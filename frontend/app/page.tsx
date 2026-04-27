'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
      <Navbar logoAsLink={false} />

      {/* Hero Section — full viewport with map background */}
      <main className="flex-grow hero-background flex flex-col items-center justify-center px-4 pt-24 pb-16 md:pt-0 md:pb-0 min-h-screen">
        <div className="max-w-4xl text-center space-y-1">
          <h1 className="text-5xl md:text-[4.5rem] font-bold text-slate-800 leading-[1.1] tracking-tight">
            {t('Seu visto simples')}
          </h1>
          <p className="text-xl md:text-[1.8rem] text-slate-700 font-normal">
            {t('para viajar, trabalhar, estudar ou morar')}
          </p>

          {/* Search Bar */}
          <div className="search-container bg-white rounded-2xl md:rounded-full mt-12 p-2 flex flex-col md:flex-row items-center w-full max-w-4xl mx-auto border border-gray-100">
            {/* Destino */}
            <div className="flex-1 px-6 md:px-8 py-3 text-left w-full border-b md:border-b-0 md:border-r border-gray-100">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('Destino')}</label>
              <select className="block w-full border-none p-0 text-gray-500 focus:ring-0 bg-transparent cursor-pointer text-sm">
                <option>{t('Selecione')}</option>
                <option>{t('Estados Unidos')}</option>
                <option>{t('Canadá')}</option>
                <option>{t('Portugal')}</option>
                <option>{t('Reino Unido')}</option>
                <option>{t('Austrália')}</option>
              </select>
            </div>
            {/* Motivo */}
            <div className="flex-1 px-6 md:px-8 py-3 text-left w-full border-b md:border-b-0 md:border-r border-gray-100">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('Motivo da viagem')}</label>
              <select className="block w-full border-none p-0 text-gray-500 focus:ring-0 bg-transparent cursor-pointer text-sm">
                <option>{t('Selecione')}</option>
                <option>{t('Turismo')}</option>
                <option>{t('Trabalho')}</option>
                <option>{t('Estudo')}</option>
                <option>{t('Imigração')}</option>
                <option>{t('Intercâmbio')}</option>
              </select>
            </div>
            {/* Quando */}
            <div className="flex-1 px-6 md:px-8 py-3 text-left w-full flex items-center justify-between">
              <div className="w-full">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('Quando')}</label>
                <select className="block w-full border-none p-0 text-gray-500 focus:ring-0 bg-transparent cursor-pointer text-sm">
                  <option>{t('Selecione')}</option>
                  <option>{t('Imediato')}</option>
                  <option>{t('Próximos 3 meses')}</option>
                  <option>{t('Próximos 6 meses')}</option>
                  <option>{t('Próximo ano')}</option>
                </select>
              </div>
              {/* Search Button */}
              <Link
                href="/clientes"
                className="bg-green-500 w-12 h-12 rounded-full flex items-center justify-center text-white hover:brightness-110 transition-all shadow-md shrink-0 ml-4"
              >
                <span className="material-symbols-outlined text-[20px]">search</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
