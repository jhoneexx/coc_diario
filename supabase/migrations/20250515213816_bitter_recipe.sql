/*
  # Funções para cálculo de métricas de performance

  1. Novas Funções
    - `calcular_mttr` - Calcula o Mean Time To Repair para um ambiente em um período
    - `calcular_mtbf` - Calcula o Mean Time Between Failures para um ambiente em um período
    - `calcular_disponibilidade` - Calcula a disponibilidade percentual para um ambiente em um período

  Estas funções são essenciais para gerar os relatórios e dashboards do sistema.
*/

-- Função para calcular MTTR (Mean Time To Repair) em horas
CREATE OR REPLACE FUNCTION calcular_mttr(
  p_ambiente_id INTEGER,
  p_data_inicio TEXT,
  p_data_fim TEXT
) RETURNS FLOAT AS $$
DECLARE
  resultado FLOAT;
BEGIN
  -- Seleciona a média da duração em minutos para incidentes resolvidos
  -- onde a criticidade é considerada como downtime
  SELECT AVG(i.duracao_minutos) / 60.0 INTO resultado
  FROM incidentes i
  JOIN criticidades c ON i.criticidade_id = c.id
  WHERE i.ambiente_id = p_ambiente_id
    AND i.inicio >= p_data_inicio::TIMESTAMP
    AND i.inicio <= (p_data_fim::TIMESTAMP + INTERVAL '1 day')
    AND i.fim IS NOT NULL
    AND c.is_downtime = TRUE;

  RETURN COALESCE(resultado, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para calcular MTBF (Mean Time Between Failures) em horas
CREATE OR REPLACE FUNCTION calcular_mtbf(
  p_ambiente_id INTEGER,
  p_data_inicio TEXT,
  p_data_fim TEXT
) RETURNS FLOAT AS $$
DECLARE
  total_incidentes INTEGER;
  periodo_horas FLOAT;
  total_downtime_horas FLOAT;
  resultado FLOAT;
BEGIN
  -- Conta o número de incidentes críticos no período
  SELECT COUNT(*) INTO total_incidentes
  FROM incidentes i
  JOIN criticidades c ON i.criticidade_id = c.id
  WHERE i.ambiente_id = p_ambiente_id
    AND i.inicio >= p_data_inicio::TIMESTAMP
    AND i.inicio <= (p_data_fim::TIMESTAMP + INTERVAL '1 day')
    AND c.is_downtime = TRUE;

  -- Calcula o período total em horas
  SELECT EXTRACT(EPOCH FROM ((p_data_fim::TIMESTAMP + INTERVAL '1 day') - p_data_inicio::TIMESTAMP)) / 3600 
  INTO periodo_horas;

  -- Calcula o tempo total de downtime em horas
  SELECT COALESCE(SUM(i.duracao_minutos) / 60.0, 0) INTO total_downtime_horas
  FROM incidentes i
  JOIN criticidades c ON i.criticidade_id = c.id
  WHERE i.ambiente_id = p_ambiente_id
    AND i.inicio >= p_data_inicio::TIMESTAMP
    AND i.inicio <= (p_data_fim::TIMESTAMP + INTERVAL '1 day')
    AND i.fim IS NOT NULL
    AND c.is_downtime = TRUE;

  -- Calcula MTBF (tempo operacional / número de falhas)
  -- Se não houver incidentes, retorna o período total
  IF total_incidentes = 0 THEN
    resultado := periodo_horas;
  ELSE
    resultado := (periodo_horas - total_downtime_horas) / total_incidentes;
  END IF;

  RETURN COALESCE(resultado, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para calcular Disponibilidade em porcentagem
CREATE OR REPLACE FUNCTION calcular_disponibilidade(
  p_ambiente_id INTEGER,
  p_data_inicio TEXT,
  p_data_fim TEXT
) RETURNS FLOAT AS $$
DECLARE
  periodo_minutos FLOAT;
  total_downtime_minutos FLOAT;
  resultado FLOAT;
BEGIN
  -- Calcula o período total em minutos
  SELECT EXTRACT(EPOCH FROM ((p_data_fim::TIMESTAMP + INTERVAL '1 day') - p_data_inicio::TIMESTAMP)) / 60 
  INTO periodo_minutos;

  -- Calcula o tempo total de downtime em minutos
  SELECT COALESCE(SUM(i.duracao_minutos), 0) INTO total_downtime_minutos
  FROM incidentes i
  JOIN criticidades c ON i.criticidade_id = c.id
  WHERE i.ambiente_id = p_ambiente_id
    AND i.inicio >= p_data_inicio::TIMESTAMP
    AND i.inicio <= (p_data_fim::TIMESTAMP + INTERVAL '1 day')
    AND i.fim IS NOT NULL
    AND c.is_downtime = TRUE;

  -- Calcula disponibilidade: (tempo total - tempo de indisponibilidade) / tempo total * 100
  resultado := (periodo_minutos - total_downtime_minutos) / periodo_minutos * 100;

  RETURN COALESCE(resultado, 100);
END;
$$ LANGUAGE plpgsql;