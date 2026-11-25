import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, AlertCircle, Loader2, Radio } from 'lucide-react';
import type { SessionStatus } from '../types/tutor';

interface VoiceVisualizerProps {
  status: SessionStatus;
  micLevelRef: React.MutableRefObject<number>;
  tutorLevelRef: React.MutableRefObject<number>;
  errorMessage?: string | null;
}

const STATUS_META: Record<
  SessionStatus,
  { label: string; helper: string; toneClass: string }
> = {
  idle: {
    label: 'Listo para empezar',
    helper: 'Pulsa "Iniciar clase" para saludar a tu profesor en inglés.',
    toneClass: 'text-slate-700',
  },
  connecting: {
    label: 'Conectando audio...',
    helper: 'Preparando micrófono y abriendo sesión de voz.',
    toneClass: 'text-[#1D4ED8]',
  },
  listening: {
    label: 'Escuchando tu voz',
    helper: 'Habla en inglés con calma; si te trabas, pide ayuda en español.',
    toneClass: 'text-[#059669]',
  },
  speaking: {
    label: 'El profesor está hablando',
    helper: 'Puedes interrumpir en cualquier momento si quieres responder.',
    toneClass: 'text-[#1D4ED8]',
  },
  muted: {
    label: 'Micrófono silenciado',
    helper: 'Activa tu micrófono cuando estés listo para responder.',
    toneClass: 'text-[#D97706]',
  },
  error: {
    label: 'Problema de conexión o micrófono',
    helper: 'Revisa los permisos del micrófono o intenta iniciar de nuevo.',
    toneClass: 'text-[#DC2626]',
  },
};

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  status,
  micLevelRef,
  tutorLevelRef,
  errorMessage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let phase = 0;
    let smoothMic = 0;
    let smoothTutor = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const targetMic = status === 'listening' ? micLevelRef.current : 0;
      const targetTutor = status === 'speaking' ? Math.max(0.18, tutorLevelRef.current) : 0;

      smoothMic += (targetMic - smoothMic) * 0.25;
      smoothTutor += (targetTutor - smoothTutor) * 0.25;

      const barCount = 44;
      const gap = 5;
      const totalBarWidth = width - 32;
      const barWidth = Math.max(3, (totalBarWidth - gap * (barCount - 1)) / barCount);
      const startX = (width - (barWidth * barCount + gap * (barCount - 1))) / 2;
      const centerY = height / 2;

      const isActive = status === 'listening' || status === 'speaking';
      const energy = status === 'speaking' ? smoothTutor : smoothMic;

      for (let i = 0; i < barCount; i++) {
        const norm = (i / (barCount - 1)) * 2 - 1;
        const envelope = Math.exp(-norm * norm * 2.2);

        let amplitude = 4;
        if (prefersReducedMotion) {
          amplitude = isActive ? 6 + envelope * energy * (height * 0.34) : 4;
        } else if (status === 'connecting') {
          const wave = Math.sin(phase * 2.5 + i * 0.35) * 0.5 + 0.5;
          amplitude = 4 + envelope * wave * 14;
        } else if (isActive) {
          const wave =
            Math.sin(phase * 4.2 + i * 0.42) * 0.45 +
            Math.cos(phase * 2.6 - i * 0.25) * 0.35 +
            0.6;
          const activeBase = Math.max(0.1, energy);
          amplitude = 5 + envelope * activeBase * wave * (height * 0.42);
        } else {
          amplitude = 3 + envelope * 2;
        }

        const clampedHeight = Math.min(height - 12, Math.max(4, amplitude * 2));
        const x = startX + i * (barWidth + gap);
        const y = centerY - clampedHeight / 2;

        if (status === 'speaking') {
          ctx.fillStyle = '#1D4ED8';
        } else if (status === 'listening') {
          ctx.fillStyle = '#059669';
        } else if (status === 'connecting') {
          ctx.fillStyle = '#64748B';
        } else if (status === 'error') {
          ctx.fillStyle = '#FCA5A5';
        } else {
          ctx.fillStyle = '#CBD5E1';
        }

        const radius = Math.min(barWidth / 2, clampedHeight / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, clampedHeight, radius);
        ctx.fill();
      }

      ctx.restore();
      phase += 0.035;
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [status, micLevelRef, tutorLevelRef]);

  const meta = STATUS_META[status];

  const renderIcon = () => {
    switch (status) {
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />;
      case 'listening':
        return <Mic className="h-4 w-4 text-[#059669]" aria-hidden="true" />;
      case 'speaking':
        return <Volume2 className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />;
      case 'muted':
        return <MicOff className="h-4 w-4 text-[#D97706]" aria-hidden="true" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-[#DC2626]" aria-hidden="true" />;
      default:
        return <Radio className="h-4 w-4 text-slate-500" aria-hidden="true" />;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className={`flex items-center gap-2 text-sm font-semibold ${meta.toneClass}`}>
          {renderIcon()}
          <span>{meta.label}</span>
        </div>
        <p className="text-xs text-slate-500">
          {status === 'error' && errorMessage ? errorMessage : meta.helper}
        </p>
      </div>
      <canvas
        ref={canvasRef}
        className="h-20 w-full rounded-lg bg-white border border-slate-200/80"
        aria-label="Visualizador de voz en tiempo real"
      />
    </div>
  );
};
