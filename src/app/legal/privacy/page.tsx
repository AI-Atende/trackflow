export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-brand-500">Políticas da Plataforma</h1>
        <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString()}</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Coleta de Informações</h2>
          <p>Coletamos informações que você nos fornece diretamente, como nome, e-mail e dados de contato, bem como informações sobre o uso da plataforma.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Uso das Informações</h2>
          <p>Usamos as informações coletadas para operar, manter e melhorar a plataforma, bem como para nos comunicarmos com você sobre atualizações e ofertas.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Compartilhamento de Informações</h2>
          <p>Não vendemos ou alugamos suas informações pessoais para terceiros. Podemos compartilhar informações com prestadores de serviços que nos ajudam a operar a plataforma.</p>
        </section>
      </div>
    </div>
  );
}
