import ProcessoDetalhe from './ProcessoDetalhe';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProcessoDetalhePage({ params }: Props) {
  const { id } = await params;
  return <ProcessoDetalhe processoId={Number(id)} />;
}
