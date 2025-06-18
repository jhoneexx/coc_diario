import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Incidente {
  id: number;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  descricao: string;
  criticidade: { 
    nome: string;
    cor: string;
    is_downtime: boolean;
  };
}

interface HeatMapProps {
  incidentes: Incidente[];
  periodo: {
    inicio: string;
    fim: string;
  };
}

interface DayData {
  date: Date;
  incidents: Incidente[];
  highestCriticality: string | null;
}

interface IncidentModalProps {
  date: Date;
  incidents: Incidente[];
  onClose: () => void;
  onViewIncident: (id: number) => void;
}

const IncidentModal: React.FC<IncidentModalProps> = ({ date, incidents, onClose, onViewIncident }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Incidentes em {format(date, 'dd/MM/yyyy')}
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
              Nenhum incidente registrado nesta data.
            </p>
          ) : (
            <div className="space-y-4">
              {incidents.map(incident => (
                <div 
                  key={incident.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">#{incident.id}</span>
                      <span 
                        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium`}
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
                  
                  <p className="text-sm text-gray-700 mb-2">{incident.descricao}</p>
                  
                  <div className="flex justify-between items-center">
                    {incident.duracao_minutos && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
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
                      Visualizar detalhes
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

const HeatMapCalendar: React.FC<HeatMapProps> = ({ incidentes, periodo }) => {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = React.useState<DayData | null>(null);
  
  // Configurar mês atual para o calendário
  const monthStart = new Date(periodo.inicio);
  const monthEnd = new Date(periodo.fim);
  
  // Se o período for maior que um mês, mostra apenas o mês atual
  const currentDate = new Date();
  const calendarStart = isSameMonth(monthStart, monthEnd) 
    ? startOfMonth(monthStart)
    : startOfMonth(currentDate);
  const calendarEnd = isSameMonth(monthStart, monthEnd)
    ? endOfMonth(monthStart) 
    : endOfMonth(currentDate);
  
  // Dias da semana em português
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  // Preparar dados para o calendário
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    return days.map(date => {
      const dayStr = format(date, 'yyyy-MM-dd');
      const dayIncidents = incidentes.filter(inc => {
        const incidentDate = new Date(inc.inicio).toISOString().split('T')[0];
        return incidentDate === dayStr;
      });
      
      // Determinar a maior criticidade do dia
      let highestCriticality = null;
      if (dayIncidents.length > 0) {
        // Ordenar pela "gravidade" da criticidade
        const sorted = [...dayIncidents].sort((a, b) => {
          // Se um é downtime e o outro não, o downtime é mais crítico
          if (a.criticidade.is_downtime && !b.criticidade.is_downtime) return -1;
          if (!a.criticidade.is_downtime && b.criticidade.is_downtime) return 1;
          
          // Usar a cor como indicador aproximado de gravidade
          // Vermelho > Laranja > Amarelo > Qualquer outro
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
        
        highestCriticality = sorted[0].criticidade.cor;
      }
      
      return {
        date,
        incidents: dayIncidents,
        highestCriticality
      } as DayData;
    });
  }, [incidentes, calendarStart, calendarEnd]);
  
  // Agrupar dias por semana para o calendário
  const calendarWeeks = useMemo(() => {
    const weeks: DayData[][] = [];
    let currentWeek: DayData[] = [];
    
    // Preencher dias vazios no início da semana se necessário
    const firstDay = calendarDays[0].date.getDay();
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push({
        date: new Date(0), // Data inválida
        incidents: [],
        highestCriticality: null
      });
    }
    
    calendarDays.forEach((day, index) => {
      currentWeek.push(day);
      
      if (currentWeek.length === 7 || index === calendarDays.length - 1) {
        // Preencher dias vazios no final da semana se necessário
        while (currentWeek.length < 7) {
          currentWeek.push({
            date: new Date(0), // Data inválida
            incidents: [],
            highestCriticality: null
          });
        }
        
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return weeks;
  }, [calendarDays]);
  
  // Função para determinar a cor de fundo com base na criticidade
  const getCellBackground = (day: DayData) => {
    if (!day.date.getTime()) return 'bg-gray-50'; // Dia vazio
    
    if (day.highestCriticality) {
      return `bg-[${day.highestCriticality}]`;
    }
    
    return 'bg-green-50';
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

  // Handler para clicar em um dia
  const handleDayClick = (day: DayData) => {
    if (day.date.getTime() > 0) { // Verifica se é um dia válido
      setSelectedDay(day);
    }
  };
  
  // Handler para visualizar detalhes de um incidente
  const handleViewIncident = (id: number) => {
    navigate(`/incidentes/editar/${id}`);
  };

  return (
    <div className="overflow-hidden">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">
          {format(calendarStart, 'MMMM yyyy', { locale: ptBR })}
        </h3>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map(day => (
          <div 
            key={day} 
            className="text-xs font-medium text-gray-500 text-center py-1"
          >
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {calendarWeeks.flatMap((week, weekIndex) =>
          week.map((day, dayIndex) => {
            // Verifica se é um dia válido
            const isValidDay = day.date.getTime() > 0;
            
            return (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`
                  relative rounded-md p-2 h-14 
                  heatmap-cell
                  ${isValidDay ? getCriticalityClass(day.highestCriticality) : 'bg-gray-50'} 
                  ${isToday(day.date) ? 'ring-2 ring-blue-400' : ''}
                  ${!isValidDay ? 'opacity-0 pointer-events-none' : 'cursor-pointer'}
                `}
                title={day.incidents.length > 0 ? 
                  `${format(day.date, 'dd/MM/yyyy')}
Incidentes: ${day.incidents.map(inc => `#${inc.id}`).join(', ')}` : 
                  format(day.date, 'dd/MM/yyyy')
                }
                onClick={isValidDay ? () => handleDayClick(day) : undefined}
              >
                <div className="absolute top-1 left-1 text-xs font-semibold">
                  {isValidDay ? format(day.date, 'd') : ''}
                </div>
                
                {day.incidents.length > 0 && (
                  <div className="absolute bottom-1 right-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-xs font-medium">
                      {day.incidents.length}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
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
      {selectedDay && (
        <IncidentModal 
          date={selectedDay.date}
          incidents={selectedDay.incidents}
          onClose={() => setSelectedDay(null)}
          onViewIncident={handleViewIncident}
        />
      )}
    </div>
  );
};

export default HeatMapCalendar;