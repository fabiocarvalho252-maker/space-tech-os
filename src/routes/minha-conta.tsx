import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { vincularContaCliente } from "@/lib/cliente-conta/cliente-conta.functions";
import { ClientAccountHeader } from "@/components/cliente-conta/ClientAccountHeader";
import {
  ClientAccountTabs,
  type ClientAccountTab,
} from "@/components/cliente-conta/ClientAccountTabs";
import { ClientAccountFooter } from "@/components/cliente-conta/ClientAccountFooter";
import { OverviewTab } from "@/components/cliente-conta/OverviewTab";
import { PurchasesTab } from "@/components/cliente-conta/PurchasesTab";
import { ServiceOrdersTab } from "@/components/cliente-conta/ServiceOrdersTab";
import { ClientDataTab } from "@/components/cliente-conta/ClientDataTab";
import { ServiceOrderDetails } from "@/components/cliente-conta/ServiceOrderDetails";
import type { MeuCliente, MinhaLoja, MinhaOs } from "@/components/cliente-conta/types";

export const Route = createFileRoute("/minha-conta")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Minha Conta — SpaceTech" },
      { name: "description", content: "Suas compras, ordens de serviço e dados de cadastro." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/" });

    const buscarCliente = () =>
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
        .from("clientes" as any)
        .select("id")
        .eq("auth_user_id", data.session!.user.id)
        .maybeSingle();

    let { data: cliente } = await buscarCliente();
    if (!cliente) {
      // Self-heal: an account tagged as a customer that somehow never got
      // linked (e.g. landed here straight after confirming the signup
      // email in a flow that didn't call this yet).
      try {
        await vincularContaCliente();
        ({ data: cliente } = await buscarCliente());
      } catch {
        // fall through to the redirect below
      }
    }
    if (!cliente) throw redirect({ to: "/" });
  },
  component: MinhaConta,
});

function MinhaConta() {
  const [tab, setTab] = useState<ClientAccountTab>("visao-geral");
  const [osSelecionada, setOsSelecionada] = useState<MinhaOs | null>(null);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["minha-conta-cliente"],
    queryFn: async (): Promise<MeuCliente> => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
        .from("clientes" as any)
        .select("id, user_id, nome, telefone, email, documento, endereco")
        .eq("auth_user_id", user.user!.id)
        .single();
      if (error) throw error;
      return data as unknown as MeuCliente;
    },
  });

  const { data: loja } = useQuery({
    queryKey: ["minha-conta-loja", cliente?.user_id],
    enabled: !!cliente?.user_id,
    queryFn: async (): Promise<MinhaLoja | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, loja, whatsapp, endereco, logo_url")
        .eq("id", cliente!.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  function abrirOs(os: MinhaOs) {
    setOsSelecionada(os);
    setDetalhesAbertos(true);
  }

  if (isLoading || !cliente) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563eb]/20 border-t-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <ClientAccountHeader nome={cliente.nome.split(" ")[0] ?? cliente.nome} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <ClientAccountTabs ativa={tab} onChange={setTab} />

        <div className="mt-6">
          {tab === "visao-geral" && (
            <OverviewTab
              cliente={cliente}
              onIrParaDados={() => setTab("dados")}
              onAbrirOs={abrirOs}
            />
          )}
          {tab === "compras" && <PurchasesTab cliente={cliente} />}
          {tab === "os" && <ServiceOrdersTab cliente={cliente} onAbrirOs={abrirOs} />}
          {tab === "dados" && <ClientDataTab cliente={cliente} />}
        </div>
      </main>

      <ClientAccountFooter loja={loja ?? null} />

      <ServiceOrderDetails
        os={osSelecionada}
        open={detalhesAbertos}
        onOpenChange={setDetalhesAbertos}
      />
    </div>
  );
}
