'use client';

import { Transicao } from '@/lib/api';

const ETAPAS_PRINCIPAIS = ['recebido', 'em_analise', 'em_processamento', 'aprovado'] as const;

const STATUS_CONFIG: Record<string, { label: string; icone: string; corAtivo: string; corIconeAtivo: string }> = {
  recebido: { label: 'Recebido', icone: 'inbox', corAtivo: 'bg-slate-600', corIconeAtivo: 'text-white' },
  em_analise: { label: 'Em Análise', icone: 'search', corAtivo: 'bg-yellow-500', corIconeAtivo: 'text-white' },
  documentos_pendentes: { label: 'Docs Pendentes', icone: 'pending_actions', corAtivo: 'bg-orange-500', corIconeAtivo: 'text-white' },
  em_processamento: { label: 'Em Processamento', icone: 'settings', corAtivo: 'bg-blue-500', corIconeAtivo: 'text-white' },
  aprovado: { label: 'Aprovado', icone: 'check_circle', corAtivo: 'bg-green-500', corIconeAtivo: 'text-white' },
  rejeitado: { label: 'Rejeitado', icone: 'cancel', corAtivo: 'bg-red-500', corIconeAtivo: 'text-white' },
  cancelado: { label: 'Cancelado', icone: 'block', corAtivo: 'bg-gray-500', corIconeAtivo: 'text-white' },
};

interface ProcessoTimelineProps {
  statusAtual: string;
  criadoEm: string;
  historico: Transicao[];
  carregando?: boolean;
}

