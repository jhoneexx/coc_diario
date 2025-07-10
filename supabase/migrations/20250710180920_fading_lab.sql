/*
  # Adicionar segmento_id à tabela metas

  1. Mudanças
    - Adiciona o campo `segmento_id` à tabela `metas`
    - O campo é opcional (NULL) para manter compatibilidade com dados existentes
    - Metas existentes continuarão funcionando como "metas gerais do ambiente"
    - Novas metas poderão ser criadas por segmento específico

  Esta migração prepara a estrutura para permitir metas por segmento,
  mantendo total compatibilidade com o sistema atual.
*/

-- Adicionar coluna segmento_id à tabela metas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'metas' AND column_name = 'segmento_id'
  ) THEN
    ALTER TABLE metas ADD COLUMN segmento_id INTEGER;
    
    -- Adicionar comentário para documentar o propósito da coluna
    COMMENT ON COLUMN metas.segmento_id IS 'ID do segmento ao qual a meta se aplica. NULL para metas a nível de ambiente (meta geral).';
  END IF;
END $$;