'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { adminLogin, verificarAdminLogin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

const inputClass =
  'w-full bg-stone-50 border-b border-stone-300/30 px-4 py-4 rounded-lg focus:ring-0 focus:bg-white focus:border-emerald-900 transition-all duration-300 outline-none text-stone-900 placeholder:text-stone-400';

export default function AdminLoginForm() {
  const [etapa, setEtapa] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { salvarAuthAdmin } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  const handleEnviarOTP = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await adminLogin(email);
      setEtapa('otp');
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao enviar código'));
    } finally {
      setCarregando(false);
    }
  };

  const handleVerificarOTP = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await verificarAdminLogin(email, codigo);
      salvarAuthAdmin(res.token, { ...res.funcionario, tipo: 'funcionario' });
      router.push('/admin/dashboard');
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Código inválido'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <section className="glass-card max-w-md w-full p-10 rounded-xl flex flex-col shadow-sm border border-stone-200/10">
      {etapa === 'otp' ? (
        <>
          <div className="mb-8">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{t('Verificação Admin')}</span>
            <h2 className="font-serif text-3xl text-emerald-950 mt-2">{t('Confirme seu acesso')}</h2>
            <p className="text-sm text-stone-500 mt-3 leading-relaxed">
              {t('Enviamos um código de verificação para')}{' '}
              <strong className="text-stone-700">{email}</strong>
            </p>
          </div>
          <form className="space-y-6 flex-grow flex flex-col" onSubmit={handleVerificarOTP}>
            {erro && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg text-red-700 text-xs font-medium">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{erro}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-950/80 px-1" htmlFor="login-codigo">
                {t('Código de Verificação')}
              </label>
              <input
                className={`${inputClass} text-center text-xl tracking-[0.3em] font-bold`}
                id="login-codigo"
                placeholder="000000"
                type="text"
                required
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="mt-8 space-y-3">
              <button
                className="w-full font-semibold py-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-950 text-white hover:bg-emerald-900"
                type="submit"
                disabled={carregando || codigo.length !== 6}
              >
                <span>{carregando ? t('Verificando...') : t('Acessar Painel')}</span>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => { setEtapa('email'); setCodigo(''); setErro(''); }}
                className="w-full bg-stone-100 text-stone-700 font-medium py-4 rounded-lg hover:bg-stone-200 transition-all duration-300 active:scale-[0.98]"
              >
                {t('Voltar')}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="mb-8">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{t('Administração')}</span>
            <h2 className="font-serif text-3xl text-emerald-950 mt-2">{t('Acesso Restrito')}</h2>
            <p className="text-sm text-stone-500 mt-3 leading-relaxed">
              {t('Área exclusiva para colaboradores YouVisa. Acesse e gerencie os processos de vistos e imigração de nossos clientes.')}
            </p>
          </div>
          <form className="space-y-6 flex-grow flex flex-col" onSubmit={handleEnviarOTP}>
            {erro && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg text-red-700 text-xs font-medium">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{erro}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-950/80 px-1" htmlFor="login-email">
                {t('E-mail Corporativo')}
              </label>
              <input
                className={inputClass}
                id="login-email"
                placeholder="funcionario@youvisa.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mt-8">
              <button
                className="w-full bg-emerald-950 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-900 transition-all duration-300 group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={carregando}
              >
                <span>{carregando ? t('Enviando...') : t('Enviar Código por E-mail')}</span>
                <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
              <div className="mt-4 flex items-center gap-3 p-3 bg-emerald-50/50 rounded-lg text-emerald-800 text-xs font-medium">
                <span className="material-symbols-outlined text-base">security</span>
                <span>{t('Acesso restrito para colaboradores da YouVisa.')}</span>
              </div>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
