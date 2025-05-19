import React, { useMemo } from 'react';
import { format, eachMonthOfInterval, eachDayOfInterval, isToday, isSameMonth, getMonth, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Incidente {
  id: number;
  inicio: string;
  fim: string | null;
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

const YearHeatMapCalendar: React.FC<YearHeatMapProps> = ({ incidentes, ano }) => {
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
                  `}
                  title={day.incidents.length > 0 ? 
                    `${format(day.date, 'dd/MM/yyyy')} - ${day.incidents.length} incidente(s)` : 
                    format(day.date, 'dd/MM/yyyy')}
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
    </div>
  );
};

export default YearHeatMapCalendar;