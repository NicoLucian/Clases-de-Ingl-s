import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Search,
} from 'lucide-react';
import { EVERYDAY_TOPICS } from '../data/topics';
import type { GroundedTopicResult } from '../types/tutor';

interface TopicsViewProps {
  selectedTopicId: string;
  isLive: boolean;
  groundedTopic: GroundedTopicResult | null;
  isSearchingTopic: boolean;
  searchError: string | null;
  onSelectTopic: (topicId: string, startImmediately?: boolean) => void;
  onSearchGroundedTopic: (query: string) => void;
  onUseGroundedTopicInChat: (topic: GroundedTopicResult) => void;
}

export const TopicsView: React.FC<TopicsViewProps> = ({
  selectedTopicId,
  isLive,
  groundedTopic,
  isSearchingTopic,
  searchError,
  onSelectTopic,
  onSearchGroundedTopic,
  onUseGroundedTopicInChat,
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearchGroundedTopic(query.trim());
  };

  return (
    <section aria-label="Temas cotidianos de conversación" className="mx-auto max-w-[1320px]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 text-balance">
          Temas cotidianos para practicar
        </h1>
        <p className="mt-2 max-w-[65ch] text-base leading-relaxed text-slate-600">
          Elige una situación diaria para guiar las preguntas de tu profesor o busca un tema de actualidad con Google Search.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Globe className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              <span>Tema de actualidad con Google Search</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Busca noticias recientes, estrenos, eventos deportivos o tendencias reales para conversar en inglés sobre lo que pasa hoy.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: Últimas noticias de inteligencia artificial, clima actual en Madrid, resultados deportivos..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearchingTopic}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-5 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-[#1E40AF] disabled:opacity-60"
          >
            {isSearchingTopic ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Buscar actualidad</span>
              </>
            )}
          </button>
        </form>

        {searchError && (
          <p className="mt-3 text-xs font-medium text-[#DC2626]">{searchError}</p>
        )}

        {groundedTopic && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-[75ch]">
                <div className="text-xs font-medium text-slate-500">
                  Tema consultado: {groundedTopic.query}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
                  {groundedTopic.summaryEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUseGroundedTopicInChat(groundedTopic)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-800"
              >
                <span>{isLive ? 'Llevar a la clase' : 'Practicar este tema'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {groundedTopic.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 text-xs">
                <span className="font-medium text-slate-500">Fuentes:</span>
                {groundedTopic.sources.slice(0, 4).map((src) => (
                  <a
                    key={src.uri}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#1D4ED8] hover:underline"
                  >
                    <span className="max-w-[200px] truncate">{src.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {EVERYDAY_TOPICS.map((topic) => {
          const isSelected = topic.id === selectedTopicId;
          return (
            <div
              key={topic.id}
              className={`flex flex-col justify-between rounded-2xl border p-6 transition-colors ${
                isSelected
                  ? 'border-[#1D4ED8] bg-white'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    {topic.labelEn}
                  </span>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8]">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Activo</span>
                    </span>
                  )}
                </div>

                <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">
                  {topic.labelEs}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {topic.descriptionEs}
                </p>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-medium text-slate-400">
                    Pregunta ejemplo
                  </div>
                  <p className="mt-1 text-xs italic leading-relaxed text-slate-700">
                    “{topic.sampleQuestionEn}”
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => onSelectTopic(topic.id, !isLive)}
                  className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100'
                      : 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
                  }`}
                >
                  <span>
                    {isLive
                      ? isSelected
                        ? 'Volver a la sesión'
                        : 'Cambiar a este tema'
                      : 'Practicar este tema'}
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
