import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { AlertTriangle, Clock, Calendar, TrendingUp, BarChart3, Download } from 'lucide-react';
import supabase from '../../lib/supabase';
import FilterBar from '../common/FilterBar';
import { calcularMTTR, calcularMTBF } from '../../utils/metricsCalculations';
import { exportReportToPDF } from '../../utils/exportReports';

// Tipos
interface Ambiente {
  id: number;
  nome: string;
}

interface Criticidade {
  id: number;
  nome: string;
  cor: string;
  is_downtime: boolean;
  peso: number;
}

interface Incidente {
  id: number;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  tipo: { nome: string };
  ambiente: { nome: string };
  segmento: { nome: string };
  criticidade: { 
    id: number;
    nome: string;
    cor: string;
    is_downtime: boolean;
  };
  descricao: string;
}

interface CriticidadeMetrics {
  criticidade_id: number;
  criticidade_nome: string;
  criticidade_cor: string;
  is_downtime: boolean;
  peso: number;
  total_incidentes: number;
  incidentes_resolvidos: number;
  mttr_horas: number;
  mtbf_horas: number;
  mtbf_dias: number;
  tempo_total_impacto_horas: number;
}

interface CriticidadeMetricsReportProps {
  filtroAmbiente?: number | null;
  periodo?: {
    inicio: string;
    fim: string;
  };
  showFilters?: boolean;
}

