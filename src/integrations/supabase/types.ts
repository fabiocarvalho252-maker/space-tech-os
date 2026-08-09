export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
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
      clientes: {
        Row: {
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
      ordens_servico: {
        Row: {
          anotacoes: string | null
          aparelho: string
          cliente_id: string | null
          cor: string | null
          created_at: string
          defeito: string | null
          desconto: number
          diagnostico: string | null
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
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          defeito?: string | null
          desconto?: number
          diagnostico?: string | null
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
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          defeito?: string | null
          desconto?: number
          diagnostico?: string | null
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mercado_pago_access_token?: string | null
          mercado_pago_public_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mercado_pago_access_token?: string | null
          mercado_pago_public_key?: string | null
          updated_at?: string
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
      produtos: {
        Row: {
          categoria: string | null
          created_at: string
          estoque_minimo: number
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
          created_at?: string
          estoque_minimo?: number
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
          created_at?: string
          estoque_minimo?: number
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
          billing_day: number | null
          cidade: string | null
          cnpj_cpf: string | null
          created_at: string
          endereco: string | null
          id: string
          logo_url: string | null
          loja: string | null
          nome: string | null
          trial_aviso_enviado_em: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          billing_day?: number | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          endereco?: string | null
          id: string
          logo_url?: string | null
          loja?: string | null
          nome?: string | null
          trial_aviso_enviado_em?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          billing_day?: number | null
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          logo_url?: string | null
          loja?: string | null
          nome?: string | null
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
          conteudo: string
          created_at: string | null
          id: string
          is_default: boolean | null
          titulo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          titulo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
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
          descricao: string
          id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          user_id: string
          venda_id: string
        }
        Insert: {
          descricao: string
          id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          user_id: string
          venda_id: string
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_convite: {
        Args: { p_codigo: string }
        Returns: {
          created_at: string
          empresa_id: string
          id: string
          role: string
          user_id: string
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      status_cobranca: ["pendente", "paga", "cancelada", "expirada"],
      tipo_aparelho_compra: ["seminovo", "com_defeito"],
    },
  },
} as const
