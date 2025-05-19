import React, { useMemo } from 'react';

interface IncidentesStats {
  totalIncidentes: number;
  incidentesAbertos: number;
  incidentesCriticos: number;
  disponibilidadeMedia: number;
  mttr: number;
  mtbf: number;
  maxDiasSemIncidentes: number;
}

interface MetaStats {
  mttr_meta?: number;
  mtbf_meta?: number;
  disponibilidade_meta?: number;
  peso_percentual?: number;
}

interface ExecutiveSummaryProps {
  stats: IncidentesStats;
  metas?: MetaStats;
  periodo: {
    inicio: string;
    fim: string;
  };
  ambiente?: string;
}

const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ 
  stats, 
  metas, 
  periodo,
  ambiente
}) => {
  // Calcular o número de dias no período
  const diasPeriodo = useMemo(() => {
    const inicio = new Date(periodo.inicio);
    const fim = new Date(periodo.fim);
    const diffTime = Math.abs(fim.getTime() - inicio.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [periodo]);

  // Determinar status de cada métrica
  const mttrStatus = useMemo(() => {
    if (!metas?.mttr_meta) return 'neutro';
    return stats.mttr <= metas.mttr_meta ? 'positivo' : 'negativo';
  }, [stats.mttr, metas?.mttr_meta]);

  const mtbfStatus = useMemo(() => {
    if (!metas?.mtbf_meta) return 'neutro';
    return stats.mtbf >= metas.mtbf_meta ? 'positivo' : 'negativo';
  }, [stats.mtbf, metas?.mtbf_meta]);

  const dispStatus = useMemo(() => {
    if (!metas?.disponibilidade_meta) return 'neutro';
    return stats.disponibilidadeMedia >= metas.disponibilidade_meta ? 'positivo' : 'negativo';
  }, [stats.disponibilidadeMedia, metas?.disponibilidade_meta]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Resumo Executivo</h2>
      
      <div className="flex items-center mb-4">
        <span className="text-gray-600 text-sm">
          {ambiente ? `Ambiente: ${ambiente}` : 'Todos os ambientes'}
        </span>
        <span className="mx-2 text-gray-400">•</span>
        <span className="text-gray-600 text-sm">
          Período: {new Date(periodo.inicio).toLocaleDateString('pt-BR')} a {new Date(periodo.fim).toLocaleDateString('pt-BR')}
        </span>
        <span className="mx-2 text-gray-400">•</span>
        <span className="text-gray-600 text-sm">
          {diasPeriodo} dias
        </span>
        {metas?.peso_percentual && (
          <>
            <span className="mx-2 text-gray-400">•</span>
            <span className="text-gray-600 text-sm">
              Peso na Meta Global: {metas.peso_percentual}%
            </span>
          </>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Incidentes */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Incidentes</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total:</span>
              <span className="font-semibold">{stats.totalIncidentes}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Em andamento:</span>
              <span className={`font-semibold ${stats.incidentesAbertos > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {stats.incidentesAbertos}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Críticos:</span>
              <span className={`font-semibold ${stats.incidentesCriticos > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.incidentesCriticos}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Dias sem incidentes:</span>
              <span className="font-semibold">
                {stats.maxDiasSemIncidentes}
              </span>
            </div>
          </div>
        </div>
        
        {/* Tempos */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Tempos</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">MTTR:</span>
              <span className={`font-semibold ${
                mttrStatus === 'positivo' ? 'text-green-600' : 
                mttrStatus === 'negativo' ? 'text-red-600' : 'text-gray-800'
              }`}>
                {stats.mttr.toFixed(2)}h {metas?.mttr_meta ? `/ Meta: ${metas.mttr_meta.toFixed(2)}h` : ''}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">MTBF:</span>
              <span className={`font-semibold ${
                mtbfStatus === 'positivo' ? 'text-green-600' : 
                mtbfStatus === 'negativo' ? 'text-red-600' : 'text-gray-800'
              }`}>
                {(stats.mtbf / 24).toFixed(2)} dias {metas?.mtbf_meta ? `/ Meta: ${(metas.mtbf_meta / 24).toFixed(2)} dias` : ''}
              </span>
            </div>
          </div>
        </div>
        
        {/* Disponibilidade */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Disponibilidade</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Percentual:</span>
              <span className={`font-semibold ${
                dispStatus === 'positivo' ? 'text-green-600' : 
                dispStatus === 'negativo' ? 'text-red-600' : 'text-gray-800'
              }`}>
                {stats.disponibilidadeMedia.toFixed(3)}% {metas?.disponibilidade_meta ? `/ Meta: ${metas.disponibilidade_meta.toFixed(3)}%` : ''}
              </span>
            </div>
            
            <div>
              <div className="mt-2 h-4 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    dispStatus === 'positivo' ? 'bg-green-500' : 
                    dispStatus === 'negativo' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, stats.disponibilidadeMedia)}%` }}
                ></div>
              </div>
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 border-t pt-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="text-sm text-gray-700 mb-2">Principais observações:</div>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              {stats.incidentesAbertos > 0 && (
                <li>Existem <span className="font-medium">{stats.incidentesAbertos} incidentes</span> ainda em andamento.</li>
              )}
              
              {stats.incidentesCriticos > 0 && (
                <li>Foram registrados <span className="font-medium">{stats.incidentesCriticos} incidentes críticos</span> no período.</li>
              )}
              
              {dispStatus === 'negativo' && metas?.disponibilidade_meta && (
                <li>A disponibilidade está <span className="font-medium text-red-600">{(metas.disponibilidade_meta - stats.disponibilidadeMedia).toFixed(3)}%</span> abaixo da meta.</li>
              )}
              
              {dispStatus === 'positivo' && metas?.disponibilidade_meta && (
                <li>A disponibilidade está <span className="font-medium text-green-600">{(stats.disponibilidadeMedia - metas.disponibilidade_meta).toFixed(3)}%</span> acima da meta.</li>
              )}
              
              {mttrStatus === 'positivo' && metas?.mttr_meta && (
                <li>O tempo médio de reparo (MTTR) está dentro da meta estabelecida.</li>
              )}
              
              {mttrStatus === 'negativo' && metas?.mttr_meta && (
                <li>O tempo médio de reparo (MTTR) está acima da meta estabelecida.</li>
              )}
              
              {stats.maxDiasSemIncidentes > 7 && (
                <li>Temos <span className="font-medium text-green-600">{stats.maxDiasSemIncidentes} dias</span> consecutivos sem incidentes.</li>
              )}
              
              {metas?.peso_percentual && (
                <li>Este ambiente representa <span className="font-medium">{metas.peso_percentual}%</span> das metas globais da organização.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveSummary;