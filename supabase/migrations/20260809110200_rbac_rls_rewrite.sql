-- Replace every single-tenant "own row" policy with permission-matrix-aware
-- policies. Each table keeps its existing `user_id` column as the company
-- identifier (unchanged) — only who else besides the owner may read/write
-- it is now governed by has_permission(). SELECT is granted by "ver" alone;
-- INSERT/UPDATE/DELETE require "gerenciar" (and, since FOR ALL also covers
-- SELECT, a "gerenciar" grant implies read access too — the two permissive
-- policies OR together for the SELECT command).

-- clientes
DROP POLICY IF EXISTS "own clientes" ON public.clientes;
CREATE POLICY "clientes ver" ON public.clientes FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'clientes', 'ver'));
CREATE POLICY "clientes gerenciar" ON public.clientes FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'clientes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'clientes', 'gerenciar'));

-- fornecedores
DROP POLICY IF EXISTS "own fornecedores" ON public.fornecedores;
CREATE POLICY "fornecedores ver" ON public.fornecedores FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'fornecedores', 'ver'));
CREATE POLICY "fornecedores gerenciar" ON public.fornecedores FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'fornecedores', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'fornecedores', 'gerenciar'));

-- produtos (also covers "serviços", stored in the same table)
DROP POLICY IF EXISTS "own produtos" ON public.produtos;
CREATE POLICY "produtos ver" ON public.produtos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'produtos', 'ver'));
CREATE POLICY "produtos gerenciar" ON public.produtos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'produtos', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'produtos', 'gerenciar'));

-- ordens_servico + its satellite tables
DROP POLICY IF EXISTS "own os" ON public.ordens_servico;
CREATE POLICY "ordens_servico ver" ON public.ordens_servico FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'ver'));
CREATE POLICY "ordens_servico gerenciar" ON public.ordens_servico FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'ordens', 'gerenciar'));

DROP POLICY IF EXISTS "own os_itens" ON public.os_itens;
CREATE POLICY "os_itens ver" ON public.os_itens FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'ver'));
CREATE POLICY "os_itens gerenciar" ON public.os_itens FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'ordens', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own OS checklists" ON public.os_checklists;
CREATE POLICY "os_checklists ver" ON public.os_checklists FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'ver'));
CREATE POLICY "os_checklists gerenciar" ON public.os_checklists FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'ordens', 'gerenciar'));

DROP POLICY IF EXISTS "own os photos" ON public.service_order_photos;
CREATE POLICY "service_order_photos ver" ON public.service_order_photos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'ver'));
CREATE POLICY "service_order_photos gerenciar" ON public.service_order_photos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'ordens', 'gerenciar'));

DROP POLICY IF EXISTS "own devices" ON public.devices;
CREATE POLICY "devices ver" ON public.devices FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'ver'));
CREATE POLICY "devices gerenciar" ON public.devices FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'ordens', 'gerenciar'));

-- vendas + venda_itens (also what PDV writes to)
DROP POLICY IF EXISTS "own vendas" ON public.vendas;
CREATE POLICY "vendas ver" ON public.vendas FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'vendas', 'ver'));
CREATE POLICY "vendas gerenciar" ON public.vendas FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'vendas', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'vendas', 'gerenciar'));

DROP POLICY IF EXISTS "own venda_itens" ON public.venda_itens;
CREATE POLICY "venda_itens ver" ON public.venda_itens FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'vendas', 'ver'));
CREATE POLICY "venda_itens gerenciar" ON public.venda_itens FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'vendas', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'vendas', 'gerenciar'));

-- compras_aparelhos (device intake / "Compras")
DROP POLICY IF EXISTS "Users can manage their own device purchases" ON public.compras_aparelhos;
CREATE POLICY "compras_aparelhos ver" ON public.compras_aparelhos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'compras', 'ver'));
CREATE POLICY "compras_aparelhos gerenciar" ON public.compras_aparelhos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'compras', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'compras', 'gerenciar'));

-- financeiro
DROP POLICY IF EXISTS "own lancamentos" ON public.lancamentos;
CREATE POLICY "lancamentos ver" ON public.lancamentos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'ver'));
CREATE POLICY "lancamentos gerenciar" ON public.lancamentos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'financeiro', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own categories" ON public.finance_categories;
CREATE POLICY "finance_categories ver" ON public.finance_categories FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'ver'));
CREATE POLICY "finance_categories gerenciar" ON public.finance_categories FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'financeiro', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own payment methods" ON public.payment_methods;
CREATE POLICY "payment_methods ver" ON public.payment_methods FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'ver'));
CREATE POLICY "payment_methods gerenciar" ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'financeiro', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own bank accounts" ON public.bank_accounts;
CREATE POLICY "bank_accounts ver" ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'ver'));
CREATE POLICY "bank_accounts gerenciar" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'financeiro', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own payment configs" ON public.pagamento_config;
CREATE POLICY "pagamento_config ver" ON public.pagamento_config FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "pagamento_config gerenciar" ON public.pagamento_config FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

-- cobrancas
DROP POLICY IF EXISTS "Users can manage their own charges" ON public.cobrancas;
CREATE POLICY "cobrancas ver" ON public.cobrancas FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'cobrancas', 'ver'));
CREATE POLICY "cobrancas gerenciar" ON public.cobrancas FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'cobrancas', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'cobrancas', 'gerenciar'));

-- garantia
DROP POLICY IF EXISTS "Users can manage their own terms" ON public.termos_garantia;
CREATE POLICY "termos_garantia ver" ON public.termos_garantia FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'garantia', 'ver'));
CREATE POLICY "termos_garantia gerenciar" ON public.termos_garantia FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'garantia', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'garantia', 'gerenciar'));

-- configuracoes (all the settings/flow-config tables shown under the
-- "Configurações" tabs — module-gated as a whole, not split further)
DROP POLICY IF EXISTS "Users can manage their own OS config" ON public.os_config;
CREATE POLICY "os_config ver" ON public.os_config FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "os_config gerenciar" ON public.os_config FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own status flows" ON public.os_status_flows;
CREATE POLICY "os_status_flows ver" ON public.os_status_flows FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "os_status_flows gerenciar" ON public.os_status_flows FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own sale_config" ON public.sale_config;
CREATE POLICY "sale_config ver" ON public.sale_config FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "sale_config gerenciar" ON public.sale_config FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own sale_status_flows" ON public.sale_status_flows;
CREATE POLICY "sale_status_flows ver" ON public.sale_status_flows FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "sale_status_flows gerenciar" ON public.sale_status_flows FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own purchase config" ON public.purchase_config;
CREATE POLICY "purchase_config ver" ON public.purchase_config FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "purchase_config gerenciar" ON public.purchase_config FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own purchase status flows" ON public.purchase_status_flows;
CREATE POLICY "purchase_status_flows ver" ON public.purchase_status_flows FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "purchase_status_flows gerenciar" ON public.purchase_status_flows FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "whatsapp_config ver" ON public.whatsapp_config FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "whatsapp_config gerenciar" ON public.whatsapp_config FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own catalogo config" ON public.catalogo_config;
CREATE POLICY "catalogo_config ver" ON public.catalogo_config FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "catalogo_config gerenciar" ON public.catalogo_config FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

DROP POLICY IF EXISTS "Users can manage their own smtp config" ON public.smtp_config;
CREATE POLICY "smtp_config ver" ON public.smtp_config FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "smtp_config gerenciar" ON public.smtp_config FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));
