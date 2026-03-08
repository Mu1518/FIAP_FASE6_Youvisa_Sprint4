import Link from 'next/link';
import Navbar from '@/components/Navbar';

const servicos = [
  {
    slug: 'turista',
    icon: 'beach_access',
    cor: 'blue',
    titulo: 'Visto de Turista',
    subtitulo: 'Explore o mundo com tranquilidade',
    descricao:
      'O visto de turista permite que você viaje para o exterior por fins recreativos, culturais ou de visita a familiares e amigos, sem exercer atividade remunerada. Ideal para quem deseja conhecer novos países com segurança e respaldo legal.',
    prazo: '15 a 45 dias úteis',
    validade: 'Geralmente 30 a 180 dias',
    documentos: [
      'Passaporte válido (mínimo 6 meses de validade)',
      'Formulário de solicitação preenchido',
      'Comprovante de renda e vínculo empregatício',
      'Extrato bancário dos últimos 3 meses',
      'Reserva de passagem aérea (ida e volta)',
      'Comprovante de hospedagem (hotel ou carta convite)',
      'Seguro viagem internacional',
      'Fotos 3x4 recentes',
    ],
    etapas: [
      'Cadastro e envio de documentos na plataforma',
      'Análise automatizada de elegibilidade',
      'Revisão por especialista YouVisa',
      'Agendamento consular (quando necessário)',
      'Emissão e entrega do visto',
    ],
  },
  {
    slug: 'estudante',
    icon: 'school',
    cor: 'purple',
    titulo: 'Visto de Estudante',
    subtitulo: 'Invista na sua educação global',
    descricao:
      'O visto de estudante é destinado a quem deseja cursar graduação, pós-graduação, idiomas ou outros programas acadêmicos reconhecidos no exterior. Garante sua permanência legal pelo período do curso com a possibilidade de extensão.',
    prazo: '20 a 60 dias úteis',
    validade: 'Duração do curso (renovável)',
    documentos: [
      'Passaporte válido',
      'Carta de aceitação da instituição de ensino',
      'Comprovante de pagamento de matrícula',
      'Comprovante de renda ou fiador financeiro',
      'Histórico escolar traduzido (juramentado)',
      'Comprovante de moradia no exterior',
      'Seguro saúde internacional',
      'Fotos 3x4 recentes',
    ],
    etapas: [
      'Cadastro e envio de documentos acadêmicos',
      'Verificação de autenticidade pela IA YouVisa',
      'Tradução e apostilamento orientados',
      'Submissão junto ao consulado',
      'Emissão do visto estudantil',
    ],
  },
  {
    slug: 'trabalho',
    icon: 'work',
    cor: 'green',
    titulo: 'Visto de Trabalho',
    subtitulo: 'Construa sua carreira internacional',
    descricao:
      'O visto de trabalho permite que profissionais exerçam atividade remunerada legalmente em outro país. Abrange desde transferências intraempresariais até contratações locais e empreendedorismo no exterior. Cada modalidade possui requisitos específicos conforme o país de destino.',
    prazo: '30 a 90 dias úteis',
    validade: '1 a 4 anos (renovável)',
    documentos: [
      'Passaporte válido',
      'Proposta ou contrato de trabalho no exterior',
      'Currículo profissional atualizado',
      'Diplomas e certificações (apostilados)',
      'Comprovante de experiência profissional',
      'Carta do empregador ou patrocinador',
      'Certidão de antecedentes criminais',
      'Exame médico (quando exigido)',
    ],
    etapas: [
      'Análise de perfil profissional e elegibilidade',
      'Orientação sobre modalidade de visto adequada',
      'Organização e verificação de documentos',
      'Protocolo junto ao órgão competente',
      'Aprovação e emissão do visto',
    ],
  },
  {
    slug: 'imigracao',
    icon: 'home_work',
    cor: 'orange',
    titulo: 'Imigração Permanente',
    subtitulo: 'Estabeleça sua nova vida no exterior',
    descricao:
      'O processo de imigração permanente é o mais completo e abrangente, permitindo que você resida indefinidamente em outro país e, futuramente, solicite a naturalização. Nossa equipe acompanha cada etapa dessa jornada complexa com suporte especializado e tecnologia de ponta.',
    prazo: '60 a 180 dias úteis',
    validade: 'Permanente (residência definitiva)',
    documentos: [
      'Passaporte válido',
      'Certidão de nascimento apostilada',
      'Certidão de casamento (se aplicável)',
      'Certidão de antecedentes criminais federal e estadual',
      'Comprovante de capacidade financeira',
      'Exame médico completo e vacinas',
      'Formulários específicos do país de destino',
      'Fotos biométricas padrão internacional',
    ],
    etapas: [
      'Consultoria inicial e análise de perfil imigratório',
      'Planejamento personalizado do processo',
      'Coleta, tradução e apostilamento de documentos',
      'Petição junto às autoridades imigratórias',
      'Acompanhamento de entrevistas e biometria',
      'Emissão do visto e orientações pós-chegada',
    ],
  },
  {
    slug: 'intercambio',
    icon: 'language',
    cor: 'indigo',
    titulo: 'Intercâmbio de Idiomas',
    subtitulo: 'Aprenda um idioma vivendo a cultura',
    descricao:
      'O programa de intercâmbio de idiomas combina aprendizado intensivo de línguas com imersão cultural completa. Nossa plataforma cuida de todo o processo burocrático — da matrícula na escola de idiomas à solicitação do visto — para que você foque apenas na experiência.',
    prazo: '10 a 30 dias úteis',
    validade: 'Duração do programa (1 semana a 12 meses)',
    documentos: [
      'Passaporte válido',
      'Comprovante de matrícula na escola de idiomas',
      'Comprovante de renda (pais ou responsável)',
      'Carta de intenção pessoal',
      'Histórico escolar',
      'Seguro viagem e saúde',
      'Comprovante de acomodação (família anfitriã ou residência)',
    ],
    etapas: [
      'Escolha do destino e programa de idiomas',
      'Inscrição e reserva na escola parceira',
      'Organização dos documentos de solicitação',
      'Emissão do visto (quando necessário por prazo)',
      'Orientações pré-viagem e suporte durante o intercâmbio',
    ],
  },
];

