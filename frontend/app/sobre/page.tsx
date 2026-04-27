'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

const valores = [
  { icon: 'verified', cor: 'blue', titulo: 'Transparência',
    descricao: 'Cada etapa do seu processo é visível em tempo real. Você sempre sabe exatamente onde sua solicitação está e o que acontecerá a seguir.' },
  { icon: 'speed', cor: 'purple', titulo: 'Agilidade',
    descricao: 'Nossa plataforma de IA analisa documentos, identifica inconsistências e acelera a instrução dos processos, reduzindo drasticamente o tempo de espera.' },
  { icon: 'security', cor: 'green', titulo: 'Segurança',
    descricao: 'Seus dados e documentos são protegidos com criptografia de nível bancário e armazenados em infraestrutura certificada na nuvem.' },
  { icon: 'diversity_3', cor: 'orange', titulo: 'Humanidade',
    descricao: 'A tecnologia está a serviço das pessoas. Por trás de cada processo existe um especialista pronto para intervir, orientar e garantir o melhor resultado.' },
];

const numeros = [
  { valor: '12.000+', label: 'Vistos emitidos' },
  { valor: '98%', label: 'Taxa de aprovação' },
  { valor: '40+', label: 'Países atendidos' },
  { valor: '24h', label: 'Suporte via IA' },
];

const equipe = [
  { nome: 'Amanda Fragnan', cargo: 'Desenvolvedora', link: 'https://www.linkedin.com/in/amanda-fragnan-b61537255', icon: 'person' },
  { nome: 'Iolanda Manzali', cargo: 'Desenvolvedora', link: 'https://www.linkedin.com/in/iolanda-helena-fabbrini-manzali-de-oliveira-14ab8ab0', icon: 'person' },
  { nome: 'Jônatas Gomes Alves', cargo: 'Desenvolvedor', link: 'https://www.linkedin.com/in/jonatasgomes', icon: 'person' },
  { nome: 'Murilo Carone Nasser', cargo: 'Desenvolvedor', link: 'https://www.linkedin.com/company/inova-fusca', icon: 'person' },
  { nome: 'Pedro Eduardo Soares de Sousa', cargo: 'Desenvolvedor', link: 'https://www.linkedin.com/in/pedro-eduardo-soares-de-sousa-439552309', icon: 'person' },
];

const corClasses: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  green: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-500' },
};

const timelineItems = [
  { ano: '2021', evento: 'Fundação da YouVisa e lançamento da versão beta da plataforma' },
  { ano: '2022', evento: 'Integração de IA para análise automatizada de documentos' },
  { ano: '2023', evento: 'Expansão para 40+ países e alcance de 5.000 vistos emitidos' },
  { ano: '2024', evento: 'Lançamento do assistente virtual com IA generativa 24/7' },
  { ano: '2025', evento: 'Plataforma multicanal com acompanhamento em tempo real' },
];

const passosComoFunciona = [
  { step: '01', icon: 'person_add', titulo: 'Cadastro simplificado', desc: 'Crie sua conta em segundos com autenticação por código OTP — sem senhas para lembrar.' },
  { step: '02', icon: 'upload_file', titulo: 'Envio de documentos', desc: 'Faça upload dos seus documentos pela plataforma. Nossa IA os analisa, classifica e valida automaticamente.' },
  { step: '03', icon: 'manage_search', titulo: 'Análise inteligente', desc: 'Especialistas revisam os resultados da IA e orientam sobre eventuais pendências ou complementações.' },
  { step: '04', icon: 'monitoring', titulo: 'Acompanhamento em tempo real', desc: 'Receba notificações a cada mudança de status e consulte o andamento do processo a qualquer momento.' },
  { step: '05', icon: 'task_alt', titulo: 'Visto emitido', desc: 'Com aprovação, você recebe orientações pós-visto e suporte para o que precisar a seguir.' },
];

