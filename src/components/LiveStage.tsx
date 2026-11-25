import React, { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Check,
  Copy,
  HelpCircle,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import type {
  EverydayTopic,
  SessionConfig,
  SessionStatus,
  TranscriptTurn,
} from '../types/tutor';
import { SPEECH_PACES } from '../data/topics';
import { VoiceVisualizer } from './VoiceVisualizer';

interface LiveStageProps {
  config: SessionConfig;
  activeTopic: EverydayTopic;
  status: SessionStatus;
  errorMessage: string | null;
  elapsedSeconds: number;
  isMuted: boolean;
  turns: TranscriptTurn[];
  micLevelRef: React.MutableRefObject<number>;
  tutorLevelRef: React.MutableRefObject<number>;
  onStartSession: () => void;
  onToggleMute: () => void;
  onSendTextMessage: (text: string) => void;
  onOpenTopics: () => void;
  onSpeakEnglishText: (text: string) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const LiveStage: React.FC<LiveStageProps> = ({
  config,
  activeTopic,
  status,
  errorMessage,
  elapsedSeconds,
  isMuted,
  turns,
  micLevelRef,
  tutorLevelRef,
  onStartSession,
  onToggleMute,
  onSendTextMessage,
  onOpenTopics,
  onSpeakEnglishText,
}) => {
  const [showTextBox, setShowTextBox] = useState(false);
  const [showBlankRescue, setShowBlankRescue] = useState(false);
  const [showTranscribeBox, setShowTranscribeBox] = useState(false);

  const [draftText, setDraftText] = useState('');
  const [spanishIdea, setSpanishIdea] = useState('');

  const [isRecordingClip, setIsRecordingClip] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const isLive =
    status === 'connecting' ||
    status === 'listening' ||
    status === 'speaking' ||
    status === 'muted';

  const paceLabel =
    SPEECH_PACES.find((p) => p.value === config.pace)?.label ?? 'Adaptable';

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    return () => {
      if (recorderStreamRef.current) {
        recorderStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftText.trim();
    if (!trimmed) return;
    onSendTextMessage(trimmed);
    setDraftText('');
  };

  const handleSubmitBlankRescue = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = spanishIdea.trim();
    const prompt = trimmed
      ? `Me quedé en blanco y quiero ayuda en español. ¿Cómo se dice en inglés: "${trimmed}"? Tradúcemelo y pídeme que lo repita.`
      : 'Me quedé en blanco y necesito ayuda en español para responder a tu última pregunta. Dame una frase útil en inglés y pídeme que la repita.';
    onSendTextMessage(prompt);
    setSpanishIdea('');
    setShowBlankRescue(false);
  };

  const startClipRecording = async () => {
    setTranscribeError(null);
    setShowTranscribeBox(true);
    setShowBlankRescue(false);
    setShowTextBox(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      recordedChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recorderStreamRef.current = null;
        setIsRecordingClip(false);

        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (blob.size < 100) {
          setTranscribeError('La grabación fue demasiado corta. Inténtalo de nuevo.');
          return;
        }

        setIsTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = typeof reader.result === 'string' ? reader.result : '';
              const commaIdx = result.indexOf(',');
              resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
            };
            reader.onerror = () => reject(new Error('No se pudo leer el audio.'));
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType: blob.type || 'audio/webm',
            }),
          });

          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) {
            setTranscribeError(data.error || 'No se pudo transcribir el audio.');
          } else {
            setTranscribedText(data.text || '');
            if (!data.text) {
              setTranscribeError('No se detectó voz clara en la grabación.');
            }
          }
        } catch {
          setTranscribeError('Error de red al transcribir el audio.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecordingClip(true);
    } catch {
      setTranscribeError(
        'Permite el acceso al micrófono para grabar y transcribir tu voz.'
      );
    }
  };

  const stopClipRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const handleCopyTranscription = async () => {
    if (!transcribedText) return;
    try {
      await navigator.clipboard.writeText(transcribedText);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section
      aria-label="Escenario de conversación por voz"
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            {activeTopic.labelEs}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Nivel {config.level}</span>
            <span aria-hidden="true">·</span>
            <span>Ritmo {paceLabel.toLowerCase()}</span>
            <span aria-hidden="true">·</span>
            <span>Voz {config.voiceName}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onOpenTopics}
              className="font-medium text-[#1D4ED8] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
            >
              Cambiar tema
            </button>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Duración</div>
          <div className="font-mono text-lg font-medium text-slate-900 tabular-nums">
            {formatDuration(elapsedSeconds)}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <VoiceVisualizer
          status={status}
          micLevelRef={micLevelRef}
          tutorLevelRef={tutorLevelRef}
          errorMessage={errorMessage}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isLive && (
          <>
            <button
              type="button"
              onClick={onToggleMute}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                isMuted
                  ? 'border-[#D97706] bg-amber-50 text-[#B45309] hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {isMuted ? (
                <>
                  <MicOff className="h-4 w-4" aria-hidden="true" />
                  <span>Activar micrófono</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  <span>Silenciar micrófono</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowBlankRescue((prev) => !prev);
                setShowTextBox(false);
                setShowTranscribeBox(false);
              }}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                showBlankRescue
                  ? 'border-[#1D4ED8] bg-blue-50 text-[#1D4ED8]'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              <span>Me quedé en blanco</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowTextBox((prev) => !prev);
                setShowBlankRescue(false);
                setShowTranscribeBox(false);
              }}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                showTextBox
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Keyboard className="h-4 w-4" aria-hidden="true" />
              <span>Escribir mensaje</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            if (isRecordingClip) {
              stopClipRecording();
            } else {
              setShowTranscribeBox((prev) => !prev);
              setShowBlankRescue(false);
              setShowTextBox(false);
            }
          }}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
            isRecordingClip
              ? 'border-[#DC2626] bg-red-50 text-[#DC2626] hover:bg-red-100'
              : showTranscribeBox
                ? 'border-[#1D4ED8] bg-blue-50 text-[#1D4ED8]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isRecordingClip ? (
            <>
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span>Detener grabación</span>
            </>
          ) : (
            <>
              <AudioLines className="h-4 w-4" aria-hidden="true" />
              <span>Transcribir audio</span>
            </>
          )}
        </button>
      </div>

      {showTranscribeBox && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Transcripción de voz por micrófono
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Graba una frase en inglés o español para revisar exactamente cómo se transcribe antes o durante tu charla.
              </p>
            </div>
            <button
              type="button"
              disabled={isTranscribing}
              onClick={isRecordingClip ? stopClipRecording : startClipRecording}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 ${
                isRecordingClip
                  ? 'bg-[#DC2626] text-white hover:bg-red-700'
                  : 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
              }`}
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Transcribiendo...</span>
                </>
              ) : isRecordingClip ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>Detener y transcribir</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  <span>Grabar audio</span>
                </>
              )}
            </button>
          </div>

          {transcribeError && (
            <p className="mt-3 text-xs font-medium text-[#DC2626]">
              {transcribeError}
            </p>
          )}

          {transcribedText && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3.5">
              <div className="text-xs font-medium text-slate-500">
                Texto transcrito
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-900">
                {transcribedText}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTranscription}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copiedTranscript ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onSpeakEnglishText(transcribedText)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Escuchar en inglés</span>
                </button>
                {isLive && (
                  <button
                    type="button"
                    onClick={() => {
                      onSendTextMessage(transcribedText);
                      setShowTranscribeBox(false);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Enviar al profesor</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isLive && showBlankRescue && (
        <form
          onSubmit={handleSubmitBlankRescue}
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Ayuda rápida en español
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Escribe lo que quieres expresar (o déjalo vacío para pedir una pista). El profesor te lo traducirá y te pedirá repetirlo.
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={spanishIdea}
              onChange={(e) => setSpanishIdea(e.target.value)}
              placeholder="Ej: Quiero decir que ayer me quedé atrapado en el tráfico..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-[#1E40AF]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Pedir traducción</span>
            </button>
          </div>
        </form>
      )}

      {isLive && showTextBox && (
        <form
          onSubmit={handleSubmitText}
          className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row"
        >
          <input
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Escribe en inglés o pide ayuda en español..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-800"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>Enviar</span>
          </button>
        </form>
      )}

      <div className="mt-5 flex-1">
        {turns.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6">
            <h2 className="font-display text-lg font-semibold text-slate-900 text-balance">
              Tu profesor particular te espera en línea
            </h2>
            <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-slate-600">
              Al comenzar, tu tutor te saludará directamente en inglés y guiará la charla a tu ritmo ({config.level}). Puedes hablar libremente o pedir ayuda en español cuando te quedes en blanco.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">01. Una pregunta cada vez</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  Conversación enfocada en temas cotidianos sin agobiarte con varias preguntas juntas.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">02. Corrección breve</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  Corrige tus errores en una frase corta antes de responder y anotarlo en tu cuaderno.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">03. Vocabulario al cierre</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  Extrae palabras nuevas en vivo y presenta la lista final con definición y ejemplo en inglés.
                </p>
              </div>
            </div>

            {!isLive && (
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onStartSession}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-6 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  <span>Iniciar clase por voz</span>
                </button>
                <span className="text-xs text-slate-500">
                  Ejemplo inicial: “{activeTopic.sampleQuestionEn}”
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-1">
            {turns.map((turn) => {
              const isTutor = turn.speaker === 'tutor';
              return (
                <div
                  key={turn.id}
                  className={`flex flex-col ${isTutor ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl border px-4 py-3 ${
                      isTutor
                        ? 'border-slate-200 bg-[#F8FAFC] text-slate-900'
                        : 'border-[#1D4ED8]/20 bg-[#1D4ED8]/5 text-slate-900'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {isTutor ? 'Profesor' : 'Tú'}
                      </span>
                      <div className="flex items-center gap-2">
                        {isTutor && turn.isFinal && (
                          <button
                            type="button"
                            onClick={() => onSpeakEnglishText(turn.text)}
                            title="Escuchar pronunciación"
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
                          >
                            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {new Date(turn.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <p className="text-[15px] leading-relaxed text-slate-800">
                      {turn.text}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
    </section>
  );
};
