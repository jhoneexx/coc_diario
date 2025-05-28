import React, { useMemo } from 'react';
import { format, eachMonthOfInterval, eachDayOfInterval, isToday, isSameMonth, getMonth, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock } from 'lucide-react';

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

interface YearHeatMapProps {
  incidentes: Incidente[];
  ano?: number; // Ano opcional para exibir (padrão: ano atual)
}

interface MonthData {
  month: Date;
  days: DayData[];
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
}

const IncidentModal: React.FC<IncidentModalProps> = ({ date, incidents, onClose }) => {
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
                  
                  {incident.duracao_minutos && (
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {incident.duracao_minutos >= 60 
                        ? `${Math.floor(incident.duracao_minutos / 60)}h ${incident.duracao_minutos % 60}min`
                        : `${incident.duracao_minutos}min`
                      }
                    </div>
                  )}
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

const YearHeatMapCalendar: React.FC<YearHeatMapProps> = ({ incidentes, ano }) => {
  const [selectedDay, setSelectedDay] = React.useState<DayData | null>(null);
  
  // Usar o ano fornecido ou o ano atual
  const currentYear = ano || getYear(new Date());
  
  // Configurar intervalo do ano
  const yearStart = startOfYear(new Date(currentYear, 0, 1));
  const yearEnd = endOfYear(new Date(currentYear, 11, 31));
  
  // Meses do ano
  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => 
      format(new Date(currentYear, i, 1), 'MMM', { locale: ptBR })
    );
  }, [currentYear]);
  
  // Preparar dados para o calendário anual
  const yearData = useMemo(() => {
    // Obter todos os meses do ano
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    
    return months.map(monthDate => {
      const monthStartDate = startOfMonth(monthDate);
      const monthEndDate = endOfMonth(monthDate);
      
      // Obter todos os dias do mês
      const days = eachDayOfInterval({ start: monthStartDate, end: monthEndDate });
      
      // Mapear dados para cada dia
      const daysData = days.map(date => {
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
      
      return {
        month: monthDate,
        days: daysData
      };
    });
  }, [incidentes, yearStart, yearEnd]);
  
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
    setSelectedDay(day);
  };

  return (
    <div className="overflow-hidden">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">
          {currentYear}
        </h3>
      </div>
      
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-6">
        {yearData.map((monthData) => (
          <div 
            key={getMonth(monthData.month)} 
            className="bg-white p-3 rounded-lg border"
          >
            <h4 className="text-sm font-medium mb-2 text-center">
              {format(monthData.month, 'MMMM', { locale: ptBR })}
            </h4>
            
            <div className="grid grid-cols-7 gap-[2px] mb-[2px]">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                <div 
                  key={i} 
                  className="text-[0.65rem] font-medium text-gray-500 text-center"
                >
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-[2px]">
              {/* Preenche espaços vazios no início do mês */}
              {Array.from({ length: monthData.days[0].date.getDay() }).map((_, index) => (
                <div key={`empty-start-${index}`} className="opacity-0"></div>
              ))}
              
              {/* Dias do mês */}
              {monthData.days.map((day) => (
                <div
                  key={day.date.getDate()}
                  className={`
                    relative rounded-sm p-1 h-6 w-6
                    ${getCriticalityClass(day.highestCriticality)}
                    ${isToday(day.date) ? 'ring-1 ring-blue-400' : ''} 
                    cursor-pointer
                  `}
                  title={day.incidents.length > 0 ? 
                    `${format(day.date, 'dd/MM/yyyy')}
Incidentes: ${day.incidents.map(inc => `#${inc.id}`).join(', ')}` : 
                    format(day.date, 'dd/MM/yyyy')
                  }
                  onClick={() => handleDayClick(day)}
                >
                  <div className="text-[0.65rem] font-medium">
                    {day.date.getDate()}
                  </div>
                  
                  {day.incidents.length > 0 && (
                    <div className="absolute -top-1 -right-1">
                      <span className="flex h-3 w-3 items-center justify-center rounded-full bg-white text-[0.6rem] font-medium shadow-sm">
                        {day.incidents.length}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
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
        />
      )}
    </div>
  );
};

export default YearHeatMapCalendar;