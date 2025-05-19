/*
  # Adicionar peso percentual às metas

  1. Mudanças
    - Adiciona o campo `peso_percentual` à tabela `metas`
    - O campo terá valor padrão de 100 para metas existentes
    - O campo não pode ser nulo e deve estar entre 0 e 100

  Este campo permitirá atribuir um peso percentual para cada ambiente,
  indicando quanto ele contribui para a meta geral da empresa.
*/

-- Adicionar coluna peso_percentual à tabela metas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'metas' AND column_name = 'peso_percentual'
  ) THEN
    ALTER TABLE metas ADD COLUMN peso_percentual DOUBLE PRECISION DEFAULT 100 NOT NULL;
    
    -- Adicionar constraint para garantir que o valor esteja entre 0 e 100
    ALTER TABLE metas ADD CONSTRAINT metas_peso_percentual_check 
      CHECK ((peso_percentual >= 0) AND (peso_percentual <= 100));
  END IF;
END $$;