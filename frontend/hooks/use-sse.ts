import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

const BACKEND_DIRECT_URL = process.env.NEXT_PUBLIC_BACKEND_DIRECT_URL || 'http://localhost:8000';

/**
 * SSE hook for user or admin dashboard.
 * Listens to server events and invalidates relevant TanStack Query caches.
 */
export function useSSE(token: string | null, channel: 'user' | 'admin') {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) return;

    const url = `${BACKEND_DIRECT_URL}/events/${channel}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type: string = data.type;

        if (type === 'processo_atualizado' || type === 'documento_enviado' || type === 'documento_avaliado') {
          qc.invalidateQueries({ queryKey: queryKeys.processos.all });
          if (data.processo_id) {
            qc.invalidateQueries({ queryKey: queryKeys.documentos.adminByProcesso(data.processo_id) });
            qc.invalidateQueries({ queryKey: queryKeys.documentos.byProcesso(data.processo_id) });
            qc.invalidateQueries({ queryKey: queryKeys.historico.byProcesso(data.processo_id) });
            qc.invalidateQueries({ queryKey: queryKeys.transicoes.byProcesso(data.processo_id) });
            qc.invalidateQueries({ queryKey: queryKeys.solicitacoes.byProcesso(data.processo_id) });
          }
        } else if (type === 'documentos_solicitados') {
          qc.invalidateQueries({ queryKey: queryKeys.processos.all });
          if (data.processo_id) {
            qc.invalidateQueries({ queryKey: queryKeys.solicitacoes.byProcesso(data.processo_id) });
          }
        } else if (type === 'novo_handoff' || type === 'handoff_atualizado') {
          qc.invalidateQueries({ queryKey: ['handoffs'] });
        }
      } catch {
        // Ignore parse errors (e.g. keepalive comments)
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [token, channel, qc]);
}

/**
 * SSE hook for a specific handoff chat.
 * Invalidates handoff messages query when new messages arrive.
 */
export function useHandoffSSE(token: string | null, handoffId: number | null) {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token || !handoffId) return;

    const url = `${BACKEND_DIRECT_URL}/events/handoff/${handoffId}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        JSON.parse(event.data); // validate it's real data
        qc.invalidateQueries({ queryKey: queryKeys.handoffs.mensagens(handoffId) });
        qc.invalidateQueries({ queryKey: queryKeys.handoffWeb.status(token) });
      } catch {
        // Ignore keepalive
      }
    };

    es.onerror = () => {};

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [token, handoffId, qc]);
}
