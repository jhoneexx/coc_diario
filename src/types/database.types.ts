type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ambientes: {
        Row: {
          id: number
          nome: string
          descricao: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: number
          nome: string
          descricao?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: number
          nome?: string
          descricao?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      segmentos: {
        Row: {
          id: number
          nome: string
          ambiente_id: number
          descricao: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: number
          nome: string
          ambiente_id: number
          descricao?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: number
          nome?: string
          ambiente_id?: number
          descricao?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "segmentos_ambiente_id_fkey"
            columns: ["ambiente_id"]
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          }
        ]
      }
      criticidades: {
        Row: {
          id: number
          nome: string
          cor: string
          descricao: string | null
          peso: number
          is_downtime: boolean
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: number
          nome: string
          cor: string
          descricao?: string | null
          peso: number
          is_downtime: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: number
          nome?: string
          cor?: string
          descricao?: string | null
          peso?: number
          is_downtime?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      tipos_incidente: {
        Row: {
          id: number
          nome: string
          descricao: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: number
          nome: string
          descricao?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: number
          nome?: string
          descricao?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      metas: {
        Row: {
          id: number
          ambiente_id: number
          segmento_id: number | null
          mttr_meta: number
          mtbf_meta: number
          disponibilidade_meta: number
          peso_percentual: number
          mttr_permite_superacao: boolean
          mtbf_permite_superacao: boolean
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: number
          ambiente_id: number
          segmento_id?: number | null
          mttr_meta: number
          mtbf_meta: number
          disponibilidade_meta: number
          peso_percentual?: number
          mttr_permite_superacao?: boolean
          mtbf_permite_superacao?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: number
          ambiente_id?: number
          segmento_id?: number | null
          mttr_meta?: number
          mtbf_meta?: number
          disponibilidade_meta?: number
          peso_percentual?: number
          mttr_permite_superacao?: boolean
          mtbf_permite_superacao?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_ambiente_id_fkey"
            columns: ["ambiente_id"]
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_segmento_id_fkey"
            columns: ["segmento_id"]
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          }
        ]
      }
      incidentes: {
        Row: {
          id: number
          inicio: string
          fim: string | null
          duracao_minutos: number | null
          tipo_id: number
          ambiente_id: number
          segmento_id: number
          criticidade_id: number
          descricao: string
          acoes_tomadas: string | null
          criado_em: string
          atualizado_em: string
          criado_por: string
          atualizado_por: string | null
        }
        Insert: {
          id?: number
          inicio: string
          fim?: string | null
          duracao_minutos?: number | null
          tipo_id: number
          ambiente_id: number
          segmento_id: number
          criticidade_id: number
          descricao: string
          acoes_tomadas?: string | null
          criado_em?: string
          atualizado_em?: string
          criado_por: string
          atualizado_por?: string | null
        }
        Update: {
          id?: number
          inicio?: string
          fim?: string | null
          duracao_minutos?: number | null
          tipo_id?: number
          ambiente_id?: number
          segmento_id?: number
          criticidade_id?: number
          descricao?: string
          acoes_tomadas?: string | null
          criado_em?: string
          atualizado_em?: string
          criado_por?: string
          atualizado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_tipo_id_fkey"
            columns: ["tipo_id"]
            referencedRelation: "tipos_incidente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidentes_ambiente_id_fkey"
            columns: ["ambiente_id"]
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidentes_segmento_id_fkey"
            columns: ["segmento_id"]
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidentes_criticidade_id_fkey"
            columns: ["criticidade_id"]
            referencedRelation: "criticidades"
            referencedColumns: ["id"]
          }
        ]
      }
      usuarios: {
        Row: {
          id: number
          nome: string
          login: string
          senha: string
          perfil: string
          ultimo_acesso: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: number
          nome: string
          login: string
          senha: string
          perfil: string
          ultimo_acesso?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: number
          nome?: string
          login?: string
          senha?: string
          perfil?: string
          ultimo_acesso?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      logs_acesso: {
        Row: {
          id: number
          usuario_id: number
          data_acesso: string
          acao: string
          detalhes: string | null
        }
        Insert: {
          id?: number
          usuario_id: number
          data_acesso?: string
          acao: string
          detalhes?: string | null
        }
        Update: {
          id?: number
          usuario_id?: number
          data_acesso?: string
          acao?: string
          detalhes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_acesso_usuario_id_fkey"
            columns: ["usuario_id"]
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_mttr: {
        Args: {
          p_ambiente_id: number,
          p_data_inicio: string,
          p_data_fim: string
        }
        Returns: number
      }
      calcular_mtbf: {
        Args: {
          p_ambiente_id: number,
          p_data_inicio: string,
          p_data_fim: string
        }
        Returns: number
      }
      calcular_disponibilidade: {
        Args: {
          p_ambiente_id: number,
          p_data_inicio: string,
          p_data_fim: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}