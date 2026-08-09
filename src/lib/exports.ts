import { supabase } from "@/integrations/supabase/client";

export async function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) return;
  
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(",")
  );
  
  const csvContent = [headers, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function generateFinancePDF(lancamentos: any[], profile: any, resumo: { entradas: number, saidas: number, saldo: number }) {
  const janela = window.open("", "_blank", "width=800,height=900");
  if (!janela) return;
  
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const dataBR = (v: string) => new Date(v).toLocaleDateString("pt-BR");

  janela.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>Relatório Financeiro — ${profile?.loja || 'SpaceTech'}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; color: #333; }
        header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
        h1 { margin: 0; color: #1e1b4b; }
        .resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .card { padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .label { font-size: 12px; color: #666; text-transform: uppercase; }
        .valor { font-size: 18px; font-weight: bold; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { text-align: left; background: #f3f4f6; padding: 10px; border-bottom: 2px solid #ddd; }
        td { padding: 10px; border-bottom: 1px solid #eee; }
        .entrada { color: #166534; }
        .saida { color: #991b1b; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <header>
        <div>
          <h1>${profile?.loja || 'SpaceTech'}</h1>
          <p>Relatório Financeiro - Gerado em ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <button class="no-print" onclick="window.print()">Imprimir PDF</button>
      </header>

      <div class="resumo">
        <div class="card">
          <div class="label">Entradas</div>
          <div class="valor entrada">${brl(resumo.entradas)}</div>
        </div>
        <div class="card">
          <div class="label">Saídas</div>
          <div class="valor saida">${brl(resumo.saidas)}</div>
        </div>
        <div class="card">
          <div class="label">Saldo Final</div>
          <div class="valor">${brl(resumo.saldo)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Tipo</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${lancamentos.map(l => `
            <tr>
              <td>${dataBR(l.created_at)}</td>
              <td>${l.descricao}</td>
              <td>${l.categoria || '—'}</td>
              <td class="${l.tipo}">${l.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td>
              <td class="${l.tipo}">${l.tipo === 'entrada' ? '+' : '-'} ${brl(l.valor)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `);
  janela.document.close();
}