const corClasses: Record<string, { bg: string; text: string; badge: string; border: string; btn: string }> = {
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-600',   badge: 'bg-blue-50 text-blue-700 border-blue-200',   border: 'border-blue-200',   btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', badge: 'bg-purple-50 text-purple-700 border-purple-200', border: 'border-purple-200', btn: 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/30' },
  green:  { bg: 'bg-emerald-100',text: 'text-emerald-600',badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', badge: 'bg-orange-50 text-orange-700 border-orange-200', border: 'border-orange-200', btn: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', border: 'border-indigo-200', btn: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30' },
};

export default function Servicos() {
  return (
    <>
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-300/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-grow py-10 md:py-20 px-4 md:px-6">
          {/* Hero */}
          <section className="max-w-4xl mx-auto text-center mb-12 md:mb-20">
            <span className="inline-block text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full mb-6">
              Nossos Serviços
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight text-slate-800 mb-6 leading-tight">
              Soluções completas para<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                cada tipo de visto
              </span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Combinamos expertise humana com inteligência artificial para tornar cada processo
              mais ágil, seguro e transparente. Escolha o serviço que melhor atende à sua necessidade.
            </p>
          </section>

          {/* Cards de navegação rápida */}
          <section className="max-w-6xl mx-auto mb-20">
            <div className="flex flex-wrap justify-center gap-3">
              {servicos.map((s) => {
                const c = corClasses[s.cor];
                return (
                  <a
                    key={s.slug}
                    href={`#${s.slug}`}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all hover:-translate-y-0.5 ${c.badge} ${c.border}`}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${c.text}`}>{s.icon}</span>
                    {s.titulo}
                  </a>
                );
              })}
            </div>
          </section>

          {/* Serviços detalhados */}
          <div className="max-w-6xl mx-auto space-y-16">
            {servicos.map((s) => {
              const c = corClasses[s.cor];
              return (
                <section
                  key={s.slug}
                  id={s.slug}
                  className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-3xl p-8 md:p-12 scroll-mt-24"
                >
                  {/* Cabeçalho */}
                  <div className="flex flex-col md:flex-row md:items-start gap-6 mb-10">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${c.bg} ${c.text}`}>
                      <span className="material-symbols-outlined text-[36px]">{s.icon}</span>
                    </div>
                    <div className="flex-grow">
                      <h2 className="text-3xl font-black text-slate-800 mb-1">{s.titulo}</h2>
                      <p className={`text-sm font-semibold mb-3 ${c.text}`}>{s.subtitulo}</p>
                      <p className="text-slate-600 leading-relaxed max-w-3xl">{s.descricao}</p>
                    </div>
                    <div className="flex md:flex-col gap-4 md:gap-3 shrink-0 text-sm">
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${c.badge} ${c.border}`}>
                        <span className={`material-symbols-outlined text-[16px] ${c.text}`}>schedule</span>
                        <div>
                          <div className="text-xs opacity-70">Prazo médio</div>
                          <div className="font-semibold">{s.prazo}</div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${c.badge} ${c.border}`}>
                        <span className={`material-symbols-outlined text-[16px] ${c.text}`}>event_available</span>
                        <div>
                          <div className="text-xs opacity-70">Validade</div>
                          <div className="font-semibold">{s.validade}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-10">
                    {/* Documentos necessários */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[20px] ${c.text}`}>folder_open</span>
                        Documentos Necessários
                      </h3>
                      <ul className="space-y-2.5">
                        {s.documentos.map((doc, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                            <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${c.text}`}>check_circle</span>
                            {doc}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Etapas do processo */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[20px] ${c.text}`}>route</span>
                        Etapas do Processo
                      </h3>
                      <ol className="space-y-3">
                        {s.etapas.map((etapa, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white ${c.btn.split(' ')[0]}`}>
                              {i + 1}
                            </div>
                            <span className="text-sm text-slate-600 pt-0.5">{etapa}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-10 pt-8 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-slate-500">
                      Tire suas dúvidas com nosso assistente IA ou inicie sua solicitação agora.
                    </p>
                    <Link
                      href="/cadastro"
                      className={`flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:-translate-y-0.5 ${c.btn}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      Iniciar Solicitação
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>

          {/* CTA final */}
          <section className="max-w-3xl mx-auto mt-24 text-center">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-12 text-white shadow-2xl shadow-blue-600/20">
              <h2 className="text-3xl font-black mb-4">Ainda com dúvidas?</h2>
              <p className="text-white/80 text-lg mb-8 leading-relaxed">
                Nosso assistente de IA está disponível 24 horas por dia para responder suas perguntas
                sobre vistos, prazos e documentação necessária.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/cadastro"
                  className="flex items-center justify-center h-12 px-8 rounded-xl bg-white text-blue-600 font-bold hover:bg-blue-50 transition-colors"
                >
                  Criar Conta Grátis
                </Link>
                <Link
                  href="/sobre"
                  className="flex items-center justify-center h-12 px-8 rounded-xl bg-white/20 text-white font-bold border border-white/30 hover:bg-white/30 transition-colors"
                >
                  Conheça a YouVisa
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
