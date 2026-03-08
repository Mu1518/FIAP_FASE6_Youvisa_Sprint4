'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  enviarMensagemChatbot,
  chatbotLogin,
  chatbotVerificarLogin,
  ChatbotMessage,
} from '@/lib/api';

interface DisplayMessage {
  id: string;
  type: 'user' | 'bot' | 'system';
  text: string;
}

const WELCOME_MESSAGE: DisplayMessage = {
  id: 'welcome',
  type: 'bot',
  text: 'Olá! Sou o assistente virtual da YouVisa. Como posso ajudar?',
};

export default function ChatbotButton() {
  const pathname = usePathname();
  const { token, salvarAuth } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [mensagens, setMensagens] = useState<DisplayMessage[]>([WELCOME_MESSAGE]);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tokenAtivo = chatToken || token;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens, carregando, chatAuthEtapa, scrollToBottom]);

  useEffect(() => {
    if (isOpen && chatAuthEtapa === 'none') {
      inputRef.current?.focus();
    }
  }, [isOpen, chatAuthEtapa]);

  const addMessage = useCallback((type: DisplayMessage['type'], text: string) => {
    const msg: DisplayMessage = { id: Date.now().toString() + Math.random(), type, text };
    setMensagens(prev => [...prev, msg]);
    return msg;
  }, []);

  const enviarMensagem = useCallback(async (texto: string) => {
    addMessage('user', texto);
    setCarregando(true);

    try {
      const res = await enviarMensagemChatbot(texto, historico, tokenAtivo);

      if (res.requer_auth) {
        if (tokenAtivo) {
          // Already has token, resend with it
          const resAuth = await enviarMensagemChatbot(texto, historico, tokenAtivo);
          addMessage('bot', resAuth.resposta);
          setHistorico(prev => [
            ...prev,
            { role: 'user', parts: [{ text: texto }] },
            { role: 'model', parts: [{ text: resAuth.resposta }] },
          ]);
        } else {
          addMessage('system', res.resposta);
          setMensagemPendente(texto);
          setChatAuthEtapa('email');
          setChatAuthErro('');
        }
      } else {
        addMessage('bot', res.resposta);
        setHistorico(prev => [
          ...prev,
          { role: 'user', parts: [{ text: texto }] },
          { role: 'model', parts: [{ text: res.resposta }] },
        ]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
      addMessage('system', `Erro: ${errorMsg}`);
    } finally {
      setCarregando(false);
    }
  }, [addMessage, historico, tokenAtivo]);

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
      addMessage('system', `Código de verificação enviado para ${email}. Digite o código abaixo.`);
      setChatAuthEtapa('otp');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao enviar código';
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
      addMessage('system', `Identidade verificada! Olá, ${res.usuario.nome}.`);

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
          addMessage('bot', resChat.resposta);
          setHistorico(prev => [
            ...prev,
            { role: 'user', parts: [{ text: pendente }] },
            { role: 'model', parts: [{ text: resChat.resposta }] },
          ]);
        } catch {
          addMessage('system', 'Erro ao reenviar sua mensagem. Tente novamente.');
        } finally {
          setCarregando(false);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Código inválido ou expirado';
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
    addMessage('system', 'Verificação cancelada. Você pode continuar fazendo perguntas gerais.');
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50">
      {isOpen && (
        <div className="fixed inset-3 sm:inset-auto sm:absolute sm:bottom-20 sm:right-0 sm:w-96 bg-white border border-black/5 shadow-2xl rounded-2xl overflow-hidden flex flex-col sm:h-[500px] animate-in slide-in-from-bottom-4 fade-in duration-300 z-50">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined">smart_toy</span>
              <h3 className="font-bold">Assistente YouVisa</h3>
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

            {/* Auth email form inline */}
            {chatAuthEtapa === 'email' && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-sm">
                <form onSubmit={handleAuthEmail} className="flex flex-col gap-2">
                  <label className="text-blue-800 font-medium">Informe seu e-mail:</label>
                  <input
                    type="email"
                    value={chatAuthEmail}
                    onChange={e => setChatAuthEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    disabled={chatAuthCarregando}
                    autoFocus
                  />
                  {chatAuthErro && <p className="text-red-600 text-xs">{chatAuthErro}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={chatAuthCarregando || !chatAuthEmail.trim()}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {chatAuthCarregando ? 'Enviando...' : 'Enviar código'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelarAuth}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Auth OTP form inline */}
            {chatAuthEtapa === 'otp' && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-sm">
                <form onSubmit={handleAuthOTP} className="flex flex-col gap-2">
                  <label className="text-blue-800 font-medium">Digite o código recebido:</label>
                  <input
                    type="text"
                    value={chatAuthCodigo}
                    onChange={e => setChatAuthCodigo(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="px-3 py-2 rounded-lg border border-blue-200 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-center tracking-widest font-mono text-lg"
                    disabled={chatAuthCarregando}
                    autoFocus
                  />
                  {chatAuthErro && <p className="text-red-600 text-xs">{chatAuthErro}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={chatAuthCarregando || !chatAuthCodigo.trim()}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {chatAuthCarregando ? 'Verificando...' : 'Verificar'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelarAuth}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                    >
                      Cancelar
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

          {/* Input */}
          <form onSubmit={handleEnviar} className="p-3 bg-white border-t border-black/5 flex gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={chatAuthEtapa !== 'none' ? 'Complete a verificação acima...' : 'Digite sua mensagem...'}
              disabled={carregando || chatAuthEtapa !== 'none'}
              className="flex-grow px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              type="submit"
              disabled={carregando || !input.trim() || chatAuthEtapa !== 'none'}
              className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors shrink-0 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-12 sm:h-16 rounded-full px-4 sm:px-6 bg-white/90 backdrop-blur-md border border-black/5 text-slate-800 flex items-center gap-2 sm:gap-3 shadow-xl hover:scale-105 transition-transform duration-300 group"
      >
        <span className="hidden sm:inline font-medium text-sm">{isOpen ? 'Fechar chat' : 'Como posso ajudar?'}</span>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white transition-transform duration-300">
          <span className="material-symbols-outlined text-[20px] sm:text-[24px]">{isOpen ? 'close' : 'forum'}</span>
        </div>
        <div className="absolute inset-0 rounded-full bg-white/50 blur-md -z-10 group-hover:blur-lg transition-all"></div>
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
      <div className="bg-blue-600 text-white p-3 rounded-xl rounded-tr-none shadow-sm self-end max-w-[85%] text-sm">
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
