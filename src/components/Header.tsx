import React from 'react';
import type { ActiveTab, SessionStatus } from '../types/tutor';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  sessionStatus: SessionStatus;
  isFinalizingSession: boolean;
  onToggleSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  sessionStatus,
  isFinalizingSession,
  onToggleSession,
}) => {
  const isLive =
    sessionStatus === 'connecting' ||
    sessionStatus === 'listening' ||
    sessionStatus === 'speaking' ||
    sessionStatus === 'muted';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-8 px-6 py-3.5">
        <button
          type="button"
          onClick={() => onSelectTab('live')}
          className="font-display text-xl font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8]"
        >
          Fluentia
        </button>

        <nav aria-label="Navegación principal" className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onSelectTab('live')}
            className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8] ${
              activeTab === 'live'
                ? 'border-b-2 border-[#1D4ED8] text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sesión en vivo
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('topics')}
            className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8] ${
              activeTab === 'topics'
                ? 'border-b-2 border-[#1D4ED8] text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Temas
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('notebook')}
            className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8] ${
              activeTab === 'notebook'
                ? 'border-b-2 border-[#1D4ED8] text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cuaderno
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            disabled={isFinalizingSession}
            onClick={onToggleSession}
            className={`inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 ${
              isLive
                ? 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                : 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
            }`}
          >
            {isFinalizingSession
              ? 'Preparando lista...'
              : isLive
                ? 'Finalizar clase'
                : 'Iniciar clase'}
          </button>
        </div>
      </div>
    </header>
  );
};
