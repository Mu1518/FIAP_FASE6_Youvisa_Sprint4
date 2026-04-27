'use client';

interface AlertMessageProps {
  tipo: 'erro' | 'sucesso';
  mensagem: string;
  onFechar: () => void;
}

const ESTILOS = {
  erro: {
    container: 'bg-[#ffdad6] border-[#ba1a1a]/20 text-[#93000a]',
    icone: 'error',
  },
  sucesso: {
    container: 'bg-[#a0f2e1] border-[#00342d]/20 text-[#00201b]',
    icone: 'check_circle',
  },
};

export default function AlertMessage({ tipo, mensagem, onFechar }: AlertMessageProps) {
  const estilo = ESTILOS[tipo];
  return (
    <div className={`mb-6 p-4 border rounded-xl text-sm flex items-center gap-2 ${estilo.container}`}>
      <span className="material-symbols-outlined text-[20px] shrink-0">{estilo.icone}</span>
      <span className="flex-1">{mensagem}</span>
      <button
        onClick={onFechar}
        className="shrink-0 p-0.5 rounded-lg hover:bg-black/10 transition-colors"
        aria-label="Fechar"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