const CriticidadeMetricsReport: React.FC<CriticidadeMetricsReportProps> = ({ 
  filtroAmbiente: propsFiltroAmbiente,
  periodo: propsPeriodo,
  showFilters = true
}) => {
  const [loading, setLoading] = useState(true);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [criticidades, setCriticidades] = useState<Criticidade[]>([]);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [metricas, setMetricas] = useState<CriticidadeMetrics[]>([]);
  
  // Filtros internos - usados apenas se não forem fornecidos via props
  const [localFiltroAmbiente, setLocalFiltroAmbiente] = useState<number | null>(null);
  const [localFiltroPeriodo, setLocalFiltroPeriodo] = useState<{inicio: string, fim: string}>(() => {
    const hoje = new Date();
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    return {
      inicio: inicioAno.toISOString().split('T')[0],
      fim: hoje.toISOString().split('T')[0]
    };
  });
  
  // Usar filtros das props se fornecidos, caso contrário, usar filtros locais
  const filtroAmbiente = propsFiltroAmbiente !== undefined ? propsFiltroAmbiente : localFiltroAmbiente;
  const filtroPeriodo = propsPeriodo || localFiltroPeriodo;

  // Estado para controlar o progresso da exportação do PDF
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Carregar ambientes
        const { data: ambientesData } = await supabase
          .from('ambientes')
          .select('*')
          .order('nome');
        
        if (ambientesData) {
          setAmbientes(ambientesData);
        }
        
        // Carregar criticidades
        const { data: criticidadesData } = await supabase
          .from('criticidades')
          .select('*')
          .order('peso');
        
        if (criticidadesData) {
          setCriticidades(criticidadesData);
        }
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        toast.error('Erro ao carregar dados iniciais');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Carregar incidentes quando os filtros mudam
  useEffect(() => {
    const fetchIncidentes = async () => {
      setLoading(true);
      try {
        // Construir query
        let query = supabase
          .from('incidentes')
          .select(`
            *,
            tipo:tipos_incidente(nome),
            ambiente:ambientes(nome),
            segmento:segmentos(nome),
            criticidade:criticidades(id, nome, cor, is_downtime)
          `)
          .gte('inicio', filtroPeriodo.inicio)
          .lte('inicio', `${filtroPeriodo.fim}T23:59:59`);
        
        if (filtroAmbiente) {
          query = query.eq('ambiente_id', filtroAmbiente);
        }
        
        const { data, error } = await query.order('inicio', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
          setIncidentes(data);
        }
      } catch (error) {
        console.error('Erro ao carregar incidentes:', error);
        toast.error('Erro ao carregar incidentes');
      } finally {
        setLoading(false);
      }
    };
    
    fetchIncidentes();
  }, [filtroAmbiente, filtroPeriodo]);
  
  // Calcular métricas por criticidade
  useEffect(() => {
    if (criticidades.length === 0 || incidentes.length === 0) {
      setMetricas([]);
      return;
    }
    
    const metricasPorCriticidade: CriticidadeMetrics[] = criticidades.map(criticidade => {
      // Filtrar incidentes desta criticidade
      const incidentesDaCriticidade = incidentes.filter(inc => 
        inc.criticidade.id === criticidade.id
      );
      
      const incidentesResolvidos = incidentesDaCriticidade.filter(inc => inc.fim !== null);
      
      // Calcular MTTR e MTBF para esta criticidade (sem filtrar por downtime)
      const mttr = calcularMTTR(incidentesDaCriticidade, false);
      const mtbf = calcularMTBF(incidentesDaCriticidade, filtroPeriodo.inicio, filtroPeriodo.fim, false);
      
      // Calcular tempo total de impacto
      const tempoTotalImpacto = incidentesResolvidos.reduce((total, inc) => {
        return total + (inc.duracao_minutos || 0);
      }, 0) / 60; // Converter para horas
      
      return {
        criticidade_id: criticidade.id,
        criticidade_nome: criticidade.nome,
        criticidade_cor: criticidade.cor,
        is_downtime: criticidade.is_downtime,
        peso: criticidade.peso,
        total_incidentes: incidentesDaCriticidade.length,
        incidentes_resolvidos: incidentesResolvidos.length,
        mttr_horas: mttr,
        mtbf_horas: mtbf,
        mtbf_dias: mtbf / 24,
        tempo_total_impacto_horas: tempoTotalImpacto
      };
    });
    
    // Ordenar por peso (criticidade mais alta primeiro)
    metricasPorCriticidade.sort((a, b) => a.peso - b.peso);
    
    setMetricas(metricasPorCriticidade);
  }, [criticidades, incidentes, filtroPeriodo]);
  
  // Dados para gráfico de MTTR
  const mttrChartData = useMemo(() => {
    const data = metricas
      .filter(m => m.total_incidentes > 0 && m.mttr_horas > 0)
      .map(m => ({
        x: m.criticidade_nome,
        y: parseFloat(m.mttr_horas.toFixed(2)),
        fillColor: m.criticidade_cor
      }));
    
    return {
      series: [{
        name: 'MTTR (horas)',
        data: data
      }],
      categories: data.map(d => d.x)
    };
  }, [metricas]);
  
  // Dados para gráfico de MTBF
  const mtbfChartData = useMemo(() => {
    const data = metricas
      .filter(m => m.total_incidentes > 0 && m.mtbf_dias > 0)
      .map(m => ({
        x: m.criticidade_nome,
        y: parseFloat(m.mtbf_dias.toFixed(2)),
        fillColor: m.criticidade_cor
      }));
    
    return {
      series: [{
        name: 'MTBF (dias)',
        data: data
      }],
      categories: data.map(d => d.x)
    };
  }, [metricas]);
  
  // Configurações dos gráficos
  const chartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif'
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        distributed: true,
        columnWidth: '60%'
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => parseFloat(val.toString()).toFixed(2)
    },
    legend: { show: false },
    grid: {
      borderColor: '#f3f4f6',
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } }
    },
    xaxis: {
      labels: {
        style: {
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif'
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
      theme: 'light'
    }
  };
  
  // Função para exportar para PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      // Preparar dados para o relatório
      const ambienteFiltrado = filtroAmbiente 
        ? ambientes.find(a => a.id === filtroAmbiente)?.nome || 'Ambiente Selecionado'
        : 'Todos os Ambientes';
      
      // Preparar métricas para o relatório
      const metricasParaRelatorio = metricas.map(m => ({
        ambiente_id: m.criticidade_id,
        ambiente_nome: m.criticidade_nome,
        mttr: m.mttr_horas,
        mtbf: m.mtbf_horas,
        disponibilidade: 100, // Valor fictício para o relatório
        incidentes_total: m.total_incidentes,
        incidentes_criticos: m.incidentes_resolvidos,
        meta_mttr: null,
        meta_mtbf: null,
        meta_disponibilidade: null
      }));
      
      await exportReportToPDF({
        incidentes,
        metricas: metricasParaRelatorio,
        filtroPeriodo,
        filtroAmbiente,
        ambienteFiltrado,
        onProgress: (progress) => setExportProgress(progress)
      });
      
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao exportar relatório');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
        {showFilters && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Métricas por Criticidade</h2>
            <p className="text-sm text-gray-500 mt-1">
              Análise de MTTR e MTBF segmentada por nível de criticidade dos incidentes
            </p>
          </div>
        )}
      </div>
      
      {/* Filtros */}
      {showFilters && (
        <FilterBar 
          ambientes={ambientes}
          filtroAmbiente={localFiltroAmbiente}
          filtroPeriodo={localFiltroPeriodo}
          setFiltroAmbiente={setLocalFiltroAmbiente}
          setFiltroPeriodo={setLocalFiltroPeriodo}
        />
      )}
      
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {incidentes.length}
              </p>
              <p className="text-sm text-gray-600">Total de Incidentes</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {metricas.reduce((sum, m) => sum + m.incidentes_resolvidos, 0)}
              </p>
              <p className="text-sm text-gray-600">Incidentes Resolvidos</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {metricas.reduce((sum, m) => sum + m.tempo_total_impacto_horas, 0).toFixed(1)}h
              </p>
              <p className="text-sm text-gray-600">Tempo Total de Impacto</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {criticidades.length}
              </p>
              <p className="text-sm text-gray-600">Níveis de Criticidade</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Botão de exportação */}
      {!showFilters && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleExportPDF}
            disabled={isExporting || loading || metricas.length === 0}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? `Exportando... ${exportProgress.toFixed(0)}%` : 'Exportar PDF'}
          </button>
        </div>
      )}
      
      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">MTTR por Criticidade</h3>
          {mttrChartData.series[0].data.length > 0 ? (
            <Chart 
              options={{
                ...chartOptions,
                colors: mttrChartData.series[0].data.map(d => d.fillColor),
                yaxis: {
                  ...chartOptions.yaxis,
                  title: { text: 'Horas' }
                }
              }} 
              series={mttrChartData.series} 
              type="bar" 
              height={300} 
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Sem dados para exibir
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">MTBF por Criticidade</h3>
          {mtbfChartData.series[0].data.length > 0 ? (
            <Chart 
              options={{
                ...chartOptions,
                colors: mtbfChartData.series[0].data.map(d => d.fillColor),
                yaxis: {
                  ...chartOptions.yaxis,
                  title: { text: 'Dias' }
                }
              }} 
              series={mtbfChartData.series} 
              type="bar" 
              height={300} 
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Sem dados para exibir
            </div>
          )}
        </div>
      </div>
      
      {/* Tabela Detalhada */}
      <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Detalhamento por Criticidade</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criticidade
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Incidentes
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resolvidos
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MTTR (horas)
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MTBF (dias)
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tempo Total Impacto
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gera Downtime
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    Carregando dados...
                  </td>
                </tr>
              ) : metricas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    Nenhum dado encontrado para o período selecionado
                  </td>
                </tr>
              ) : (
                metricas.map((metrica) => (
                  <tr key={metrica.criticidade_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div 
                          className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full"
                          style={{ backgroundColor: `${metrica.criticidade_cor}20`, color: metrica.criticidade_cor }}
                        >
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {metrica.criticidade_nome}
                          </div>
                          <div className="text-xs text-gray-500">
                            Peso: {metrica.peso}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metrica.total_incidentes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metrica.incidentes_resolvidos}
                      {metrica.total_incidentes > 0 && (
                        <div className="text-xs text-gray-500">
                          ({((metrica.incidentes_resolvidos / metrica.total_incidentes) * 100).toFixed(1)}%)
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metrica.mttr_horas > 0 ? metrica.mttr_horas.toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metrica.mtbf_dias > 0 ? metrica.mtbf_dias.toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metrica.tempo_total_impacto_horas.toFixed(1)}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        metrica.is_downtime 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {metrica.is_downtime ? 'Sim' : 'Não'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CriticidadeMetricsReport;