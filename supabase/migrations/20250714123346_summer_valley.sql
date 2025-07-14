/*
  # Adicionar suporte a segmentos na tabela metas

  1. Modificações na tabela
    - Adicionar coluna `segmento_id` (nullable)
    - Adicionar foreign key para segmentos
    - Remover constraint única antiga
    - Adicionar nova constraint única composta

  2. Segurança
    - Manter RLS habilitado
    - Preservar políticas existentes
*/

-- Adicionar coluna segmento_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'metas' AND column_name = 'segmento_id'
  ) THEN
    ALTER TABLE metas ADD COLUMN segmento_id integer;
  END IF;
END $$;

-- Adicionar foreign key constraint se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'metas_segmento_id_fkey' 
    AND table_name = 'metas'
  ) THEN
    ALTER TABLE metas ADD CONSTRAINT metas_segmento_id_fkey 
    FOREIGN KEY (segmento_id) REFERENCES segmentos(id);
  END IF;
END $$;

-- Remover a constraint única antiga se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'metas_ambiente_id_key' 
    AND table_name = 'metas'
  ) THEN
    ALTER TABLE metas DROP CONSTRAINT metas_ambiente_id_key;
  END IF;
END $$;

-- Adicionar nova constraint única composta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'metas_ambiente_segmento_unique' 
    AND table_name = 'metas'
  ) THEN
    ALTER TABLE metas ADD CONSTRAINT metas_ambiente_segmento_unique 
    UNIQUE (ambiente_id, segmento_id);
  END IF;
END $$;