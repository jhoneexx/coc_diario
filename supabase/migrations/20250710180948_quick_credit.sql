/*
  # Adicionar funções de validação para metas por segmento

  1. Novas Funções
    - `validar_peso_percentual_ambiente` - Valida se a soma dos pesos de um ambiente não excede 100%
    - `get_metas_ambiente_consolidado` - Retorna as metas consolidadas de um ambiente
    - `calcular_meta_ponderada` - Calcula meta ponderada baseada nos segmentos

  Estas funções auxiliam na validação e cálculo das metas por segmento,
  garantindo a integridade dos dados e facilitando os cálculos no frontend.
*/

-- Função para validar se a soma dos pesos percentuais de um ambiente não excede 100%
CREATE OR REPLACE FUNCTION validar_peso_percentual_ambiente(
  p_ambiente_id INTEGER,
  p_segmento_id INTEGER DEFAULT NULL,
  p_novo_peso DOUBLE PRECISION DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  soma_atual DOUBLE PRECISION;
  peso_existente DOUBLE PRECISION;
BEGIN
  -- Calcular a soma atual dos pesos para o ambiente (excluindo o registro que está sendo editado)
  SELECT COALESCE(SUM(peso_percentual), 0) INTO soma_atual
  FROM metas 
  WHERE ambiente_id = p_ambiente_id 
    AND (p_segmento_id IS NULL OR segmento_id != p_segmento_id);
  
  -- Se estamos editando um registro existente, subtrair seu peso atual
  IF p_segmento_id IS NOT NULL THEN
    SELECT peso_percentual INTO peso_existente
    FROM metas 
    WHERE ambiente_id = p_ambiente_id AND segmento_id = p_segmento_id;
    
    IF peso_existente IS NOT NULL THEN
      soma_atual := soma_atual - peso_existente;
    END IF;
  END IF;
  
  -- Adicionar o novo peso (se fornecido)
  IF p_novo_peso IS NOT NULL THEN
    soma_atual := soma_atual + p_novo_peso;
  END IF;
  
  -- Retornar true se a soma não exceder 100%
  RETURN soma_atual <= 100;
END;
$$ LANGUAGE plpgsql;

-- Função para obter as metas consolidadas de um ambiente
CREATE OR REPLACE FUNCTION get_metas_ambiente_consolidado(
  p_ambiente_id INTEGER
) RETURNS TABLE (
  mttr_meta_consolidada DOUBLE PRECISION,
  mtbf_meta_consolidada DOUBLE PRECISION,
  disponibilidade_meta_consolidada DOUBLE PRECISION,
  peso_total DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Calcular MTTR ponderado (média ponderada)
    CASE 
      WHEN SUM(peso_percentual) > 0 THEN
        SUM(mttr_meta * peso_percentual / 100.0) / SUM(peso_percentual / 100.0)
      ELSE 0
    END as mttr_meta_consolidada,
    
    -- Calcular MTBF ponderado (média ponderada)
    CASE 
      WHEN SUM(peso_percentual) > 0 THEN
        SUM(mtbf_meta * peso_percentual / 100.0) / SUM(peso_percentual / 100.0)
      ELSE 0
    END as mtbf_meta_consolidada,
    
    -- Calcular Disponibilidade ponderada (média ponderada)
    CASE 
      WHEN SUM(peso_percentual) > 0 THEN
        SUM(disponibilidade_meta * peso_percentual / 100.0) / SUM(peso_percentual / 100.0)
      ELSE 0
    END as disponibilidade_meta_consolidada,
    
    -- Soma total dos pesos
    COALESCE(SUM(peso_percentual), 0) as peso_total
    
  FROM metas 
  WHERE ambiente_id = p_ambiente_id;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular atingimento de meta ponderado por ambiente
CREATE OR REPLACE FUNCTION calcular_atingimento_meta_ambiente(
  p_ambiente_id INTEGER,
  p_mttr_real DOUBLE PRECISION,
  p_mtbf_real DOUBLE PRECISION,
  p_disponibilidade_real DOUBLE PRECISION
) RETURNS TABLE (
  mttr_percentual DOUBLE PRECISION,
  mtbf_percentual DOUBLE PRECISION,
  disponibilidade_percentual DOUBLE PRECISION
) AS $$
DECLARE
  metas_consolidadas RECORD;
BEGIN
  -- Obter as metas consolidadas do ambiente
  SELECT * INTO metas_consolidadas 
  FROM get_metas_ambiente_consolidado(p_ambiente_id);
  
  RETURN QUERY
  SELECT 
    -- MTTR: menor é melhor (meta / real * 100)
    CASE 
      WHEN p_mttr_real > 0 AND metas_consolidadas.mttr_meta_consolidada > 0 THEN
        (metas_consolidadas.mttr_meta_consolidada / p_mttr_real) * 100
      ELSE 0
    END as mttr_percentual,
    
    -- MTBF: maior é melhor (real / meta * 100)
    CASE 
      WHEN metas_consolidadas.mtbf_meta_consolidada > 0 THEN
        (p_mtbf_real / metas_consolidadas.mtbf_meta_consolidada) * 100
      ELSE 0
    END as mtbf_percentual,
    
    -- Disponibilidade: maior é melhor (real / meta * 100)
    CASE 
      WHEN metas_consolidadas.disponibilidade_meta_consolidada > 0 THEN
        (p_disponibilidade_real / metas_consolidadas.disponibilidade_meta_consolidada) * 100
      ELSE 0
    END as disponibilidade_percentual;
END;
$$ LANGUAGE plpgsql;