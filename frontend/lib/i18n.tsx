'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { translations } from './i18n-dict';
import { atualizarIdioma } from './api';

export type Idioma = 'pt-BR' | 'en';

interface I18nContextType {
  idioma: Idioma;
  setIdioma: (i: Idioma) => void;
  t: (chave: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'youvisa_idioma';

function interpolar(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k])), str);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>('pt-BR');

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY) as Idioma | null;
    if (salvo === 'pt-BR' || salvo === 'en') {
      setIdiomaState(salvo);
      document.documentElement.lang = salvo === 'en' ? 'en' : 'pt-BR';
    }
  }, []);

  const setIdioma = useCallback((novo: Idioma) => {
    localStorage.setItem(STORAGE_KEY, novo);
    setIdiomaState(novo);
    document.documentElement.lang = novo === 'en' ? 'en' : 'pt-BR';
    // Notifica backend se houver sessão de usuário autenticado (não bloqueia UI)
    const token = localStorage.getItem('youvisa_token');
    if (token) {
      const idiomaBackend = novo === 'en' ? 'en-US' : 'pt-BR';
      atualizarIdioma(token, idiomaBackend).catch(() => {});
    }
  }, []);

  const t = useCallback(
    (chave: string, vars?: Record<string, string | number>): string => {
      if (idioma === 'pt-BR') return interpolar(chave, vars);
      const traducao = translations[chave];
      return interpolar(traducao ?? chave, vars);
    },
    [idioma],
  );

  return (
    <I18nContext.Provider value={{ idioma, setIdioma, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n deve ser usado dentro de I18nProvider');
  return ctx;
}