export default function ProcessoTimeline({ statusAtual, criadoEm, historico, carregando }: ProcessoTimelineProps) {
  if (carregando) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Carregando linha do tempo...
        </div>
      </div>
    );
  }

  const datasTransicao: Record<string, string> = {};
  datasTransicao['recebido'] = criadoEm;

  for (const t of historico) {
    datasTransicao[t.status_novo] = t.criado_em;
  }

  const isRejeitado = statusAtual === 'rejeitado';
  const isCancelado = statusAtual === 'cancelado';
  const isDocsPendentes = statusAtual === 'documentos_pendentes';
  const isTerminalAlternativo = isRejeitado || isCancelado;

  let etapas: string[];

  if (isDocsPendentes) {
    etapas = ['recebido', 'em_analise', 'documentos_pendentes', 'em_processamento', 'aprovado'];
  } else if (isTerminalAlternativo) {
    const etapasBase = ['recebido', 'em_analise', 'em_processamento'];
    const alcancadas = etapasBase.filter((e) => datasTransicao[e] !== undefined);
    etapas = [...alcancadas, statusAtual];
  } else {
    const passouPorDocsPendentes = historico.some((t) => t.status_novo === 'documentos_pendentes');
    if (passouPorDocsPendentes) {
      etapas = ['recebido', 'em_analise', 'documentos_pendentes', 'em_processamento', 'aprovado'];
    } else {
      etapas = [...ETAPAS_PRINCIPAIS];
    }
  }

  const indiceStatusAtual = etapas.indexOf(statusAtual);

  function formatarData(dataStr: string): string {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatarDataHora(dataStr: string): string {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="py-4">
      {/* Desktop: horizontal timeline */}
      <div className="hidden sm:flex items-center w-full mb-6">
        {etapas.map((etapa, i) => {
          const config = STATUS_CONFIG[etapa];
          const foiAlcancado = datasTransicao[etapa] !== undefined;
          const isAtual = etapa === statusAtual;
          const isUltimo = i === etapas.length - 1;
          const proximaEtapa = i < etapas.length - 1 ? etapas[i + 1] : null;
          const barraPreenchida = proximaEtapa ? datasTransicao[proximaEtapa] !== undefined : false;

          return (
            <div key={etapa} className={`flex items-center ${isUltimo ? '' : 'flex-1'}`}>
              <div className="flex flex-col items-center relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isAtual
                      ? `${config.corAtivo} ${config.corIconeAtivo} ring-4 ring-offset-2 ${
                          isRejeitado ? 'ring-red-200' : isCancelado ? 'ring-gray-200' : etapa === 'aprovado' ? 'ring-green-200' : 'ring-blue-200'
                        } shadow-lg`
                      : foiAlcancado
                      ? `${config.corAtivo} ${config.corIconeAtivo} opacity-80`
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{config.icone}</span>
                </div>

                <div className="absolute top-12 flex flex-col items-center w-24 text-center">
                  <span className={`text-[11px] font-semibold leading-tight ${
                    isAtual ? 'text-slate-800' : foiAlcancado ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    {config.label}
                  </span>
                  {datasTransicao[etapa] && (
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {formatarData(datasTransicao[etapa])}
                    </span>
                  )}
                </div>
              </div>

              {!isUltimo && (
                <div className="flex-1 mx-1">
                  <div className={`h-1 rounded-full transition-all ${
                    barraPreenchida
                      ? isTerminalAlternativo ? 'bg-slate-300' : 'bg-blue-400'
                      : 'bg-slate-200'
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: space for labels */}
      <div className="hidden sm:block h-8" />

      {/* Mobile: vertical timeline */}
      <div className="sm:hidden flex flex-col gap-0 mb-4">
        {etapas.map((etapa, i) => {
          const config = STATUS_CONFIG[etapa];
          const foiAlcancado = datasTransicao[etapa] !== undefined;
          const isAtual = etapa === statusAtual;
          const isUltimo = i === etapas.length - 1;
          const proximaEtapa = i < etapas.length - 1 ? etapas[i + 1] : null;
          const barraPreenchida = proximaEtapa ? datasTransicao[proximaEtapa] !== undefined : false;

          return (
            <div key={etapa} className="flex items-stretch gap-3">
              {/* Node + vertical bar */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isAtual
                      ? `${config.corAtivo} ${config.corIconeAtivo} ring-3 ring-offset-1 ${
                          isRejeitado ? 'ring-red-200' : isCancelado ? 'ring-gray-200' : etapa === 'aprovado' ? 'ring-green-200' : 'ring-blue-200'
                        } shadow-md`
                      : foiAlcancado
                      ? `${config.corAtivo} ${config.corIconeAtivo} opacity-80`
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{config.icone}</span>
                </div>
                {!isUltimo && (
                  <div className={`w-0.5 flex-1 min-h-4 my-1 rounded-full ${
                    barraPreenchida
                      ? isTerminalAlternativo ? 'bg-slate-300' : 'bg-blue-400'
                      : 'bg-slate-200'
                  }`} />
                )}
              </div>

              {/* Label + date */}
              <div className={`pb-4 ${isUltimo ? '' : ''}`}>
                <span className={`text-sm font-semibold leading-tight ${
                  isAtual ? 'text-slate-800' : foiAlcancado ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  {config.label}
                </span>
                {datasTransicao[etapa] && (
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {formatarData(datasTransicao[etapa])}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Historico detalhado */}
      {historico.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-4">
          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">history</span>
            Histórico de Alterações
          </h5>
          <div className="space-y-2">
            {historico.map((t) => {
              const configAnterior = STATUS_CONFIG[t.status_anterior];
              const configNovo = STATUS_CONFIG[t.status_novo];

              return (
                <div key={t.id} className="flex items-start gap-3 text-xs bg-white rounded-lg px-3 py-2.5 border border-slate-100">
                  <span className="material-symbols-outlined text-[16px] text-blue-400 mt-0.5 shrink-0">arrow_forward</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium text-slate-500">{configAnterior?.label || t.status_anterior}</span>
                      <span className="text-slate-300">&rarr;</span>
                      <span className={`font-bold ${
                        t.status_novo === 'aprovado' ? 'text-green-600' :
                        t.status_novo === 'rejeitado' ? 'text-red-600' :
                        t.status_novo === 'cancelado' ? 'text-gray-500' :
                        'text-slate-700'
                      }`}>
                        {configNovo?.label || t.status_novo}
                      </span>
                    </div>
                    {t.observacao && (
                      <p className="text-slate-500 mt-1 italic">&ldquo;{t.observacao}&rdquo;</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-slate-400">
                      <span>{formatarDataHora(t.criado_em)}</span>
                      {t.responsavel_nome && (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px]">person</span>
                            {t.responsavel_nome}
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
