'use client';

import { Transicao } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const ETAPAS_PRINCIPAIS = ['recebido', 'em_analise', 'em_processamento', 'aprovado'] as const;

const STATUS_CONFIG: Record<string, { label: string; icone: string; corAtivo: string; corIconeAtivo: string }> = {
  recebido: { label: 'Recebido', icone: 'inbox', corAtivo: 'bg-[#00342d]', corIconeAtivo: 'text-white' },
  em_analise: { label: 'Em Análise', icone: 'search', corAtivo: 'bg-[#00342d]', corIconeAtivo: 'text-white' },
  documentos_pendentes: { label: 'Documentos Pendentes', icone: 'pending_actions', corAtivo: 'bg-[#593f00]', corIconeAtivo: 'text-white' },
  em_processamento: { label: 'Em Processamento', icone: 'settings', corAtivo: 'bg-[#00342d]', corIconeAtivo: 'text-white' },
  aprovado: { label: 'Aprovado', icone: 'check_circle', corAtivo: 'bg-[#00342d]', corIconeAtivo: 'text-white' },
  rejeitado: { label: 'Rejeitado', icone: 'cancel', corAtivo: 'bg-[#ba1a1a]', corIconeAtivo: 'text-white' },
  cancelado: { label: 'Cancelado', icone: 'block', corAtivo: 'bg-[#707975]', corIconeAtivo: 'text-white' },
};

interface ProcessoTimelineProps {
  statusAtual: string;
  criadoEm: string;
  historico: Transicao[];
  carregando?: boolean;
}

