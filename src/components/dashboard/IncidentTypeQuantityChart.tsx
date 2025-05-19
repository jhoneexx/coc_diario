import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface Incidente {
  tipo: { nome: string };
}

interface IncidentTypeQuantityChartProps {
  incidentes: Incidente[];
  titulo?: string;
}

const IncidentTypeQuantityChart: React.FC<IncidentTypeQuantityChartProps> = ({ 
  incidentes,
  titulo = "Quantidade por Tipo de Incidente"
}) => {
  // Processar dados para o gráfico
  const chartData = useMemo(() => {
    // Contagem por tipo de incidente
    const tiposCount: Record<string, number> = {};
    
    incidentes.forEach(inc => {
      const tipo = inc.tipo.nome;
      tiposCount[tipo] = (tiposCount[tipo] || 0) + 1;
    });
    
    // Ordenar por quantidade (do maior para o menor)
    const sortedEntries = Object.entries(tiposCount).sort((a, b) => b[1] - a[1]);
    
    // Converter para arrays para o gráfico
    const categories = sortedEntries.map(([tipo]) => tipo);
    const data = sortedEntries.map(([, count]) => count);
    
    return { categories, data };
  }, [incidentes]);

  // Configurações do gráfico
  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: {
        show: false
      },
      fontFamily: 'Inter, sans-serif',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '70%',
        distributed: true
      }
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: chartData.categories,
      labels: {
        style: {
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif'
        }
      }
    },
    colors: ['#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#f43f5e', '#a3a3a3'],
    legend: {
      show: false
    },
    grid: {
      borderColor: '#f3f4f6',
      xaxis: {
        lines: {
          show: false
        }
      }
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif'
        }
      }
    },
    tooltip: {
      theme: 'light',
      y: {
        title: {
          formatter: () => 'Quantidade'
        }
      }
    }
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
    <div className="h-64">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{titulo}</h3>
      <Chart 
        options={options} 
        series={[{ data: chartData.data }]} 
        type="bar" 
        height="90%" 
      />
    </div>
  );
};

export default IncidentTypeQuantityChart;