'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavbarProps {
  logoAsLink?: boolean;
}

export default function Navbar({ logoAsLink = true }: NavbarProps) {
  const [menuAberto, setMenuAberto] = useState(false);

  const Logo = (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
        <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
      </div>
      <span className="text-xl font-bold tracking-tight text-slate-800">YouVisa</span>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-black/5 px-4 md:px-8 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {logoAsLink ? (
          <Link href="/">{Logo}</Link>
        ) : (
          Logo
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/servicos"
            className="text-sm font-medium hover:text-blue-600 transition-colors text-slate-600"
          >
            Serviços
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium hover:text-blue-600 transition-colors text-slate-600"
          >
            Acompanhar Processo
          </Link>
          <Link
            href="/sobre"
            className="text-sm font-medium hover:text-blue-600 transition-colors text-slate-600"
          >
            Sobre Nós
          </Link>
        </nav>

        {/* Desktop buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/login"
            className="flex items-center justify-center h-10 px-4 rounded-lg text-sm font-medium hover:bg-black/5 transition-colors text-slate-700"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="flex items-center justify-center h-10 px-5 rounded-lg bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all"
          >
            Novo Cliente
          </Link>
        </div>

        {/* Mobile buttons */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            href="/login"
            className="flex items-center justify-center h-9 px-3 rounded-lg text-sm font-medium hover:bg-black/5 transition-colors text-slate-700"
          >
            Entrar
          </Link>
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-black/5 transition-colors text-slate-700"
            aria-label="Abrir menu"
          >
            <span className="material-symbols-outlined text-[24px]">
              {menuAberto ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuAberto && (
        <div className="md:hidden border-t border-black/5 mt-4 pt-4 pb-2">
          <nav className="flex flex-col gap-1 max-w-6xl mx-auto">
            <Link
              href="/servicos"
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-black/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-blue-600">travel_explore</span>
              Serviços
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-black/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-blue-600">dashboard</span>
              Acompanhar Processo
            </Link>
            <Link
              href="/sobre"
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-black/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px] text-blue-600">info</span>
              Sobre Nós
            </Link>
            <div className="border-t border-black/5 mt-2 pt-2">
              <Link
                href="/cadastro"
                onClick={() => setMenuAberto(false)}
                className="flex items-center justify-center h-11 rounded-lg bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all"
              >
                Novo Cliente
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
