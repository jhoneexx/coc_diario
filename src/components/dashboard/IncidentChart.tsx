import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface Incidente {
  tipo: { nome: string };
  criticidade: { 
    nome: string;
    is_downtime: boolean;
  };
}

interface IncidentChartProps {
  incidentes: Incidente[];
}

const IncidentChart: React.FC<IncidentChartProps> = ({ incidentes }) => {
  // Processar dados para o gráfico
  const chartData = useMemo(() => {
    // Contagem por tipo de incidente
    const tiposCount: Record<string, number> = {};
    
    incidentes.forEach(inc => {
      const tipo = inc.tipo.nome;
      tiposCount[tipo] = (tiposCount[tipo] || 0) + 1;
    });
    
    // Converter para arrays para o gráfico
    const labels = Object.keys(tiposCount);
    const series = Object.values(tiposCount);
    
    return { labels, series };
  }, [incidentes]);

  // Configurações do gráfico
  const options: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'Inter, sans-serif',
      toolbar: {
        show: false
      }
    },
    labels: chartData.labels,
    colors: ['#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#f43f5e', '#a3a3a3'],
    legend: {
      position: 'bottom',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 500,
      fontSize: '12px',
      markers: {
        width: 10,
        height: 10,
        radius: 2
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              offsetY: -10
            },
            value: {
              show: true,
              fontSize: '16px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              color: undefined,
              offsetY: 0,
              formatter: (val) => `${val}`
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              color: '#64748b',
              formatter: (w) => {
                return `${w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)}`;
              }
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            height: 250
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    ]
  };

  // Se não houver dados, mostrar mensagem
  if (incidentes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Sem dados para exibir</p>
      </div>
    );
  }

  return (
    <div className="h-64 flex items-center justify-center">
      <Chart 
        options={options} 
        series={chartData.series} 
        type="donut" 
        height="100%" 
      />
    </div>
  );
};

export default IncidentChart;