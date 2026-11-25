import React, { useState } from 'react';
import { BookOpen, Check, CheckCircle2, Copy, Volume2, X } from 'lucide-react';
import type { CompletedSession } from '../types/tutor';

interface SessionSummaryModalProps {
  session: CompletedSession | null;
  onClose: () => void;
  onOpenNotebook: () => void;
  onPronounceWord: (word: string) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  session,
  onClose,
  onOpenNotebook,
  onPronounceWord,
}) => {
  const [copied, setCopied] = useState(false);

  if (!session) return null;

  const handleCopyAll = async () => {
    const lines = session.vocabulary.map(
      (v, idx) =>
        `${idx + 1}. ${v.word} (${v.partOfSpeech})\n   Definition: ${v.definitionEn}\n   Example: ${v.exampleEn}`
    );
    const payload = `Session Vocabulary — ${session.topicLabelEs} (${session.level})\n\n${lines.join('\n\n')}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2
              id="session-summary-title"
              className="font-display text-2xl font-semibold text-slate-900"
            >
              Vocabulario de tu sesión
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{session.topicLabelEs}</span>
              <span aria-hidden="true">·</span>
              <span>Nivel {session.level}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {formatDuration(session.durationSeconds)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {session.vocabulary.length} palabras nuevas
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar resumen"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {session.vocabulary.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-slate-800">
                La conversación fue demasiado breve para extraer vocabulario nuevo
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Habla unos turnos en inglés con tu profesor para generar tu glosario con definiciones y ejemplos al finalizar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {session.vocabulary.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-base font-semibold text-slate-900">
                        {entry.word}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {entry.partOfSpeech} · {entry.levelTag}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPronounceWord(entry.word)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Escuchar</span>
                    </button>
                  </div>

                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500">
                        Definition
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-800">
                        {entry.definitionEn}
                      </p>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500">
                        Example sentence
                      </div>
                      <p className="mt-0.5 text-sm italic leading-relaxed text-slate-700">
                        “{entry.exampleEn}”
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {session.corrections.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Correcciones repasadas en esta clase ({session.corrections.length})
              </h3>
              <div className="mt-3 flex flex-col gap-2.5">
                {session.corrections.map((corr) => (
                  <div
                    key={corr.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5"
                  >
                    {corr.originalPhrase && (
                      <div className="text-xs text-slate-500">
                        <span className="line-through">{corr.originalPhrase}</span>
                      </div>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-[#059669]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{corr.correctedPhrase}</span>
                    </div>
                    {corr.explanationEs && (
                      <p className="mt-1 text-xs text-slate-600">{corr.explanationEs}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#F8FAFC] px-6 py-4">
          <button
            type="button"
            disabled={session.vocabulary.length === 0}
            onClick={handleCopyAll}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-[#059669]" aria-hidden="true" />
                <span>Lista copiada</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Copiar lista</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenNotebook}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Ver en Cuaderno
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1D4ED8] px-5 text-sm font-medium text-white hover:bg-[#1E40AF]"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
