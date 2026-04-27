import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  buscarProcessosUsuario,
  buscarTodosProcessos,
  statusTelegram,
  buscarHandoffs,
  buscarMensagensHandoff,
  buscarStatusHandoffWeb,
  buscarDocumentosAdmin,
  buscarDocumentos,
  buscarSolicitacoes,
  buscarHistoricoProcesso,
  buscarTransicoesValidas,
  buscarRequisitos,
} from '@/lib/api';

export function useProcessosUsuario(token: string | null) {
  return useQuery({
    queryKey: queryKeys.processos.usuario(token ?? ''),
    queryFn: () => buscarProcessosUsuario(token!),
    enabled: !!token,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useProcessosAdmin(token: string | null) {
  return useQuery({
    queryKey: queryKeys.processos.admin(token ?? ''),
    queryFn: () => buscarTodosProcessos(token!),
    enabled: !!token,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useTelegramStatus(token: string | null, polling: boolean) {
  return useQuery({
    queryKey: queryKeys.telegram.status(token ?? ''),
    queryFn: () => statusTelegram(token!),
    enabled: !!token,
    refetchInterval: polling ? 3_000 : false,
    placeholderData: keepPreviousData,
  });
}

export function useHandoffsAdmin(token: string | null) {
  return useQuery({
    queryKey: queryKeys.handoffs.all(token ?? ''),
    queryFn: () => buscarHandoffs(token!),
    enabled: !!token,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useHandoffMensagens(token: string | null, handoffId: number | null) {
  return useQuery({
    queryKey: queryKeys.handoffs.mensagens(handoffId ?? 0),
    queryFn: () => buscarMensagensHandoff(token!, handoffId!),
    enabled: !!token && !!handoffId,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  });
}

export function useHandoffWebStatus(token: string | null, active: boolean) {
  return useQuery({
    queryKey: queryKeys.handoffWeb.status(token ?? ''),
    queryFn: () => buscarStatusHandoffWeb(token!),
    enabled: !!token && active,
    refetchInterval: 4_000,
    placeholderData: keepPreviousData,
  });
}

export function useDocumentosAdmin(token: string | null, processoId: number | null) {
  return useQuery({
    queryKey: queryKeys.documentos.adminByProcesso(processoId ?? 0),
    queryFn: () => buscarDocumentosAdmin(token!, processoId!),
    enabled: !!token && !!processoId,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useDocumentos(token: string | null, processoId: number | null) {
  return useQuery({
    queryKey: queryKeys.documentos.byProcesso(processoId ?? 0),
    queryFn: () => buscarDocumentos(token!, processoId!),
    enabled: !!token && !!processoId,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useSolicitacoes(token: string | null, processoId: number | null) {
  return useQuery({
    queryKey: queryKeys.solicitacoes.byProcesso(processoId ?? 0),
    queryFn: () => buscarSolicitacoes(token!, processoId!),
    enabled: !!token && !!processoId,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useHistorico(token: string | null, processoId: number | null) {
  return useQuery({
    queryKey: queryKeys.historico.byProcesso(processoId ?? 0),
    queryFn: () => buscarHistoricoProcesso(token!, processoId!),
    enabled: !!token && !!processoId,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useTransicoes(token: string | null, processoId: number | null) {
  return useQuery({
    queryKey: queryKeys.transicoes.byProcesso(processoId ?? 0),
    queryFn: () => buscarTransicoesValidas(token!, processoId!),
    enabled: !!token && !!processoId,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useRequisitos(token: string | null) {
  return useQuery({
    queryKey: queryKeys.requisitos.all(token ?? ''),
    queryFn: () => buscarRequisitos(token!),
    enabled: !!token,
    placeholderData: keepPreviousData,
  });
}
