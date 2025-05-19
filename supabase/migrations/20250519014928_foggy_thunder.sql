/*
  # Create incident approvals system

  1. New Tables
    - `aprovacoes_incidentes`
      - `id` (serial, primary key)
      - `incidente_id` (integer, foreign key to incidentes table)
      - `tipo_operacao` (text) - "edicao" or "exclusao"
      - `dados_antes` (jsonb) - Original incident data before change
      - `dados_depois` (jsonb) - New incident data after change
      - `solicitado_por` (integer) - Foreign key to usuarios table
      - `solicitado_em` (timestamp) - When the approval was requested
      - `aprovador_id` (integer) - Who approved/rejected the request
      - `status` (text) - "pendente", "aprovado", "rejeitado"
      - `data_aprovacao` (timestamp) - When the approval status was updated
      - `motivo_rejeicao` (text) - Reason for rejection if applicable
  
  2. Security
    - Enable RLS on the new table
    - Add policies for access control
*/

CREATE TABLE IF NOT EXISTS aprovacoes_incidentes (
  id SERIAL PRIMARY KEY,
  incidente_id INTEGER NOT NULL REFERENCES incidentes(id) ON DELETE CASCADE,
  tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('edicao', 'exclusao')),
  dados_antes JSONB, -- Original data before change (for edits)
  dados_depois JSONB, -- New data after change (for edits)
  solicitado_por INTEGER NOT NULL REFERENCES usuarios(id),
  solicitado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  aprovador_id INTEGER REFERENCES usuarios(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  motivo_rejeicao TEXT
);

-- Enable RLS
ALTER TABLE aprovacoes_incidentes ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Admin full access" ON aprovacoes_incidentes 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Aprovacoes visible to all users" ON aprovacoes_incidentes 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert approvals" ON aprovacoes_incidentes 
  FOR INSERT WITH CHECK (true);