export default function ProcessoTimeline({ statusAtual, criadoEm, historico, carregando }: ProcessoTimelineProps) {
  const { t, idioma } = useI18n();
  const locale = idioma === 'en' ? 'en-US' : 'pt-BR';

  if (carregando) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2 text-sm text-[#707975]">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          {t('Carregando linha do tempo...')}
        </div>
      </div>
    );
  }

  const datasTransicao: Record<string, string> = {};
  datasTransicao['recebido'] = criadoEm;

  for (const trans of historico) {
    datasTransicao[trans.status_novo] = trans.criado_em;
  }

  const isRejeitado = statusAtual === 'rejeitado';
  const isCancelado = statusAtual === 'cancelado';
  const isAprovado = statusAtual === 'aprovado';
  const isDocsPendentes = statusAtual === 'documentos_pendentes';
  const isTerminalAlternativo = isRejeitado || isCancelado;
  const isTerminal = isRejeitado || isCancelado || isAprovado;

  let etapas: string[];

  if (isDocsPendentes) {
    etapas = ['recebido', 'em_analise', 'documentos_pendentes', 'em_processamento', 'aprovado'];
  } else if (isTerminalAlternativo) {
    const etapasBase = ['recebido', 'em_analise', 'em_processamento'];
    const alcancadas = etapasBase.filter((e) => datasTransicao[e] !== undefined);
    etapas = [...alcancadas, statusAtual];
  } else {
    const passouPorDocsPendentes = historico.some((trans) => trans.status_novo === 'documentos_pendentes');
    if (passouPorDocsPendentes) {
      etapas = ['recebido', 'em_analise', 'documentos_pendentes', 'em_processamento', 'aprovado'];
    } else {
      etapas = [...ETAPAS_PRINCIPAIS];
    }
  }

  const indiceStatusAtual = etapas.indexOf(statusAtual);

  function formatarData(dataStr: string): string {
    const data = new Date(dataStr);
    return data.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  }

  function formatarDataHora(dataStr: string): string {
    const data = new Date(dataStr);
    return data.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + data.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="py-4">
      {/* Asymmetric Timeline */}
      <div className="relative py-4">
        {/* Vertical center line */}
        <div className="absolute left-4 top-0 bottom-0 w-px border-l border-dashed border-[#bfc9c4] md:left-1/2"></div>

        <div className="space-y-12 relative">
          {etapas.map((etapa, i) => {
            const config = STATUS_CONFIG[etapa];
            const foiAlcancado = datasTransicao[etapa] !== undefined;
            const isAtual = etapa === statusAtual;
            const isEven = i % 2 === 0;
            const isPending = !foiAlcancado && !isAtual;
            const isActiveAction = isAtual && (etapa === 'documentos_pendentes');

            // Node styling
            let nodeClasses = '';
            let nodeSize = 'w-8 h-8';
            let ringClasses = 'ring-4 ring-[#f5f3f0]';

            if (isActiveAction) {
              nodeClasses = 'bg-[#593f00] text-[#d1ab63]';
              nodeSize = 'w-10 h-10';
              ringClasses = 'ring-8 ring-[#593f00]/10 shadow-[0_0_20px_rgba(89,63,0,0.3)]';
            } else if (isAtual) {
              nodeClasses = `${config.corAtivo} ${config.corIconeAtivo}`;
              nodeSize = 'w-10 h-10';
              ringClasses = 'ring-8 ring-[#00342d]/10 shadow-lg';
            } else if (foiAlcancado) {
              nodeClasses = `${config.corAtivo} ${config.corIconeAtivo}`;
              ringClasses = 'ring-4 ring-[#f5f3f0] shadow-lg';
            } else {
              nodeClasses = 'bg-[#e4e2df] text-[#707975]';
            }

            const dataLabel = foiAlcancado && datasTransicao[etapa]
              ? (isAtual && !isTerminal ? t('Em andamento') : `${t('Concluído em')} ${formatarData(datasTransicao[etapa])}`)
              : null;

            return (
              <div
                key={etapa}
                className={`flex flex-col md:flex-row items-center gap-4 md:gap-6 md:justify-between ${isPending ? 'opacity-30' : ''}`}
              >
                {/* Left side (desktop: text for even rows) */}
                <div className={`md:w-5/12 ${isEven ? 'text-right hidden md:block' : 'hidden md:block'}`}>
                  {isEven ? (
                    <>
                      {isActiveAction && (
                        <div className="bg-[#ffdad6] text-[#93000a] px-3 py-1 rounded-full text-xs font-bold inline-block mb-1">{t('Ação Requerida')}</div>
                      )}
                      <h4 className={`font-[var(--font-serif)] text-lg ${isAtual ? 'text-[#00342d] font-bold' : foiAlcancado ? 'text-[#00342d] opacity-50' : 'text-[#00342d]'}`}>
                        {t(config.label)}
                      </h4>
                      {dataLabel && (
                        <p className="text-sm text-[#4c616c] italic">{dataLabel}</p>
                      )}
                    </>
                  ) : (
                    foiAlcancado && !isPending ? (
                      <p className="text-sm text-[#3f4945] max-w-xs ml-auto text-right">
                        {t(historico.find(h => h.status_novo === etapa)?.observacao || '')}
                      </p>
                    ) : null
                  )}
                </div>

                {/* Node */}
                <div className={`z-10 ${nodeSize} rounded-full flex items-center justify-center ${nodeClasses} ${ringClasses}`}>
                  <span
                    className={`material-symbols-outlined text-sm ${isActiveAction ? 'animate-pulse' : ''}`}
                    style={foiAlcancado && !isAtual ? { fontVariationSettings: '"FILL" 1' } : undefined}
                  >
                    {foiAlcancado && !isAtual ? 'check' : config.icone}
                  </span>
                </div>

                {/* Right side */}
                <div className={`md:w-5/12 w-full pl-12 md:pl-0 ${!isEven ? '' : ''}`}>
                  {/* Mobile: always show label */}
                  <div className="md:hidden">
                    {isActiveAction && (
                      <div className="bg-[#ffdad6] text-[#93000a] px-3 py-1 rounded-full text-xs font-bold inline-block mb-1">{t('Ação Requerida')}</div>
                    )}
                    <h4 className={`font-[var(--font-serif)] text-lg ${isAtual ? 'text-[#00342d] font-bold' : foiAlcancado ? 'text-[#00342d] opacity-50' : 'text-[#00342d]'}`}>
                      {t(config.label)}
                    </h4>
                    {dataLabel && (
                      <p className="text-sm text-[#4c616c] italic">{dataLabel}</p>
                    )}
                  </div>

                  {/* Desktop: label for odd rows */}
                  {!isEven && (
                    <div className="hidden md:block">
                      {isActiveAction && (
                        <div className="bg-[#ffdad6] text-[#93000a] px-3 py-1 rounded-full text-xs font-bold inline-block mb-1">{t('Ação Requerida')}</div>
                      )}
                      <h4 className={`font-[var(--font-serif)] text-lg ${isAtual ? 'text-[#00342d] font-bold' : foiAlcancado ? 'text-[#00342d] opacity-50' : 'text-[#00342d]'}`}>
                        {t(config.label)}
                      </h4>
                      {dataLabel && (
                        <p className="text-sm text-[#4c616c] italic">{dataLabel}</p>
                      )}
                    </div>
                  )}

                  {/* Description / action card for even rows on desktop */}
                  {isEven && foiAlcancado && !isPending && (
                    <div className="hidden md:block">
                      <p className="text-sm text-[#3f4945] max-w-xs">
                        {t(historico.find(h => h.status_novo === etapa)?.observacao || '')}
                      </p>
                    </div>
                  )}

                  {/* Pending time estimate */}
                  {isPending && (
                    <p className="text-sm text-[#3f4945] italic">{t('Pendente')}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historico detalhado */}
      {historico.length > 0 && (
        <div className="mt-6 border-t border-[#bfc9c4]/30 pt-4">
          <h5 className="text-xs font-bold text-[#4c616c] uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">history</span>
            {t('Histórico de Alterações')}
          </h5>
          <div className="space-y-2">
            {historico.map((trans) => {
              const configAnterior = STATUS_CONFIG[trans.status_anterior];
              const configNovo = STATUS_CONFIG[trans.status_novo];

              return (
                <div key={trans.id} className="flex items-start gap-3 text-xs bg-white rounded-lg px-3 py-2.5 border border-[#bfc9c4]/20">
                  <span className="material-symbols-outlined text-[16px] text-[#00342d] mt-0.5 shrink-0">arrow_forward</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium text-[#4c616c]">{t(configAnterior?.label || trans.status_anterior)}</span>
                      <span className="text-[#bfc9c4]">&rarr;</span>
                      <span className={`font-bold ${
                        trans.status_novo === 'aprovado' ? 'text-[#00342d]' :
                        trans.status_novo === 'rejeitado' ? 'text-[#ba1a1a]' :
                        trans.status_novo === 'cancelado' ? 'text-[#707975]' :
                        'text-[#1b1c1a]'
                      }`}>
                        {t(configNovo?.label || trans.status_novo)}
                      </span>
                    </div>
                    {trans.observacao && (
                      <p className="text-[#4c616c] mt-1 italic">&ldquo;{t(trans.observacao)}&rdquo;</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[#707975]">
                      <span>{formatarDataHora(trans.criado_em)}</span>
                      {trans.responsavel_nome && (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px]">person</span>
                            {trans.responsavel_nome}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
