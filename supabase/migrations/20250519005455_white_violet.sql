/*
  # Adicionar configuração para superação de metas

  1. Novas Colunas
    - `mttr_permite_superacao` - Indica se o MTTR pode superar 100% do atingimento da meta
    - `mtbf_permite_superacao` - Indica se o MTBF pode superar 100% do atingimento da meta
*/

-- Adicionar colunas para controle de superação de metas
DO $$ 
BEGIN
  -- Adicionar coluna para MTTR
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'metas' AND column_name = 'mttr_permite_superacao'
  ) THEN
    ALTER TABLE metas ADD COLUMN mttr_permite_superacao BOOLEAN DEFAULT true NOT NULL;
  END IF;
  
  -- Adicionar coluna para MTBF
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'metas' AND column_name = 'mtbf_permite_superacao'
  ) THEN
    ALTER TABLE metas ADD COLUMN mtbf_permite_superacao BOOLEAN DEFAULT true NOT NULL;
  END IF;
END $$;