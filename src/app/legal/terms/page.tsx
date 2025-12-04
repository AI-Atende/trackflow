export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-brand-500">Termos de Uso</h1>
        <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString()}</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Aceitação dos Termos</h2>
          <p>Ao acessar e usar a plataforma TrackFlow, você concorda em cumprir e ficar vinculado aos seguintes termos e condições de uso.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Uso da Plataforma</h2>
          <p>Você concorda em usar a plataforma apenas para fins legais e de acordo com todas as leis aplicáveis. O uso indevido ou não autorizado da plataforma pode resultar na suspensão ou encerramento da sua conta.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Propriedade Intelectual</h2>
          <p>Todo o conteúdo, design e funcionalidade da plataforma são propriedade exclusiva do TrackFlow e estão protegidos por leis de direitos autorais e propriedade intelectual.</p>
        </section>
      </div>
    </div>
  );
}
