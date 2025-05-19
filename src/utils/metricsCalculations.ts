// Utilitários para cálculo de métricas de performance e disponibilidade

interface Incidente {
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  criticidade: {
    is_downtime: boolean;
  };
}

/**
 * Calcula o MTTR (Mean Time To Repair) em horas
 * @param incidentes Lista de incidentes
 * @returns Valor do MTTR em horas
 */
export function calcularMTTR(incidentes: Incidente[]): number {
  // Filtramos apenas incidentes resolvidos que são downtime
  const incidentesResolvidos = incidentes.filter(inc => 
    inc.fim !== null && 
    inc.duracao_minutos !== null && 
    inc.criticidade.is_downtime
  );
  
  if (incidentesResolvidos.length === 0) {
    return 0;
  }
  
  // Calculamos a duração média em horas
  const somaMinutos = incidentesResolvidos.reduce((sum, inc) => sum + (inc.duracao_minutos || 0), 0);
  return somaMinutos / 60 / incidentesResolvidos.length;
}

/**
 * Calcula o MTBF (Mean Time Between Failures) em horas
 * @param incidentes Lista de incidentes
 * @param dataInicio Data de início do período
 * @param dataFim Data de fim do período
 * @returns Valor do MTBF em horas
 */
export function calcularMTBF(incidentes: Incidente[], dataInicio: string, dataFim: string): number {
  // Filtramos apenas incidentes que são downtime
  const incidentesDowntime = incidentes.filter(inc => inc.criticidade.is_downtime);
  
  if (incidentesDowntime.length === 0) {
    // Se não houver falhas, o MTBF é todo o período
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim + 'T23:59:59');
    const periodoHoras = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60);
    return periodoHoras;
  }
  
  // Calcular tempo total de downtime em minutos
  const totalDowntime = incidentesDowntime.reduce((sum, inc) => {
    if (inc.duracao_minutos !== null) {
      return sum + inc.duracao_minutos;
    }
    
    // Se o incidente ainda estiver em aberto, calcular duração até o momento atual
    if (inc.fim === null) {
      const inicioIncidente = new Date(inc.inicio);
      const agora = new Date();
      return sum + ((agora.getTime() - inicioIncidente.getTime()) / (1000 * 60));
    }
    
    return sum;
  }, 0);
  
  // Calcular tempo total do período em horas
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim + 'T23:59:59');
  const periodoHoras = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60);
  
  // Calcular tempo de uptime
  const downtimeHoras = totalDowntime / 60;
  const uptimeHoras = periodoHoras - downtimeHoras;
  
  // MTBF = Tempo de operação / Número de falhas
  return uptimeHoras / incidentesDowntime.length;
}

/**
 * Calcula a disponibilidade em porcentagem
 * @param incidentes Lista de incidentes
 * @param dataInicio Data de início do período
 * @param dataFim Data de fim do período
 * @returns Valor da disponibilidade em porcentagem
 */
export function calcularDisponibilidade(incidentes: Incidente[], dataInicio: string, dataFim: string): number {
  // Filtramos apenas incidentes que são downtime
  const incidentesDowntime = incidentes.filter(inc => inc.criticidade.is_downtime);
  
  if (incidentesDowntime.length === 0) {
    return 100; // 100% de disponibilidade se não houver falhas
  }
  
  // Calcular tempo total de downtime em minutos
  const totalDowntime = incidentesDowntime.reduce((sum, inc) => {
    if (inc.duracao_minutos !== null) {
      return sum + inc.duracao_minutos;
    }
    
    // Se o incidente ainda estiver em aberto, calcular duração até o momento atual
    if (inc.fim === null) {
      const inicioIncidente = new Date(inc.inicio);
      const agora = new Date();
      return sum + ((agora.getTime() - inicioIncidente.getTime()) / (1000 * 60));
    }
    
    return sum;
  }, 0);
  
  // Calcular tempo total do período em minutos
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim + 'T23:59:59');
  const periodoMinutos = (fim.getTime() - inicio.getTime()) / (1000 * 60);
  
  // Disponibilidade = (tempo total - tempo de indisponibilidade) / tempo total * 100
  return ((periodoMinutos - totalDowntime) / periodoMinutos) * 100;
}