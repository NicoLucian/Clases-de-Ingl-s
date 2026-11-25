import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { LiveStage } from './components/LiveStage';
import { NotebookView } from './components/NotebookView';
import { SessionSummaryModal } from './components/SessionSummaryModal';
import { StudyDeck } from './components/StudyDeck';
import { TopicsView } from './components/TopicsView';
import { EVERYDAY_TOPICS } from './data/topics';
import type {
  ActiveTab,
  CefrLevel,
  CompletedSession,
  CorrectionItem,
  GroundedTopicResult,
  SessionConfig,
  SessionStatus,
  SpeechPace,
  TranscriptTurn,
  TutorVoice,
  VocabularyEntry,
} from './types/tutor';
import {
  computeRmsLevel,
  decodePcm24kToFloat32,
  downsampleAndEncodePcm16,
} from './utils/audio';

const STORAGE_KEY = 'fluentia_saved_sessions_v1';

function loadSavedSessions(): CompletedSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [config, setConfig] = useState<SessionConfig>({
    level: 'B1',
    pace: 'adaptive',
    voiceName: 'Zephyr',
    topicId: 'free',
  });

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFinalizingSession, setIsFinalizingSession] = useState(false);

  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [savedSessions, setSavedSessions] = useState<CompletedSession[]>(() =>
    loadSavedSessions()
  );
  const [summarySession, setSummarySession] = useState<CompletedSession | null>(null);

  const [groundedTopic, setGroundedTopic] = useState<GroundedTopicResult | null>(null);
  const [isSearchingTopic, setIsSearchingTopic] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const isMutedRef = useRef(false);
  const micLevelRef = useRef(0);
  const tutorLevelRef = useRef(0);
  const sessionStartedAtRef = useRef<number>(0);
  const statusRef = useRef<SessionStatus>('idle');

  const turnsRef = useRef<TranscriptTurn[]>([]);
  const vocabularyRef = useRef<VocabularyEntry[]>([]);
  const correctionsRef = useRef<CorrectionItem[]>([]);
  const configRef = useRef<SessionConfig>(config);
  const pendingGroundedTopicRef = useRef<GroundedTopicResult | null>(null);

  const currentStudentTurnIdRef = useRef<string | null>(null);
  const currentTutorTurnIdRef = useRef<string | null>(null);
  const pendingStudentTextRef = useRef<string>('');
  const pendingTutorTextRef = useRef<string>('');

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    vocabularyRef.current = vocabulary;
  }, [vocabulary]);

  useEffect(() => {
    correctionsRef.current = corrections;
  }, [corrections]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSessions));
    } catch {
      // ignore storage quota errors
    }
  }, [savedSessions]);

  const isLive =
    status === 'connecting' ||
    status === 'listening' ||
    status === 'speaking' ||
    status === 'muted';

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      if (sessionStartedAtRef.current > 0) {
        setElapsedSeconds(
          Math.floor((Date.now() - sessionStartedAtRef.current) / 1000)
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const stopPlaybackQueue = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current.clear();
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    tutorLevelRef.current = 0;
  }, []);

  const cleanupAudioAndSocket = useCallback(() => {
    stopPlaybackQueue();

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    micLevelRef.current = 0;
    tutorLevelRef.current = 0;
  }, [stopPlaybackQueue]);

  useEffect(() => {
    return () => {
      cleanupAudioAndSocket();
    };
  }, [cleanupAudioAndSocket]);

  const pronounceEnglishText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }, []);

  const analyzeCompletedTurn = useCallback(
    async (studentText: string, tutorText: string) => {
      if (!tutorText.trim()) return;
      try {
        const existingWords = vocabularyRef.current.map((v) => v.word);
        const res = await fetch('/api/analyze-turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentText,
            tutorText,
            level: configRef.current.level,
            existingWords,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          correction?: {
            originalPhrase: string;
            correctedPhrase: string;
            explanationEs: string;
          } | null;
          vocabulary?: Array<{
            word: string;
            partOfSpeech: string;
            definitionEn: string;
            exampleEn: string;
            levelTag: string;
          }>;
        };

        if (data.correction && data.correction.correctedPhrase) {
          const newCorrection: CorrectionItem = {
            id: `corr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            originalPhrase: data.correction.originalPhrase,
            correctedPhrase: data.correction.correctedPhrase,
            explanationEs: data.correction.explanationEs,
            timestamp: Date.now(),
          };
          setCorrections((prev) => [newCorrection, ...prev]);
        }

        if (Array.isArray(data.vocabulary) && data.vocabulary.length > 0) {
          setVocabulary((prev) => {
            const seen = new Set(prev.map((item) => item.word.toLowerCase()));
            const additions: VocabularyEntry[] = [];
            for (const item of data.vocabulary!) {
              const key = item.word.trim().toLowerCase();
              if (!key || seen.has(key)) continue;
              seen.add(key);
              additions.push({
                id: `voc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                word: item.word.trim(),
                partOfSpeech: item.partOfSpeech || 'expression',
                definitionEn: item.definitionEn,
                exampleEn: item.exampleEn,
                levelTag: item.levelTag || configRef.current.level,
                timestamp: Date.now(),
              });
            }
            return [...prev, ...additions];
          });
        }
      } catch {
        // Non-blocking background enhancement
      }
    },
    []
  );

  const schedulePlaybackChunk = useCallback((base64Pcm: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const float32 = decodePcm24kToFloat32(base64Pcm);
    if (float32.length === 0) return;

    tutorLevelRef.current = computeRmsLevel(float32);

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.02;
    }

    const startTime = nextStartTimeRef.current;
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    if (statusRef.current !== 'muted') {
      setStatus('speaking');
    }

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        tutorLevelRef.current = 0;
        if (
          statusRef.current === 'speaking' ||
          statusRef.current === 'listening'
        ) {
          setStatus(isMutedRef.current ? 'muted' : 'listening');
        }
      }
    };
  }, []);

  const appendTranscriptDelta = useCallback(
    (speaker: 'student' | 'tutor', delta: string) => {
      const cleaned = delta;
      if (!cleaned) return;

      if (speaker === 'student') {
        pendingStudentTextRef.current += cleaned;
        const targetId =
          currentStudentTurnIdRef.current ??
          `turn_s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        currentStudentTurnIdRef.current = targetId;

        setTurns((prev) => {
          const exists = prev.some((t) => t.id === targetId);
          if (exists) {
            return prev.map((t) =>
              t.id === targetId ? { ...t, text: t.text + cleaned } : t
            );
          }
          return [
            ...prev,
            {
              id: targetId,
              speaker: 'student',
              text: cleaned.trimStart(),
              timestamp: Date.now(),
              isFinal: false,
            },
          ];
        });
      } else {
        pendingTutorTextRef.current += cleaned;
        const targetId =
          currentTutorTurnIdRef.current ??
          `turn_t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        currentTutorTurnIdRef.current = targetId;

        setTurns((prev) => {
          const exists = prev.some((t) => t.id === targetId);
          if (exists) {
            return prev.map((t) =>
              t.id === targetId ? { ...t, text: t.text + cleaned } : t
            );
          }
          return [
            ...prev,
            {
              id: targetId,
              speaker: 'tutor',
              text: cleaned.trimStart(),
              timestamp: Date.now(),
              isFinal: false,
            },
          ];
        });
      }
    },
    []
  );

  const startSession = useCallback(async () => {
    if (isLive || isFinalizingSession) return;

    setActiveTab('live');
    setErrorMessage(null);
    setTurns([]);
    setVocabulary([]);
    setCorrections([]);
    setElapsedSeconds(0);
    setIsMuted(false);
    isMutedRef.current = false;
    currentStudentTurnIdRef.current = null;
    currentTutorTurnIdRef.current = null;
    pendingStudentTextRef.current = '';
    pendingTutorTextRef.current = '';
    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        level: configRef.current.level,
        pace: configRef.current.pace,
        voice: configRef.current.voiceName,
        topicId: configRef.current.topicId,
      });

      const ws = new WebSocket(`${protocol}//${window.location.host}/live?${params.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        sessionStartedAtRef.current = Date.now();
        setStatus('listening');

        if (pendingGroundedTopicRef.current) {
          const gt = pendingGroundedTopicRef.current;
          pendingGroundedTopicRef.current = null;
          ws.send(
            JSON.stringify({
              type: 'groundedTopic',
              groundedQuery: gt.query,
              groundedSummary: gt.summaryEn,
            })
          );
        }

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) {
            micLevelRef.current = 0;
            return;
          }
          const channelData = event.inputBuffer.getChannelData(0);
          micLevelRef.current = computeRmsLevel(channelData);
          const base64Pcm = downsampleAndEncodePcm16(
            channelData,
            inputCtx.sampleRate,
            16000
          );
          ws.send(JSON.stringify({ type: 'audio', data: base64Pcm }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type?: string;
            data?: string;
            text?: string;
            message?: string;
          };

          if (msg.type === 'audio' && msg.data) {
            schedulePlaybackChunk(msg.data);
          } else if (msg.type === 'inputTranscript' && msg.text) {
            appendTranscriptDelta('student', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            appendTranscriptDelta('tutor', msg.text);
          } else if (msg.type === 'interrupted') {
            stopPlaybackQueue();
            setStatus(isMutedRef.current ? 'muted' : 'listening');
          } else if (msg.type === 'turnComplete') {
            const completedStudentId = currentStudentTurnIdRef.current;
            const completedTutorId = currentTutorTurnIdRef.current;
            const studentTxt = pendingStudentTextRef.current.trim();
            const tutorTxt = pendingTutorTextRef.current.trim();

            if (completedStudentId || completedTutorId) {
              setTurns((prev) =>
                prev.map((t) =>
                  t.id === completedStudentId || t.id === completedTutorId
                    ? { ...t, isFinal: true }
                    : t
                )
              );
            }

            currentStudentTurnIdRef.current = null;
            currentTutorTurnIdRef.current = null;
            pendingStudentTextRef.current = '';
            pendingTutorTextRef.current = '';

            if (tutorTxt) {
              void analyzeCompletedTurn(studentTxt, tutorTxt);
            }
          } else if (msg.type === 'error') {
            setErrorMessage(
              msg.message || 'Ocurrió un error en la sesión de voz.'
            );
            setStatus('error');
            cleanupAudioAndSocket();
          }
        } catch {
          // ignore malformed event
        }
      };

      ws.onerror = () => {
        setErrorMessage('No se pudo conectar con el servidor de audio.');
        setStatus('error');
        cleanupAudioAndSocket();
      };

      ws.onclose = () => {
        if (
          statusRef.current !== 'idle' &&
          statusRef.current !== 'error'
        ) {
          cleanupAudioAndSocket();
          setStatus('idle');
        }
      };
    } catch (err) {
      cleanupAudioAndSocket();
      setErrorMessage(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Permite el acceso al micrófono en tu navegador para hablar con tu profesor.'
          : 'No pudimos acceder a tu micrófono.'
      );
      setStatus('error');
    }
  }, [
    analyzeCompletedTurn,
    appendTranscriptDelta,
    cleanupAudioAndSocket,
    isFinalizingSession,
    isLive,
    schedulePlaybackChunk,
    stopPlaybackQueue,
  ]);

  const finishSession = useCallback(async () => {
    const duration = sessionStartedAtRef.current
      ? Math.max(1, Math.floor((Date.now() - sessionStartedAtRef.current) / 1000))
      : elapsedSeconds;

    cleanupAudioAndSocket();
    setStatus('idle');
    setIsMuted(false);

    const capturedTurns = turnsRef.current;
    const topic =
      EVERYDAY_TOPICS.find((t) => t.id === configRef.current.topicId) ??
      EVERYDAY_TOPICS[0];

    setIsFinalizingSession(true);
    let finalVocab = vocabularyRef.current;

    if (capturedTurns.length > 0) {
      try {
        const res = await fetch('/api/session-vocab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcriptTurns: capturedTurns.map((t) => ({
              speaker: t.speaker,
              text: t.text,
            })),
            existingWords: vocabularyRef.current,
            level: configRef.current.level,
            topicLabelEn: topic.labelEn,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            vocabulary?: Array<{
              word: string;
              partOfSpeech: string;
              definitionEn: string;
              exampleEn: string;
              levelTag: string;
            }>;
          };
          if (Array.isArray(data.vocabulary) && data.vocabulary.length > 0) {
            finalVocab = data.vocabulary.map((item, idx) => ({
              id: `final_voc_${Date.now()}_${idx}`,
              word: item.word,
              partOfSpeech: item.partOfSpeech || 'expression',
              definitionEn: item.definitionEn,
              exampleEn: item.exampleEn,
              levelTag: item.levelTag || configRef.current.level,
              timestamp: Date.now(),
            }));
            setVocabulary(finalVocab);
          }
        }
      } catch {
        // Fallback to live captured vocabulary
      }
    }

    const completed: CompletedSession = {
      id: `sess_${Date.now()}`,
      startedAt: sessionStartedAtRef.current || Date.now() - duration * 1000,
      endedAt: Date.now(),
      durationSeconds: duration,
      topicId: topic.id,
      topicLabelEs: topic.labelEs,
      level: configRef.current.level,
      pace: configRef.current.pace,
      turnCount: capturedTurns.length,
      vocabulary: finalVocab,
      corrections: correctionsRef.current,
    };

    if (capturedTurns.length > 0 || finalVocab.length > 0) {
      setSavedSessions((prev) => [completed, ...prev]);
    }
    setSummarySession(completed);
    setIsFinalizingSession(false);
  }, [cleanupAudioAndSocket, elapsedSeconds]);

  const handleToggleSession = () => {
    if (isLive) {
      void finishSession();
    } else {
      void startSession();
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
    if (nextMuted) {
      setStatus('muted');
    } else {
      setStatus(activeSourcesRef.current.size > 0 ? 'speaking' : 'listening');
    }
  };

  const handleSendTextMessage = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const studentTurn: TranscriptTurn = {
      id: `turn_txt_${Date.now()}`,
      speaker: 'student',
      text,
      timestamp: Date.now(),
      isFinal: true,
    };
    setTurns((prev) => [...prev, studentTurn]);
    pendingStudentTextRef.current = text;
    wsRef.current.send(JSON.stringify({ type: 'text', text }));
  };

  const pushLiveContextUpdate = (nextConfig: SessionConfig) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'contextUpdate',
          level: nextConfig.level,
          pace: nextConfig.pace,
          topicId: nextConfig.topicId,
        })
      );
    }
  };

  const handleChangeLevel = (level: CefrLevel) => {
    const next = { ...config, level };
    setConfig(next);
    pushLiveContextUpdate(next);
  };

  const handleChangePace = (pace: SpeechPace) => {
    const next = { ...config, pace };
    setConfig(next);
    pushLiveContextUpdate(next);
  };

  const handleChangeVoice = (voiceName: TutorVoice) => {
    setConfig((prev) => ({ ...prev, voiceName }));
  };

  const handleSelectTopic = (topicId: string, startImmediately = false) => {
    const next = { ...config, topicId };
    setConfig(next);
    configRef.current = next;
    setActiveTab('live');

    if (isLive) {
      pushLiveContextUpdate(next);
    } else if (startImmediately) {
      void startSession();
    }
  };

  const handleSearchGroundedTopic = useCallback(async (query: string) => {
    setIsSearchingTopic(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          level: configRef.current.level,
        }),
      });
      const data = (await res.json()) as GroundedTopicResult & { error?: string };
      if (!res.ok) {
        setSearchError(data.error || 'No se pudo consultar Google Search.');
      } else {
        setGroundedTopic({
          query: data.query,
          summaryEn: data.summaryEn,
          sources: Array.isArray(data.sources) ? data.sources : [],
        });
      }
    } catch {
      setSearchError('Error de red al consultar datos actualizados.');
    } finally {
      setIsSearchingTopic(false);
    }
  }, []);

  const handleUseGroundedTopicInChat = useCallback(
    (topic: GroundedTopicResult) => {
      setActiveTab('live');
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'groundedTopic',
            groundedQuery: topic.query,
            groundedSummary: topic.summaryEn,
          })
        );
      } else {
        pendingGroundedTopicRef.current = topic;
        void startSession();
      }
    },
    [startSession]
  );

  const handleDeleteSession = (id: string) => {
    setSavedSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const activeTopic =
    EVERYDAY_TOPICS.find((t) => t.id === config.topicId) ?? EVERYDAY_TOPICS[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sessionStatus={status}
        isFinalizingSession={isFinalizingSession}
        onToggleSession={handleToggleSession}
      />

      <main className="mx-auto max-w-[1320px] px-6 py-8">
        {activeTab === 'live' && (
          <div className="grid items-start gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <LiveStage
                config={config}
                activeTopic={activeTopic}
                status={status}
                errorMessage={errorMessage}
                elapsedSeconds={elapsedSeconds}
                isMuted={isMuted}
                turns={turns}
                micLevelRef={micLevelRef}
                tutorLevelRef={tutorLevelRef}
                onStartSession={() => void startSession()}
                onToggleMute={handleToggleMute}
                onSendTextMessage={handleSendTextMessage}
                onOpenTopics={() => setActiveTab('topics')}
                onSpeakEnglishText={pronounceEnglishText}
              />
            </div>

            <div className="lg:col-span-4">
              <StudyDeck
                config={config}
                isLive={isLive}
                vocabulary={vocabulary}
                corrections={corrections}
                groundedTopic={groundedTopic}
                isSearchingTopic={isSearchingTopic}
                searchError={searchError}
                onChangeLevel={handleChangeLevel}
                onChangePace={handleChangePace}
                onChangeVoice={handleChangeVoice}
                onPronounceWord={pronounceEnglishText}
                onSearchGroundedTopic={(q) => void handleSearchGroundedTopic(q)}
                onUseGroundedTopicInChat={handleUseGroundedTopicInChat}
              />
            </div>
          </div>
        )}

        {activeTab === 'topics' && (
          <TopicsView
            selectedTopicId={config.topicId}
            isLive={isLive}
            groundedTopic={groundedTopic}
            isSearchingTopic={isSearchingTopic}
            searchError={searchError}
            onSelectTopic={handleSelectTopic}
            onSearchGroundedTopic={(q) => void handleSearchGroundedTopic(q)}
            onUseGroundedTopicInChat={handleUseGroundedTopicInChat}
          />
        )}

        {activeTab === 'notebook' && (
          <NotebookView
            sessions={savedSessions}
            onPronounceWord={pronounceEnglishText}
            onDeleteSession={handleDeleteSession}
            onStartNewSession={() => setActiveTab('live')}
          />
        )}
      </main>

      <SessionSummaryModal
        session={summarySession}
        onClose={() => setSummarySession(null)}
        onOpenNotebook={() => {
          setSummarySession(null);
          setActiveTab('notebook');
        }}
        onPronounceWord={pronounceEnglishText}
      />
    </div>
  );
}
