'use client';

import Link from 'next/link';
import ClientesContent from './ClientesContent';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n';

export default function Clientes() {
  const { t } = useI18n();

  return (
    <div className="bg-[#fbf9f6] text-[#1b1c1a] min-h-screen flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 px-8 h-20 flex items-center justify-between">
        <div className="w-24" />
        <Link href="/">
          <h1 className="font-serif text-3xl font-bold tracking-tighter text-emerald-950">YouVisa</h1>
        </Link>
        <div className="w-24 flex justify-end">
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center pt-20 pb-12 px-6 map-bg">
        <ClientesContent />
      </main>

      {/* Footer */}
      <footer className="bg-stone-50 border-t border-stone-200/10">
        <div className="max-w-screen-2xl mx-auto py-8 px-8 flex flex-col sm:flex-row items-center gap-4">
          <div className="sm:w-1/4 flex justify-start">
            <span className="font-serif text-xl font-bold text-emerald-950">YouVisa</span>
          </div>
          <div className="sm:w-2/4 flex justify-center text-center">
            <p className="text-xs tracking-wide text-slate-500 uppercase">
              &copy; 2024 YouVisa. {t('Consultoria de Elite em Imigração')}
            </p>
          </div>
          <nav className="sm:w-1/4 flex justify-end gap-8">
            <Link className="text-sm text-slate-500 hover:text-emerald-950 transition-colors duration-200" href="#">
              {t('Termos de Uso')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
