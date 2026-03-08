'use client';

import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  textoBotaoConfirmar?: string;
  textoBotaoCancelar?: string;
  icone?: string;
  variante?: 'perigo' | 'aviso' | 'info';
  onConfirmar: () => void;
  onCancelar: () => void;
}

const VARIANTES = {
  perigo: {
    iconeBg: 'bg-red-100',
    iconeTexto: 'text-red-600',
    botao: 'bg-red-600 hover:bg-red-700 shadow-red-600/30',
  },
  aviso: {
    iconeBg: 'bg-yellow-100',
    iconeTexto: 'text-yellow-600',
    botao: 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-600/30',
  },
  info: {
    iconeBg: 'bg-blue-100',
    iconeTexto: 'text-blue-600',
    botao: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30',
  },
};

export default function ConfirmModal({
  aberto,
  titulo,
  mensagem,
  textoBotaoConfirmar = 'Confirmar',
  textoBotaoCancelar = 'Cancelar',
  icone = 'warning',
  variante = 'perigo',
  onConfirmar,
  onCancelar,
}: ConfirmModalProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (aberto) {
      cancelarRef.current?.focus();
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancelar();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  const estilos = VARIANTES[variante];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
        onClick={onCancelar}
      />

      {/* Modal */}
      <div className="relative bg-white/95 backdrop-blur-md border border-black/5 shadow-2xl rounded-2xl p-6 w-full max-w-md mx-4 animate-[scaleIn_150ms_ease-out]">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl ${estilos.iconeBg} flex items-center justify-center shrink-0`}>
            <span className={`material-symbols-outlined text-[22px] ${estilos.iconeTexto}`}>
              {icone}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-800">{titulo}</h3>
            <p className="text-sm text-slate-600 mt-1 break-words">{mensagem}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            ref={cancelarRef}
            onClick={onCancelar}
            className="h-10 px-5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            {textoBotaoCancelar}
          </button>
          <button
            onClick={onConfirmar}
            className={`h-10 px-5 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${estilos.botao}`}
          >
            {textoBotaoConfirmar}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
