const cards = [
  ['Projetos ativos', '12'],
  ['Usuários', '84'],
  ['Receita', 'R$ 24,8k'],
  ['Chamados', '7'],
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold text-cyan-300">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Resumo operacional</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Estrutura inicial pronta para autenticação, banco de dados, componentes reutilizáveis e
            painel administrativo.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Próximos passos</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>• Conectar Prisma ao PostgreSQL</li>
            <li>• Configurar login</li>
            <li>• Adicionar shadcn/ui</li>
            <li>• Criar CRUDs</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
