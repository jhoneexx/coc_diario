import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
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

const HeatMapCalendar: React.FC<HeatMapProps> = ({ incidentes, periodo }) => {
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
                  ${!isValidDay ? 'opacity-0 pointer-events-none' : ''}
                `}
                title={day.incidents.length > 0 ? 
                  `${format(day.date, 'dd/MM/yyyy')}
Incidentes: ${day.incidents.map(inc => `#${inc.id}`).join(', ')}` : 
                  format(day.date, 'dd/MM/yyyy')
                }
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
    </div>
  );
};

export default HeatMapCalendar;