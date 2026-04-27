export const queryKeys = {
  processos: {
    all: ['processos'] as const,
    usuario: (token: string) => ['processos', 'usuario', token] as const,
    admin: (token: string) => ['processos', 'admin', token] as const,
  },
  documentos: {
    all: ['documentos'] as const,
    byProcesso: (processoId: number) => ['documentos', processoId] as const,
    adminByProcesso: (processoId: number) => ['documentos', 'admin', processoId] as const,
  },
  solicitacoes: {
    all: ['solicitacoes'] as const,
    byProcesso: (processoId: number) => ['solicitacoes', processoId] as const,
  },
  historico: {
    byProcesso: (processoId: number) => ['historico', processoId] as const,
  },
  transicoes: {
    byProcesso: (processoId: number) => ['transicoes', processoId] as const,
  },
  telegram: {
    status: (token: string) => ['telegram', 'status', token] as const,
  },
  handoffs: {
    all: (token: string) => ['handoffs', token] as const,
    mensagens: (handoffId: number) => ['handoffs', 'mensagens', handoffId] as const,
  },
  handoffWeb: {
    status: (token: string) => ['handoffWeb', 'status', token] as const,
  },
  requisitos: {
    all: (token: string) => ['requisitos', token] as const,
  },
  analises: {
    byProcesso: (processoId: number) => ['analises', processoId] as const,
  },
};
