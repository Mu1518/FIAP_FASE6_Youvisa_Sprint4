'use client';

import { useI18n } from '@/lib/i18n';

interface Props {
  variante?: 'claro' | 'escuro';
}

export default function LanguageSwitcher({ variante = 'claro' }: Props) {
  const { idioma, setIdioma } = useI18n();

  const baseCls = 'text-xs font-semibold uppercase tracking-widest px-2 py-1 rounded transition-colors';
  const ativoCls = variante === 'escuro' ? 'bg-white text-[#00342d]' : 'bg-[#00342d] text-white';
  const inativoCls = variante === 'escuro' ? 'text-white/70 hover:text-white' : 'text-[#4c616c] hover:text-[#00342d]';

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => setIdioma('pt-BR')}
        className={`${baseCls} ${idioma === 'pt-BR' ? ativoCls : inativoCls}`}
        aria-pressed={idioma === 'pt-BR'}
      >
        PT
      </button>
      <span className={variante === 'escuro' ? 'text-white/30' : 'text-[#bfc9c4]'}>|</span>
      <button
        type="button"
        onClick={() => setIdioma('en')}
        className={`${baseCls} ${idioma === 'en' ? ativoCls : inativoCls}`}
        aria-pressed={idioma === 'en'}
      >
        EN
      </button>
    </div>
  );
}
