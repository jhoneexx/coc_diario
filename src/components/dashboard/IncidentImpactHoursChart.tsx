import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface Incidente {
  tipo: { nome: string };
  duracao_minutos: number | null;
  criticidade: { 
    is_downtime: boolean;
  };
}

interface IncidentImpactHoursChartProps {
  incidentes: Incidente[];
  titulo?: string;
  apenasDowntime?: boolean;
}

const IncidentImpactHoursChart: React.FC<IncidentImpactHoursChartProps> = ({ 
  incidentes,
  titulo = "Horas de Impacto por Tipo de Incidente",
  apenasDowntime = true
}) => {
  // Processar dados para o gráfico
  const chartData = useMemo(() => {
    // Horas por tipo de incidente
    const tiposHoras: Record<string, number> = {};
    
    // Filtrar apenas incidentes resolvidos e, se for o caso, apenas downtime
    const incidentesFiltrados = incidentes.filter(inc => 
      inc.duracao_minutos !== null && 
      (!apenasDowntime || inc.criticidade.is_downtime)
    );
    
    incidentesFiltrados.forEach(inc => {
      const tipo = inc.tipo.nome;
      // Convertemos minutos para horas
      const horas = (inc.duracao_minutos || 0) / 60;
      tiposHoras[tipo] = (tiposHoras[tipo] || 0) + horas;
    });
    
    // Ordenar por horas (do maior para o menor)
    const sortedEntries = Object.entries(tiposHoras).sort((a, b) => b[1] - a[1]);
    
    // Converter para arrays para o gráfico
    const categories = sortedEntries.map(([tipo]) => tipo);
    const data = sortedEntries.map(([, horas]) => parseFloat(horas.toFixed(2)));
    
    return { categories, data };
  }, [incidentes, apenasDowntime]);

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
    colors: ['#ef4444', '#f97316', '#f59e0b', '#65a30d', '#0ea5e9', '#8b5cf6'],
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
          formatter: () => 'Horas'
        },
        formatter: (val) => `${val.toFixed(2)}h`
      }
    }
  };

  // Se não houver dados, mostrar mensagem
  if (chartData.categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500 text-sm">
          {apenasDowntime 
            ? "Sem dados de downtime para exibir" 
            : "Sem dados de incidentes resolvidos para exibir"}
        </p>
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

export default IncidentImpactHoursChart;