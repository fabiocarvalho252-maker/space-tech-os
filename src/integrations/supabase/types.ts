export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      agendamentos: {
        Row: {
          cliente_id: string | null;
          created_at: string;
          fim: string;
          id: string;
          inicio: string;
          observacoes: string | null;
          os_id: string | null;
          status: string;
          tecnico: string | null;
          tipo: string;
          titulo: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cliente_id?: string | null;
          created_at?: string;
          fim: string;
          id?: string;
          inicio: string;
          observacoes?: string | null;
          os_id?: string | null;
          status?: string;
          tecnico?: string | null;
          tipo?: string;
          titulo: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cliente_id?: string | null;
          created_at?: string;
          fim?: string;
          id?: string;
          inicio?: string;
          observacoes?: string | null;
          os_id?: string | null;
          status?: string;
          tecnico?: string | null;
          tipo?: string;
          titulo?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agendamentos_os_id_fkey";
            columns: ["os_id"];
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
        ];
      };
      assistente_preferencias: {
        Row: {
          ativo: boolean;
          categorias_desligadas: string[];
          dispensados: Json;
          silenciado_ate: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ativo?: boolean;
          categorias_desligadas?: string[];
          dispensados?: Json;
          silenciado_ate?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          ativo?: boolean;
          categorias_desligadas?: string[];
          dispensados?: Json;
          silenciado_ate?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      aparelho_fotos: {
        Row: {
          aparelho_id: string;
          created_at: string;
          id: string;
          path: string;
          tipo: string;
          user_id: string;
        };
        Insert: {
          aparelho_id: string;
          created_at?: string;
          id?: string;
          path: string;
          tipo: string;
          user_id: string;
        };
        Update: {
          aparelho_id?: string;
          created_at?: string;
          id?: string;
          path?: string;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aparelho_fotos_aparelho_id_fkey";
            columns: ["aparelho_id"];
            referencedRelation: "aparelhos";
            referencedColumns: ["id"];
          },
        ];
      };
      aparelho_garantias: {
        Row: {
          aparelho_id: string;
          cliente_id: string | null;
          created_at: string;
          dias: number;
          fim: string;
          id: string;
          inicio: string;
          numero: number;
          observacoes: string | null;
          status: string;
          termo_id: string | null;
          updated_at: string;
          user_id: string;
          venda_id: string | null;
        };
        Insert: {
          aparelho_id: string;
          cliente_id?: string | null;
          created_at?: string;
          dias: number;
          fim: string;
          id?: string;
          inicio: string;
          numero?: number;
          observacoes?: string | null;
          status?: string;
          termo_id?: string | null;
          updated_at?: string;
          user_id: string;
          venda_id?: string | null;
        };
        Update: {
          aparelho_id?: string;
          cliente_id?: string | null;
          created_at?: string;
          dias?: number;
          fim?: string;
          id?: string;
          inicio?: string;
          numero?: number;
          observacoes?: string | null;
          status?: string;
          termo_id?: string | null;
          updated_at?: string;
          user_id?: string;
          venda_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "aparelho_garantias_aparelho_id_fkey";
            columns: ["aparelho_id"];
            referencedRelation: "aparelhos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aparelho_garantias_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aparelho_garantias_termo_id_fkey";
            columns: ["termo_id"];
            referencedRelation: "termos_garantia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aparelho_garantias_venda_id_fkey";
            columns: ["venda_id"];
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      aparelho_historico: {
        Row: {
          aparelho_id: string;
          created_at: string;
          created_by: string | null;
          descricao: string;
          evento: string;
          id: string;
          user_id: string;
        };
        Insert: {
          aparelho_id: string;
          created_at?: string;
          created_by?: string | null;
          descricao: string;
          evento: string;
          id?: string;
          user_id: string;
        };
        Update: {
          aparelho_id?: string;
          created_at?: string;
          created_by?: string | null;
          descricao?: string;
          evento?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aparelho_historico_aparelho_id_fkey";
            columns: ["aparelho_id"];
            referencedRelation: "aparelhos";
            referencedColumns: ["id"];
          },
        ];
      };
      aparelhos: {
        Row: {
          armazenamento: string | null;
          checklist: Json;
          ciclos_bateria: number | null;
          cor: string | null;
          created_at: string;
          created_by: string;
          estado_conservacao: string | null;
          id: string;
          imei1: string | null;
          imei2: string | null;
          marca: string;
          modelo: string;
          numero: number;
          numero_serie: string | null;
          observacoes: string | null;
          preco_custo: number;
          preco_venda: number;
          ram: string | null;
          reservado_ate: string | null;
          reservado_cliente_id: string | null;
          reservado_observacao: string | null;
          saude_bateria: number | null;
          seminovo_id: string | null;
          sold_at: string | null;
          status: string;
          tipo: string;
          updated_at: string;
          user_id: string;
          variante: string | null;
        };
        Insert: {
          armazenamento?: string | null;
          checklist?: Json;
          ciclos_bateria?: number | null;
          cor?: string | null;
          created_at?: string;
          created_by: string;
          estado_conservacao?: string | null;
          id?: string;
          imei1?: string | null;
          imei2?: string | null;
          marca: string;
          modelo: string;
          numero?: number;
          numero_serie?: string | null;
          observacoes?: string | null;
          preco_custo?: number;
          preco_venda?: number;
          ram?: string | null;
          reservado_ate?: string | null;
          reservado_cliente_id?: string | null;
          reservado_observacao?: string | null;
          saude_bateria?: number | null;
          seminovo_id?: string | null;
          sold_at?: string | null;
          status?: string;
          tipo: string;
          updated_at?: string;
          user_id: string;
          variante?: string | null;
        };
        Update: {
          armazenamento?: string | null;
          checklist?: Json;
          ciclos_bateria?: number | null;
          cor?: string | null;
          created_at?: string;
          created_by?: string;
          estado_conservacao?: string | null;
          id?: string;
          imei1?: string | null;
          imei2?: string | null;
          marca?: string;
          modelo?: string;
          numero?: number;
          numero_serie?: string | null;
          observacoes?: string | null;
          preco_custo?: number;
          preco_venda?: number;
          ram?: string | null;
          reservado_ate?: string | null;
          reservado_cliente_id?: string | null;
          reservado_observacao?: string | null;
          saude_bateria?: number | null;
          seminovo_id?: string | null;
          sold_at?: string | null;
          status?: string;
          tipo?: string;
          updated_at?: string;
          user_id?: string;
          variante?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "aparelhos_reservado_cliente_id_fkey";
            columns: ["reservado_cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aparelhos_seminovo_id_fkey";
            columns: ["seminovo_id"];
            referencedRelation: "seminovos";
            referencedColumns: ["id"];
          },
        ];
      };
      backup_google_drive: {
        Row: {
          automatico: boolean;
          created_at: string;
          email: string | null;
          id: string;
          incluir_fotos: boolean;
          pasta_id: string | null;
          refresh_token: string;
          ultimo_arquivo: string | null;
          ultimo_backup_em: string | null;
          ultimo_erro: string | null;
          ultimo_status: string | null;
          ultimo_tamanho: number | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          automatico?: boolean;
          created_at?: string;
          email?: string | null;
          id: string;
          incluir_fotos?: boolean;
          pasta_id?: string | null;
          refresh_token: string;
          ultimo_arquivo?: string | null;
          ultimo_backup_em?: string | null;
          ultimo_erro?: string | null;
          ultimo_status?: string | null;
          ultimo_tamanho?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          automatico?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          incluir_fotos?: boolean;
          pasta_id?: string | null;
          refresh_token?: string;
          ultimo_arquivo?: string | null;
          ultimo_backup_em?: string | null;
          ultimo_erro?: string | null;
          ultimo_status?: string | null;
          ultimo_tamanho?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          agencia: string | null;
          banco: string;
          conta: string | null;
          created_at: string;
          id: string;
          saldo_inicial: number | null;
          tipo: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agencia?: string | null;
          banco: string;
          conta?: string | null;
          created_at?: string;
          id?: string;
          saldo_inicial?: number | null;
          tipo?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agencia?: string | null;
          banco?: string;
          conta?: string | null;
          created_at?: string;
          id?: string;
          saldo_inicial?: number | null;
          tipo?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      caixa_movimentos: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          motivo: string | null;
          sessao_id: string;
          tipo: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          motivo?: string | null;
          sessao_id: string;
          tipo: string;
          user_id: string;
          valor: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          motivo?: string | null;
          sessao_id?: string;
          tipo?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "caixa_movimentos_sessao_id_fkey";
            columns: ["sessao_id"];
            referencedRelation: "caixa_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      caixa_sessoes: {
        Row: {
          aberto_em: string;
          aberto_por: string | null;
          diferenca: number | null;
          fechado_em: string | null;
          fechado_por: string | null;
          id: string;
          observacoes: string | null;
          resumo: Json | null;
          status: string;
          user_id: string;
          valor_abertura: number;
          valor_contado: number | null;
          valor_esperado: number | null;
        };
        Insert: {
          aberto_em?: string;
          aberto_por?: string | null;
          diferenca?: number | null;
          fechado_em?: string | null;
          fechado_por?: string | null;
          id?: string;
          observacoes?: string | null;
          resumo?: Json | null;
          status?: string;
          user_id: string;
          valor_abertura?: number;
          valor_contado?: number | null;
          valor_esperado?: number | null;
        };
        Update: {
          aberto_em?: string;
          aberto_por?: string | null;
          diferenca?: number | null;
          fechado_em?: string | null;
          fechado_por?: string | null;
          id?: string;
          observacoes?: string | null;
          resumo?: Json | null;
          status?: string;
          user_id?: string;
          valor_abertura?: number;
          valor_contado?: number | null;
          valor_esperado?: number | null;
        };
        Relationships: [];
      };
      catalogo_config: {
        Row: {
          created_at: string | null;
          dominio_proprio: string | null;
          exibir_apenas_com_estoque: boolean | null;
          id: string;
          ignorar_estoque: boolean | null;
          loja_ativa: boolean | null;
          permitir_vender_sem_estoque: boolean | null;
          subdominio: string | null;
          updated_at: string | null;
          user_id: string;
          whatsapp_atendimento: string | null;
          whatsapp_flutuante_ativo: boolean | null;
          whatsapp_mensagem_inicial: string | null;
        };
        Insert: {
          created_at?: string | null;
          dominio_proprio?: string | null;
          exibir_apenas_com_estoque?: boolean | null;
          id?: string;
          ignorar_estoque?: boolean | null;
          loja_ativa?: boolean | null;
          permitir_vender_sem_estoque?: boolean | null;
          subdominio?: string | null;
          updated_at?: string | null;
          user_id: string;
          whatsapp_atendimento?: string | null;
          whatsapp_flutuante_ativo?: boolean | null;
          whatsapp_mensagem_inicial?: string | null;
        };
        Update: {
          created_at?: string | null;
          dominio_proprio?: string | null;
          exibir_apenas_com_estoque?: boolean | null;
          id?: string;
          ignorar_estoque?: boolean | null;
          loja_ativa?: boolean | null;
          permitir_vender_sem_estoque?: boolean | null;
          subdominio?: string | null;
          updated_at?: string | null;
          user_id?: string;
          whatsapp_atendimento?: string | null;
          whatsapp_flutuante_ativo?: boolean | null;
          whatsapp_mensagem_inicial?: string | null;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          auth_user_id: string | null;
          created_at: string;
          data_nascimento: string | null;
          documento: string | null;
          email: string | null;
          endereco: string | null;
          id: string;
          importacao_id: string | null;
          nome: string;
          observacoes: string | null;
          telefone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string;
          data_nascimento?: string | null;
          documento?: string | null;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          importacao_id?: string | null;
          nome: string;
          observacoes?: string | null;
          telefone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string;
          data_nascimento?: string | null;
          documento?: string | null;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          importacao_id?: string | null;
          nome?: string;
          observacoes?: string | null;
          telefone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_importacao_id_fkey";
            columns: ["importacao_id"];
            referencedRelation: "importacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cobrancas: {
        Row: {
          cliente_id: string | null;
          created_at: string;
          crediario_parcela_id: string | null;
          expires_at: string | null;
          id: string;
          lancamento_id: string | null;
          mp_id: string | null;
          os_id: string | null;
          qr_code: string | null;
          qr_code_copy_paste: string | null;
          status: Database["public"]["Enums"]["status_cobranca"];
          updated_at: string;
          user_id: string;
          valor: number;
          vencimento: string;
          venda_id: string | null;
        };
        Insert: {
          cliente_id?: string | null;
          created_at?: string;
          crediario_parcela_id?: string | null;
          expires_at?: string | null;
          id?: string;
          lancamento_id?: string | null;
          mp_id?: string | null;
          os_id?: string | null;
          qr_code?: string | null;
          qr_code_copy_paste?: string | null;
          status?: Database["public"]["Enums"]["status_cobranca"];
          updated_at?: string;
          user_id: string;
          valor: number;
          vencimento?: string;
          venda_id?: string | null;
        };
        Update: {
          cliente_id?: string | null;
          created_at?: string;
          crediario_parcela_id?: string | null;
          expires_at?: string | null;
          id?: string;
          lancamento_id?: string | null;
          mp_id?: string | null;
          os_id?: string | null;
          qr_code?: string | null;
          qr_code_copy_paste?: string | null;
          status?: Database["public"]["Enums"]["status_cobranca"];
          updated_at?: string;
          user_id?: string;
          valor?: number;
          vencimento?: string;
          venda_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_crediario_parcela_id_fkey";
            columns: ["crediario_parcela_id"];
            referencedRelation: "crediario_parcelas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_crediario_parcela_id_fkey";
            columns: ["crediario_parcela_id"];
            referencedRelation: "vw_crediario_parcelas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_lancamento_id_fkey";
            columns: ["lancamento_id"];
            referencedRelation: "lancamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_os_id_fkey";
            columns: ["os_id"];
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_venda_id_fkey";
            columns: ["venda_id"];
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      compra_itens: {
        Row: {
          compra_id: string;
          created_at: string;
          custo_unitario: number;
          descricao: string;
          id: string;
          produto_id: string | null;
          quantidade: number;
          user_id: string;
        };
        Insert: {
          compra_id: string;
          created_at?: string;
          custo_unitario?: number;
          descricao: string;
          id?: string;
          produto_id?: string | null;
          quantidade?: number;
          user_id: string;
        };
        Update: {
          compra_id?: string;
          created_at?: string;
          custo_unitario?: number;
          descricao?: string;
          id?: string;
          produto_id?: string | null;
          quantidade?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compra_itens_compra_id_fkey";
            columns: ["compra_id"];
            referencedRelation: "compras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compra_itens_produto_id_fkey";
            columns: ["produto_id"];
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      compras: {
        Row: {
          created_at: string;
          faturado_em: string | null;
          forma_pagamento: string | null;
          fornecedor_id: string | null;
          id: string;
          observacoes: string | null;
          recebido_em: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          valor_total: number;
        };
        Insert: {
          created_at?: string;
          faturado_em?: string | null;
          forma_pagamento?: string | null;
          fornecedor_id?: string | null;
          id?: string;
          observacoes?: string | null;
          recebido_em?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          valor_total?: number;
        };
        Update: {
          created_at?: string;
          faturado_em?: string | null;
          forma_pagamento?: string | null;
          fornecedor_id?: string | null;
          id?: string;
          observacoes?: string | null;
          recebido_em?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          valor_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "compras_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            referencedRelation: "fornecedores";
            referencedColumns: ["id"];
          },
        ];
      };
      compras_aparelhos: {
        Row: {
          cliente_id: string | null;
          condicao_detalhada: string | null;
          created_at: string;
          data_compra: string;
          id: string;
          imei_serial: string | null;
          marca: string | null;
          modelo: string;
          tipo: Database["public"]["Enums"]["tipo_aparelho_compra"];
          updated_at: string;
          user_id: string;
          valor_pago: number;
        };
        Insert: {
          cliente_id?: string | null;
          condicao_detalhada?: string | null;
          created_at?: string;
          data_compra?: string;
          id?: string;
          imei_serial?: string | null;
          marca?: string | null;
          modelo: string;
          tipo?: Database["public"]["Enums"]["tipo_aparelho_compra"];
          updated_at?: string;
          user_id: string;
          valor_pago?: number;
        };
        Update: {
          cliente_id?: string | null;
          condicao_detalhada?: string | null;
          created_at?: string;
          data_compra?: string;
          id?: string;
          imei_serial?: string | null;
          marca?: string | null;
          modelo?: string;
          tipo?: Database["public"]["Enums"]["tipo_aparelho_compra"];
          updated_at?: string;
          user_id?: string;
          valor_pago?: number;
        };
        Relationships: [
          {
            foreignKeyName: "compras_aparelhos_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      convites_assinatura: {
        Row: {
          chave_telefone: string;
          created_at: string;
          enviado_por: string | null;
          erro: string | null;
          id: string;
          mensagem: string;
          nome: string | null;
          oferta: string;
          status: string;
          telefone: string;
        };
        Insert: {
          chave_telefone: string;
          created_at?: string;
          enviado_por?: string | null;
          erro?: string | null;
          id?: string;
          mensagem: string;
          nome?: string | null;
          oferta: string;
          status: string;
          telefone: string;
        };
        Update: {
          chave_telefone?: string;
          created_at?: string;
          enviado_por?: string | null;
          erro?: string | null;
          id?: string;
          mensagem?: string;
          nome?: string | null;
          oferta?: string;
          status?: string;
          telefone?: string;
        };
        Relationships: [];
      };
      crediario_avisos: {
        Row: {
          com_pix: boolean;
          contrato_id: string;
          created_at: string;
          enviado_por: string | null;
          erro: string | null;
          id: string;
          parcela_id: string | null;
          status: string;
          telefone: string | null;
          tipo: string;
          user_id: string;
        };
        Insert: {
          com_pix?: boolean;
          contrato_id: string;
          created_at?: string;
          enviado_por?: string | null;
          erro?: string | null;
          id?: string;
          parcela_id?: string | null;
          status: string;
          telefone?: string | null;
          tipo: string;
          user_id: string;
        };
        Update: {
          com_pix?: boolean;
          contrato_id?: string;
          created_at?: string;
          enviado_por?: string | null;
          erro?: string | null;
          id?: string;
          parcela_id?: string | null;
          status?: string;
          telefone?: string | null;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crediario_avisos_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "crediario_contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_avisos_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "vw_crediario_contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_avisos_parcela_id_fkey";
            columns: ["parcela_id"];
            referencedRelation: "crediario_parcelas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_avisos_parcela_id_fkey";
            columns: ["parcela_id"];
            referencedRelation: "vw_crediario_parcelas";
            referencedColumns: ["id"];
          },
        ];
      };
      crediario_comandos: {
        Row: {
          confirmado_em: string | null;
          contrato_id: string;
          created_at: string;
          criado_por: string | null;
          enviado_em: string | null;
          id: string;
          motivo: string | null;
          payload: Json;
          status: string;
          tipo: string;
          user_id: string;
        };
        Insert: {
          confirmado_em?: string | null;
          contrato_id: string;
          created_at?: string;
          criado_por?: string | null;
          enviado_em?: string | null;
          id?: string;
          motivo?: string | null;
          payload?: Json;
          status?: string;
          tipo: string;
          user_id: string;
        };
        Update: {
          confirmado_em?: string | null;
          contrato_id?: string;
          created_at?: string;
          criado_por?: string | null;
          enviado_em?: string | null;
          id?: string;
          motivo?: string | null;
          payload?: Json;
          status?: string;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crediario_comandos_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "crediario_contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_comandos_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "vw_crediario_contratos";
            referencedColumns: ["id"];
          },
        ];
      };
      crediario_contratos: {
        Row: {
          bloqueio_manual: boolean;
          cliente_id: string;
          created_at: string;
          created_by: string | null;
          dias_tolerancia: number;
          entrada: number;
          id: string;
          imei: string;
          juros_mes_pct: number;
          liberado_ate: string | null;
          marca: string;
          modelo: string;
          multa_pct: number;
          num_parcelas: number;
          numero: number;
          observacoes: string | null;
          primeiro_vencimento: string;
          provisionado_em: string | null;
          status: string;
          status_aparelho: string;
          termo_aceito_em: string;
          ultimo_contato: string | null;
          updated_at: string;
          user_id: string;
          valor_aparelho: number;
          valor_parcela: number;
        };
        Insert: {
          bloqueio_manual?: boolean;
          cliente_id: string;
          created_at?: string;
          created_by?: string | null;
          dias_tolerancia?: number;
          entrada?: number;
          id?: string;
          imei: string;
          juros_mes_pct?: number;
          liberado_ate?: string | null;
          marca: string;
          modelo: string;
          multa_pct?: number;
          num_parcelas: number;
          numero: number;
          observacoes?: string | null;
          primeiro_vencimento: string;
          provisionado_em?: string | null;
          status?: string;
          status_aparelho?: string;
          termo_aceito_em: string;
          ultimo_contato?: string | null;
          updated_at?: string;
          user_id: string;
          valor_aparelho: number;
          valor_parcela: number;
        };
        Update: {
          bloqueio_manual?: boolean;
          cliente_id?: string;
          created_at?: string;
          created_by?: string | null;
          dias_tolerancia?: number;
          entrada?: number;
          id?: string;
          imei?: string;
          juros_mes_pct?: number;
          liberado_ate?: string | null;
          marca?: string;
          modelo?: string;
          multa_pct?: number;
          num_parcelas?: number;
          numero?: number;
          observacoes?: string | null;
          primeiro_vencimento?: string;
          provisionado_em?: string | null;
          status?: string;
          status_aparelho?: string;
          termo_aceito_em?: string;
          ultimo_contato?: string | null;
          updated_at?: string;
          user_id?: string;
          valor_aparelho?: number;
          valor_parcela?: number;
        };
        Relationships: [
          {
            foreignKeyName: "crediario_contratos_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      crediario_eventos: {
        Row: {
          contrato_id: string;
          created_at: string;
          created_by: string | null;
          descricao: string;
          id: string;
          user_id: string;
        };
        Insert: {
          contrato_id: string;
          created_at?: string;
          created_by?: string | null;
          descricao: string;
          id?: string;
          user_id: string;
        };
        Update: {
          contrato_id?: string;
          created_at?: string;
          created_by?: string | null;
          descricao?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crediario_eventos_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "crediario_contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_eventos_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "vw_crediario_contratos";
            referencedColumns: ["id"];
          },
        ];
      };
      crediario_parcelas: {
        Row: {
          contrato_id: string;
          created_at: string;
          id: string;
          lancamento_id: string | null;
          numero: number;
          pago_em: string | null;
          payment_method_id: string | null;
          pix_txid: string | null;
          recebido_por: string | null;
          status: string;
          user_id: string;
          valor: number;
          valor_pago: number | null;
          vencimento: string;
        };
        Insert: {
          contrato_id: string;
          created_at?: string;
          id?: string;
          lancamento_id?: string | null;
          numero: number;
          pago_em?: string | null;
          payment_method_id?: string | null;
          pix_txid?: string | null;
          recebido_por?: string | null;
          status?: string;
          user_id: string;
          valor: number;
          valor_pago?: number | null;
          vencimento: string;
        };
        Update: {
          contrato_id?: string;
          created_at?: string;
          id?: string;
          lancamento_id?: string | null;
          numero?: number;
          pago_em?: string | null;
          payment_method_id?: string | null;
          pix_txid?: string | null;
          recebido_por?: string | null;
          status?: string;
          user_id?: string;
          valor?: number;
          valor_pago?: number | null;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crediario_parcelas_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "crediario_contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_parcelas_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "vw_crediario_contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_parcelas_lancamento_id_fkey";
            columns: ["lancamento_id"];
            referencedRelation: "lancamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_parcelas_payment_method_id_fkey";
            columns: ["payment_method_id"];
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          cor: string | null;
          created_at: string | null;
          customer_id: string;
          id: string;
          imei: string | null;
          marca: string;
          modelo: string;
          observations: string | null;
          serial_number: string | null;
          storage: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          cor?: string | null;
          created_at?: string | null;
          customer_id: string;
          id?: string;
          imei?: string | null;
          marca: string;
          modelo: string;
          observations?: string | null;
          serial_number?: string | null;
          storage?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          cor?: string | null;
          created_at?: string | null;
          customer_id?: string;
          id?: string;
          imei?: string | null;
          marca?: string;
          modelo?: string;
          observations?: string | null;
          serial_number?: string | null;
          storage?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      empresa_convites: {
        Row: {
          codigo: string;
          created_at: string | null;
          criado_por: string;
          empresa_id: string;
          expira_em: string;
          id: string;
          permissao: string;
          usado_em: string | null;
          usado_por: string | null;
        };
        Insert: {
          codigo: string;
          created_at?: string | null;
          criado_por: string;
          empresa_id: string;
          expira_em: string;
          id?: string;
          permissao?: string;
          usado_em?: string | null;
          usado_por?: string | null;
        };
        Update: {
          codigo?: string;
          created_at?: string | null;
          criado_por?: string;
          empresa_id?: string;
          expira_em?: string;
          id?: string;
          permissao?: string;
          usado_em?: string | null;
          usado_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "empresa_convites_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      estoque_config: {
        Row: {
          created_at: string | null;
          estoque_minimo_padrao: number;
          id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          estoque_minimo_padrao?: number;
          id?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          estoque_minimo_padrao?: number;
          id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      estoque_movimentacoes: {
        Row: {
          created_at: string;
          created_by: string | null;
          descricao: string | null;
          id: string;
          origem_id: string | null;
          produto_id: string;
          quantidade: number;
          saldo_anterior: number;
          saldo_posterior: number;
          tipo: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          id?: string;
          origem_id?: string | null;
          produto_id: string;
          quantidade: number;
          saldo_anterior: number;
          saldo_posterior: number;
          tipo: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          id?: string;
          origem_id?: string | null;
          produto_id?: string;
          quantidade?: number;
          saldo_anterior?: number;
          saldo_posterior?: number;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_produto_id_fkey";
            columns: ["produto_id"];
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_categories: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          tipo: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          tipo: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      fiscal_config: {
        Row: {
          created_at: string | null;
          id: string;
          serie_padrao: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          serie_padrao?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          serie_padrao?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      fornecedores: {
        Row: {
          cnpj_cpf: string | null;
          created_at: string;
          email: string | null;
          endereco: string | null;
          id: string;
          importacao_id: string | null;
          nome_fantasia: string | null;
          observacoes: string | null;
          razao_social: string;
          telefone: string | null;
          updated_at: string;
          user_id: string;
          whatsapp: string | null;
        };
        Insert: {
          cnpj_cpf?: string | null;
          created_at?: string;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          importacao_id?: string | null;
          nome_fantasia?: string | null;
          observacoes?: string | null;
          razao_social: string;
          telefone?: string | null;
          updated_at?: string;
          user_id: string;
          whatsapp?: string | null;
        };
        Update: {
          cnpj_cpf?: string | null;
          created_at?: string;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          importacao_id?: string | null;
          nome_fantasia?: string | null;
          observacoes?: string | null;
          razao_social?: string;
          telefone?: string | null;
          updated_at?: string;
          user_id?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fornecedores_importacao_id_fkey";
            columns: ["importacao_id"];
            referencedRelation: "importacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      fornecedor_consultas_pecas: {
        Row: {
          chave_telefone: string | null;
          conversa_aberta_em: string | null;
          conversa_id: string | null;
          created_at: string;
          criado_por: string | null;
          enviada_em: string | null;
          erro: string | null;
          fornecedor_id: string | null;
          fornecedor_nome: string;
          id: string;
          lote_id: string;
          marca: string | null;
          mensagem: string;
          modelo: string;
          peca: string;
          qualidade: string | null;
          respondida_em: string | null;
          status: string;
          user_id: string;
          whatsapp: string;
        };
        Insert: {
          conversa_aberta_em?: string | null;
          conversa_id?: string | null;
          created_at?: string;
          criado_por?: string | null;
          enviada_em?: string | null;
          erro?: string | null;
          fornecedor_id?: string | null;
          fornecedor_nome: string;
          id?: string;
          lote_id: string;
          marca?: string | null;
          mensagem: string;
          modelo: string;
          peca: string;
          qualidade?: string | null;
          respondida_em?: string | null;
          status?: string;
          user_id: string;
          whatsapp: string;
        };
        Update: {
          conversa_aberta_em?: string | null;
          conversa_id?: string | null;
          created_at?: string;
          criado_por?: string | null;
          enviada_em?: string | null;
          erro?: string | null;
          fornecedor_id?: string | null;
          fornecedor_nome?: string;
          id?: string;
          lote_id?: string;
          marca?: string | null;
          mensagem?: string;
          modelo?: string;
          peca?: string;
          qualidade?: string | null;
          respondida_em?: string | null;
          status?: string;
          user_id?: string;
          whatsapp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fornecedor_consultas_pecas_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            referencedRelation: "fornecedores";
            referencedColumns: ["id"];
          },
        ];
      };
      importacoes: {
        Row: {
          arquivo: string | null;
          created_at: string;
          criado_por: string | null;
          desfeita_em: string | null;
          desfeita_mantidos: number | null;
          id: string;
          inseridos: number;
          pulados: number;
          tipo: string;
          user_id: string;
        };
        Insert: {
          arquivo?: string | null;
          created_at?: string;
          criado_por?: string | null;
          desfeita_em?: string | null;
          desfeita_mantidos?: number | null;
          id?: string;
          inseridos?: number;
          pulados?: number;
          tipo: string;
          user_id: string;
        };
        Update: {
          arquivo?: string | null;
          created_at?: string;
          criado_por?: string | null;
          desfeita_em?: string | null;
          desfeita_mantidos?: number | null;
          id?: string;
          inseridos?: number;
          pulados?: number;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lancamentos: {
        Row: {
          bank_account_id: string | null;
          categoria: string | null;
          created_at: string;
          data: string;
          descricao: string;
          id: string;
          payment_method_id: string | null;
          status: string | null;
          tipo: string;
          user_id: string;
          valor: number;
          vencimento: string | null;
          venda_id: string | null;
        };
        Insert: {
          bank_account_id?: string | null;
          categoria?: string | null;
          created_at?: string;
          data?: string;
          descricao: string;
          id?: string;
          payment_method_id?: string | null;
          status?: string | null;
          tipo?: string;
          user_id: string;
          valor?: number;
          vencimento?: string | null;
          venda_id?: string | null;
        };
        Update: {
          bank_account_id?: string | null;
          categoria?: string | null;
          created_at?: string;
          data?: string;
          descricao?: string;
          id?: string;
          payment_method_id?: string | null;
          status?: string | null;
          tipo?: string;
          user_id?: string;
          valor?: number;
          vencimento?: string | null;
          venda_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lancamentos_bank_account_id_fkey";
            columns: ["bank_account_id"];
            referencedRelation: "bank_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_payment_method_id_fkey";
            columns: ["payment_method_id"];
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_venda_id_fkey";
            columns: ["venda_id"];
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      nota_fiscal_itens: {
        Row: {
          descricao: string;
          id: string;
          nota_id: string;
          quantidade: number;
          user_id: string;
          valor_unitario: number;
        };
        Insert: {
          descricao: string;
          id?: string;
          nota_id: string;
          quantidade?: number;
          user_id: string;
          valor_unitario?: number;
        };
        Update: {
          descricao?: string;
          id?: string;
          nota_id?: string;
          quantidade?: number;
          user_id?: string;
          valor_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_itens_nota_id_fkey";
            columns: ["nota_id"];
            referencedRelation: "notas_fiscais";
            referencedColumns: ["id"];
          },
        ];
      };
      notas_fiscais: {
        Row: {
          chave_acesso: string | null;
          cliente_id: string | null;
          created_at: string;
          emitida_em: string | null;
          id: string;
          numero: number;
          observacoes: string | null;
          os_id: string | null;
          serie: string;
          status: string;
          updated_at: string;
          user_id: string;
          valor_total: number;
          venda_id: string | null;
        };
        Insert: {
          chave_acesso?: string | null;
          cliente_id?: string | null;
          created_at?: string;
          emitida_em?: string | null;
          id?: string;
          numero?: number;
          observacoes?: string | null;
          os_id?: string | null;
          serie?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          valor_total?: number;
          venda_id?: string | null;
        };
        Update: {
          chave_acesso?: string | null;
          cliente_id?: string | null;
          created_at?: string;
          emitida_em?: string | null;
          id?: string;
          numero?: number;
          observacoes?: string | null;
          os_id?: string | null;
          serie?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          valor_total?: number;
          venda_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notas_fiscais_os_id_fkey";
            columns: ["os_id"];
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notas_fiscais_venda_id_fkey";
            columns: ["venda_id"];
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      ordens_servico: {
        Row: {
          acessorios: string | null;
          anotacoes: string | null;
          aparelho: string;
          checklist_entrada: Json;
          cliente_id: string | null;
          cor: string | null;
          created_at: string;
          data_entrega: string | null;
          defeito: string | null;
          desconto: number;
          diagnostico: string | null;
          estado_fisico: Json;
          estado_fisico_obs: string | null;
          garantia_dias: number | null;
          garantia_vencimento: string | null;
          id: string;
          imei: string | null;
          laudo_tecnico: string | null;
          marca: string | null;
          modelo: string | null;
          numero: number;
          padrao_desbloqueio: string | null;
          previsao: string | null;
          responsavel: string | null;
          responsavel_user_id: string | null;
          senha_dispositivo: string | null;
          serial_number: string | null;
          status: string;
          status_pagamento: string;
          updated_at: string;
          user_id: string;
          valor: number;
          valor_pago: number;
        };
        Insert: {
          acessorios?: string | null;
          anotacoes?: string | null;
          aparelho: string;
          checklist_entrada?: Json;
          cliente_id?: string | null;
          cor?: string | null;
          created_at?: string;
          data_entrega?: string | null;
          defeito?: string | null;
          desconto?: number;
          diagnostico?: string | null;
          estado_fisico?: Json;
          estado_fisico_obs?: string | null;
          garantia_dias?: number | null;
          garantia_vencimento?: string | null;
          id?: string;
          imei?: string | null;
          laudo_tecnico?: string | null;
          marca?: string | null;
          modelo?: string | null;
          numero?: number;
          padrao_desbloqueio?: string | null;
          previsao?: string | null;
          responsavel?: string | null;
          responsavel_user_id?: string | null;
          senha_dispositivo?: string | null;
          serial_number?: string | null;
          status?: string;
          status_pagamento?: string;
          updated_at?: string;
          user_id: string;
          valor?: number;
          valor_pago?: number;
        };
        Update: {
          acessorios?: string | null;
          anotacoes?: string | null;
          aparelho?: string;
          checklist_entrada?: Json;
          cliente_id?: string | null;
          cor?: string | null;
          created_at?: string;
          data_entrega?: string | null;
          defeito?: string | null;
          desconto?: number;
          diagnostico?: string | null;
          estado_fisico?: Json;
          estado_fisico_obs?: string | null;
          garantia_dias?: number | null;
          garantia_vencimento?: string | null;
          id?: string;
          imei?: string | null;
          laudo_tecnico?: string | null;
          marca?: string | null;
          modelo?: string | null;
          numero?: number;
          padrao_desbloqueio?: string | null;
          previsao?: string | null;
          responsavel?: string | null;
          responsavel_user_id?: string | null;
          senha_dispositivo?: string | null;
          serial_number?: string | null;
          status?: string;
          status_pagamento?: string;
          updated_at?: string;
          user_id?: string;
          valor?: number;
          valor_pago?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      os_checklists: {
        Row: {
          created_at: string;
          id: string;
          itens: Json | null;
          nome: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          itens?: Json | null;
          nome: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          itens?: Json | null;
          nome?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      os_config: {
        Row: {
          created_at: string;
          dias_garantia_padrao: number | null;
          exibir_fotos_impressao: boolean | null;
          id: string;
          imprimir_duas_vias: boolean | null;
          imprimir_qrcode_cliente: boolean | null;
          modelo_impressao: string | null;
          proximo_numero_os: number | null;
          termos_condicoes: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          dias_garantia_padrao?: number | null;
          exibir_fotos_impressao?: boolean | null;
          id?: string;
          imprimir_duas_vias?: boolean | null;
          imprimir_qrcode_cliente?: boolean | null;
          modelo_impressao?: string | null;
          proximo_numero_os?: number | null;
          termos_condicoes?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dias_garantia_padrao?: number | null;
          exibir_fotos_impressao?: boolean | null;
          id?: string;
          imprimir_duas_vias?: boolean | null;
          imprimir_qrcode_cliente?: boolean | null;
          modelo_impressao?: string | null;
          proximo_numero_os?: number | null;
          termos_condicoes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      os_faturamento_parcelas: {
        Row: {
          created_at: string;
          data_recebimento: string | null;
          faturamento_id: string;
          forma_pagamento_id: string | null;
          id: string;
          lancamento_estorno_id: string | null;
          lancamento_id: string | null;
          numero_parcela: number;
          status: string;
          total_parcelas: number;
          user_id: string;
          valor: number;
          vencimento: string;
        };
        Insert: {
          created_at?: string;
          data_recebimento?: string | null;
          faturamento_id: string;
          forma_pagamento_id?: string | null;
          id?: string;
          lancamento_estorno_id?: string | null;
          lancamento_id?: string | null;
          numero_parcela: number;
          status?: string;
          total_parcelas: number;
          user_id: string;
          valor: number;
          vencimento: string;
        };
        Update: {
          created_at?: string;
          data_recebimento?: string | null;
          faturamento_id?: string;
          forma_pagamento_id?: string | null;
          id?: string;
          lancamento_estorno_id?: string | null;
          lancamento_id?: string | null;
          numero_parcela?: number;
          status?: string;
          total_parcelas?: number;
          user_id?: string;
          valor?: number;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_faturamento_parcelas_faturamento_id_fkey";
            columns: ["faturamento_id"];
            referencedRelation: "os_faturamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_faturamento_parcelas_forma_pagamento_id_fkey";
            columns: ["forma_pagamento_id"];
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_faturamento_parcelas_lancamento_estorno_id_fkey";
            columns: ["lancamento_estorno_id"];
            referencedRelation: "lancamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_faturamento_parcelas_lancamento_id_fkey";
            columns: ["lancamento_id"];
            referencedRelation: "lancamentos";
            referencedColumns: ["id"];
          },
        ];
      };
      os_faturamento_tecnicos: {
        Row: {
          created_at: string;
          faturamento_id: string;
          id: string;
          membro_user_id: string | null;
          nome_livre: string | null;
          user_id: string;
          valor: number;
        };
        Insert: {
          created_at?: string;
          faturamento_id: string;
          id?: string;
          membro_user_id?: string | null;
          nome_livre?: string | null;
          user_id: string;
          valor: number;
        };
        Update: {
          created_at?: string;
          faturamento_id?: string;
          id?: string;
          membro_user_id?: string | null;
          nome_livre?: string | null;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "os_faturamento_tecnicos_faturamento_id_fkey";
            columns: ["faturamento_id"];
            referencedRelation: "os_faturamentos";
            referencedColumns: ["id"];
          },
        ];
      };
      os_faturamentos: {
        Row: {
          cancelado_em: string | null;
          cancelado_por: string | null;
          categoria_id: string | null;
          created_at: string;
          created_by: string;
          custo_tecnico: number;
          custo_tecnico_nome: string | null;
          descricao: string | null;
          id: string;
          lancamento_custo_tecnico_id: string | null;
          motivo_cancelamento: string | null;
          numero: number;
          observacoes: string | null;
          os_id: string;
          status: string;
          user_id: string;
          valor_total: number;
        };
        Insert: {
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          categoria_id?: string | null;
          created_at?: string;
          created_by: string;
          custo_tecnico?: number;
          custo_tecnico_nome?: string | null;
          descricao?: string | null;
          id?: string;
          lancamento_custo_tecnico_id?: string | null;
          motivo_cancelamento?: string | null;
          numero?: number;
          observacoes?: string | null;
          os_id: string;
          status?: string;
          user_id: string;
          valor_total: number;
        };
        Update: {
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          categoria_id?: string | null;
          created_at?: string;
          created_by?: string;
          custo_tecnico?: number;
          custo_tecnico_nome?: string | null;
          descricao?: string | null;
          id?: string;
          lancamento_custo_tecnico_id?: string | null;
          motivo_cancelamento?: string | null;
          numero?: number;
          observacoes?: string | null;
          os_id?: string;
          status?: string;
          user_id?: string;
          valor_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "os_faturamentos_categoria_id_fkey";
            columns: ["categoria_id"];
            referencedRelation: "finance_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_faturamentos_lancamento_custo_tecnico_id_fkey";
            columns: ["lancamento_custo_tecnico_id"];
            referencedRelation: "lancamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_faturamentos_os_id_fkey";
            columns: ["os_id"];
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
        ];
      };
      os_historico: {
        Row: {
          created_at: string;
          created_by: string | null;
          descricao: string;
          evento: string;
          id: string;
          os_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          descricao: string;
          evento: string;
          id?: string;
          os_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string;
          evento?: string;
          id?: string;
          os_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_historico_os_id_fkey";
            columns: ["os_id"];
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
        ];
      };
      os_itens: {
        Row: {
          created_at: string;
          descricao: string;
          id: string;
          observacao: string | null;
          os_id: string;
          preco_unitario: number;
          produto_id: string | null;
          quantidade: number;
          tipo: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          descricao: string;
          id?: string;
          observacao?: string | null;
          os_id: string;
          preco_unitario?: number;
          produto_id?: string | null;
          quantidade?: number;
          tipo?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          descricao?: string;
          id?: string;
          observacao?: string | null;
          os_id?: string;
          preco_unitario?: number;
          produto_id?: string | null;
          quantidade?: number;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_itens_os_id_fkey";
            columns: ["os_id"];
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_itens_produto_id_fkey";
            columns: ["produto_id"];
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      os_status_flows: {
        Row: {
          ativo: boolean | null;
          created_at: string;
          destino: string;
          id: string;
          origem: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ativo?: boolean | null;
          created_at?: string;
          destino: string;
          id?: string;
          origem: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ativo?: boolean | null;
          created_at?: string;
          destino?: string;
          id?: string;
          origem?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      os_templates: {
        Row: {
          ativo: boolean;
          builtin: boolean;
          categoria: string;
          config: Json;
          created_at: string;
          created_by: string | null;
          descricao: string | null;
          favorito: boolean;
          id: string;
          nome: string;
          orientacao: string;
          padrao: boolean;
          paginas: number;
          tema: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          ativo?: boolean;
          builtin?: boolean;
          categoria: string;
          config?: Json;
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          favorito?: boolean;
          id?: string;
          nome: string;
          orientacao?: string;
          padrao?: boolean;
          paginas?: number;
          tema?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          ativo?: boolean;
          builtin?: boolean;
          categoria?: string;
          config?: Json;
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          favorito?: boolean;
          id?: string;
          nome?: string;
          orientacao?: string;
          padrao?: boolean;
          paginas?: number;
          tema?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      pagamento_config: {
        Row: {
          created_at: string;
          id: string;
          mercado_pago_access_token: string | null;
          mercado_pago_public_key: string | null;
          mercado_pago_webhook_secret: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mercado_pago_access_token?: string | null;
          mercado_pago_public_key?: string | null;
          mercado_pago_webhook_secret?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mercado_pago_access_token?: string | null;
          mercado_pago_public_key?: string | null;
          mercado_pago_webhook_secret?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          prazo_recebimento: number | null;
          taxa: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          prazo_recebimento?: number | null;
          taxa?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          prazo_recebimento?: number | null;
          taxa?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      peliculas_catalogo: {
        Row: {
          codigo: string | null;
          created_at: string;
          id: string;
          marca: string;
          modelo: string;
          observacoes: string | null;
          pelicula_compativel: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          codigo?: string | null;
          created_at?: string;
          id?: string;
          marca: string;
          modelo: string;
          observacoes?: string | null;
          pelicula_compativel: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          codigo?: string | null;
          created_at?: string;
          id?: string;
          marca?: string;
          modelo?: string;
          observacoes?: string | null;
          pelicula_compativel?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      plan_features: {
        Row: {
          created_at: string;
          enabled: boolean;
          feature: string;
          id: string;
          plan_id: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          feature: string;
          id?: string;
          plan_id: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          feature?: string;
          id?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey";
            columns: ["plan_id"];
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          annual_discount_pct: number | null;
          annual_price: number | null;
          created_at: string;
          description: string | null;
          id: string;
          monthly_price: number | null;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          annual_discount_pct?: number | null;
          annual_price?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          monthly_price?: number | null;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          annual_discount_pct?: number | null;
          annual_price?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          monthly_price?: number | null;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      produto_categorias: {
        Row: {
          created_at: string | null;
          id: string;
          nome: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          nome: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          nome?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      produtos: {
        Row: {
          categoria: string | null;
          codigo_barras: string | null;
          comissao_percentual: number;
          created_at: string;
          descricao: string | null;
          estoque_minimo: number;
          exibir_no_catalogo: boolean | null;
          fornecedor_id: string | null;
          id: string;
          importacao_id: string | null;
          nome: string;
          preco_custo: number;
          preco_venda: number;
          quantidade: number;
          sku: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          categoria?: string | null;
          codigo_barras?: string | null;
          comissao_percentual?: number;
          created_at?: string;
          descricao?: string | null;
          estoque_minimo?: number;
          exibir_no_catalogo?: boolean | null;
          fornecedor_id?: string | null;
          id?: string;
          importacao_id?: string | null;
          nome: string;
          preco_custo?: number;
          preco_venda?: number;
          quantidade?: number;
          sku?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          categoria?: string | null;
          codigo_barras?: string | null;
          comissao_percentual?: number;
          created_at?: string;
          descricao?: string | null;
          estoque_minimo?: number;
          exibir_no_catalogo?: boolean | null;
          fornecedor_id?: string | null;
          id?: string;
          importacao_id?: string | null;
          nome?: string;
          preco_custo?: number;
          preco_venda?: number;
          quantidade?: number;
          sku?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "produtos_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            referencedRelation: "fornecedores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produtos_importacao_id_fkey";
            columns: ["importacao_id"];
            referencedRelation: "importacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          acesso_ate: string | null;
          aviso_inatividade_enviado_em: string | null;
          billing_day: number | null;
          cidade: string | null;
          cnpj_cpf: string | null;
          created_at: string;
          endereco: string | null;
          ia_creditos: number;
          id: string;
          logo_url: string | null;
          loja: string | null;
          nome: string | null;
          onboarding_concluido_em: string | null;
          plan_id: string | null;
          plano: string;
          plano_solicitado: string | null;
          plano_solicitado_em: string | null;
          status: string;
          trial_aviso_enviado_em: string | null;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          acesso_ate?: string | null;
          aviso_inatividade_enviado_em?: string | null;
          billing_day?: number | null;
          cidade?: string | null;
          cnpj_cpf?: string | null;
          created_at?: string;
          endereco?: string | null;
          ia_creditos?: number;
          id: string;
          logo_url?: string | null;
          loja?: string | null;
          nome?: string | null;
          onboarding_concluido_em?: string | null;
          plan_id?: string | null;
          plano?: string;
          plano_solicitado?: string | null;
          plano_solicitado_em?: string | null;
          status?: string;
          trial_aviso_enviado_em?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          acesso_ate?: string | null;
          aviso_inatividade_enviado_em?: string | null;
          billing_day?: number | null;
          cidade?: string | null;
          cnpj_cpf?: string | null;
          created_at?: string;
          endereco?: string | null;
          ia_creditos?: number;
          id?: string;
          logo_url?: string | null;
          loja?: string | null;
          nome?: string | null;
          onboarding_concluido_em?: string | null;
          plan_id?: string | null;
          plano?: string;
          plano_solicitado?: string | null;
          plano_solicitado_em?: string | null;
          status?: string;
          trial_aviso_enviado_em?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey";
            columns: ["plan_id"];
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_config: {
        Row: {
          created_at: string | null;
          id: string;
          situacao_faturar: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          situacao_faturar?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          situacao_faturar?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      purchase_status_flows: {
        Row: {
          color: string | null;
          created_at: string | null;
          from_status: string;
          id: string;
          is_active: boolean | null;
          to_status: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          from_status: string;
          id?: string;
          is_active?: boolean | null;
          to_status: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          from_status?: string;
          id?: string;
          is_active?: boolean | null;
          to_status?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      referral_commissions: {
        Row: {
          amount: number;
          available_at: string | null;
          canceled_at: string | null;
          commission_type: string;
          created_at: string;
          description: string | null;
          id: string;
          paid_at: string | null;
          plan_id: string | null;
          referral_id: string;
          referrer_empresa_id: string;
          status: string;
          subscription_id: string | null;
          subscription_payment_id: string | null;
          updated_at: string;
          used_at: string | null;
          used_note: string | null;
        };
        Insert: {
          amount: number;
          available_at?: string | null;
          canceled_at?: string | null;
          commission_type: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          paid_at?: string | null;
          plan_id?: string | null;
          referral_id: string;
          referrer_empresa_id: string;
          status?: string;
          subscription_id?: string | null;
          subscription_payment_id?: string | null;
          updated_at?: string;
          used_at?: string | null;
          used_note?: string | null;
        };
        Update: {
          amount?: number;
          available_at?: string | null;
          canceled_at?: string | null;
          commission_type?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          paid_at?: string | null;
          plan_id?: string | null;
          referral_id?: string;
          referrer_empresa_id?: string;
          status?: string;
          subscription_id?: string | null;
          subscription_payment_id?: string | null;
          updated_at?: string;
          used_at?: string | null;
          used_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "referral_commissions_plan_id_fkey";
            columns: ["plan_id"];
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_commissions_referral_id_fkey";
            columns: ["referral_id"];
            referencedRelation: "referrals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_commissions_referrer_empresa_id_fkey";
            columns: ["referrer_empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_commissions_subscription_id_fkey";
            columns: ["subscription_id"];
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_commissions_subscription_payment_id_fkey";
            columns: ["subscription_payment_id"];
            referencedRelation: "subscription_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_events: {
        Row: {
          actor_empresa_id: string | null;
          commission_id: string | null;
          created_at: string;
          id: string;
          payload: Json | null;
          referral_id: string | null;
          type: string;
          withdrawal_id: string | null;
        };
        Insert: {
          actor_empresa_id?: string | null;
          commission_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json | null;
          referral_id?: string | null;
          type: string;
          withdrawal_id?: string | null;
        };
        Update: {
          actor_empresa_id?: string | null;
          commission_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json | null;
          referral_id?: string | null;
          type?: string;
          withdrawal_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "referral_events_actor_empresa_id_fkey";
            columns: ["actor_empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_events_commission_id_fkey";
            columns: ["commission_id"];
            referencedRelation: "referral_commissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_events_referral_id_fkey";
            columns: ["referral_id"];
            referencedRelation: "referrals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_events_withdrawal_id_fkey";
            columns: ["withdrawal_id"];
            referencedRelation: "referral_withdrawals";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_plan_rules: {
        Row: {
          active: boolean;
          commission_type: string;
          commission_value: number | null;
          created_at: string;
          id: string;
          plan_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          commission_type: string;
          commission_value?: number | null;
          created_at?: string;
          id?: string;
          plan_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          commission_type?: string;
          commission_value?: number | null;
          created_at?: string;
          id?: string;
          plan_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_plan_rules_plan_id_fkey";
            columns: ["plan_id"];
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_profiles: {
        Row: {
          active: boolean;
          created_at: string;
          empresa_id: string;
          id: string;
          referral_code: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          empresa_id: string;
          id?: string;
          referral_code: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          referral_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_profiles_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_program_config: {
        Row: {
          active: boolean;
          commission_type: string | null;
          commission_value: number | null;
          created_at: string;
          description: string | null;
          first_payment_only: boolean;
          id: string;
          minimum_withdrawal: number | null;
          name: string;
          pending_days: number | null;
          recurring_commission: boolean;
          updated_at: string;
          whatsapp_share_message: string | null;
        };
        Insert: {
          active?: boolean;
          commission_type?: string | null;
          commission_value?: number | null;
          created_at?: string;
          description?: string | null;
          first_payment_only?: boolean;
          id?: string;
          minimum_withdrawal?: number | null;
          name?: string;
          pending_days?: number | null;
          recurring_commission?: boolean;
          updated_at?: string;
          whatsapp_share_message?: string | null;
        };
        Update: {
          active?: boolean;
          commission_type?: string | null;
          commission_value?: number | null;
          created_at?: string;
          description?: string | null;
          first_payment_only?: boolean;
          id?: string;
          minimum_withdrawal?: number | null;
          name?: string;
          pending_days?: number | null;
          recurring_commission?: boolean;
          updated_at?: string;
          whatsapp_share_message?: string | null;
        };
        Relationships: [];
      };
      referral_withdrawal_items: {
        Row: {
          amount: number;
          commission_id: string;
          created_at: string;
          id: string;
          withdrawal_id: string;
        };
        Insert: {
          amount: number;
          commission_id: string;
          created_at?: string;
          id?: string;
          withdrawal_id: string;
        };
        Update: {
          amount?: number;
          commission_id?: string;
          created_at?: string;
          id?: string;
          withdrawal_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_withdrawal_items_commission_id_fkey";
            columns: ["commission_id"];
            referencedRelation: "referral_commissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referral_withdrawal_items_withdrawal_id_fkey";
            columns: ["withdrawal_id"];
            referencedRelation: "referral_withdrawals";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_withdrawals: {
        Row: {
          amount: number;
          approved_at: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          paid_at: string | null;
          payment_method: string;
          pix_key: string | null;
          referrer_empresa_id: string;
          rejected_at: string | null;
          rejection_reason: string | null;
          requested_at: string;
          status: string;
          transaction_reference: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          approved_at?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_method?: string;
          pix_key?: string | null;
          referrer_empresa_id: string;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          requested_at?: string;
          status?: string;
          transaction_reference?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          approved_at?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_method?: string;
          pix_key?: string | null;
          referrer_empresa_id?: string;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          requested_at?: string;
          status?: string;
          transaction_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_withdrawals_referrer_empresa_id_fkey";
            columns: ["referrer_empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      referrals: {
        Row: {
          clicked_at: string | null;
          converted_at: string | null;
          created_at: string;
          id: string;
          referral_code: string;
          referred_empresa_id: string | null;
          referrer_empresa_id: string;
          registered_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          clicked_at?: string | null;
          converted_at?: string | null;
          created_at?: string;
          id?: string;
          referral_code: string;
          referred_empresa_id?: string | null;
          referrer_empresa_id: string;
          registered_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          clicked_at?: string | null;
          converted_at?: string | null;
          created_at?: string;
          id?: string;
          referral_code?: string;
          referred_empresa_id?: string | null;
          referrer_empresa_id?: string;
          registered_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_referred_empresa_id_fkey";
            columns: ["referred_empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referrer_empresa_id_fkey";
            columns: ["referrer_empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          empresa_id: string;
          id: string;
          modulo: string;
          pode_gerenciar: boolean;
          pode_ver: boolean;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          empresa_id: string;
          id?: string;
          modulo: string;
          pode_gerenciar?: boolean;
          pode_ver?: boolean;
          role: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          empresa_id?: string;
          id?: string;
          modulo?: string;
          pode_gerenciar?: boolean;
          pode_ver?: boolean;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_config: {
        Row: {
          cliente_balcao_id: string | null;
          created_at: string;
          dias_garantia_padrao: number | null;
          editar_preco_carrinho: boolean | null;
          id: string;
          limite_itens_carrinho: number | null;
          limite_vendas_abertas: number | null;
          pagamento_sugerido: string | null;
          permitir_desconto: boolean | null;
          proximo_numero_venda: number | null;
          status_padrao_os: string | null;
          status_padrao_venda: string | null;
          teto_desconto_percentual: number | null;
          texto_proposta: string | null;
          tipo_caixa: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cliente_balcao_id?: string | null;
          created_at?: string;
          dias_garantia_padrao?: number | null;
          editar_preco_carrinho?: boolean | null;
          id?: string;
          limite_itens_carrinho?: number | null;
          limite_vendas_abertas?: number | null;
          pagamento_sugerido?: string | null;
          permitir_desconto?: boolean | null;
          proximo_numero_venda?: number | null;
          status_padrao_os?: string | null;
          status_padrao_venda?: string | null;
          teto_desconto_percentual?: number | null;
          texto_proposta?: string | null;
          tipo_caixa?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cliente_balcao_id?: string | null;
          created_at?: string;
          dias_garantia_padrao?: number | null;
          editar_preco_carrinho?: boolean | null;
          id?: string;
          limite_itens_carrinho?: number | null;
          limite_vendas_abertas?: number | null;
          pagamento_sugerido?: string | null;
          permitir_desconto?: boolean | null;
          proximo_numero_venda?: number | null;
          status_padrao_os?: string | null;
          status_padrao_venda?: string | null;
          teto_desconto_percentual?: number | null;
          texto_proposta?: string | null;
          tipo_caixa?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sale_status_flows: {
        Row: {
          ativo: boolean | null;
          cor: string | null;
          created_at: string;
          destino: string;
          id: string;
          origem: string;
          user_id: string;
        };
        Insert: {
          ativo?: boolean | null;
          cor?: string | null;
          created_at?: string;
          destino: string;
          id?: string;
          origem: string;
          user_id: string;
        };
        Update: {
          ativo?: boolean | null;
          cor?: string | null;
          created_at?: string;
          destino?: string;
          id?: string;
          origem?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      seminovos: {
        Row: {
          acessorios: string | null;
          armazenamento: string | null;
          assinatura_coletada_em: string | null;
          assinatura_url: string | null;
          bateria_percentual: number | null;
          cliente_id: string | null;
          cor: string | null;
          created_at: string;
          data_avaliacao: string;
          devolucao_data: string | null;
          devolucao_motivo: string | null;
          estado: string | null;
          finalizacao_checklist: Json | null;
          finalizacao_observacao: string | null;
          finalizado_em: string | null;
          finalizado_por: string | null;
          fotos: string[];
          id: string;
          imei: string | null;
          lucro_minimo: number | null;
          lucro_previsto: number | null;
          marca: string;
          modelo: string;
          observacoes: string | null;
          outros_custos: number;
          padrao_desbloqueio: string | null;
          preco_lojista: number | null;
          preco_venda: number | null;
          ram: string | null;
          senha_dispositivo: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          valor_conserto: number;
          valor_oferecido: number | null;
          valor_pago: number | null;
          valor_total_gasto: number | null;
          venda_id: string | null;
          vendedor_documento: string | null;
          vendedor_nome: string | null;
          vendedor_telefone: string | null;
        };
        Insert: {
          acessorios?: string | null;
          armazenamento?: string | null;
          assinatura_coletada_em?: string | null;
          assinatura_url?: string | null;
          bateria_percentual?: number | null;
          cliente_id?: string | null;
          cor?: string | null;
          created_at?: string;
          data_avaliacao?: string;
          devolucao_data?: string | null;
          devolucao_motivo?: string | null;
          estado?: string | null;
          finalizacao_checklist?: Json | null;
          finalizacao_observacao?: string | null;
          finalizado_em?: string | null;
          finalizado_por?: string | null;
          fotos?: string[];
          id?: string;
          imei?: string | null;
          lucro_minimo?: number | null;
          lucro_previsto?: number | null;
          marca: string;
          modelo: string;
          observacoes?: string | null;
          outros_custos?: number;
          padrao_desbloqueio?: string | null;
          preco_lojista?: number | null;
          preco_venda?: number | null;
          ram?: string | null;
          senha_dispositivo?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          valor_conserto?: number;
          valor_oferecido?: number | null;
          valor_pago?: number | null;
          valor_total_gasto?: number | null;
          venda_id?: string | null;
          vendedor_documento?: string | null;
          vendedor_nome?: string | null;
          vendedor_telefone?: string | null;
        };
        Update: {
          acessorios?: string | null;
          armazenamento?: string | null;
          assinatura_coletada_em?: string | null;
          assinatura_url?: string | null;
          bateria_percentual?: number | null;
          cliente_id?: string | null;
          cor?: string | null;
          created_at?: string;
          data_avaliacao?: string;
          devolucao_data?: string | null;
          devolucao_motivo?: string | null;
          estado?: string | null;
          finalizacao_checklist?: Json | null;
          finalizacao_observacao?: string | null;
          finalizado_em?: string | null;
          finalizado_por?: string | null;
          fotos?: string[];
          id?: string;
          imei?: string | null;
          lucro_minimo?: number | null;
          lucro_previsto?: number | null;
          marca?: string;
          modelo?: string;
          observacoes?: string | null;
          outros_custos?: number;
          padrao_desbloqueio?: string | null;
          preco_lojista?: number | null;
          preco_venda?: number | null;
          ram?: string | null;
          senha_dispositivo?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          valor_conserto?: number;
          valor_oferecido?: number | null;
          valor_pago?: number | null;
          valor_total_gasto?: number | null;
          venda_id?: string | null;
          vendedor_documento?: string | null;
          vendedor_nome?: string | null;
          vendedor_telefone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seminovos_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seminovos_venda_id_fkey";
            columns: ["venda_id"];
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      seminovos_conserto_itens: {
        Row: {
          categoria: string;
          created_at: string;
          descricao: string | null;
          fornecedor: string | null;
          id: string;
          observacao: string | null;
          seminovo_id: string;
          updated_at: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          categoria: string;
          created_at?: string;
          descricao?: string | null;
          fornecedor?: string | null;
          id?: string;
          observacao?: string | null;
          seminovo_id: string;
          updated_at?: string;
          user_id: string;
          valor?: number;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          descricao?: string | null;
          fornecedor?: string | null;
          id?: string;
          observacao?: string | null;
          seminovo_id?: string;
          updated_at?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "seminovos_conserto_itens_seminovo_id_fkey";
            columns: ["seminovo_id"];
            referencedRelation: "seminovos";
            referencedColumns: ["id"];
          },
        ];
      };
      seminovos_historico: {
        Row: {
          created_at: string;
          created_by: string | null;
          descricao: string;
          evento: string;
          id: string;
          seminovo_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          descricao: string;
          evento: string;
          id?: string;
          seminovo_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string;
          evento?: string;
          id?: string;
          seminovo_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seminovos_historico_seminovo_id_fkey";
            columns: ["seminovo_id"];
            referencedRelation: "seminovos";
            referencedColumns: ["id"];
          },
        ];
      };
      service_order_photos: {
        Row: {
          category: string | null;
          created_at: string | null;
          id: string;
          lado: string | null;
          service_order_id: string;
          url: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          id?: string;
          lado?: string | null;
          service_order_id: string;
          url: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          id?: string;
          lado?: string | null;
          service_order_id?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_order_photos_service_order_id_fkey";
            columns: ["service_order_id"];
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
        ];
      };
      site_landing: {
        Row: {
          conteudo: Json;
          id: number;
          updated_at: string;
        };
        Insert: {
          conteudo?: Json;
          id?: number;
          updated_at?: string;
        };
        Update: {
          conteudo?: Json;
          id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      smtp_config: {
        Row: {
          created_at: string | null;
          encryption: string | null;
          from_email: string;
          from_name: string | null;
          host: string;
          id: string;
          is_active: boolean | null;
          password: string;
          port: number;
          updated_at: string | null;
          user: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          encryption?: string | null;
          from_email: string;
          from_name?: string | null;
          host: string;
          id?: string;
          is_active?: boolean | null;
          password: string;
          port?: number;
          updated_at?: string | null;
          user: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          encryption?: string | null;
          from_email?: string;
          from_name?: string | null;
          host?: string;
          id?: string;
          is_active?: boolean | null;
          password?: string;
          port?: number;
          updated_at?: string | null;
          user?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscription_events: {
        Row: {
          created_at: string;
          id: string;
          payload: Json | null;
          subscription_id: string | null;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          payload?: Json | null;
          subscription_id?: string | null;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          payload?: Json | null;
          subscription_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey";
            columns: ["subscription_id"];
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          amount: number;
          created_at: string;
          expires_at: string | null;
          external_reference: string;
          id: string;
          mercado_pago_payment_id: string | null;
          metadata: Json | null;
          paid_at: string | null;
          payment_method: string;
          status: string;
          subscription_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          expires_at?: string | null;
          external_reference: string;
          id?: string;
          mercado_pago_payment_id?: string | null;
          metadata?: Json | null;
          paid_at?: string | null;
          payment_method: string;
          status?: string;
          subscription_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          expires_at?: string | null;
          external_reference?: string;
          id?: string;
          mercado_pago_payment_id?: string | null;
          metadata?: Json | null;
          paid_at?: string | null;
          payment_method?: string;
          status?: string;
          subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey";
            columns: ["subscription_id"];
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          billing_cycle: string;
          canceled_at: string | null;
          created_at: string;
          empresa_id: string;
          id: string;
          mercado_pago_preapproval_id: string | null;
          next_billing_date: string | null;
          plan_id: string;
          start_date: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          billing_cycle: string;
          canceled_at?: string | null;
          created_at?: string;
          empresa_id: string;
          id?: string;
          mercado_pago_preapproval_id?: string | null;
          next_billing_date?: string | null;
          plan_id: string;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          billing_cycle?: string;
          canceled_at?: string | null;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          mercado_pago_preapproval_id?: string | null;
          next_billing_date?: string | null;
          plan_id?: string;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      termos_garantia: {
        Row: {
          ativo: boolean;
          conteudo: string;
          created_at: string | null;
          id: string;
          is_default: boolean | null;
          titulo: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          ativo?: boolean;
          conteudo: string;
          created_at?: string | null;
          id?: string;
          is_default?: boolean | null;
          titulo: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          ativo?: boolean;
          conteudo?: string;
          created_at?: string | null;
          id?: string;
          is_default?: boolean | null;
          titulo?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_empresas: {
        Row: {
          created_at: string | null;
          empresa_id: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          empresa_id: string;
          id?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          empresa_id?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_empresas_empresa_id_fkey";
            columns: ["empresa_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      venda_itens: {
        Row: {
          aparelho_id: string | null;
          created_at: string;
          descricao: string;
          id: string;
          preco_unitario: number;
          produto_id: string | null;
          quantidade: number;
          user_id: string;
          venda_id: string;
        };
        Insert: {
          aparelho_id?: string | null;
          created_at?: string;
          descricao: string;
          id?: string;
          preco_unitario?: number;
          produto_id?: string | null;
          quantidade?: number;
          user_id: string;
          venda_id: string;
        };
        Update: {
          aparelho_id?: string | null;
          created_at?: string;
          descricao?: string;
          id?: string;
          preco_unitario?: number;
          produto_id?: string | null;
          quantidade?: number;
          user_id?: string;
          venda_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venda_itens_aparelho_id_fkey";
            columns: ["aparelho_id"];
            referencedRelation: "aparelhos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venda_itens_produto_id_fkey";
            columns: ["produto_id"];
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey";
            columns: ["venda_id"];
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      vendas: {
        Row: {
          cliente_id: string | null;
          created_at: string;
          desconto: number;
          forma_pagamento: string;
          id: string;
          numero: number;
          observacoes: string | null;
          origem: string;
          status: string;
          total: number;
          user_id: string;
        };
        Insert: {
          cliente_id?: string | null;
          created_at?: string;
          desconto?: number;
          forma_pagamento?: string;
          id?: string;
          numero?: number;
          observacoes?: string | null;
          origem?: string;
          status?: string;
          total?: number;
          user_id: string;
        };
        Update: {
          cliente_id?: string | null;
          created_at?: string;
          desconto?: number;
          forma_pagamento?: string;
          id?: string;
          numero?: number;
          observacoes?: string | null;
          origem?: string;
          status?: string;
          total?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_config: {
        Row: {
          robo_textos: Json;
          robo_ativo: boolean;
          robo_horario: Json;
          aprovacao_automacoes: string[];
          notif_cobranca_lembrete_auto: boolean;
          cobranca_lembrete_texto: string;
          notif_cobranca_paga_auto: boolean;
          cobranca_paga_texto: string;
          notif_cobranca_desde: string | null;
          boas_vindas: boolean | null;
          boas_vindas_texto: string | null;
          created_at: string | null;
          feliz_aniversario: boolean | null;
          feliz_aniversario_texto: string | null;
          fila_hora_fim: number;
          fila_hora_inicio: number;
          fila_intervalo_seg: number;
          fila_limite_hora: number;
          ia_agradecer_pesquisa: boolean;
          ia_pesquisa_personalizada: boolean;
          id: string;
          instancia_id: string | null;
          lembrete_tecnico: boolean | null;
          lembrete_tecnico_texto: string | null;
          notif_aniversario_auto: boolean;
          notif_boas_vindas_auto: boolean;
          notif_boas_vindas_auto_desde: string | null;
          notif_nfe_emitida: boolean | null;
          notif_nfe_emitida_texto: string | null;
          notif_os_criada: boolean | null;
          notif_os_criada_texto: string | null;
          notif_os_editada: boolean | null;
          notif_os_editada_texto: string | null;
          notif_os_pronta: boolean;
          notif_os_pronta_texto: string;
          notif_pesquisa_auto: boolean;
          notif_pesquisa_auto_desde: string | null;
          notif_pesquisa_venda_auto: boolean;
          notif_pesquisa_venda_auto_desde: string | null;
          notif_relatorio_auto: boolean;
          pesquisa_pos_os: boolean | null;
          pesquisa_pos_os_texto: string | null;
          pesquisa_pos_venda: boolean | null;
          pesquisa_pos_venda_texto: string | null;
          relatorio_numero: string | null;
          relatorio_semanal_ia: boolean | null;
          relatorio_semanal_ia_texto: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          robo_textos?: Json;
          robo_ativo?: boolean;
          robo_horario?: Json;
          aprovacao_automacoes?: string[];
          notif_cobranca_lembrete_auto?: boolean;
          cobranca_lembrete_texto?: string;
          notif_cobranca_paga_auto?: boolean;
          cobranca_paga_texto?: string;
          notif_cobranca_desde?: string | null;
          boas_vindas?: boolean | null;
          boas_vindas_texto?: string | null;
          created_at?: string | null;
          feliz_aniversario?: boolean | null;
          feliz_aniversario_texto?: string | null;
          fila_hora_fim?: number;
          fila_hora_inicio?: number;
          fila_intervalo_seg?: number;
          fila_limite_hora?: number;
          ia_agradecer_pesquisa?: boolean;
          ia_pesquisa_personalizada?: boolean;
          id?: string;
          instancia_id?: string | null;
          lembrete_tecnico?: boolean | null;
          lembrete_tecnico_texto?: string | null;
          notif_aniversario_auto?: boolean;
          notif_boas_vindas_auto?: boolean;
          notif_boas_vindas_auto_desde?: string | null;
          notif_nfe_emitida?: boolean | null;
          notif_nfe_emitida_texto?: string | null;
          notif_os_criada?: boolean | null;
          notif_os_criada_texto?: string | null;
          notif_os_editada?: boolean | null;
          notif_os_editada_texto?: string | null;
          notif_os_pronta?: boolean;
          notif_os_pronta_texto?: string;
          notif_pesquisa_auto?: boolean;
          notif_pesquisa_auto_desde?: string | null;
          notif_pesquisa_venda_auto?: boolean;
          notif_pesquisa_venda_auto_desde?: string | null;
          notif_relatorio_auto?: boolean;
          pesquisa_pos_os?: boolean | null;
          pesquisa_pos_os_texto?: string | null;
          pesquisa_pos_venda?: boolean | null;
          pesquisa_pos_venda_texto?: string | null;
          relatorio_numero?: string | null;
          relatorio_semanal_ia?: boolean | null;
          relatorio_semanal_ia_texto?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          robo_textos?: Json;
          robo_ativo?: boolean;
          robo_horario?: Json;
          aprovacao_automacoes?: string[];
          notif_cobranca_lembrete_auto?: boolean;
          cobranca_lembrete_texto?: string;
          notif_cobranca_paga_auto?: boolean;
          cobranca_paga_texto?: string;
          notif_cobranca_desde?: string | null;
          boas_vindas?: boolean | null;
          boas_vindas_texto?: string | null;
          created_at?: string | null;
          feliz_aniversario?: boolean | null;
          feliz_aniversario_texto?: string | null;
          fila_hora_fim?: number;
          fila_hora_inicio?: number;
          fila_intervalo_seg?: number;
          fila_limite_hora?: number;
          ia_agradecer_pesquisa?: boolean;
          ia_pesquisa_personalizada?: boolean;
          id?: string;
          instancia_id?: string | null;
          lembrete_tecnico?: boolean | null;
          lembrete_tecnico_texto?: string | null;
          notif_aniversario_auto?: boolean;
          notif_boas_vindas_auto?: boolean;
          notif_boas_vindas_auto_desde?: string | null;
          notif_nfe_emitida?: boolean | null;
          notif_nfe_emitida_texto?: string | null;
          notif_os_criada?: boolean | null;
          notif_os_criada_texto?: string | null;
          notif_os_editada?: boolean | null;
          notif_os_editada_texto?: string | null;
          notif_os_pronta?: boolean;
          notif_os_pronta_texto?: string;
          notif_pesquisa_auto?: boolean;
          notif_pesquisa_auto_desde?: string | null;
          notif_pesquisa_venda_auto?: boolean;
          notif_pesquisa_venda_auto_desde?: string | null;
          notif_relatorio_auto?: boolean;
          pesquisa_pos_os?: boolean | null;
          pesquisa_pos_os_texto?: string | null;
          pesquisa_pos_venda?: boolean | null;
          pesquisa_pos_venda_texto?: string | null;
          relatorio_numero?: string | null;
          relatorio_semanal_ia?: boolean | null;
          relatorio_semanal_ia_texto?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      whatsapp_connections: {
        Row: {
          created_at: string;
          id: string;
          instance_name: string;
          last_connected_at: string | null;
          last_error: string | null;
          phone_number: string | null;
          qr_code: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          instance_name: string;
          last_connected_at?: string | null;
          last_error?: string | null;
          phone_number?: string | null;
          qr_code?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          instance_name?: string;
          last_connected_at?: string | null;
          last_error?: string | null;
          phone_number?: string | null;
          qr_code?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      whatsapp_conversa_eventos: {
        Row: {
          autor_id: string | null;
          conversa_id: string;
          created_at: string;
          detalhes: Json | null;
          id: string;
          tipo: string;
          user_id: string;
        };
        Insert: {
          autor_id?: string | null;
          conversa_id: string;
          created_at?: string;
          detalhes?: Json | null;
          id?: string;
          tipo: string;
          user_id: string;
        };
        Update: {
          autor_id?: string | null;
          conversa_id?: string;
          created_at?: string;
          detalhes?: Json | null;
          id?: string;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversa_eventos_conversa_id_fkey";
            columns: ["conversa_id"];
            referencedRelation: "whatsapp_conversas";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_conversas: {
        Row: {
          robo_etapa: string | null;
          robo_dados: Json;
          robo_atualizado_em: string | null;
          robo_pausado_ate: string | null;
          opt_out_em: string | null;
          foto_url: string | null;
          foto_atualizada_em: string | null;
          atribuida_a: string | null;
          chave_telefone: string;
          cliente_id: string | null;
          contact_name: string | null;
          created_at: string;
          encerrada_em: string | null;
          etiquetas: string[];
          id: string;
          nao_lidas: number;
          phone_number: string;
          prioridade: string;
          status: string;
          ultima_direcao: string | null;
          ultima_mensagem_em: string | null;
          ultima_mensagem_preview: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          robo_etapa?: string | null;
          robo_dados?: Json;
          robo_atualizado_em?: string | null;
          robo_pausado_ate?: string | null;
          opt_out_em?: string | null;
          foto_url?: string | null;
          foto_atualizada_em?: string | null;
          atribuida_a?: string | null;
          chave_telefone: string;
          cliente_id?: string | null;
          contact_name?: string | null;
          created_at?: string;
          encerrada_em?: string | null;
          etiquetas?: string[];
          id?: string;
          nao_lidas?: number;
          phone_number: string;
          prioridade?: string;
          status?: string;
          ultima_direcao?: string | null;
          ultima_mensagem_em?: string | null;
          ultima_mensagem_preview?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          robo_etapa?: string | null;
          robo_dados?: Json;
          robo_atualizado_em?: string | null;
          robo_pausado_ate?: string | null;
          opt_out_em?: string | null;
          foto_url?: string | null;
          foto_atualizada_em?: string | null;
          atribuida_a?: string | null;
          chave_telefone?: string;
          cliente_id?: string | null;
          contact_name?: string | null;
          created_at?: string;
          encerrada_em?: string | null;
          etiquetas?: string[];
          id?: string;
          nao_lidas?: number;
          phone_number?: string;
          prioridade?: string;
          status?: string;
          ultima_direcao?: string | null;
          ultima_mensagem_em?: string | null;
          ultima_mensagem_preview?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_messages: {
        Row: {
          conversa_id: string | null;
          entrega: string | null;
          midia_mime: string | null;
          midia_nome: string | null;
          midia_path: string | null;
          midia_tamanho: number | null;
          midia_tipo: string | null;
          resposta_a: string | null;
          attachments: Json;
          avaliacao: string | null;
          avaliacao_resolvida: boolean;
          connection_id: string | null;
          contact_name: string | null;
          content: string | null;
          created_at: string;
          direction: string;
          enviado_em: string | null;
          error: string | null;
          evolution_message_id: string | null;
          id: string;
          metadata: Json | null;
          os_id: string | null;
          pesquisa_msg_id: string | null;
          phone_number: string;
          scheduled_at: string | null;
          sent_by: string | null;
          status: string;
          template_id: string | null;
          user_id: string;
        };
        Insert: {
          conversa_id?: string | null;
          entrega?: string | null;
          midia_mime?: string | null;
          midia_nome?: string | null;
          midia_path?: string | null;
          midia_tamanho?: number | null;
          midia_tipo?: string | null;
          resposta_a?: string | null;
          attachments?: Json;
          avaliacao?: string | null;
          avaliacao_resolvida?: boolean;
          connection_id?: string | null;
          contact_name?: string | null;
          content?: string | null;
          created_at?: string;
          direction: string;
          enviado_em?: string | null;
          error?: string | null;
          evolution_message_id?: string | null;
          id?: string;
          metadata?: Json | null;
          os_id?: string | null;
          pesquisa_msg_id?: string | null;
          phone_number: string;
          scheduled_at?: string | null;
          sent_by?: string | null;
          status?: string;
          template_id?: string | null;
          user_id: string;
        };
        Update: {
          conversa_id?: string | null;
          entrega?: string | null;
          midia_mime?: string | null;
          midia_nome?: string | null;
          midia_path?: string | null;
          midia_tamanho?: number | null;
          midia_tipo?: string | null;
          resposta_a?: string | null;
          attachments?: Json;
          avaliacao?: string | null;
          avaliacao_resolvida?: boolean;
          connection_id?: string | null;
          contact_name?: string | null;
          content?: string | null;
          created_at?: string;
          direction?: string;
          enviado_em?: string | null;
          error?: string | null;
          evolution_message_id?: string | null;
          id?: string;
          metadata?: Json | null;
          os_id?: string | null;
          pesquisa_msg_id?: string | null;
          phone_number?: string;
          scheduled_at?: string | null;
          sent_by?: string | null;
          status?: string;
          template_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_connection_id_fkey";
            columns: ["connection_id"];
            referencedRelation: "whatsapp_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_messages_os_id_fkey";
            columns: ["os_id"];
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_messages_pesquisa_msg_id_fkey";
            columns: ["pesquisa_msg_id"];
            referencedRelation: "whatsapp_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_respostas_rapidas: {
        Row: {
          atalho: string;
          created_at: string;
          id: string;
          texto: string;
          user_id: string;
        };
        Insert: {
          atalho: string;
          created_at?: string;
          id?: string;
          texto: string;
          user_id: string;
        };
        Update: {
          atalho?: string;
          created_at?: string;
          id?: string;
          texto?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      whatsapp_otps: {
        Row: {
          attempts: number;
          code_hash: string;
          created_at: string;
          expires_at: string;
          id: string;
          user_id: string;
          verified_at: string | null;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          user_id: string;
          verified_at?: string | null;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          user_id?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      whatsapp_system_connection: {
        Row: {
          created_at: string;
          id: string;
          instance_name: string;
          last_connected_at: string | null;
          last_error: string | null;
          phone_number: string | null;
          qr_code: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          instance_name?: string;
          last_connected_at?: string | null;
          last_error?: string | null;
          phone_number?: string | null;
          qr_code?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          instance_name?: string;
          last_connected_at?: string | null;
          last_error?: string | null;
          phone_number?: string | null;
          qr_code?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      vw_crediario_contratos: {
        Row: {
          bloqueio_manual: boolean | null;
          cliente_id: string | null;
          cliente_nome: string | null;
          cliente_telefone: string | null;
          created_at: string | null;
          created_by: string | null;
          dias_atraso: number | null;
          dias_tolerancia: number | null;
          entrada: number | null;
          id: string | null;
          imei: string | null;
          juros_mes_pct: number | null;
          liberado_ate: string | null;
          marca: string | null;
          modelo: string | null;
          multa_pct: number | null;
          num_parcelas: number | null;
          numero: number | null;
          observacoes: string | null;
          parcelas_pagas: number | null;
          primeiro_vencimento: string | null;
          provisionado_em: string | null;
          proximo_vencimento: string | null;
          saldo_devedor: number | null;
          status: string | null;
          status_aparelho: string | null;
          termo_aceito_em: string | null;
          total_recebido: number | null;
          ultimo_contato: string | null;
          updated_at: string | null;
          user_id: string | null;
          valor_aparelho: number | null;
          valor_parcela: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "crediario_contratos_cliente_id_fkey";
            columns: ["cliente_id"];
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      vw_crediario_parcelas: {
        Row: {
          contrato_id: string | null;
          created_at: string | null;
          dias_atraso: number | null;
          id: string | null;
          lancamento_id: string | null;
          numero: number | null;
          pago_em: string | null;
          payment_method_id: string | null;
          pix_txid: string | null;
          recebido_por: string | null;
          status: string | null;
          user_id: string | null;
          valor: number | null;
          valor_atualizado: number | null;
          valor_pago: number | null;
          vencimento: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "crediario_parcelas_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "crediario_contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_parcelas_contrato_id_fkey";
            columns: ["contrato_id"];
            referencedRelation: "vw_crediario_contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_parcelas_lancamento_id_fkey";
            columns: ["lancamento_id"];
            referencedRelation: "lancamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crediario_parcelas_payment_method_id_fkey";
            columns: ["payment_method_id"];
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      abrir_caixa: {
        Args: { p_empresa_id: string; p_valor_abertura: number };
        Returns: {
          aberto_em: string;
          aberto_por: string | null;
          diferenca: number | null;
          fechado_em: string | null;
          fechado_por: string | null;
          id: string;
          observacoes: string | null;
          resumo: Json | null;
          status: string;
          user_id: string;
          valor_abertura: number;
          valor_contado: number | null;
          valor_esperado: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "caixa_sessoes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      aceitar_convite: {
        Args: { p_codigo: string };
        Returns: {
          created_at: string | null;
          empresa_id: string;
          id: string;
          role: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "user_empresas";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ajustar_estoque: {
        Args: {
          p_motivo: string;
          p_produto_id: string;
          p_quantidade: number;
          p_tipo: string;
        };
        Returns: {
          categoria: string | null;
          codigo_barras: string | null;
          comissao_percentual: number;
          created_at: string;
          descricao: string | null;
          estoque_minimo: number;
          exibir_no_catalogo: boolean | null;
          fornecedor_id: string | null;
          id: string;
          importacao_id: string | null;
          nome: string;
          preco_custo: number;
          preco_venda: number;
          quantidade: number;
          sku: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "produtos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      alterar_bloqueio_crediario: {
        Args: {
          p_bloquear: boolean;
          p_contrato_id: string;
          p_liberar_ate?: string;
          p_motivo: string;
        };
        Returns: undefined;
      };
      backup_arquivos_empresa: {
        Args: { p_empresa: string };
        Returns: {
          bucket_id: string;
          name: string;
          tamanho: number;
        }[];
      };
      backup_tabelas_empresa: { Args: never; Returns: string[] };
      caixa_forma_normalizada: { Args: { p_forma: string }; Returns: string };
      cancelar_contrato_crediario: {
        Args: { p_contrato_id: string; p_motivo: string };
        Returns: undefined;
      };
      cancelar_faturamento_os: {
        Args: { p_faturamento_id: string; p_motivo?: string };
        Returns: {
          cancelado_em: string | null;
          cancelado_por: string | null;
          categoria_id: string | null;
          created_at: string;
          created_by: string;
          custo_tecnico: number;
          custo_tecnico_nome: string | null;
          descricao: string | null;
          id: string;
          lancamento_custo_tecnico_id: string | null;
          motivo_cancelamento: string | null;
          numero: number;
          observacoes: string | null;
          os_id: string;
          status: string;
          user_id: string;
          valor_total: number;
        };
        SetofOptions: {
          from: "*";
          to: "os_faturamentos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancelar_reserva_aparelho: {
        Args: { p_aparelho_id: string };
        Returns: {
          armazenamento: string | null;
          checklist: Json;
          ciclos_bateria: number | null;
          cor: string | null;
          created_at: string;
          created_by: string;
          estado_conservacao: string | null;
          id: string;
          imei1: string | null;
          imei2: string | null;
          marca: string;
          modelo: string;
          numero: number;
          numero_serie: string | null;
          observacoes: string | null;
          preco_custo: number;
          preco_venda: number;
          ram: string | null;
          reservado_ate: string | null;
          reservado_cliente_id: string | null;
          reservado_observacao: string | null;
          saude_bateria: number | null;
          seminovo_id: string | null;
          sold_at: string | null;
          status: string;
          tipo: string;
          updated_at: string;
          user_id: string;
          variante: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "aparelhos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancelar_venda: { Args: { p_venda_id: string }; Returns: undefined };
      cancelar_venda_aparelho: {
        Args: { p_motivo?: string; p_venda_id: string };
        Returns: {
          armazenamento: string | null;
          checklist: Json;
          ciclos_bateria: number | null;
          cor: string | null;
          created_at: string;
          created_by: string;
          estado_conservacao: string | null;
          id: string;
          imei1: string | null;
          imei2: string | null;
          marca: string;
          modelo: string;
          numero: number;
          numero_serie: string | null;
          observacoes: string | null;
          preco_custo: number;
          preco_venda: number;
          ram: string | null;
          reservado_ate: string | null;
          reservado_cliente_id: string | null;
          reservado_observacao: string | null;
          saude_bateria: number | null;
          seminovo_id: string | null;
          sold_at: string | null;
          status: string;
          tipo: string;
          updated_at: string;
          user_id: string;
          variante: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "aparelhos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cliente_decidir_orcamento: {
        Args: { p_aprovar: boolean; p_os_id: string };
        Returns: string;
      };
      consultar_os_publica: {
        Args: { p_identificador: string };
        Returns: {
          aparelho: string;
          created_at: string;
          defeito: string;
          diagnostico: string;
          loja: string;
          marca: string;
          modelo: string;
          numero: number;
          status: string;
          valor: number;
          whatsapp: string;
        }[];
      };
      crediario_enfileirar: {
        Args: {
          p_contrato: string;
          p_motivo: string;
          p_payload?: Json;
          p_tipo: string;
        };
        Returns: undefined;
      };
      crediario_hoje: { Args: never; Returns: string };
      crediario_log: {
        Args: { p_contrato: string; p_descricao: string };
        Returns: undefined;
      };
      crediario_recalcular: { Args: { p_contrato: string }; Returns: undefined };
      crediario_valor_atualizado: {
        Args: {
          p_em: string;
          p_juros_mes_pct: number;
          p_multa_pct: number;
          p_valor: number;
          p_vencimento: string;
        };
        Returns: number;
      };
      criar_contrato_crediario: {
        Args: {
          p_cliente_id: string;
          p_dias_tolerancia?: number;
          p_entrada: number;
          p_forma_entrada_id?: string;
          p_imei: string;
          p_juros_mes_pct?: number;
          p_marca: string;
          p_modelo: string;
          p_multa_pct?: number;
          p_num_parcelas: number;
          p_observacoes?: string;
          p_primeiro_vencimento: string;
          p_termo_aceito: boolean;
          p_valor_aparelho: number;
          p_valor_parcela?: number;
        };
        Returns: {
          bloqueio_manual: boolean;
          cliente_id: string;
          created_at: string;
          created_by: string | null;
          dias_tolerancia: number;
          entrada: number;
          id: string;
          imei: string;
          juros_mes_pct: number;
          liberado_ate: string | null;
          marca: string;
          modelo: string;
          multa_pct: number;
          num_parcelas: number;
          numero: number;
          observacoes: string | null;
          primeiro_vencimento: string;
          provisionado_em: string | null;
          status: string;
          status_aparelho: string;
          termo_aceito_em: string;
          ultimo_contato: string | null;
          updated_at: string;
          user_id: string;
          valor_aparelho: number;
          valor_parcela: number;
        };
        SetofOptions: {
          from: "*";
          to: "crediario_contratos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      definir_template_padrao: {
        Args: { p_template_id: string };
        Returns: undefined;
      };
      descontar_credito_ia: { Args: { p_empresa_id: string }; Returns: boolean };
      desfazer_importacao: {
        Args: { p_importacao: string };
        Returns: {
          apagados: number;
          mantidos: number;
        }[];
      };
      devolver_aparelho: {
        Args: { p_aparelho_id: string; p_condicao?: string; p_motivo: string };
        Returns: {
          armazenamento: string | null;
          checklist: Json;
          ciclos_bateria: number | null;
          cor: string | null;
          created_at: string;
          created_by: string;
          estado_conservacao: string | null;
          id: string;
          imei1: string | null;
          imei2: string | null;
          marca: string;
          modelo: string;
          numero: number;
          numero_serie: string | null;
          observacoes: string | null;
          preco_custo: number;
          preco_venda: number;
          ram: string | null;
          reservado_ate: string | null;
          reservado_cliente_id: string | null;
          reservado_observacao: string | null;
          saude_bateria: number | null;
          seminovo_id: string | null;
          sold_at: string | null;
          status: string;
          tipo: string;
          updated_at: string;
          user_id: string;
          variante: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "aparelhos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      devolver_estoque_venda: {
        Args: { p_descricao: string; p_tipo: string; p_venda_id: string };
        Returns: undefined;
      };
      empresa_role: { Args: { p_empresa_id: string }; Returns: string };
      excluir_venda: { Args: { p_venda_id: string }; Returns: undefined };
      faturar_compra: {
        Args: { p_compra_id: string; p_status: string };
        Returns: undefined;
      };
      faturar_os: {
        Args: {
          p_categoria_id: string;
          p_custo_tecnico?: number;
          p_custo_tecnico_nome?: string;
          p_descricao?: string;
          p_observacoes?: string;
          p_os_id: string;
          p_parcelas: Json;
          p_tecnicos?: Json;
          p_valor_total: number;
        };
        Returns: {
          cancelado_em: string | null;
          cancelado_por: string | null;
          categoria_id: string | null;
          created_at: string;
          created_by: string;
          custo_tecnico: number;
          custo_tecnico_nome: string | null;
          descricao: string | null;
          id: string;
          lancamento_custo_tecnico_id: string | null;
          motivo_cancelamento: string | null;
          numero: number;
          observacoes: string | null;
          os_id: string;
          status: string;
          user_id: string;
          valor_total: number;
        };
        SetofOptions: {
          from: "*";
          to: "os_faturamentos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fechar_caixa: {
        Args: {
          p_observacoes: string;
          p_sessao_id: string;
          p_valor_contado: number;
        };
        Returns: {
          aberto_em: string;
          aberto_por: string | null;
          diferenca: number | null;
          fechado_em: string | null;
          fechado_por: string | null;
          id: string;
          observacoes: string | null;
          resumo: Json | null;
          status: string;
          user_id: string;
          valor_abertura: number;
          valor_contado: number | null;
          valor_esperado: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "caixa_sessoes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      garantir_templates_padrao: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      generate_referral_code: { Args: never; Returns: string };
      get_empresa_membros: {
        Args: { p_empresa_id: string };
        Returns: {
          created_at: string;
          email: string;
          nome: string;
          role: string;
          user_id: string;
        }[];
      };
      has_permission: {
        Args: { p_acao: string; p_empresa_id: string; p_modulo: string };
        Returns: boolean;
      };
      has_plan_feature: {
        Args: { p_empresa_id: string; p_feature: string };
        Returns: boolean;
      };
      meu_cliente_id: { Args: never; Returns: string };
      movimentar_caixa: {
        Args: {
          p_motivo: string;
          p_sessao_id: string;
          p_tipo: string;
          p_valor: number;
        };
        Returns: {
          created_at: string;
          created_by: string | null;
          id: string;
          motivo: string | null;
          sessao_id: string;
          tipo: string;
          user_id: string;
          valor: number;
        };
        SetofOptions: {
          from: "*";
          to: "caixa_movimentos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      pode_finalizar_seminovo: {
        Args: { p_empresa_id: string };
        Returns: boolean;
      };
      pode_ver_custo_aparelho: {
        Args: { p_empresa_id: string };
        Returns: boolean;
      };
      processar_inadimplencia_crediario: {
        Args: { p_empresa_id?: string };
        Returns: number;
      };
      recalcular_status_pagamento_os: {
        Args: { p_os_id: string };
        Returns: undefined;
      };
      receber_compra: {
        Args: { p_compra_id: string; p_status?: string };
        Returns: undefined;
      };
      receber_parcela_faturamento: {
        Args: {
          p_data_recebimento?: string;
          p_forma_pagamento_id?: string;
          p_parcela_id: string;
        };
        Returns: {
          created_at: string;
          data_recebimento: string | null;
          faturamento_id: string;
          forma_pagamento_id: string | null;
          id: string;
          lancamento_estorno_id: string | null;
          lancamento_id: string | null;
          numero_parcela: number;
          status: string;
          total_parcelas: number;
          user_id: string;
          valor: number;
          vencimento: string;
        };
        SetofOptions: {
          from: "*";
          to: "os_faturamento_parcelas";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      registrar_pagamento_crediario: {
        Args: {
          p_data?: string;
          p_dispensar_encargos?: boolean;
          p_parcela_id: string;
          p_payment_method_id?: string;
          p_pix_txid?: string;
          p_valor: number;
        };
        Returns: {
          contrato_id: string;
          created_at: string;
          id: string;
          lancamento_id: string | null;
          numero: number;
          pago_em: string | null;
          payment_method_id: string | null;
          pix_txid: string | null;
          recebido_por: string | null;
          status: string;
          user_id: string;
          valor: number;
          valor_pago: number | null;
          vencimento: string;
        };
        SetofOptions: {
          from: "*";
          to: "crediario_parcelas";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      registrar_venda: {
        Args: {
          p_categoria?: string;
          p_cliente_id?: string;
          p_created_at?: string;
          p_data?: string;
          p_desconto?: number;
          p_empresa_id: string;
          p_forma_pagamento?: string;
          p_itens: Json;
          p_observacoes?: string;
        };
        Returns: {
          cliente_id: string | null;
          created_at: string;
          desconto: number;
          forma_pagamento: string;
          id: string;
          numero: number;
          observacoes: string | null;
          origem: string;
          status: string;
          total: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "vendas";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      relatorio_semanal_dados: {
        Args: { p_empresa_id: string; p_fim: string; p_inicio: string };
        Returns: Json;
      };
      relatorio_tecnicos: {
        Args: { p_empresa_id: string; p_fim: string; p_inicio: string };
        Returns: {
          comissao: number;
          custo_terceiro: number;
          faturamento: number;
          mao_de_obra: number;
          pecas: number;
          qtd_os: number;
          tecnico: string;
          tecnico_user_id: string;
        }[];
      };
      reservar_aparelho: {
        Args: {
          p_aparelho_id: string;
          p_cliente_id: string;
          p_expira_em?: string;
          p_observacao?: string;
        };
        Returns: {
          armazenamento: string | null;
          checklist: Json;
          ciclos_bateria: number | null;
          cor: string | null;
          created_at: string;
          created_by: string;
          estado_conservacao: string | null;
          id: string;
          imei1: string | null;
          imei2: string | null;
          marca: string;
          modelo: string;
          numero: number;
          numero_serie: string | null;
          observacoes: string | null;
          preco_custo: number;
          preco_venda: number;
          ram: string | null;
          reservado_ate: string | null;
          reservado_cliente_id: string | null;
          reservado_observacao: string | null;
          saude_bateria: number | null;
          seminovo_id: string | null;
          sold_at: string | null;
          status: string;
          tipo: string;
          updated_at: string;
          user_id: string;
          variante: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "aparelhos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resumo_caixa: { Args: { p_sessao_id: string }; Returns: Json };
      validar_cpf: { Args: { p_cpf: string }; Returns: boolean };
      vender_aparelho: {
        Args: {
          p_aparelho_id: string;
          p_cliente_id: string;
          p_desconto?: number;
          p_dias_garantia?: number;
          p_forma_pagamento?: string;
          p_observacoes?: string;
          p_preco_venda: number;
          p_termo_garantia_id?: string;
        };
        Returns: {
          armazenamento: string | null;
          checklist: Json;
          ciclos_bateria: number | null;
          cor: string | null;
          created_at: string;
          created_by: string;
          estado_conservacao: string | null;
          id: string;
          imei1: string | null;
          imei2: string | null;
          marca: string;
          modelo: string;
          numero: number;
          numero_serie: string | null;
          observacoes: string | null;
          preco_custo: number;
          preco_venda: number;
          ram: string | null;
          reservado_ate: string | null;
          reservado_cliente_id: string | null;
          reservado_observacao: string | null;
          saude_bateria: number | null;
          seminovo_id: string | null;
          sold_at: string | null;
          status: string;
          tipo: string;
          updated_at: string;
          user_id: string;
          variante: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "aparelhos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      whatsapp_fila_regras: {
        Args: { p_empresa: string };
        Returns: {
          envios_ultima_hora: number;
          hora_atual: number;
          hora_fim: number;
          hora_inicio: number;
          intervalo_seg: number;
          limite_hora: number;
          ultimo_envio: string;
        }[];
      };
      whatsapp_fila_reservar: {
        Args: { p_empresa: string };
        Returns: {
          espera_seg: number;
          mensagem_id: string;
          motivo: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
      status_cobranca: "pendente" | "paga" | "cancelada" | "expirada";
      tipo_aparelho_compra: "seminovo" | "com_defeito";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      status_cobranca: ["pendente", "paga", "cancelada", "expirada"],
      tipo_aparelho_compra: ["seminovo", "com_defeito"],
    },
  },
} as const;