export default function Sobre() {
  const { t } = useI18n();
  return (
    <>
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-300/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-grow py-10 md:py-20 px-4 md:px-6">

          <section className="max-w-4xl mx-auto text-center mb-16 md:mb-24">
            <span className="inline-block text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full mb-6">
              {t('Sobre Nós')}
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight text-slate-800 mb-6 leading-tight">
              {t('Tornando fronteiras')}<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                {t('mais acessíveis')}
              </span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {t('A YouVisa nasceu da crença de que ninguém deveria perder oportunidades por causa da burocracia. Combinamos inteligência artificial, especialistas em imigração e uma plataforma digital intuitiva para transformar processos complexos em jornadas simples.')}
            </p>
          </section>

          <section className="max-w-6xl mx-auto mb-16 md:mb-24">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-6">{t('Nossa história')}</h2>
                <div className="space-y-4 text-slate-600 leading-relaxed">
                  <p>{t('Fundada em 2021, a YouVisa surgiu de uma necessidade real: simplificar o acesso a serviços consulares para brasileiros que desejam estudar, trabalhar ou se estabelecer no exterior. Nosso time de fundadores viveu na pele a frustração de processos lentos, documentações perdidas e comunicação falha com consulados.')}</p>
                  <p>{t('Decidimos unir expertise jurídica-consular com tecnologia de ponta para criar uma plataforma que funciona como um escritório de imigração digital. Nossa IA analisa documentos, identifica inconsistências e mantém o cliente informado em cada etapa, enquanto nossa equipe especializada cuida das nuances que só a experiência humana pode resolver.')}</p>
                  <p>{t('Hoje, com mais de 12.000 vistos emitidos e 98% de taxa de aprovação, somos a referência em serviços imigratórios inteligentes para o mercado brasileiro.')}</p>
                </div>
              </div>

              <div className="space-y-6">
                {timelineItems.map((item, i) => (
                  <div key={i} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {item.ano.slice(2)}
                      </div>
                      {i < 4 && <div className="w-px flex-grow bg-blue-200 mt-2" />}
                    </div>
                    <div className="pb-6">
                      <div className="text-sm font-bold text-blue-600 mb-1">{item.ano}</div>
                      <p className="text-sm text-slate-600">{t(item.evento)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto mb-16 md:mb-24">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-6 md:p-12 text-white">
              <h2 className="text-2xl md:text-3xl font-black text-center mb-8 md:mb-12">{t('YouVisa em números')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
                {numeros.map((n, i) => (
                  <div key={i}>
                    <div className="text-3xl md:text-5xl font-black mb-2">{n.valor}</div>
                    <div className="text-white/70 text-sm font-medium">{t(n.label)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto mb-16 md:mb-24">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">{t('Nossos valores')}</h2>
              <p className="text-slate-600 max-w-xl mx-auto">
                {t('Os princípios que guiam cada decisão que tomamos e cada processo que cuidamos.')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {valores.map((v) => {
                const c = corClasses[v.cor];
                return (
                  <div key={v.titulo} className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-5 md:p-8 flex gap-4 md:gap-5 hover:bg-white/90 transition-colors group">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.bg} ${c.text} group-hover:scale-110 transition-transform`}>
                      <span className="material-symbols-outlined text-[26px]">{v.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">{t(v.titulo)}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{t(v.descricao)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="max-w-4xl mx-auto mb-16 md:mb-24">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">{t('Como a plataforma funciona')}</h2>
              <p className="text-slate-600 max-w-xl mx-auto">
                {t('Tecnologia e expertise humana trabalhando juntas em cada solicitação.')}
              </p>
            </div>
            <div className="grid gap-4">
              {passosComoFunciona.map((item) => (
                <div key={item.step} className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-6 flex items-start gap-5 hover:bg-white/90 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                    {item.step}
                  </div>
                  <div className="flex items-start gap-4 flex-grow">
                    <span className="material-symbols-outlined text-blue-600 text-[24px] mt-0.5">{item.icon}</span>
                    <div>
                      <h3 className="font-bold text-slate-800 mb-1">{t(item.titulo)}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{t(item.desc)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-6xl mx-auto mb-16 md:mb-24">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">{t('Nosso time')}</h2>
              <p className="text-slate-600 max-w-xl mx-auto">
                {t('Profissionais apaixonados por tecnologia e por abrir portas para quem quer ir mais longe.')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {equipe.map((m) => (
                <div key={m.nome} className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-6 text-center hover:bg-white/90 transition-colors">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-[32px]">{m.icon}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 mb-0.5">{m.nome}</h3>
                  <p className="text-xs font-semibold text-blue-600 mb-3">{t(m.cargo)}</p>
                  <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline leading-relaxed break-all inline-block mt-1">{t('Ver perfil no LinkedIn')}</a>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">
              {t('Pronto para iniciar sua jornada?')}
            </h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              {t('Faça parte dos mais de 12.000 clientes que confiaram na YouVisa para realizar o sonho de viver, estudar ou trabalhar no exterior.')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/clientes" className="flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all">
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                {t('Criar Conta Grátis')}
              </Link>
              <Link href="/servicos" className="flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-white border border-gray-200 text-slate-700 font-medium hover:bg-gray-50 transition-all">
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
                {t('Ver Serviços')}
              </Link>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
