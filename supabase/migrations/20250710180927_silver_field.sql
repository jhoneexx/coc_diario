/*
  # Atualizar restrição de unicidade para permitir metas por segmento

  1. Mudanças
    - Remove a restrição única antiga que permitia apenas uma meta por ambiente
    - Adiciona nova restrição única na combinação (ambiente_id, segmento_id)
    - Permite uma meta "geral" por ambiente (segmento_id IS NULL)
    - Permite múltiplas metas por segmento dentro do mesmo ambiente

  Esta migração é crucial para permitir a granularidade por segmento,
  mantendo a integridade dos dados.
*/

-- Remover o índice único antigo que garantia apenas uma meta por ambiente_id
DO $$
BEGIN
  -- Verificar se o índice existe antes de tentar removê-lo
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'metas_ambiente_id_key'
  ) THEN
    DROP INDEX metas_ambiente_id_key;
  END IF;
END $$;

-- Remover a constraint única antiga se existir
DO $$
BEGIN
  -- Verificar se a constraint existe antes de tentar removê-la
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'metas_ambiente_id_key' 
    AND table_name = 'metas'
  ) THEN
    ALTER TABLE metas DROP CONSTRAINT metas_ambiente_id_key;
  END IF;
END $$;

-- Adicionar nova restrição única na combinação de ambiente_id e segmento_id
DO $$
BEGIN
  -- Verificar se a nova constraint já existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'metas_ambiente_segmento_unique' 
    AND table_name = 'metas'
  ) THEN
    -- Em PostgreSQL, UNIQUE (col1, col2) permite no máximo uma linha onde col2 é NULL para um dado col1
    -- Isso significa que você poderá ter:
    -- - Uma meta "geral" por ambiente (segmento_id IS NULL)
    -- - Múltiplas metas por segmento para o mesmo ambiente (segmento_id IS NOT NULL e único)
    ALTER TABLE metas ADD CONSTRAINT metas_ambiente_segmento_unique UNIQUE (ambiente_id, segmento_id);
  END IF;
END $$;