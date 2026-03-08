'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { cadastro, verificarCadastro } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function CadastroForm() {
  const [etapa, setEtapa] = useState<'dados' | 'otp'>('dados');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { salvarAuth } = useAuth();
  const router = useRouter();

  const handleCadastro = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await cadastro(nome, email, telefone);
      setEtapa('otp');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setCarregando(false);
    }
  };

  const handleVerificarOTP = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await verificarCadastro(email, codigo);
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
            {carregando ? 'Verificando...' : 'Verificar Código'}
          </button>
          <button
            type="button"
            onClick={() => { setEtapa('dados'); setCodigo(''); setErro(''); }}
            className="w-full flex items-center justify-center h-12 rounded-xl bg-white border border-gray-200 text-slate-700 font-medium hover:bg-gray-50 transition-all"
          >
            Voltar
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleCadastro}>
      {erro && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-medium text-center">
          {erro}
        </div>
      )}

      <div>
        <label htmlFor="nome" className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
        <input
          type="text"
          id="nome"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
          placeholder="João da Silva"
        />
      </div>

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

      <div>
        <label htmlFor="telefone" className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
        <input
          type="tel"
          id="telefone"
          required
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
          placeholder="(11) 99999-9999"
        />
      </div>

      <div className="pt-4 flex flex-col gap-3">
        <button
          type="submit"
          disabled={carregando}
          className="w-full flex items-center justify-center h-12 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {carregando ? 'Enviando...' : 'Cadastrar'}
        </button>
        <Link
          href="/"
          className="w-full flex items-center justify-center h-12 rounded-xl bg-white border border-gray-200 text-slate-700 font-medium hover:bg-gray-50 transition-all"
        >
          Cancelar
        </Link>
      </div>

      <p className="text-center text-sm text-slate-500">
        Já tem conta?{' '}
        <Link href="/login" className="text-blue-600 font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
