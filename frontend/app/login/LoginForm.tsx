'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { login, verificarLogin } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginForm() {
  const [etapa, setEtapa] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { salvarAuth } = useAuth();
  const router = useRouter();

  const handleEnviarOTP = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email);
      setEtapa('otp');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar código');
    } finally {
      setCarregando(false);
    }
  };

  const handleVerificarOTP = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await verificarLogin(email, codigo);
      salvarAuth(res.token, { ...res.usuario, tipo: 'usuario' });
      router.push('/dashboard');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      setCarregando(false);
    }
  };

  if (etapa === 'otp') {
    return (
      <form className="space-y-5" onSubmit={handleVerificarOTP}>
        {erro && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-medium text-center">
            {erro}
          </div>
        )}

        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-3 text-green-600">
            <span className="material-symbols-outlined text-[28px]">mail</span>
          </div>
          <p className="text-slate-600 text-sm">
            Enviamos um código de verificação para<br />
            <strong className="text-slate-800">{email}</strong>
          </p>
        </div>

        <div>
          <label htmlFor="codigo" className="block text-sm font-medium text-slate-700 mb-1">Código de Verificação</label>
          <input
            type="text"
            id="codigo"
            required
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-center text-xl sm:text-2xl tracking-[0.3em] sm:tracking-[0.5em] font-bold"
            placeholder="000000"
          />
        </div>

        <div className="pt-4 flex flex-col gap-3">
          <button
            type="submit"
            disabled={carregando || codigo.length !== 6}
            className="w-full flex items-center justify-center h-12 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Verificando...' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => { setEtapa('email'); setCodigo(''); setErro(''); }}
            className="w-full flex items-center justify-center h-12 rounded-xl bg-white border border-gray-200 text-slate-700 font-medium hover:bg-gray-50 transition-all"
          >
            Voltar
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleEnviarOTP}>
      {erro && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-medium text-center">
          {erro}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
        <input
          type="email"
          id="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
          placeholder="joao@exemplo.com"
        />
      </div>

      <div className="pt-4 flex flex-col gap-3">
        <button
          type="submit"
          disabled={carregando}
          className="w-full flex items-center justify-center h-12 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {carregando ? 'Enviando...' : 'Enviar Código'}
        </button>
        <Link
          href="/"
          className="w-full flex items-center justify-center h-12 rounded-xl bg-white border border-gray-200 text-slate-700 font-medium hover:bg-gray-50 transition-all"
        >
          Voltar
        </Link>
      </div>

      <p className="text-center text-sm text-slate-500">
        Não tem conta?{' '}
        <Link href="/cadastro" className="text-blue-600 font-medium hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
