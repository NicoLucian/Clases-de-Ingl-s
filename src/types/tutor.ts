export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type SpeechPace = 'slow' | 'adaptive' | 'natural';

export type TutorVoice = 'Zephyr' | 'Puck' | 'Kore' | 'Charon' | 'Fenrir';

export type ActiveTab = 'live' | 'topics' | 'notebook';

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'muted'
  | 'error';

export interface EverydayTopic {
  id: string;
  labelEs: string;
  labelEn: string;
  descriptionEs: string;
  sampleQuestionEn: string;
  promptHintEn: string;
}

export interface TranscriptTurn {
  id: string;
  speaker: 'student' | 'tutor';
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface CorrectionItem {
  id: string;
  originalPhrase: string;
  correctedPhrase: string;
  explanationEs: string;
  timestamp: number;
}

export interface VocabularyEntry {
  id: string;
  word: string;
  partOfSpeech: string;
  definitionEn: string;
  exampleEn: string;
  levelTag: string;
  timestamp: number;
}

export interface CompletedSession {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  topicId: string;
  topicLabelEs: string;
  level: CefrLevel;
  pace: SpeechPace;
  turnCount: number;
  vocabulary: VocabularyEntry[];
  corrections: CorrectionItem[];
}

export interface SessionConfig {
  level: CefrLevel;
  pace: SpeechPace;
  voiceName: TutorVoice;
  topicId: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export interface GroundedTopicResult {
  query: string;
  summaryEn: string;
  sources: SearchSource[];
}

