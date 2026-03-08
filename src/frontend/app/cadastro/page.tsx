import Link from 'next/link';
import CadastroForm from './CadastroForm';

export default function Cadastro() {
  return (
    <>
      {/* Background Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/40 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-300/30 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-black/5 px-4 md:px-8 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">YouVisa</h2>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow flex flex-col items-center justify-center py-10 md:py-20 px-4 md:px-6">
          <div className="w-full max-w-md bg-white/70 backdrop-blur-md border border-black/5 shadow-xl rounded-3xl p-6 md:p-8 relative">
            <div className="absolute inset-0 bg-blue-600/5 blur-[50px] -z-10 rounded-3xl"></div>
            
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-600">
                <span className="material-symbols-outlined text-[28px]">person_add</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Criar sua conta</h1>
              <p className="text-slate-600 mt-2">Preencha os dados abaixo para começar</p>
            </div>

            <CadastroForm />
          </div>
        </main>
      </div>
    </>
  );
}
