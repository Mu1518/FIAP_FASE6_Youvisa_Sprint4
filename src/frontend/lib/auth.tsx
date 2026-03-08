'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  tipo: 'usuario' | 'funcionario';
}

interface AuthContextType {
  usuario: Usuario | null;
  token: string | null;
  salvarAuth: (token: string, usuario: Usuario) => void;
  logout: () => void;
  carregando: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const tokenSalvo = localStorage.getItem('youvisa_token');
    const usuarioSalvo = localStorage.getItem('youvisa_usuario');
    if (tokenSalvo && usuarioSalvo) {
      setToken(tokenSalvo);
      setUsuario(JSON.parse(usuarioSalvo));
    }
    setCarregando(false);
  }, []);

  const salvarAuth = (novoToken: string, novoUsuario: Usuario) => {
    localStorage.setItem('youvisa_token', novoToken);
    localStorage.setItem('youvisa_usuario', JSON.stringify(novoUsuario));
    setToken(novoToken);
    setUsuario(novoUsuario);
  };

  const logout = () => {
    localStorage.removeItem('youvisa_token');
    localStorage.removeItem('youvisa_usuario');
    setToken(null);
    setUsuario(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ usuario, token, salvarAuth, logout, carregando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
