'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';

interface NavbarProps {
  logoAsLink?: boolean;
}

export default function Navbar({ logoAsLink = true }: NavbarProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const { t } = useI18n();

  const Logo = (
    <div className="flex items-center gap-2">
      <Image src="/logo.png" alt="YouVisa" width={32} height={32} className="w-8 h-8" />
      <span className="text-2xl font-bold tracking-tight text-slate-800">YOUVISA</span>
    </div>
  );

  return (
    <header className="w-full py-5 px-6 md:px-16 bg-white/80 backdrop-blur-sm fixed top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {logoAsLink ? (
          <Link href="/">{Logo}</Link>
        ) : (
          Logo
        )}

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8">
          <Link
            href="#"
            className="text-sm font-medium hover:text-emerald-600 transition-colors text-slate-600"
          >
            {t('Vistos')}
          </Link>
          <Link
            href="#"
            className="text-sm font-medium hover:text-emerald-600 transition-colors text-slate-600"
          >
            {t('Cidadania')}
          </Link>
          <Link
            href="#"
            className="text-sm font-medium hover:text-emerald-600 transition-colors text-slate-600"
          >
            {t('Imigração')}
          </Link>
          <Link
            href="#"
            className="text-sm font-medium hover:text-emerald-600 transition-colors text-slate-600"
          >
            {t('Suporte')}
          </Link>
          <Link
            href="#"
            className="text-sm font-medium hover:text-emerald-600 transition-colors text-slate-600"
          >
            {t('Sobre Nós')}
          </Link>
        </nav>

        {/* Desktop buttons */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            href="/clientes"
            className="flex items-center justify-center h-10 px-6 rounded-full bg-emerald-900 text-white text-sm font-medium shadow-sm hover:bg-emerald-800 transition-all"
          >
            {t('Clientes')}
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Mobile buttons */}
        <div className="flex lg:hidden items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-black/5 transition-colors text-slate-700"
            aria-label={t('Abrir menu')}
          >
            <span className="material-symbols-outlined text-[24px]">
              {menuAberto ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuAberto && (
        <div className="lg:hidden border-t border-black/5 mt-4 pt-4 pb-2">
          <nav className="flex flex-col gap-1 max-w-7xl mx-auto">
            <Link
              href="#"
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-black/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-emerald-600">travel_explore</span>
              {t('Vistos')}
            </Link>
            <Link
              href="#"
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-black/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-emerald-600">badge</span>
              {t('Cidadania')}
            </Link>
            <Link
              href="#"
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-black/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-emerald-600">flight_takeoff</span>
              {t('Imigração')}
            </Link>
            <Link
              href="#"
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-black/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-emerald-600">support_agent</span>
              {t('Suporte')}
            </Link>
            <Link
              href="#"
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-black/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-emerald-600">info</span>
              {t('Sobre Nós')}
            </Link>
            <div className="border-t border-black/5 mt-2 pt-2">
              <Link
                href="/clientes"
                onClick={() => setMenuAberto(false)}
                className="flex items-center justify-center h-11 rounded-full bg-emerald-900 text-white text-sm font-medium shadow-sm hover:bg-emerald-800 transition-all"
              >
                {t('Clientes')}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
