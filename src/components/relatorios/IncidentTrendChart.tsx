import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { parseISO, format, eachDayOfInterval, eachMonthOfInterval, isWithinInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Incidente {
  id: number;
  inicio: string;
  tipo: { nome: string };
  criticidade: { 
    is_downtime: boolean;
  };
}

interface IncidentTrendChartProps {
  incidentes: Incidente[];
  periodo: {
    inicio: string;
    fim: string;
  };
  agrupamento?: 'dia' | 'mes';
  titulo?: string;
}

const IncidentTrendChart: React.FC<IncidentTrendChartProps> = ({ 
  incidentes,
  periodo,
  agrupamento = 'dia',
  titulo = "Tendência de Incidentes"
}) => {
  // Organizar os incidentes por período (dia ou mês)
  const chartData = useMemo(() => {
    const dataInicio = parseISO(periodo.inicio);
    const dataFim = parseISO(periodo.fim);
    
    // Determinar se devemos agrupar por mês baseado no intervalo
    const intervaloPeriodo = dataFim.getTime() - dataInicio.getTime();
    const forcarAgrupamentoPorMes = intervaloPeriodo > 1000 * 60 * 60 * 24 * 60; // 60 dias ou mais
    const tipoAgrupamento = forcarAgrupamentoPorMes ? 'mes' : agrupamento;
    
    let categories: string[] = [];
    let incidentesPorPeriodo: Record<string, number> = {};
    let incidentesCriticosPorPeriodo: Record<string, number> = {};
    
    if (tipoAgrupamento === 'mes') {
      // Para garantir pelo menos 6 meses no gráfico, mesmo se o período for menor
      const inicioAjustado = subMonths(dataFim, 5);
      const inicioFinal = inicioAjustado < dataInicio ? inicioAjustado : dataInicio;
      
      const meses = eachMonthOfInterval({ start: inicioFinal, end: dataFim });
      categories = meses.map(mes => format(mes, 'MMM/yyyy', { locale: ptBR }));
      
      // Inicializar contadores
      categories.forEach(mes => {
        incidentesPorPeriodo[mes] = 0;
        incidentesCriticosPorPeriodo[mes] = 0;
      });
      
      // Contar incidentes por mês
      incidentes.forEach(inc => {
        const dataInc = parseISO(inc.inicio);
        const mesStr = format(dataInc, 'MMM/yyyy', { locale: ptBR });
        
        // Verificar se o mês está em nossa lista de categorias (pode não estar se for um período grande)
        if (categories.includes(mesStr)) {
          incidentesPorPeriodo[mesStr]++;
          
          if (inc.criticidade.is_downtime) {
            incidentesCriticosPorPeriodo[mesStr]++;
          }
        }
      });
    } else {
      // Agrupar por dia
      const dias = eachDayOfInterval({ start: dataInicio, end: dataFim });
      categories = dias.map(dia => format(dia, 'dd/MM', { locale: ptBR }));
      
      // Inicializar contadores
      categories.forEach(dia => {
        incidentesPorPeriodo[dia] = 0;
        incidentesCriticosPorPeriodo[dia] = 0;
      });
      
      // Contar incidentes por dia
      incidentes.forEach(inc => {
        const dataInc = parseISO(inc.inicio);
        const diaStr = format(dataInc, 'dd/MM', { locale: ptBR });
        
        if (isWithinInterval(dataInc, { start: dataInicio, end: dataFim })) {
          incidentesPorPeriodo[diaStr]++;
          
          if (inc.criticidade.is_downtime) {
            incidentesCriticosPorPeriodo[diaStr]++;
          }
        }
      });
    }
    
    return {
      categories,
      series: [
        {
          name: 'Total',
          data: categories.map(cat => incidentesPorPeriodo[cat] || 0)
        },
        {
          name: 'Críticos',
          data: categories.map(cat => incidentesCriticosPorPeriodo[cat] || 0)
        }
      ],
      tipoAgrupamento
    };
  }, [incidentes, periodo, agrupamento]);

  // Configurações do gráfico
  const options: ApexOptions = {
    chart: {
      type: 'line',
      toolbar: {
        show: true
      },
      fontFamily: 'Inter, sans-serif'
    },
    stroke: {
      width: [3, 3],
      curve: 'smooth'
    },
    colors: ['#3b82f6', '#ef4444'],
    dataLabels: {
      enabled: false
    },
    markers: {
      size: 4,
      strokeWidth: 0,
      hover: {
        size: 6
      }
    },
    xaxis: {
      categories: chartData.categories,
      labels: {
        style: {
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      title: {
        text: 'Número de Incidentes',
        style: {
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif'
        }
      },
      min: 0,
      labels: {
        style: {
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif'
        }
      }
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: function (val) {
          return val.toFixed(0);
        }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 500,
      itemMargin: {
        horizontal: 10,
        vertical: 0
      }
    },
    grid: {
      borderColor: '#f1f1f1',
    }
  };

  // Se não houver dados, mostrar mensagem
  if (incidentes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72">
        <p className="text-gray-500 text-sm">Sem dados para exibir</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {titulo} ({chartData.tipoAgrupamento === 'mes' ? 'Mensal' : 'Diário'})
      </h3>
      <div className="h-72">
        <Chart 
          options={options} 
          series={chartData.series} 
          type="line" 
          height="100%" 
        />
      </div>
    </div>
  );
};

export default IncidentTrendChart;