'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { login, verificarLogin, cadastro, verificarCadastro } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

function formatarTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const inputClass =
  'w-full bg-stone-50 border-b border-stone-300/30 px-4 py-4 rounded-lg focus:ring-0 focus:bg-white focus:border-emerald-900 transition-all duration-300 outline-none text-stone-900 placeholder:text-stone-400';

export default function ClientesContent() {
  // ── Login state ──
  const [loginEtapa, setLoginEtapa] = useState<'email' | 'otp'>('email');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCodigo, setLoginCodigo] = useState('');
  const [loginErro, setLoginErro] = useState('');
  const [loginCarregando, setLoginCarregando] = useState(false);

  // ── Cadastro state ──
  const [cadastroEtapa, setCadastroEtapa] = useState<'dados' | 'otp'>('dados');
  const [nome, setNome] = useState('');
  const [cadastroEmail, setCadastroEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cadastroCodigo, setCadastroCodigo] = useState('');
  const [cadastroErro, setCadastroErro] = useState('');
  const [cadastroCarregando, setCadastroCarregando] = useState(false);

  const { salvarAuth } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  // ── Login handlers (preserved from LoginForm) ──
  const handleLoginEnviarOTP = async (e: FormEvent) => {
    e.preventDefault();
    setLoginErro('');
    setLoginCarregando(true);
    try {
      await login(loginEmail);
      setLoginEtapa('otp');
    } catch (err) {
      setLoginErro(err instanceof Error ? err.message : t('Erro ao enviar código'));
    } finally {
      setLoginCarregando(false);
    }
  };

  const handleLoginVerificarOTP = async (e: FormEvent) => {
    e.preventDefault();
    setLoginErro('');
    setLoginCarregando(true);
    try {
      const res = await verificarLogin(loginEmail, loginCodigo);
      salvarAuth(res.token, { ...res.usuario, tipo: 'usuario' });
      router.push('/dashboard');
    } catch (err) {
      setLoginErro(err instanceof Error ? err.message : t('Código inválido'));
    } finally {
      setLoginCarregando(false);
    }
  };

  // ── Cadastro handlers (preserved from CadastroForm) ──
  const handleCadastro = async (e: FormEvent) => {
    e.preventDefault();
    setCadastroErro('');
    setCadastroCarregando(true);
    try {
      await cadastro(nome, cadastroEmail, telefone);
      setCadastroEtapa('otp');
    } catch (err) {
      setCadastroErro(err instanceof Error ? err.message : t('Erro ao cadastrar'));
    } finally {
      setCadastroCarregando(false);
    }
  };

  const handleCadastroVerificarOTP = async (e: FormEvent) => {
    e.preventDefault();
    setCadastroErro('');
    setCadastroCarregando(true);
    try {
      const res = await verificarCadastro(cadastroEmail, cadastroCodigo);
      salvarAuth(res.token, { ...res.usuario, tipo: 'usuario' });
      router.push('/dashboard');
    } catch (err) {
      setCadastroErro(err instanceof Error ? err.message : t('Código inválido'));
    } finally {
      setCadastroCarregando(false);
    }
  };

  // ── Shared OTP form ──
  const renderOTP = (opts: {
    titulo: string;
    email: string;
    codigo: string;
    setCodigo: (v: string) => void;
    erro: string;
    carregando: boolean;
    onSubmit: (e: FormEvent) => void;
    onVoltar: () => void;
    submitLabel: string;
    variant: 'primary' | 'secondary';
    idPrefix: string;
  }) => (
    <>
      <div className="mb-8">
        <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{t('Verificação')}</span>
        <h2 className="font-serif text-3xl text-emerald-950 mt-2">{opts.titulo}</h2>
        <p className="text-sm text-stone-500 mt-3 leading-relaxed">
          {t('Enviamos um código de verificação para')}{' '}
          <strong className="text-stone-700">{opts.email}</strong>
        </p>
      </div>
      <form className="space-y-6 flex-grow flex flex-col" onSubmit={opts.onSubmit}>
        {opts.erro && (
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg text-red-700 text-xs font-medium">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{opts.erro}</span>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-emerald-950/80 px-1" htmlFor={`${opts.idPrefix}-codigo`}>
            {t('Código de Verificação')}
          </label>
          <input
            className={`${inputClass} text-center text-xl tracking-[0.3em] font-bold`}
            id={`${opts.idPrefix}-codigo`}
            placeholder="000000"
            type="text"
            required
            maxLength={6}
            value={opts.codigo}
            onChange={(e) => opts.setCodigo(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="mt-auto space-y-3">
          <button
            className={`w-full font-semibold py-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
              opts.variant === 'primary'
                ? 'bg-emerald-950 text-white hover:bg-emerald-900'
                : 'bg-stone-200 text-emerald-950 font-bold hover:bg-stone-300'
            }`}
            type="submit"
            disabled={opts.carregando || opts.codigo.length !== 6}
          >
            <span>{opts.carregando ? t('Verificando...') : opts.submitLabel}</span>
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
          <button
            type="button"
            onClick={opts.onVoltar}
            className="w-full bg-stone-100 text-stone-700 font-medium py-4 rounded-lg hover:bg-stone-200 transition-all duration-300 active:scale-[0.98]"
          >
            {t('Voltar')}
          </button>
        </div>
      </form>
    </>
  );

  return (
    <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
      {/* ── Login Column ── */}
      <section className="glass-card p-10 rounded-xl flex flex-col shadow-sm border border-stone-200/10">
        {loginEtapa === 'otp' ? (
          renderOTP({
            titulo: t('Confirme seu acesso'),
            email: loginEmail,
            codigo: loginCodigo,
            setCodigo: setLoginCodigo,
            erro: loginErro,
            carregando: loginCarregando,
            onSubmit: handleLoginVerificarOTP,
            onVoltar: () => { setLoginEtapa('email'); setLoginCodigo(''); setLoginErro(''); },
            submitLabel: t('Entrar'),
            variant: 'primary',
            idPrefix: 'login',
          })
        ) : (
          <>
            <div className="mb-8">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{t('Acesso Rápido')}</span>
              <h2 className="font-serif text-3xl text-emerald-950 mt-2">{t('Já sou cliente')}</h2>
              <p className="text-sm text-stone-500 mt-3 leading-relaxed">
                {t('Não precisa de senha. Enviaremos um código único para o seu e-mail para um acesso seguro e rápido.')}
              </p>
            </div>
            <form className="space-y-6 flex-grow flex flex-col" onSubmit={handleLoginEnviarOTP}>
              {loginErro && (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg text-red-700 text-xs font-medium">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{loginErro}</span>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-950/80 px-1" htmlFor="login-email">
                  {t('Seu E-mail de Acesso')}
                </label>
                <input
                  className={inputClass}
                  id="login-email"
                  placeholder={t('exemplo@email.com')}
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="mt-auto">
                <button
                  className="w-full bg-emerald-950 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-900 transition-all duration-300 group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={loginCarregando}
                >
                  <span>{loginCarregando ? t('Enviando...') : t('Enviar Código por E-mail')}</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
                <div className="mt-4 flex items-center gap-3 p-3 bg-emerald-50/50 rounded-lg text-emerald-800 text-xs font-medium">
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span>{t('Se o e-mail estiver correto, você receberá o código em instantes.')}</span>
                </div>
              </div>
            </form>
          </>
        )}
      </section>

      {/* ── Cadastro Column ── */}
      <section className="bg-stone-100/40 p-10 rounded-xl flex flex-col shadow-sm border border-stone-200/10">
        {cadastroEtapa === 'otp' ? (
          renderOTP({
            titulo: t('Confirme seu cadastro'),
            email: cadastroEmail,
            codigo: cadastroCodigo,
            setCodigo: setCadastroCodigo,
            erro: cadastroErro,
            carregando: cadastroCarregando,
            onSubmit: handleCadastroVerificarOTP,
            onVoltar: () => { setCadastroEtapa('dados'); setCadastroCodigo(''); setCadastroErro(''); },
            submitLabel: t('Verificar código'),
            variant: 'secondary',
            idPrefix: 'cadastro',
          })
        ) : (
          <>
            <div className="mb-8">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{t('Primeira Vez')}</span>
              <h2 className="font-serif text-3xl text-emerald-950 mt-2">{t('Novo por aqui?')}</h2>
              <p className="text-sm text-stone-500 mt-3 leading-relaxed">
                {t('Inicie sua jornada global hoje. O cadastro leva menos de um minuto e garante sua segurança institucional.')}
              </p>
            </div>
            <form className="space-y-6 flex-grow flex flex-col" onSubmit={handleCadastro}>
              {cadastroErro && (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg text-red-700 text-xs font-medium">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{cadastroErro}</span>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-950/80 px-1" htmlFor="signup-name">
                  {t('Nome Completo')}
                </label>
                <input
                  className={inputClass}
                  id="signup-name"
                  placeholder={t('Como devemos chamar você?')}
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-950/80 px-1" htmlFor="signup-email">
                  {t('E-mail Pessoal')}
                </label>
                <input
                  className={inputClass}
                  id="signup-email"
                  placeholder={t('seu.melhor@email.com')}
                  type="email"
                  required
                  value={cadastroEmail}
                  onChange={(e) => setCadastroEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-950/80 px-1" htmlFor="signup-telefone">
                  {t('Telefone')}
                </label>
                <input
                  className={inputClass}
                  id="signup-telefone"
                  placeholder="(11) 99999-9999"
                  type="tel"
                  required
                  value={telefone}
                  maxLength={15}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                />
              </div>
              <div className="mt-auto">
                <button
                  className="w-full bg-stone-200 text-emerald-950 font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-stone-300 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={cadastroCarregando}
                >
                  <span>{cadastroCarregando ? t('Enviando...') : t('Criar Conta & Receber Acesso')}</span>
                  <span className="material-symbols-outlined text-lg">person_add</span>
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
