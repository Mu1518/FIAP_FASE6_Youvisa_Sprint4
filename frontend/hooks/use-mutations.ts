import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  atualizarStatusProcesso,
  uploadDocumento,
  avaliarDocumento,
  aprovarDocumentoComIA,
  enviarMensagemHandoff,
  enviarMensagemHandoffWeb,
  solicitarDocumentos,
  excluirDocumento,
  Processo,
} from '@/lib/api';

export function useAtualizarStatus(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ processoId, status, observacao }: { processoId: number; status: string; observacao?: string }) =>
      atualizarStatusProcesso(token!, processoId, status, observacao),
    onMutate: async ({ processoId, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.processos.all });
      const adminKey = queryKeys.processos.admin(token ?? '');
      const previous = qc.getQueryData<{ processos: Processo[] }>(adminKey);
      if (previous) {
        qc.setQueryData(adminKey, {
          processos: previous.processos.map((p) =>
            p.id === processoId ? { ...p, status } : p
          ),
        });
      }
      return { previous, adminKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(context.adminKey, context.previous);
      }
    },
    onSettled: (_data, _err, { processoId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.processos.all });
      qc.invalidateQueries({ queryKey: queryKeys.historico.byProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.transicoes.byProcesso(processoId) });
    },
  });
}

export function useUploadDocumento(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ processoId, arquivo, tipoDocumento, solicitacaoId }: { processoId: number; arquivo: File; tipoDocumento: string; solicitacaoId?: number }) =>
      uploadDocumento(token!, processoId, arquivo, tipoDocumento, solicitacaoId),
    onSettled: (_data, _err, { processoId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.documentos.byProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.documentos.adminByProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.solicitacoes.byProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.processos.all });
    },
  });
}

export function useExcluirDocumento(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ processoId, documentoId }: { processoId: number; documentoId: number }) =>
      excluirDocumento(token!, processoId, documentoId),
    onSettled: (_data, _err, { processoId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.documentos.byProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.documentos.adminByProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.processos.all });
    },
  });
}

export function useAvaliarDocumento(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ processoId, documentoId, status, feedback }: { processoId: number; documentoId: number; status: string; feedback?: string }) =>
      avaliarDocumento(token!, processoId, documentoId, status, feedback),
    onSettled: (_data, _err, { processoId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.documentos.adminByProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.processos.all });
    },
  });
}

export function useAprovarDocumentoIA(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ processoId, documentoId }: { processoId: number; documentoId: number }) =>
      aprovarDocumentoComIA(token!, processoId, documentoId),
    onSettled: (_data, _err, { processoId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.documentos.adminByProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.processos.all });
    },
  });
}

export function useEnviarMensagemHandoff(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handoffId, conteudo }: { handoffId: number; conteudo: string }) =>
      enviarMensagemHandoff(token!, handoffId, conteudo),
    onSettled: (_data, _err, { handoffId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.handoffs.mensagens(handoffId) });
    },
  });
}

export function useEnviarMensagemHandoffWeb(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conteudo }: { conteudo: string }) =>
      enviarMensagemHandoffWeb(token!, conteudo),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.handoffWeb.status(token ?? '') });
    },
  });
}

export function useSolicitarDocumentos(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ processoId, documentos }: { processoId: number; documentos: Array<{ tipo_documento: string; descricao?: string; obrigatoria?: boolean }> }) =>
      solicitarDocumentos(token!, processoId, documentos),
    onSettled: (_data, _err, { processoId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.solicitacoes.byProcesso(processoId) });
      qc.invalidateQueries({ queryKey: queryKeys.processos.all });
    },
  });
}
