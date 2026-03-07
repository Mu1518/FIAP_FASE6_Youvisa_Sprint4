import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <>
      {/* Background Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/40 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-300/30 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar logoAsLink={false} />

        {/* Main Content */}
        <main className="flex-grow flex flex-col items-center justify-center py-10 md:py-20 px-4 md:px-6">
          {/* Hero Section */}
          <section className="max-w-3xl w-full text-center space-y-6 md:space-y-8 mb-16 md:mb-24 relative">
            <div className="absolute inset-0 bg-blue-600/5 blur-[100px] -z-10 rounded-full"></div>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black leading-tight tracking-tight text-slate-800 drop-shadow-sm">
              Sua Jornada Global,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Simplificada por IA</span>
            </h1>
            <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Experimente serviços consulares e de visto eficientes com nossa plataforma inteligente automatizada. Rápido, preciso e totalmente transparente.
            </p>
            <div className="pt-4">
              <Link href="/cadastro" className="flex items-center justify-center h-12 md:h-14 px-6 md:px-8 rounded-full bg-blue-600 text-white text-base md:text-lg font-bold shadow-xl shadow-blue-600/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-600/50 transition-all duration-300 mx-auto group w-fit">
                Iniciar Nova Solicitação
                <span className="material-symbols-outlined ml-2 group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </div>
          </section>

          {/* Features Section */}
          <section className="max-w-6xl w-full mb-12 md:mb-16">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-4 text-slate-800">Por que escolher a YouVisa?</h2>
              <p className="text-slate-600">Nossa plataforma orientada por IA garante um processo de solicitação de visto tranquilo e eficiente.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {/* Feature 1 */}
              <div className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-6 md:p-8 hover:bg-white/90 transition-colors duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">document_scanner</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-800">Análise Automatizada de Documentos</h3>
                <p className="text-slate-600 leading-relaxed">
                  Processamento de documentos rápido e preciso, impulsionado por modelos avançados de IA para minimizar erros.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-6 md:p-8 hover:bg-white/90 transition-colors duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-6 text-purple-600 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">monitoring</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-800">Acompanhamento em Tempo Real</h3>
                <p className="text-slate-600 leading-relaxed">
                  Mantenha-se atualizado sobre o status de sua solicitação em tempo real com notificações instantâneas.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-6 md:p-8 hover:bg-white/90 transition-colors duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-6 text-indigo-600 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">smart_toy</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-800">Assistência IA 24/7</h3>
                <p className="text-slate-600 leading-relaxed">
                  Obtenha respostas instantâneas e personalizadas para suas dúvidas sobre vistos a qualquer hora e em qualquer lugar.
                </p>
              </div>
            </div>
          </section>

          {/* Serviços rápidos */}
          <section className="max-w-6xl w-full">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">Nossos serviços</h2>
              <p className="text-slate-600">Cobertura completa para todas as suas necessidades de visto.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {[
                { label: 'Turista',    icon: 'beach_access', href: '/servicos#turista',    cor: 'blue' },
                { label: 'Estudante',  icon: 'school',       href: '/servicos#estudante',  cor: 'purple' },
                { label: 'Trabalho',   icon: 'work',         href: '/servicos#trabalho',   cor: 'green' },
                { label: 'Imigração',  icon: 'home_work',    href: '/servicos#imigracao',  cor: 'orange' },
                { label: 'Intercâmbio',icon: 'language',     href: '/servicos#intercambio',cor: 'indigo' },
              ].map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-5 text-center hover:bg-white/90 hover:-translate-y-1 transition-all group"
                >
                  <span className="material-symbols-outlined text-blue-600 text-[28px] mb-2 block group-hover:scale-110 transition-transform">{s.icon}</span>
                  <span className="text-sm font-medium text-slate-700">{s.label}</span>
                </Link>
              ))}
            </div>
            <div className="text-center">
              <Link
                href="/servicos"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
              >
                Ver detalhes de cada serviço
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </section>
        </main>

      </div>
    </>
  );
}
