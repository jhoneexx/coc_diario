import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../lib/supabase';

interface Incidente {
  id: number;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  descricao: string;
  ambiente_id: number;
  segmento_id: number;
  criticidade: { 
    nome: string;
    cor: string;
    is_downtime: boolean;
  };
}

interface AmbienteSegmento {
  ambiente_id: number;
  ambiente_nome: string;
  segmento_id: number;
  segmento_nome: string;
  usuarios: number;
}

interface IncidentModalProps {
  date: Date;
  ambienteId: number;
  segmentoId: number;
  ambienteNome: string;
  segmentoNome: string;
  incidents: Incidente[];
  onClose: () => void;
  onViewIncident: (id: number) => void;
}

const IncidentModal: React.FC<IncidentModalProps> = ({ 
  date, 
  ambienteId,
  segmentoId,
  ambienteNome,
  segmentoNome,
  incidents, 
  onClose, 
  onViewIncident 
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Incidentes em {format(date, 'dd/MM/yyyy')}
            <div className="text-sm text-gray-600 mt-1">
              {ambienteNome} - {segmentoNome}
            </div>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Fechar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          {incidents.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Nenhum incidente registrado nesta data para este segmento.
            </p>
          ) : (
            <div className="space-y-4">
              {incidents.map(incident => (
                <div 
                  key={incident.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-sm font-medium text-gray-900">#{incident.id}</span>
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: `${incident.criticidade.cor}20`,
                          color: incident.criticidade.cor
                        }}
                      >
                        {incident.criticidade.nome}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(incident.inicio), 'HH:mm')}
                      {incident.fim && ` - ${format(new Date(incident.fim), 'HH:mm')}`}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2 break-words">{incident.descricao}</p>
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    {incident.duracao_minutos && (
                      <div className="flex items-center text-xs text-gray-500">
                        <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {incident.duracao_minutos >= 60 
                          ? `${Math.floor(incident.duracao_minutos / 60)}h ${incident.duracao_minutos % 60}min`
                          : `${incident.duracao_minutos}min`
                        }
                      </div>
                    )}
                    
                    <button
                      onClick={() => onViewIncident(incident.id)}
                      className="text-xs text-primary-600 hover:text-primary-800 flex items-center"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ver detalhes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

interface EnvironmentOverviewHeatmapProps {
  periodo?: {
    inicio: string;
    fim: string;
  };
}

const EnvironmentOverviewHeatmap: React.FC<EnvironmentOverviewHeatmapProps> = ({ periodo }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [ambientesSegmentos, setAmbientesSegmentos] = useState<AmbienteSegmento[]>([]);
  const [selectedIncidents, setSelectedIncidents] = useState<{
    date: Date;
    ambienteId: number;
    segmentoId: number;
    ambienteNome: string;
    segmentoNome: string;
    incidents: Incidente[];
  } | null>(null);
  
  // Memoize the current date to prevent re-rendering issues
  const stableCurrentDate = useMemo(() => new Date(), []);
  
  // Memoize month start and end dates
  const monthStart = useMemo(() => startOfMonth(stableCurrentDate), [stableCurrentDate]);
  const monthEnd = useMemo(() => endOfMonth(stableCurrentDate), [stableCurrentDate]);
  
  // Dias do mês
  const daysOfMonth = useMemo(() => {
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [monthStart, monthEnd]);
  
  // Carregar ambientes, segmentos e incidentes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Carregar ambientes e segmentos
        const { data: segmentosData, error: segmentosError } = await supabase
          .from('segmentos')
          .select(`
            id,
            nome,
            ambiente_id,
            ambiente:ambientes(id, nome)
          `)
          .order('ambiente_id')
          .order('nome');
        
        if (segmentosError) throw segmentosError;
        
        if (segmentosData) {
          // Transformar dados para o formato que precisamos
          const ambSegList: AmbienteSegmento[] = segmentosData.map(seg => ({
            ambiente_id: seg.ambiente_id,
            ambiente_nome: seg.ambiente?.nome || 'Desconhecido',
            segmento_id: seg.id,
            segmento_nome: seg.nome,
            usuarios: Math.floor(Math.random() * 2000) + 1 // Simulando número de usuários
          }));
          
          setAmbientesSegmentos(ambSegList);
        }
        
        // Carregar incidentes do mês atual
        const inicioMes = monthStart.toISOString().split('T')[0]; 
        const fimMes = monthEnd.toISOString().split('T')[0]; 
        
        const { data: incidentesData, error: incidentesError } = await supabase
          .from('incidentes')
          .select(`
            *,
            tipo:tipos_incidente(nome),
            ambiente:ambientes(nome),
            segmento:segmentos(nome),
            criticidade:criticidades(nome, cor, is_downtime)
          `)
          .gte('inicio', inicioMes)
          .lte('inicio', `${fimMes}T23:59:59`);
        
        if (incidentesError) throw incidentesError;
        
        if (incidentesData) {
          setIncidentes(incidentesData);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Função para obter incidentes de um dia específico para um ambiente/segmento
  const getIncidentsForDayAndSegment = (day: Date, ambienteId: number, segmentoId: number) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return incidentes.filter(inc => {
      const incidentDate = new Date(inc.inicio).toISOString().split('T')[0];
      return incidentDate === dayStr && 
             inc.ambiente_id === ambienteId && 
             inc.segmento_id === segmentoId;
    });
  };
  
  // Função para obter a cor da criticidade mais alta para um conjunto de incidentes
  const getHighestCriticalityColor = (incidents: Incidente[]) => {
    if (incidents.length === 0) return null;
    
    // Ordenar pela "gravidade" da criticidade
    const sorted = [...incidents].sort((a, b) => {
      // Se um é downtime e o outro não, o downtime é mais crítico
      if (a.criticidade.is_downtime && !b.criticidade.is_downtime) return -1;
      if (!a.criticidade.is_downtime && b.criticidade.is_downtime) return 1;
      
      // Usar a cor como indicador aproximado de gravidade
      const colorOrder = {
        '#dc2626': 1, // Vermelho
        '#ea580c': 2, // Laranja
        '#f59e0b': 3, // Amarelo
        '#65a30d': 4, // Verde Limão
        '#16a34a': 5, // Verde
        '#0ea5e9': 6, // Azul
        '#e2e8f0': 7  // Cinza
      };
      
      const colorA = a.criticidade.cor;
      const colorB = b.criticidade.cor;
      
      return (colorOrder[colorA as keyof typeof colorOrder] || 999) - 
             (colorOrder[colorB as keyof typeof colorOrder] || 999);
    });
    
    return sorted[0].criticidade.cor;
  };
  
  // Retorna classe de criticidade com base no código de cor
  const getCriticalityClass = (color: string | null) => {
    if (!color) return 'criticality-none';
    
    const colorMap: Record<string, string> = {
      '#dc2626': 'criticality-critical',
      '#ea580c': 'criticality-high',
      '#f59e0b': 'criticality-medium',
      '#65a30d': 'criticality-low',
      '#16a34a': 'criticality-very-low',
      '#0ea5e9': 'criticality-zero',
      '#e2e8f0': 'criticality-none'
    };
    
    return colorMap[color] || 'criticality-none';
  };
  
  // Handler para clicar em uma célula do mapa de calor
  const handleCellClick = (day: Date, ambienteId: number, segmentoId: number, ambienteNome: string, segmentoNome: string) => {
    const incidents = getIncidentsForDayAndSegment(day, ambienteId, segmentoId);
    setSelectedIncidents({
      date: day,
      ambienteId,
      segmentoId,
      ambienteNome,
      segmentoNome,
      incidents
    });
  };
  
  // Handler para visualizar detalhes de um incidente
  const handleViewIncident = (id: number) => {
    navigate(`/incidentes/editar/${id}`);
  };
  
  // Agrupar ambientes/segmentos por ambiente
  const ambienteGroups = useMemo(() => {
    const groups: Record<number, {
      ambiente_id: number;
      ambiente_nome: string;
      segmentos: AmbienteSegmento[];
    }> = {};
    
    ambientesSegmentos.forEach(item => {
      if (!groups[item.ambiente_id]) {
        groups[item.ambiente_id] = {
          ambiente_id: item.ambiente_id,
          ambiente_nome: item.ambiente_nome,
          segmentos: []
        };
      }
      
      groups[item.ambiente_id].segmentos.push(item);
    });
    
    return Object.values(groups);
  }, [ambientesSegmentos]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse flex space-x-4">
          <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
          <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
          <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-center mb-4">
        <h3 className="text-base sm:text-lg font-medium">
          {format(monthStart, 'MMMM yyyy', { locale: ptBR })}
        </h3>
      </div>
      
      <div className="min-w-max">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 sticky left-0 z-10" style={{ minWidth: '200px' }}>
                Ambiente/Unidade
              </th>
              <th className="px-2 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 sticky left-[200px] z-10" style={{ width: '80px' }}>
                Users
              </th>
              {daysOfMonth.map(day => (
                <th 
                  key={day.getDate()} 
                  className={`px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 ${
                    isToday(day) ? 'bg-blue-50' : 'bg-gray-50'
                  }`}
                  style={{ width: '36px', minWidth: '36px' }}
                >
                  {format(day, 'dd/MM', { locale: ptBR }).split('/')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ambienteGroups.map(group => (
              <React.Fragment key={group.ambiente_id}>
                {group.segmentos.map((item, index) => (
                  <tr key={`${item.ambiente_id}-${item.segmento_id}`} className="hover:bg-gray-50">
                    <td className={`px-2 py-2 text-sm border-b border-r border-gray-200 sticky left-0 bg-white z-10 ${
                      index === 0 ? 'font-medium' : ''
                    }`}>
                      {index === 0 ? (
                        <div className="font-medium">{item.ambiente_nome}</div>
                      ) : null}
                      <div className={`${index === 0 ? 'ml-0' : 'ml-4'} ${index === 0 ? '' : 'text-blue-600'}`}>
                        {item.segmento_nome}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-sm text-center border-b border-r border-gray-200 sticky left-[200px] bg-white z-10">
                      {item.usuarios.toLocaleString()}
                    </td>
                    {daysOfMonth.map(day => {
                      const incidents = getIncidentsForDayAndSegment(day, item.ambiente_id, item.segmento_id);
                      const highestCriticalityColor = getHighestCriticalityColor(incidents);
                      const criticalityClass = getCriticalityClass(highestCriticalityColor);
                      
                      return (
                        <td 
                          key={day.getDate()} 
                          className={`px-0 py-0 border-b border-r border-gray-200 ${
                            isToday(day) ? 'bg-blue-50' : ''
                          } ${criticalityClass} cursor-pointer`}
                          onClick={() => handleCellClick(day, item.ambiente_id, item.segmento_id, item.ambiente_nome, item.segmento_nome)}
                          title={incidents.length > 0 ? 
                            `${format(day, 'dd/MM/yyyy')}
${item.ambiente_nome} - ${item.segmento_nome}
Incidentes: ${incidents.map(inc => `#${inc.id}`).join(', ')}` : 
                            `${format(day, 'dd/MM/yyyy')}
${item.ambiente_nome} - ${item.segmento_nome}
Sem incidentes`
                          }
                        >
                          {incidents.length > 0 && (
                            <div className="flex justify-center items-center h-9 w-9">
                              <span className="text-xs font-medium">
                                {incidents.length}
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Legenda */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm criticality-critical mr-2"></div>
          <span className="text-xs">Crítico</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm criticality-high mr-2"></div>
          <span className="text-xs">Alto</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm criticality-medium mr-2"></div>
          <span className="text-xs">Médio</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm criticality-low mr-2"></div>
          <span className="text-xs">Baixo</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm criticality-very-low mr-2"></div>
          <span className="text-xs">Baixíssimo</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm criticality-zero mr-2"></div>
          <span className="text-xs">Zero Impacto</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm criticality-none mr-2"></div>
          <span className="text-xs">Sem Incidentes</span>
        </div>
      </div>
      
      {/* Modal de detalhes de incidentes */}
      {selectedIncidents && (
        <IncidentModal 
          date={selectedIncidents.date}
          ambienteId={selectedIncidents.ambienteId}
          segmentoId={selectedIncidents.segmentoId}
          ambienteNome={selectedIncidents.ambienteNome}
          segmentoNome={selectedIncidents.segmentoNome}
          incidents={selectedIncidents.incidents}
          onClose={() => setSelectedIncidents(null)}
          onViewIncident={handleViewIncident}
        />
      )}
    </div>
  );
};

export default EnvironmentOverviewHeatmap;