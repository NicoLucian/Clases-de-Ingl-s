import React, { useState } from 'react';
import { BookOpen, Check, Copy, Trash2, Volume2 } from 'lucide-react';
import type { CompletedSession } from '../types/tutor';

interface NotebookViewProps {
  sessions: CompletedSession[];
  onPronounceWord: (word: string) => void;
  onDeleteSession: (id: string) => void;
  onStartNewSession: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export const NotebookView: React.FC<NotebookViewProps> = ({
  sessions,
  onPronounceWord,
  onDeleteSession,
  onStartNewSession,
}) => {
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  const handleCopyVocabulary = async (session: CompletedSession) => {
    const lines = session.vocabulary.map(
      (v, i) =>
        `${i + 1}. ${v.word} (${v.partOfSpeech}) — ${v.definitionEn}\n   Example: ${v.exampleEn}`
    );
    const text = `Vocabulary — ${session.topicLabelEs} (${session.level})\n\n${lines.join('\n\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSessionId(session.id);
      setTimeout(() => setCopiedSessionId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const totalWords = sessions.reduce((acc, s) => acc + s.vocabulary.length, 0);

  return (
    <section aria-label="Cuaderno de vocabulario y sesiones" className="mx-auto max-w-[1320px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
            Cuaderno de vocabulario
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Historial de sesiones finalizadas con todas las palabras nuevas, definiciones y ejemplos en inglés.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="tabular-nums">{sessions.length} sesiones guardadas</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{totalWords} palabras registradas</span>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 font-display text-xl font-semibold text-slate-900">
            Aún no hay sesiones guardadas
          </h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-slate-600">
            Cuando termines una clase por voz, se generará automáticamente tu lista completa de vocabulario con definiciones y oraciones de ejemplo en inglés.
          </p>
          <button
            type="button"
            onClick={onStartNewSession}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[#1D4ED8] px-5 text-sm font-medium text-white hover:bg-[#1E40AF]"
          >
            Ir a la sesión en vivo
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sessions.map((session) => (
            <article
              key={session.id}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-slate-900">
                    {session.topicLabelEs}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      {new Date(session.endedAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Nivel {session.level}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatDuration(session.durationSeconds)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {session.vocabulary.length} palabras
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {session.vocabulary.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopyVocabulary(session)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {copiedSessionId === session.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copiar lista</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    aria-label="Eliminar sesión del cuaderno"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {session.vocabulary.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No se registraron palabras nuevas en esta sesión breve.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                        <th className="py-2.5 pr-4">Palabra / Expresión</th>
                        <th className="py-2.5 pr-4">Definición en inglés</th>
                        <th className="py-2.5">Oración de ejemplo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {session.vocabulary.map((word) => (
                        <tr key={word.id} className="align-top">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {word.word}
                              </span>
                              <button
                                type="button"
                                onClick={() => onPronounceWord(word.word)}
                                title={`Escuchar ${word.word}`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {word.partOfSpeech} · {word.levelTag}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-slate-700 leading-relaxed">
                            {word.definitionEn}
                          </td>
                          <td className="py-3 italic text-slate-600 leading-relaxed">
                            “{word.exampleEn}”
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
