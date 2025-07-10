/*
  # Adicionar chave estrangeira para segmento_id

  1. Mudanças
    - Adiciona chave estrangeira entre metas.segmento_id e segmentos.id
    - Garante integridade referencial
    - Impede que metas sejam associadas a segmentos inexistentes

  Esta migração finaliza a estrutura de dados para metas por segmento,
  garantindo a integridade referencial.
*/

-- Adicionar chave estrangeira para segmento_id
DO $$
BEGIN
  -- Verificar se a constraint de chave estrangeira já existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'metas_segmento_id_fkey' 
    AND table_name = 'metas'
  ) THEN
    ALTER TABLE metas ADD CONSTRAINT metas_segmento_id_fkey 
      FOREIGN KEY (segmento_id) REFERENCES segmentos(id);
  END IF;
END $$;