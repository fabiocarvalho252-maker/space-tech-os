export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          cliente_id: string | null
          created_at: string
          fim: string
          id: string
          inicio: string
          observacoes: string | null
          os_id: string | null
          status: string
          tecnico: string | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          fim: string
          id?: string
          inicio: string
          observacoes?: string | null
          os_id?: string | null
          status?: string
          tecnico?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          fim?: string
          id?: string
          inicio?: string
          observacoes?: string | null
          os_id?: string | null
          status?: string
          tecnico?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          agencia: string | null
          banco: string
          conta: string | null
          created_at: string
          id: string
          saldo_inicial: number | null
          tipo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agencia?: string | null
          banco: string
          conta?: string | null
          created_at?: string
          id?: string
          saldo_inicial?: number | null
          tipo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agencia?: string | null
          banco?: string
          conta?: string | null
          created_at?: string
          id?: string
          saldo_inicial?: number | null
          tipo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalogo_config: {
        Row: {
          created_at: string | null
          dominio_proprio: string | null
          exibir_apenas_com_estoque: boolean | null
          id: string
          ignorar_estoque: boolean | null
          loja_ativa: boolean | null
          permitir_vender_sem_estoque: boolean | null
          subdominio: string | null
          updated_at: string | null
          user_id: string
          whatsapp_atendimento: string | null
          whatsapp_flutuante_ativo: boolean | null
          whatsapp_mensagem_inicial: string | null
        }
        Insert: {
          created_at?: string | null
          dominio_proprio?: string | null
          exibir_apenas_com_estoque?: boolean | null
          id?: string
          ignorar_estoque?: boolean | null
          loja_ativa?: boolean | null
          permitir_vender_sem_estoque?: boolean | null
          subdominio?: string | null
          updated_at?: string | null
          user_id: string
          whatsapp_atendimento?: string | null
          whatsapp_flutuante_ativo?: boolean | null
          whatsapp_mensagem_inicial?: string | null
        }
        Update: {
          created_at?: string | null
          dominio_proprio?: string | null
          exibir_apenas_com_estoque?: boolean | null
          id?: string
          ignorar_estoque?: boolean | null
          loja_ativa?: boolean | null
          permitir_vender_sem_estoque?: boolean | null
          subdominio?: string | null
          updated_at?: string | null
          user_id?: string
          whatsapp_atendimento?: string | null
          whatsapp_flutuante_ativo?: boolean | null
          whatsapp_mensagem_inicial?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          auth_user_id: string | null
          created_at: string
          documento: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          cliente_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          lancamento_id: string | null
          mp_id: string | null
          os_id: string | null
          qr_code: string | null
          qr_code_copy_paste: string | null
          status: Database["public"]["Enums"]["status_cobranca"]
          updated_at: string
          user_id: string
          valor: number
          venda_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          lancamento_id?: string | null
          mp_id?: string | null
          os_id?: string | null
          qr_code?: string | null
          qr_code_copy_paste?: string | null
          status?: Database["public"]["Enums"]["status_cobranca"]
          updated_at?: string
          user_id: string
          valor: number
          venda_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          lancamento_id?: string | null
          mp_id?: string | null
          os_id?: string | null
          qr_code?: string | null
          qr_code_copy_paste?: string | null
          status?: Database["public"]["Enums"]["status_cobranca"]
          updated_at?: string
          user_id?: string
          valor?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_itens: {
        Row: {
          compra_id: string
          created_at: string
          custo_unitario: number
          descricao: string
          id: string
          produto_id: string | null
          quantidade: number
          user_id: string
        }
        Insert: {
          compra_id: string
          created_at?: string
          custo_unitario?: number
          descricao: string
          id?: string
          produto_id?: string | null
          quantidade?: number
          user_id: string
        }
        Update: {
          compra_id?: string
          created_at?: string
          custo_unitario?: number
          descricao?: string
          id?: string
          produto_id?: string | null
          quantidade?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compra_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          faturado_em: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          observacoes: string | null
          recebido_em: string | null
          status: string
          updated_at: string
          user_id: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          faturado_em?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          recebido_em?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          faturado_em?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          recebido_em?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_aparelhos: {
        Row: {
          cliente_id: string | null
          condicao_detalhada: string | null
          created_at: string
          data_compra: string
          id: string
          imei_serial: string | null
          marca: string | null
          modelo: string
          tipo: Database["public"]["Enums"]["tipo_aparelho_compra"]
          updated_at: string
          user_id: string
          valor_pago: number
        }
        Insert: {
          cliente_id?: string | null
          condicao_detalhada?: string | null
          created_at?: string
          data_compra?: string
          id?: string
          imei_serial?: string | null
          marca?: string | null
          modelo: string
          tipo?: Database["public"]["Enums"]["tipo_aparelho_compra"]
          updated_at?: string
          user_id: string
          valor_pago?: number
        }
        Update: {
          cliente_id?: string | null
          condicao_detalhada?: string | null
          created_at?: string
          data_compra?: string
          id?: string
          imei_serial?: string | null
          marca?: string | null
          modelo?: string
          tipo?: Database["public"]["Enums"]["tipo_aparelho_compra"]
          updated_at?: string
          user_id?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_aparelhos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          cor: string | null
          created_at: string | null
          customer_id: string
          id: string
          imei: string | null
          marca: string
          modelo: string
          observations: string | null
          serial_number: string | null
          storage: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          imei?: string | null
          marca: string
          modelo: string
          observations?: string | null
          serial_number?: string | null
          storage?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          imei?: string | null
          marca?: string
          modelo?: string
          observations?: string | null
          serial_number?: string | null
          storage?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_convites: {
        Row: {
          codigo: string
          created_at: string | null
          criado_por: string
          empresa_id: string
          expira_em: string
          id: string
          permissao: string
          usado_em: string | null
          usado_por: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          criado_por: string
          empresa_id: string
          expira_em: string
          id?: string
          permissao?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          criado_por?: string
          empresa_id?: string
          expira_em?: string
          id?: string
          permissao?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_config: {
        Row: {
          created_at: string | null
          estoque_minimo_padrao: number
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          estoque_minimo_padrao?: number
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          estoque_minimo_padrao?: number
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          created_at: string
          id: string
          nome: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      fiscal_config: {
        Row: {
          created_at: string | null
          id: string
          serie_padrao: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          serie_padrao?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          serie_padrao?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          cnpj_cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          cnpj_cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          cnpj_cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          bank_account_id: string | null
          categoria: string | null
          created_at: string
          data: string
          descricao: string
          id: string
          payment_method_id: string | null
          status: string | null
          tipo: string
          user_id: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          bank_account_id?: string | null
          categoria?: string | null
          created_at?: string
          data?: string
          descricao: string
          id?: string
          payment_method_id?: string | null
          status?: string | null
          tipo?: string
          user_id: string
          valor?: number
          vencimento?: string | null
        }
        Update: {
          bank_account_id?: string | null
          categoria?: string | null
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          payment_method_id?: string | null
          status?: string | null
          tipo?: string
          user_id?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_itens: {
        Row: {
          descricao: string
          id: string
          nota_id: string
          quantidade: number
          user_id: string
          valor_unitario: number
        }
        Insert: {
          descricao: string
          id?: string
          nota_id: string
          quantidade?: number
          user_id: string
          valor_unitario?: number
        }
        Update: {
          descricao?: string
          id?: string
          nota_id?: string
          quantidade?: number
          user_id?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_itens_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          chave_acesso: string | null
          cliente_id: string | null
          created_at: string
          emitida_em: string | null
          id: string
          numero: number
          observacoes: string | null
          os_id: string | null
          serie: string
          status: string
          updated_at: string
          user_id: string
          valor_total: number
          venda_id: string | null
        }
        Insert: {
          chave_acesso?: string | null
          cliente_id?: string | null
          created_at?: string
          emitida_em?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          os_id?: string | null
          serie?: string
          status?: string
          updated_at?: string
          user_id: string
          valor_total?: number
          venda_id?: string | null
        }
        Update: {
          chave_acesso?: string | null
          cliente_id?: string | null
          created_at?: string
          emitida_em?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          os_id?: string | null
          serie?: string
          status?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          anotacoes: string | null
          aparelho: string
          checklist_entrada: Json
          cliente_id: string | null
          cor: string | null
          created_at: string
          data_entrega: string | null
          defeito: string | null
          desconto: number
          diagnostico: string | null
          estado_fisico: Json
          estado_fisico_obs: string | null
          garantia_dias: number | null
          garantia_vencimento: string | null
          id: string
          imei: string | null
          laudo_tecnico: string | null
          marca: string | null
          modelo: string | null
          numero: number
          padrao_desbloqueio: string | null
          previsao: string | null
          responsavel: string | null
          senha_dispositivo: string | null
          serial_number: string | null
          status: string
          status_pagamento: string
          updated_at: string
          user_id: string
          valor: number
          valor_pago: number
        }
        Insert: {
          anotacoes?: string | null
          aparelho: string
          checklist_entrada?: Json
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          data_entrega?: string | null
          defeito?: string | null
          desconto?: number
          diagnostico?: string | null
          estado_fisico?: Json
          estado_fisico_obs?: string | null
          garantia_dias?: number | null
          garantia_vencimento?: string | null
          id?: string
          imei?: string | null
          laudo_tecnico?: string | null
          marca?: string | null
          modelo?: string | null
          numero?: number
          padrao_desbloqueio?: string | null
          previsao?: string | null
          responsavel?: string | null
          senha_dispositivo?: string | null
          serial_number?: string | null
          status?: string
          status_pagamento?: string
          updated_at?: string
          user_id: string
          valor?: number
          valor_pago?: number
        }
        Update: {
          anotacoes?: string | null
          aparelho?: string
          checklist_entrada?: Json
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          data_entrega?: string | null
          defeito?: string | null
          desconto?: number
          diagnostico?: string | null
          estado_fisico?: Json
          estado_fisico_obs?: string | null
          garantia_dias?: number | null
          garantia_vencimento?: string | null
          id?: string
          imei?: string | null
          laudo_tecnico?: string | null
          marca?: string | null
          modelo?: string | null
          numero?: number
          padrao_desbloqueio?: string | null
          previsao?: string | null
          responsavel?: string | null
          senha_dispositivo?: string | null
          serial_number?: string | null
          status?: string
          status_pagamento?: string
          updated_at?: string
          user_id?: string
          valor?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      os_checklists: {
        Row: {
          created_at: string
          id: string
          itens: Json | null
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          itens?: Json | null
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          itens?: Json | null
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      os_config: {
        Row: {
          created_at: string
          dias_garantia_padrao: number | null
          exibir_fotos_impressao: boolean | null
          id: string
          imprimir_duas_vias: boolean | null
          imprimir_qrcode_cliente: boolean | null
          modelo_impressao: string | null
          proximo_numero_os: number | null
          termos_condicoes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dias_garantia_padrao?: number | null
          exibir_fotos_impressao?: boolean | null
          id?: string
          imprimir_duas_vias?: boolean | null
          imprimir_qrcode_cliente?: boolean | null
          modelo_impressao?: string | null
          proximo_numero_os?: number | null
          termos_condicoes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dias_garantia_padrao?: number | null
          exibir_fotos_impressao?: boolean | null
          id?: string
          imprimir_duas_vias?: boolean | null
          imprimir_qrcode_cliente?: boolean | null
          modelo_impressao?: string | null
          proximo_numero_os?: number | null
          termos_condicoes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      os_faturamento_parcelas: {
        Row: {
          created_at: string
          data_recebimento: string | null
          faturamento_id: string
          forma_pagamento_id: string | null
          id: string
          lancamento_estorno_id: string | null
          lancamento_id: string | null
          numero_parcela: number
          status: string
          total_parcelas: number
          user_id: string
          valor: number
          vencimento: string
        }
        Insert: {
          created_at?: string
          data_recebimento?: string | null
          faturamento_id: string
          forma_pagamento_id?: string | null
          id?: string
          lancamento_estorno_id?: string | null
          lancamento_id?: string | null
          numero_parcela: number
          status?: string
          total_parcelas: number
          user_id: string
          valor: number
          vencimento: string
        }
        Update: {
          created_at?: string
          data_recebimento?: string | null
          faturamento_id?: string
          forma_pagamento_id?: string | null
          id?: string
          lancamento_estorno_id?: string | null
          lancamento_id?: string | null
          numero_parcela?: number
          status?: string
          total_parcelas?: number
          user_id?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_faturamento_parcelas_faturamento_id_fkey"
            columns: ["faturamento_id"]
            isOneToOne: false
            referencedRelation: "os_faturamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_faturamento_parcelas_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_faturamento_parcelas_lancamento_estorno_id_fkey"
            columns: ["lancamento_estorno_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_faturamento_parcelas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      os_faturamento_tecnicos: {
        Row: {
          created_at: string
          faturamento_id: string
          id: string
          membro_user_id: string | null
          nome_livre: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          faturamento_id: string
          id?: string
          membro_user_id?: string | null
          nome_livre?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          faturamento_id?: string
          id?: string
          membro_user_id?: string | null
          nome_livre?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_faturamento_tecnicos_faturamento_id_fkey"
            columns: ["faturamento_id"]
            isOneToOne: false
            referencedRelation: "os_faturamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      os_faturamentos: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          categoria_id: string | null
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          motivo_cancelamento: string | null
          numero: number
          observacoes: string | null
          os_id: string
          status: string
          user_id: string
          valor_total: number
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          categoria_id?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          motivo_cancelamento?: string | null
          numero?: number
          observacoes?: string | null
          os_id: string
          status?: string
          user_id: string
          valor_total: number
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          categoria_id?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          motivo_cancelamento?: string | null
          numero?: number
          observacoes?: string | null
          os_id?: string
          status?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_faturamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_faturamentos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_historico: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string
          evento: string
          id: string
          os_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao: string
          evento: string
          id?: string
          os_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string
          evento?: string
          id?: string
          os_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_historico_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          observacao: string | null
          os_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          observacao?: string | null
          os_id: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          observacao?: string | null
          os_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_itens_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      os_status_flows: {
        Row: {
          ativo: boolean | null
          created_at: string
          destino: string
          id: string
          origem: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          destino: string
          id?: string
          origem: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          destino?: string
          id?: string
          origem?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pagamento_config: {
        Row: {
          created_at: string
          id: string
          mercado_pago_access_token: string | null
          mercado_pago_public_key: string | null
          mercado_pago_webhook_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mercado_pago_access_token?: string | null
          mercado_pago_public_key?: string | null
          mercado_pago_webhook_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mercado_pago_access_token?: string | null
          mercado_pago_public_key?: string | null
          mercado_pago_webhook_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          nome: string
          prazo_recebimento: number | null
          taxa: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          prazo_recebimento?: number | null
          taxa?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          prazo_recebimento?: number | null
          taxa?: number | null
          user_id?: string
        }
        Relationships: []
      }
      peliculas_catalogo: {
        Row: {
          codigo: string | null
          created_at: string
          id: string
          marca: string
          modelo: string
          observacoes: string | null
          pelicula_compativel: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          id?: string
          marca: string
          modelo: string
          observacoes?: string | null
          pelicula_compativel: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          id?: string
          marca?: string
          modelo?: string
          observacoes?: string | null
          pelicula_compativel?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      produto_categorias: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          categoria: string | null
          comissao_percentual: number
          created_at: string
          descricao: string | null
          estoque_minimo: number
          exibir_no_catalogo: boolean | null
          id: string
          nome: string
          preco_custo: number
          preco_venda: number
          quantidade: number
          sku: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          comissao_percentual?: number
          created_at?: string
          descricao?: string | null
          estoque_minimo?: number
          exibir_no_catalogo?: boolean | null
          id?: string
          nome: string
          preco_custo?: number
          preco_venda?: number
          quantidade?: number
          sku?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          comissao_percentual?: number
          created_at?: string
          descricao?: string | null
          estoque_minimo?: number
          exibir_no_catalogo?: boolean | null
          id?: string
          nome?: string
          preco_custo?: number
          preco_venda?: number
          quantidade?: number
          sku?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acesso_ate: string | null
          billing_day: number | null
          cidade: string | null
          cnpj_cpf: string | null
          created_at: string
          endereco: string | null
          id: string
          logo_url: string | null
          loja: string | null
          nome: string | null
          plano: string
          trial_aviso_enviado_em: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          acesso_ate?: string | null
          billing_day?: number | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          endereco?: string | null
          id: string
          logo_url?: string | null
          loja?: string | null
          nome?: string | null
          plano?: string
          trial_aviso_enviado_em?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          acesso_ate?: string | null
          billing_day?: number | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          logo_url?: string | null
          loja?: string | null
          nome?: string | null
          plano?: string
          trial_aviso_enviado_em?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      purchase_config: {
        Row: {
          created_at: string | null
          id: string
          situacao_faturar: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          situacao_faturar?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          situacao_faturar?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      purchase_status_flows: {
        Row: {
          color: string | null
          created_at: string | null
          from_status: string
          id: string
          is_active: boolean | null
          to_status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          from_status: string
          id?: string
          is_active?: boolean | null
          to_status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          from_status?: string
          id?: string
          is_active?: boolean | null
          to_status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          modulo: string
          pode_gerenciar: boolean
          pode_ver: boolean
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          modulo: string
          pode_gerenciar?: boolean
          pode_ver?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          modulo?: string
          pode_gerenciar?: boolean
          pode_ver?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_config: {
        Row: {
          cliente_balcao_id: string | null
          created_at: string
          dias_garantia_padrao: number | null
          editar_preco_carrinho: boolean | null
          id: string
          limite_itens_carrinho: number | null
          limite_vendas_abertas: number | null
          pagamento_sugerido: string | null
          permitir_desconto: boolean | null
          proximo_numero_venda: number | null
          status_padrao_os: string | null
          status_padrao_venda: string | null
          teto_desconto_percentual: number | null
          texto_proposta: string | null
          tipo_caixa: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_balcao_id?: string | null
          created_at?: string
          dias_garantia_padrao?: number | null
          editar_preco_carrinho?: boolean | null
          id?: string
          limite_itens_carrinho?: number | null
          limite_vendas_abertas?: number | null
          pagamento_sugerido?: string | null
          permitir_desconto?: boolean | null
          proximo_numero_venda?: number | null
          status_padrao_os?: string | null
          status_padrao_venda?: string | null
          teto_desconto_percentual?: number | null
          texto_proposta?: string | null
          tipo_caixa?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_balcao_id?: string | null
          created_at?: string
          dias_garantia_padrao?: number | null
          editar_preco_carrinho?: boolean | null
          id?: string
          limite_itens_carrinho?: number | null
          limite_vendas_abertas?: number | null
          pagamento_sugerido?: string | null
          permitir_desconto?: boolean | null
          proximo_numero_venda?: number | null
          status_padrao_os?: string | null
          status_padrao_venda?: string | null
          teto_desconto_percentual?: number | null
          texto_proposta?: string | null
          tipo_caixa?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_status_flows: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string
          destino: string
          id: string
          origem: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          destino: string
          id?: string
          origem: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          destino?: string
          id?: string
          origem?: string
          user_id?: string
        }
        Relationships: []
      }
      seminovos: {
        Row: {
          acessorios: string | null
          armazenamento: string | null
          bateria_percentual: number | null
          cliente_id: string | null
          cor: string | null
          created_at: string
          data_avaliacao: string
          estado: string | null
          fotos: string[]
          id: string
          imei: string | null
          marca: string
          modelo: string
          observacoes: string | null
          ram: string | null
          status: string
          updated_at: string
          user_id: string
          valor_oferecido: number | null
          valor_pago: number | null
          vendedor_nome: string | null
          vendedor_telefone: string | null
        }
        Insert: {
          acessorios?: string | null
          armazenamento?: string | null
          bateria_percentual?: number | null
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          data_avaliacao?: string
          estado?: string | null
          fotos?: string[]
          id?: string
          imei?: string | null
          marca: string
          modelo: string
          observacoes?: string | null
          ram?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor_oferecido?: number | null
          valor_pago?: number | null
          vendedor_nome?: string | null
          vendedor_telefone?: string | null
        }
        Update: {
          acessorios?: string | null
          armazenamento?: string | null
          bateria_percentual?: number | null
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          data_avaliacao?: string
          estado?: string | null
          fotos?: string[]
          id?: string
          imei?: string | null
          marca?: string
          modelo?: string
          observacoes?: string | null
          ram?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor_oferecido?: number | null
          valor_pago?: number | null
          vendedor_nome?: string | null
          vendedor_telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seminovos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_photos: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          service_order_id: string
          url: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          service_order_id: string
          url: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          service_order_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_photos_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_config: {
        Row: {
          created_at: string | null
          encryption: string | null
          from_email: string
          from_name: string | null
          host: string
          id: string
          is_active: boolean | null
          password: string
          port: number
          updated_at: string | null
          user: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encryption?: string | null
          from_email: string
          from_name?: string | null
          host: string
          id?: string
          is_active?: boolean | null
          password: string
          port?: number
          updated_at?: string | null
          user: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          encryption?: string | null
          from_email?: string
          from_name?: string | null
          host?: string
          id?: string
          is_active?: boolean | null
          password?: string
          port?: number
          updated_at?: string | null
          user?: string
          user_id?: string
        }
        Relationships: []
      }
      termos_garantia: {
        Row: {
          ativo: boolean
          conteudo: string
          created_at: string | null
          id: string
          is_default: boolean | null
          titulo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          conteudo: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          titulo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          titulo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_empresas: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      venda_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          user_id: string
          venda_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          user_id: string
          venda_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          user_id?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          cliente_id: string | null
          created_at: string
          desconto: number
          forma_pagamento: string
          id: string
          numero: number
          observacoes: string | null
          origem: string
          status: string
          total: number
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          desconto?: number
          forma_pagamento?: string
          id?: string
          numero?: number
          observacoes?: string | null
          origem?: string
          status?: string
          total?: number
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          desconto?: number
          forma_pagamento?: string
          id?: string
          numero?: number
          observacoes?: string | null
          origem?: string
          status?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          boas_vindas: boolean | null
          boas_vindas_texto: string | null
          created_at: string | null
          feliz_aniversario: boolean | null
          feliz_aniversario_texto: string | null
          id: string
          instancia_id: string | null
          lembrete_tecnico: boolean | null
          lembrete_tecnico_texto: string | null
          notif_nfe_emitida: boolean | null
          notif_nfe_emitida_texto: string | null
          notif_os_criada: boolean | null
          notif_os_criada_texto: string | null
          notif_os_editada: boolean | null
          notif_os_editada_texto: string | null
          pesquisa_pos_os: boolean | null
          pesquisa_pos_os_texto: string | null
          pesquisa_pos_venda: boolean | null
          pesquisa_pos_venda_texto: string | null
          relatorio_semanal_ia: boolean | null
          relatorio_semanal_ia_texto: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          boas_vindas?: boolean | null
          boas_vindas_texto?: string | null
          created_at?: string | null
          feliz_aniversario?: boolean | null
          feliz_aniversario_texto?: string | null
          id?: string
          instancia_id?: string | null
          lembrete_tecnico?: boolean | null
          lembrete_tecnico_texto?: string | null
          notif_nfe_emitida?: boolean | null
          notif_nfe_emitida_texto?: string | null
          notif_os_criada?: boolean | null
          notif_os_criada_texto?: string | null
          notif_os_editada?: boolean | null
          notif_os_editada_texto?: string | null
          pesquisa_pos_os?: boolean | null
          pesquisa_pos_os_texto?: string | null
          pesquisa_pos_venda?: boolean | null
          pesquisa_pos_venda_texto?: string | null
          relatorio_semanal_ia?: boolean | null
          relatorio_semanal_ia_texto?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          boas_vindas?: boolean | null
          boas_vindas_texto?: string | null
          created_at?: string | null
          feliz_aniversario?: boolean | null
          feliz_aniversario_texto?: string | null
          id?: string
          instancia_id?: string | null
          lembrete_tecnico?: boolean | null
          lembrete_tecnico_texto?: string | null
          notif_nfe_emitida?: boolean | null
          notif_nfe_emitida_texto?: string | null
          notif_os_criada?: boolean | null
          notif_os_criada_texto?: string | null
          notif_os_editada?: boolean | null
          notif_os_editada_texto?: string | null
          pesquisa_pos_os?: boolean | null
          pesquisa_pos_os_texto?: string | null
          pesquisa_pos_venda?: boolean | null
          pesquisa_pos_venda_texto?: string | null
          relatorio_semanal_ia?: boolean | null
          relatorio_semanal_ia_texto?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          last_connected_at: string | null
          last_error: string | null
          phone_number: string | null
          qr_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          last_connected_at?: string | null
          last_error?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          last_connected_at?: string | null
          last_error?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          attachments: Json
          connection_id: string | null
          contact_name: string | null
          content: string | null
          created_at: string
          direction: string
          error: string | null
          evolution_message_id: string | null
          id: string
          metadata: Json | null
          os_id: string | null
          phone_number: string
          scheduled_at: string | null
          sent_by: string | null
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          attachments?: Json
          connection_id?: string | null
          contact_name?: string | null
          content?: string | null
          created_at?: string
          direction: string
          error?: string | null
          evolution_message_id?: string | null
          id?: string
          metadata?: Json | null
          os_id?: string | null
          phone_number: string
          scheduled_at?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          attachments?: Json
          connection_id?: string | null
          contact_name?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          evolution_message_id?: string | null
          id?: string
          metadata?: Json | null
          os_id?: string | null
          phone_number?: string
          scheduled_at?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_convite: {
        Args: { p_codigo: string }
        Returns: {
          created_at: string | null
          empresa_id: string
          id: string
          role: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_empresas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_faturamento_os: {
        Args: { p_faturamento_id: string; p_motivo?: string }
        Returns: {
          cancelado_em: string | null
          cancelado_por: string | null
          categoria_id: string | null
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          motivo_cancelamento: string | null
          numero: number
          observacoes: string | null
          os_id: string
          status: string
          user_id: string
          valor_total: number
        }
        SetofOptions: {
          from: "*"
          to: "os_faturamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      empresa_role: { Args: { p_empresa_id: string }; Returns: string }
      faturar_os: {
        Args: {
          p_categoria_id: string
          p_descricao?: string
          p_observacoes?: string
          p_os_id: string
          p_parcelas: Json
          p_tecnicos?: Json
          p_valor_total: number
        }
        Returns: {
          cancelado_em: string | null
          cancelado_por: string | null
          categoria_id: string | null
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          motivo_cancelamento: string | null
          numero: number
          observacoes: string | null
          os_id: string
          status: string
          user_id: string
          valor_total: number
        }
        SetofOptions: {
          from: "*"
          to: "os_faturamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_empresa_membros: {
        Args: { p_empresa_id: string }
        Returns: {
          created_at: string
          email: string
          role: string
          user_id: string
        }[]
      }
      has_permission: {
        Args: { p_acao: string; p_empresa_id: string; p_modulo: string }
        Returns: boolean
      }
      meu_cliente_id: { Args: never; Returns: string }
      recalcular_status_pagamento_os: {
        Args: { p_os_id: string }
        Returns: undefined
      }
      receber_parcela_faturamento: {
        Args: {
          p_data_recebimento?: string
          p_forma_pagamento_id?: string
          p_parcela_id: string
        }
        Returns: {
          created_at: string
          data_recebimento: string | null
          faturamento_id: string
          forma_pagamento_id: string | null
          id: string
          lancamento_estorno_id: string | null
          lancamento_id: string | null
          numero_parcela: number
          status: string
          total_parcelas: number
          user_id: string
          valor: number
          vencimento: string
        }
        SetofOptions: {
          from: "*"
          to: "os_faturamento_parcelas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      status_cobranca: "pendente" | "paga" | "cancelada" | "expirada"
      tipo_aparelho_compra: "seminovo" | "com_defeito"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

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
} as const

