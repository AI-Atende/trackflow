export default function LGPDPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-brand-500">Lei Geral de Proteção de Dados (LGPD)</h1>
        <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString()}</p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Seus Direitos</h2>
          <p>De acordo com a LGPD, você tem o direito de acessar, corrigir, portar e excluir seus dados pessoais, bem como de revogar seu consentimento a qualquer momento.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Controlador de Dados</h2>
          <p>O TrackFlow atua como controlador de seus dados pessoais. Para exercer seus direitos ou tirar dúvidas, entre em contato com nosso Encarregado de Proteção de Dados.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Segurança dos Dados</h2>
          <p>Adotamos medidas técnicas e administrativas adequadas para proteger seus dados pessoais contra acesso não autorizado, perda ou alteração.</p>
        </section>
      </div>
    </div>
  );
}
