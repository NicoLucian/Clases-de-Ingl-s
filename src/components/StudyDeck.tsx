import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  Volume2,
} from 'lucide-react';
import { CEFR_LEVELS, SPEECH_PACES, TUTOR_VOICES } from '../data/topics';
import type {
  CefrLevel,
  CorrectionItem,
  GroundedTopicResult,
  SessionConfig,
  SpeechPace,
  TutorVoice,
  VocabularyEntry,
} from '../types/tutor';

interface StudyDeckProps {
  config: SessionConfig;
  isLive: boolean;
  vocabulary: VocabularyEntry[];
  corrections: CorrectionItem[];
  groundedTopic: GroundedTopicResult | null;
  isSearchingTopic: boolean;
  searchError: string | null;
  onChangeLevel: (level: CefrLevel) => void;
  onChangePace: (pace: SpeechPace) => void;
  onChangeVoice: (voice: TutorVoice) => void;
  onPronounceWord: (word: string) => void;
  onSearchGroundedTopic: (query: string) => void;
  onUseGroundedTopicInChat: (topic: GroundedTopicResult) => void;
}

const QUICK_SEARCH_PROMPTS = [
  'Current global technology news',
  'Popular new movies this month',
  'Weather and seasonal trends today',
];

export const StudyDeck: React.FC<StudyDeckProps> = ({
  config,
  isLive,
  vocabulary,
  corrections,
  groundedTopic,
  isSearchingTopic,
  searchError,
  onChangeLevel,
  onChangePace,
  onChangeVoice,
  onPronounceWord,
  onSearchGroundedTopic,
  onUseGroundedTopicInChat,
}) => {
  const [notesTab, setNotesTab] = useState<'vocab' | 'corrections' | 'search'>('vocab');
  const [searchQuery, setSearchQuery] = useState('');

  const activeLevelInfo = CEFR_LEVELS.find((l) => l.value === config.level);
  const activePaceInfo = SPEECH_PACES.find((p) => p.value === config.pace);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onSearchGroundedTopic(searchQuery.trim());
  };

  return (
    <aside
      aria-label="Ajustes y notas de la sesión"
      className="flex flex-col gap-5"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Ajustes de clase
        </h2>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Nivel de inglés</span>
            <span className="font-mono text-slate-900 tabular-nums">{config.level}</span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1 rounded-lg bg-slate-100 p-1">
            {CEFR_LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                type="button"
                onClick={() => onChangeLevel(lvl.value)}
                className={`min-h-[36px] rounded-md px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#1D4ED8] ${
                  config.level === lvl.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl.value}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {activeLevelInfo?.label} — {activeLevelInfo?.shortDesc}
          </p>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="text-xs font-medium text-slate-600">Velocidad del profesor</div>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            {SPEECH_PACES.map((pace) => (
              <button
                key={pace.value}
                type="button"
                onClick={() => onChangePace(pace.value)}
                className={`min-h-[36px] rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#1D4ED8] ${
                  config.pace === pace.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pace.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{activePaceInfo?.description}</p>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <label
            htmlFor="tutor-voice-select"
            className="block text-xs font-medium text-slate-600"
          >
            Voz del profesor
          </label>
          <select
            id="tutor-voice-select"
            value={config.voiceName}
            disabled={isLive}
            onChange={(e) => onChangeVoice(e.target.value as TutorVoice)}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          >
            {TUTOR_VOICES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label} — {v.tone}
              </option>
            ))}
          </select>
          {isLive && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Para cambiar de voz, finaliza primero la sesión actual.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Notas en vivo
          </h2>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setNotesTab('vocab')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                notesTab === 'vocab'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vocabulario ({vocabulary.length})
            </button>
            <button
              type="button"
              onClick={() => setNotesTab('corrections')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                notesTab === 'corrections'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Correcciones ({corrections.length})
            </button>
            <button
              type="button"
              onClick={() => setNotesTab('search')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                notesTab === 'search'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Actualidad
            </button>
          </div>
        </div>

        <div className="mt-4 max-h-[400px] flex-1 overflow-y-auto pr-1">
          {notesTab === 'vocab' &&
            (vocabulary.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                <BookOpen className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-slate-700">
                  Sin palabras nuevas todavía
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  A medida que converses, aparecerán aquí las palabras y expresiones nuevas para tu repaso final.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {vocabulary.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-slate-900">
                          {item.word}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {item.partOfSpeech} · {item.levelTag}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPronounceWord(item.word)}
                        title={`Pronunciar ${item.word}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
                      >
                        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                      {item.definitionEn}
                    </p>
                    <p className="mt-1.5 text-xs italic leading-relaxed text-slate-500">
                      “{item.exampleEn}”
                    </p>
                  </div>
                ))}
              </div>
            ))}

          {notesTab === 'corrections' &&
            (corrections.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                <CheckCircle2 className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-slate-700">
                  Sin correcciones registradas
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Cuando el profesor corrija una frase o te traduzca algo del español, quedará guardado aquí.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {corrections.map((corr) => (
                  <div
                    key={corr.id}
                    className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5"
                  >
                    {corr.originalPhrase && (
                      <div className="text-xs text-slate-500">
                        <span className="font-medium text-slate-600">Dijiste: </span>
                        <span className="line-through">{corr.originalPhrase}</span>
                      </div>
                    )}
                    <div className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-[#059669]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{corr.correctedPhrase}</span>
                    </div>
                    {corr.explanationEs && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                        {corr.explanationEs}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {notesTab === 'search' && (
            <div className="flex flex-col gap-3">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej: Noticias de hoy, clima en Londres..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSearchingTopic}
                  aria-label="Buscar en Google Search"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 text-xs font-medium text-white hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  {isSearchingTopic ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Buscar</span>
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_SEARCH_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={isSearchingTopic}
                    onClick={() => {
                      setSearchQuery(q);
                      onSearchGroundedTopic(q);
                    }}
                    className="rounded-md border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {searchError && (
                <p className="text-xs font-medium text-[#DC2626]">{searchError}</p>
              )}

              {groundedTopic ? (
                <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Globe className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                    <span>Contexto actualizado</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-800">
                    {groundedTopic.summaryEn}
                  </p>

                  {groundedTopic.sources.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-2.5">
                      <div className="text-[11px] font-medium text-slate-500">
                        Fuentes verificadas
                      </div>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {groundedTopic.sources.slice(0, 4).map((src) => (
                          <li key={src.uri}>
                            <a
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[#1D4ED8] hover:underline"
                            >
                              <span className="truncate max-w-[230px]">{src.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onUseGroundedTopicInChat(groundedTopic)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    <span>
                      {isLive ? 'Hablar de esto ahora' : 'Iniciar clase sobre este tema'}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                  <Globe className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Conversa sobre actualidad real
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Consulta noticias o datos recientes con Google Search para practicar inglés hablando de temas reales de hoy.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
