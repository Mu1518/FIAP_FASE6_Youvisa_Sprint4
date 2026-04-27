'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  enviarMensagemChatbot,
  chatbotLogin,
  chatbotVerificarLogin,
  ChatbotMessage,
  solicitarHandoffWeb,
  enviarMensagemHandoffWeb,
  HandoffMensagem,
} from '@/lib/api';
import { useHandoffWebStatus } from '@/hooks/use-queries';
import { useI18n } from '@/lib/i18n';

interface DisplayMessage {
  id: string;
  type: 'user' | 'bot' | 'system';
  text: string;
}

export default function ChatbotButton() {
  const pathname = usePathname();
  const { token, salvarAuth } = useAuth();
  const { t } = useI18n();

  const [isOpen, setIsOpen] = useState(false);
  const [mensagens, setMensagens] = useState<DisplayMessage[]>([{
    id: 'welcome',
    type: 'bot',
    text: t('Olá! Sou o assistente virtual da YouVisa. Como posso ajudar?'),
  }]);

  useEffect(() => {
    setMensagens(prev => prev.map(m =>
      m.id === 'welcome' ? { ...m, text: t('Olá! Sou o assistente virtual da YouVisa. Como posso ajudar?') } : m
    ));
  }, [t]);
  const [historico, setHistorico] = useState<ChatbotMessage[]>([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Auth inline states
  const [chatAuthEtapa, setChatAuthEtapa] = useState<'none' | 'email' | 'otp'>('none');
  const [chatAuthEmail, setChatAuthEmail] = useState('');
  const [chatAuthCodigo, setChatAuthCodigo] = useState('');
  const [chatAuthErro, setChatAuthErro] = useState('');
  const [chatAuthCarregando, setChatAuthCarregando] = useState(false);
  const [chatToken, setChatToken] = useState<string | null>(null);
  const [mensagemPendente, setMensagemPendente] = useState<string | null>(null);

  // Handoff state
  const [handoffAtivo, setHandoffAtivo] = useState(false);
  const [handoffMensagens, setHandoffMensagens] = useState<HandoffMensagem[]>([]);
  const [handoffNomeAtendente, setHandoffNomeAtendente] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tokenAtivo = chatToken || token;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens, carregando, chatAuthEtapa, handoffMensagens, scrollToBottom]);

  useEffect(() => {
    if (isOpen && chatAuthEtapa === 'none') {
      inputRef.current?.focus();
    }
  }, [isOpen, chatAuthEtapa]);

  // Fechar com Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Query hook for handoff status — polls every 4s when handoff is active or chat is open with a token
  const handoffQuery = useHandoffWebStatus(tokenAtivo, handoffAtivo || (isOpen && !!tokenAtivo));

  // React to handoff status changes from query
  useEffect(() => {
    const data = handoffQuery.data;
    if (!data) return;
    if (data.ativo) {
      if (!handoffAtivo) setHandoffAtivo(true);
      if (data.mensagens) setHandoffMensagens(data.mensagens);
      if (data.nome_atendente) setHandoffNomeAtendente(data.nome_atendente);
    } else if (handoffAtivo) {
      setHandoffAtivo(false);
      setHandoffMensagens([]);
      setHandoffNomeAtendente(null);
      setMensagens(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        text: t('O atendimento foi encerrado. Você está de volta ao assistente virtual.'),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffQuery.data]);

  const addMessage = useCallback((type: DisplayMessage['type'], text: string) => {
    const msg: DisplayMessage = { id: Date.now().toString() + Math.random(), type, text };
    setMensagens(prev => [...prev, msg]);
    return msg;
  }, []);

  const iniciarHandoff = useCallback(async (tkn: string) => {
    try {
      await solicitarHandoffWeb(tkn);
      setHandoffAtivo(true);
      addMessage('system', t('Você foi conectado ao atendimento humano. Aguarde um atendente responder.'));
    } catch {
      addMessage('system', t('Erro ao solicitar atendente. Tente novamente.'));
    }
  }, [addMessage, t]);

  const enviarMensagem = useCallback(async (texto: string) => {
    // If handoff is active, route message to handoff
    if (handoffAtivo && tokenAtivo) {
      setCarregando(true);
      try {
        await enviarMensagemHandoffWeb(tokenAtivo, texto);
        // Trigger immediate refetch of handoff status
        handoffQuery.refetch();
      } catch {
        addMessage('system', t('Erro ao enviar mensagem. Tente novamente.'));
      } finally {
        setCarregando(false);
      }
      return;
    }

    addMessage('user', texto);
    setCarregando(true);

    try {
      const res = await enviarMensagemChatbot(texto, historico, tokenAtivo);

      if (res.requer_auth) {
        if (tokenAtivo) {
          const resAuth = await enviarMensagemChatbot(texto, historico, tokenAtivo);
          if (resAuth.requer_handoff) {
            addMessage('bot', resAuth.resposta);
            await iniciarHandoff(tokenAtivo);
          } else {
            addMessage('bot', resAuth.resposta);
            setHistorico(prev => [
              ...prev,
              { role: 'user', parts: [{ text: texto }] },
              { role: 'model', parts: [{ text: resAuth.resposta }] },
            ]);
          }
        } else {
          addMessage('system', res.resposta);
          setMensagemPendente(texto);
          setChatAuthEtapa('email');
          setChatAuthErro('');
        }
      } else if (res.requer_handoff && tokenAtivo) {
        addMessage('bot', res.resposta);
        await iniciarHandoff(tokenAtivo);
      } else {
        addMessage('bot', res.resposta);
        setHistorico(prev => [
          ...prev,
          { role: 'user', parts: [{ text: texto }] },
          { role: 'model', parts: [{ text: res.resposta }] },
        ]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('Erro ao enviar mensagem');
      addMessage('system', `${t('Erro')}: ${errorMsg}`);
    } finally {
      setCarregando(false);
    }
  }, [addMessage, historico, tokenAtivo, handoffAtivo, iniciarHandoff, t]);

  // Esconder nas rotas de admin (após todos os hooks)
  if (pathname.startsWith('/admin')) return null;

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || carregando) return;
    setInput('');
    enviarMensagem(texto);
  };

  const handleAuthEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = chatAuthEmail.trim();
    if (!email) return;

    setChatAuthCarregando(true);
    setChatAuthErro('');

    try {
      await chatbotLogin(email);
      addMessage('system', `${t('Código de verificação enviado para')} ${email}. ${t('Digite o código abaixo.')}`);
      setChatAuthEtapa('otp');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('Erro ao enviar código');
      setChatAuthErro(errorMsg);
    } finally {
      setChatAuthCarregando(false);
    }
  };

  const handleAuthOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = chatAuthCodigo.trim();
    if (!codigo) return;

    setChatAuthCarregando(true);
    setChatAuthErro('');

    try {
      const res = await chatbotVerificarLogin(chatAuthEmail, codigo);
      setChatToken(res.token);
      salvarAuth(res.token, { ...res.usuario, tipo: 'usuario' });
      addMessage('system', `${t('Identidade verificada! Olá,')} ${res.usuario.nome}.`);

      // Reset auth state
      setChatAuthEtapa('none');
      setChatAuthEmail('');
      setChatAuthCodigo('');

      // Resend pending message with new token
      if (mensagemPendente) {
        const pendente = mensagemPendente;
        setMensagemPendente(null);

        setCarregando(true);
        try {
          const resChat = await enviarMensagemChatbot(pendente, historico, res.token);
          if (resChat.requer_handoff) {
            addMessage('bot', resChat.resposta);
            await iniciarHandoff(res.token);
          } else {
            addMessage('bot', resChat.resposta);
            setHistorico(prev => [
              ...prev,
              { role: 'user', parts: [{ text: pendente }] },
              { role: 'model', parts: [{ text: resChat.resposta }] },
            ]);
          }
        } catch {
          addMessage('system', t('Erro ao reenviar sua mensagem. Tente novamente.'));
        } finally {
          setCarregando(false);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('Código inválido ou expirado');
      setChatAuthErro(errorMsg);
    } finally {
      setChatAuthCarregando(false);
    }
  };

  const cancelarAuth = () => {
    setChatAuthEtapa('none');
    setChatAuthEmail('');
    setChatAuthCodigo('');
    setChatAuthErro('');
    setMensagemPendente(null);
    addMessage('system', t('Verificação cancelada. Você pode continuar fazendo perguntas gerais.'));
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50">
      {isOpen && (
        <div className="fixed inset-3 sm:inset-auto sm:absolute sm:bottom-20 sm:right-0 sm:w-96 bg-white border border-black/5 shadow-2xl rounded-2xl overflow-hidden flex flex-col sm:h-[500px] animate-in slide-in-from-bottom-4 fade-in duration-300 z-50">
          {/* Header */}
          <div className={`${handoffAtivo ? 'bg-emerald-700' : 'bg-emerald-900'} text-white p-4 flex items-center justify-between shrink-0 transition-colors`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined">{handoffAtivo ? 'support_agent' : 'chat_bubble'}</span>
              <div>
                <h3 className="font-bold">{handoffAtivo ? t('Atendimento Humano') : t('Assistente YouVisa')}</h3>
                {handoffAtivo && handoffNomeAtendente && (
                  <p className="text-xs text-white/80">{handoffNomeAtendente}</p>
                )}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-grow p-4 bg-slate-50 flex flex-col gap-3 overflow-y-auto">
            {mensagens.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Handoff messages from admin */}
            {handoffAtivo && handoffMensagens.map(msg => (
              <div
                key={`hm-${msg.id}`}
                className={`p-3 rounded-xl shadow-sm max-w-[85%] text-sm ${
                  msg.remetente_tipo === 'usuario'
                    ? 'bg-emerald-900 text-white rounded-tr-none self-end'
                    : 'bg-emerald-50 border border-emerald-200 text-slate-700 rounded-tl-none self-start'
                }`}
              >
                {msg.remetente_tipo === 'funcionario' && (
                  <p className="text-xs font-semibold text-emerald-700 mb-1">{msg.nome_remetente || t('Atendente')}</p>
                )}
                {msg.conteudo}
                <p className={`text-[10px] mt-1 ${msg.remetente_tipo === 'usuario' ? 'text-white/60' : 'text-slate-400'}`}>
                  {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}

            {/* Auth email form inline */}
            {chatAuthEtapa === 'email' && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-sm">
                <form onSubmit={handleAuthEmail} className="flex flex-col gap-2">
                  <label className="text-emerald-800 font-medium">{t('Informe seu e-mail:')}</label>
                  <input
                    type="email"
                    value={chatAuthEmail}
                    onChange={e => setChatAuthEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="px-3 py-2 rounded-lg border border-emerald-200 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    disabled={chatAuthCarregando}
                    autoFocus
                  />
                  {chatAuthErro && <p className="text-red-600 text-xs">{chatAuthErro}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={chatAuthCarregando || !chatAuthEmail.trim()}
                      className="flex-1 px-3 py-2 bg-emerald-900 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                    >
                      {chatAuthCarregando ? t('Enviando...') : t('Enviar código')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelarAuth}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                    >
                      {t('Cancelar')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Auth OTP form inline */}
            {chatAuthEtapa === 'otp' && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-sm">
                <form onSubmit={handleAuthOTP} className="flex flex-col gap-2">
                  <label className="text-emerald-800 font-medium">{t('Digite o código recebido:')}</label>
                  <input
                    type="text"
                    value={chatAuthCodigo}
                    onChange={e => setChatAuthCodigo(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="px-3 py-2 rounded-lg border border-emerald-200 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-center tracking-widest font-mono text-lg"
                    disabled={chatAuthCarregando}
                    autoFocus
                  />
                  {chatAuthErro && <p className="text-red-600 text-xs">{chatAuthErro}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={chatAuthCarregando || !chatAuthCodigo.trim()}
                      className="flex-1 px-3 py-2 bg-emerald-900 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                    >
                      {chatAuthCarregando ? t('Verificando...') : t('Verificar')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelarAuth}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                    >
                      {t('Cancelar')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Typing indicator */}
            {carregando && (
              <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm self-start max-w-[85%] border border-black/5">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Falar com atendente button */}
          {tokenAtivo && !handoffAtivo && chatAuthEtapa === 'none' && (
            <div className="px-3 pt-2 bg-white border-t border-black/5">
              <button
                onClick={() => iniciarHandoff(tokenAtivo)}
                className="w-full text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">support_agent</span>
                {t('Falar com atendente')}
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleEnviar} className="p-3 bg-white border-t border-black/5 flex gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={chatAuthEtapa !== 'none' ? t('Complete a verificação acima...') : handoffAtivo ? t('Mensagem para o atendente...') : t('Digite sua mensagem...')}
              disabled={carregando || chatAuthEtapa !== 'none'}
              className="flex-grow px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              type="submit"
              disabled={carregando || !input.trim() || chatAuthEtapa !== 'none'}
              className="w-10 h-10 bg-emerald-900 text-white rounded-lg flex items-center justify-center hover:bg-emerald-800 transition-colors shrink-0 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="chat-widget-pulse w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-900 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform duration-300"
      >
        <span className="material-symbols-outlined text-[28px] sm:text-[32px]">{isOpen ? 'close' : 'chat_bubble'}</span>
      </button>
    </div>
  );
}

function parseMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Unordered list items: lines starting with * or -
  html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="list-disc pl-4 my-1 space-y-0.5">$1</ul>');

  // Line breaks (preserve double newlines as paragraph breaks)
  html = html.replace(/\n{2,}/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  if (message.type === 'user') {
    return (
      <div className="bg-emerald-900 text-white p-3 rounded-xl rounded-tr-none shadow-sm self-end max-w-[85%] text-sm">
        {message.text}
      </div>
    );
  }

  if (message.type === 'system') {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl shadow-sm self-center max-w-[90%] text-sm text-center">
        {message.text}
      </div>
    );
  }

  // bot - render markdown
  return (
    <div
      className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm self-start max-w-[85%] border border-black/5 text-sm text-slate-700 chatbot-markdown"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(message.text) }}
    />
  );
}
