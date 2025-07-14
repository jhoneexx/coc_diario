import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FileText, Download, BarChart2, PieChart, Clock1, Layers, ListFilter, Award } from 'lucide-react';
import { BarChart3, Download, FileText, Filter, PieChart, AlertTriangle } from 'lucide-react';
import { ApexOptions } from 'apexcharts';
import supabase from '../lib/supabase';
import FilterBar from '../components/common/FilterBar';
import { exportReportToExcel, exportReportToPDF } from '../utils/exportReports';
import DetailedReportTable from '../components/relatorios/DetailedReportTable';
import CriticidadeMetricsReport from '../components/relatorios/CriticidadeMetricsReport';
import IncidentTypeQuantityChart from '../components/dashboard/IncidentTypeQuantityChart';
import IncidentImpactHoursChart from '../components/dashboard/IncidentImpactHoursChart';
import IncidentTrendChart from '../components/relatorios/IncidentTrendChart';
import { calcularMTTR, calcularMTBF, calcularDisponibilidade } from '../utils/metricsCalculations';

// Tipos
interface Ambiente {
  id: number;
  nome: string;
}

interface Meta {
  ambiente_id: number;
  mttr_meta: number;
  mtbf_meta: number;
  disponibilidade_meta: number;
  peso_percentual: number;
  mttr_permite_superacao: boolean;
  mtbf_permite_superacao: boolean;
}

interface Incidente {
  id: number;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  tipo_id: number;
  tipo: { nome: string };
  ambiente_id: number;
  ambiente: { nome: string };
  segmento_id: number;
  segmento: { nome: string };
  criticidade_id: number;
  criticidade: { 
    nome: string;
    cor: string;
    is_downtime: boolean;
  };
  descricao: string;
  acoes_tomadas: string | null;
  criado_por: string;
}

interface MetricsData {
  ambiente_id: number;
  ambiente_nome: string;
  mttr: number;
  mtbf: number;
  disponibilidade: number;
  incidentes_total: number;
  incidentes_criticos: number;
  meta_mttr: number | null;
  meta_mtbf: number | null;
  meta_disponibilidade: number | null;
  peso_percentual: number | null;
  mttr_permite_superacao: boolean | null;
  mtbf_permite_superacao: boolean | null;
  mttr_percentual: number;
  mtbf_percentual: number;
  disponibilidade_percentual: number;
}

const Relatorios: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [metricas, setMetricas] = useState<MetricsData[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  // Filtros
  const [filtroAmbiente, setFiltroAmbiente] = useState<number | null>(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState<{inicio: string, fim: string}>({
    inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fim: new Date().toISOString().split('T')[0]
  });
  
  // Visualização ativa
  const [activeView, setActiveView] = useState<'metricas' | 'tiposIncidente' | 'historico' | 'detalhado' | 'impacto' | 'metas' | 'criticidade'>('metricas');

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
        
        // Carregar metas
        const { data: metasData } = await supabase
          .from('metas')
          .select('*');
        
        if (metasData) {
          setMetas(metasData);
        }
        
        // Os incidentes e métricas serão carregados em outro useEffect que depende dos filtros
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        toast.error('Erro ao carregar dados para relatórios');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Efeito para carregar dados filtrados
  useEffect(() => {
    const fetchDataFiltrada = async () => {
      setLoading(true);
      try {
        // Construir query base para incidentes
        let query = supabase
          .from('incidentes')
          .select(`
            *,
            tipo:tipos_incidente(nome),
            ambiente:ambientes(nome),
            segmento:segmentos(nome),
            criticidade:criticidades(nome, cor, is_downtime)
          `)
          .gte('inicio', filtroPeriodo.inicio)
          .lte('inicio', `${filtroPeriodo.fim}T23:59:59`);
        
        // Adicionar filtro de ambiente se especificado
        if (filtroAmbiente) {
          query = query.eq('ambiente_id', filtroAmbiente);
        }
        
        const { data: incidentesData, error } = await query.order('inicio', { ascending: false });
        
        if (error) throw error;
        
        if (incidentesData) {
          setIncidentes(incidentesData);
          
          // Determinar todos os ambientes relevantes para calcular métricas
          let ambientesParaProcessar: number[] = [];
          
          if (filtroAmbiente) {
            // Se um ambiente está selecionado, calculamos apenas para ele
            ambientesParaProcessar = [filtroAmbiente];
          } else {
            // Caso contrário, para todos os ambientes que têm incidentes no período
            const uniqueAmbientes = new Set<number>();
            incidentesData.forEach(inc => uniqueAmbientes.add(inc.ambiente_id));
            
            // Também incluímos todos os ambientes com metas configuradas
            metas.forEach(m => uniqueAmbientes.add(m.ambiente_id));
            
            ambientesParaProcessar = Array.from(uniqueAmbientes);
          }
          
          // Calcular métricas para cada ambiente
          const metricasData: MetricsData[] = [];
          
          for (const ambId of ambientesParaProcessar) {
            // Filtrar incidentes deste ambiente
            const incidentesDoAmbiente = incidentesData.filter(inc => inc.ambiente_id === ambId);
            
            // Contar incidentes críticos
            const incidentesCriticos = incidentesDoAmbiente.filter(inc => inc.criticidade.is_downtime).length;
            
            // Buscar nome do ambiente
            const nomeAmbiente = incidentesDoAmbiente.length > 0 
              ? incidentesDoAmbiente[0].ambiente.nome
              : ambientes.find(a => a.id === ambId)?.nome || `Ambiente ${ambId}`;
            
            // Calcular métricas
            const mttr = calcularMTTR(incidentesDoAmbiente, true);
            const mtbf = calcularMTBF(incidentesDoAmbiente, filtroPeriodo.inicio, filtroPeriodo.fim, true);
            const disponibilidade = calcularDisponibilidade(incidentesDoAmbiente, filtroPeriodo.inicio, filtroPeriodo.fim);
            
            // Buscar metas do ambiente
            const meta = metas.find(m => m.ambiente_id === ambId);

            // Calcular percentuais de atingimento das metas
            let mttrPercentual = 0;
            let mtbfPercentual = 0;
            let disponibilidadePercentual = 0;
            
            if (meta) {
              // MTTR (menor é melhor)
              mttrPercentual = mttr > 0 ? 100 * (meta.mttr_meta / mttr) : 100;
              if (!meta.mttr_permite_superacao) {
                mttrPercentual = Math.min(100, mttrPercentual);
              }
              
              // MTBF (maior é melhor)
              mtbfPercentual = meta.mtbf_meta > 0 ? 100 * (mtbf / meta.mtbf_meta) : 0;
              if (!meta.mtbf_permite_superacao) {
                mtbfPercentual = Math.min(100, mtbfPercentual);
              }
              
              // Disponibilidade (sempre limitado a 100%)
              disponibilidadePercentual = meta.disponibilidade_meta > 0 
                ? Math.min(100, 100 * (disponibilidade / meta.disponibilidade_meta)) 
                : 0;
            }
            
            metricasData.push({
              ambiente_id: ambId,
              ambiente_nome: nomeAmbiente,
              mttr: mttr,
              mtbf: mtbf,
              disponibilidade: disponibilidade,
              incidentes_total: incidentesDoAmbiente.length,
              incidentes_criticos: incidentesCriticos,
              meta_mttr: meta?.mttr_meta || null,
              meta_mtbf: meta?.mtbf_meta || null,
              meta_disponibilidade: meta?.disponibilidade_meta || null,
              peso_percentual: meta?.peso_percentual || null,
              mttr_permite_superacao: meta?.mttr_permite_superacao || null,
              mtbf_permite_superacao: meta?.mtbf_permite_superacao || null,
              mttr_percentual: mttrPercentual,
              mtbf_percentual: mtbfPercentual,
              disponibilidade_percentual: disponibilidadePercentual
            });
          }
          
          setMetricas(metricasData);
        }
      } catch (error) {
        console.error('Erro ao carregar dados filtrados:', error);
        toast.error('Erro ao processar métricas para relatório');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDataFiltrada();
  }, [filtroAmbiente, filtroPeriodo, metas, ambientes]);
  
  // Calcular atingimento geral das metas (ponderado pelo peso percentual)
  const calcularAtingimentoGeral = (tipoMetrica: 'mttr' | 'mtbf' | 'disponibilidade') => {
    if (metricas.length === 0) return 0;
    
    const metricasComPeso = metricas.filter(m => m.peso_percentual !== null);
    if (metricasComPeso.length === 0) return 0;
    
    const totalPercentual = metricasComPeso.reduce((sum, m) => sum + (m.peso_percentual || 0), 0);
    if (totalPercentual <= 0) return 0;
    
    const somaPonderada = metricasComPeso.reduce((sum, m) => {
      let percentual;
      
      switch (tipoMetrica) {
        case 'mttr':
          percentual = m.mttr_percentual;
          break;
        case 'mtbf':
          percentual = m.mtbf_percentual;
          break;
        case 'disponibilidade':
          percentual = m.disponibilidade_percentual;
          break;
      }
      
      return sum + (percentual * (m.peso_percentual || 0) / totalPercentual);
    }, 0);
    
    return somaPonderada;
  };
  
  // Dados para o gráfico de tipos de incidente
  const tiposIncidenteChartData = React.useMemo(() => {
    const countByType: Record<string, number> = {};
    
    incidentes.forEach(inc => {
      const tipo = inc.tipo.nome;
      countByType[tipo] = (countByType[tipo] || 0) + 1;
    });
    
    return {
      labels: Object.keys(countByType),
      series: Object.values(countByType)
    };
  }, [incidentes]);
  
  // Dados para o gráfico de histórico mensal
  const historicoChartData = React.useMemo(() => {
    // Criar um mapa de datas (usando apenas o dia) para contagem de incidentes
    const incidentesPorDia: Record<string, number> = {};
    const incidentesCriticosPorDia: Record<string, number> = {};
    
    // Preencher todos os dias do intervalo
    const inicio = new Date(filtroPeriodo.inicio);
    const fim = new Date(filtroPeriodo.fim);
    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      const dataStr = d.toISOString().split('T')[0];
      incidentesPorDia[dataStr] = 0;
      incidentesCriticosPorDia[dataStr] = 0;
    }
    
    // Contar incidentes por dia
    incidentes.forEach(inc => {
      const dataStr = new Date(inc.inicio).toISOString().split('T')[0];
      incidentesPorDia[dataStr] = (incidentesPorDia[dataStr] || 0) + 1;
      
      if (inc.criticidade.is_downtime) {
        incidentesCriticosPorDia[dataStr] = (incidentesCriticosPorDia[dataStr] || 0) + 1;
      }
    });
    
    // Converter para arrays para o gráfico
    const categories = Object.keys(incidentesPorDia).sort();
    const seriesTotal = categories.map(date => incidentesPorDia[date]);
    const seriesCriticos = categories.map(date => incidentesCriticosPorDia[date]);
    
    return {
      categories,
      series: [
        {
          name: 'Total de Incidentes',
          data: seriesTotal
        },
        {
          name: 'Incidentes Críticos',
          data: seriesCriticos
        }
      ]
    };
  }, [incidentes, filtroPeriodo]);
  
  // Configuração do gráfico de tipos de incidente
  const tiposIncidenteChartOptions: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'Inter, sans-serif',
    },
    labels: tiposIncidenteChartData.labels,
    colors: ['#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#f43f5e', '#a3a3a3'],
    legend: {
      position: 'bottom',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 500,
      fontSize: '12px',
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              color: '#64748b',
            }
          }
        }
      }
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            height: 300
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    ]
  };
  
  // Configuração do gráfico de histórico
  const historicoChartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      fontFamily: 'Inter, sans-serif',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '80%',
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    xaxis: {
      categories: historicoChartData.categories,
      labels: {
        rotate: -45,
        style: {
          fontFamily: 'Inter, sans-serif'
        }
      }
    },
    yaxis: {
      title: {
        text: 'Número de Incidentes',
        style: {
          fontFamily: 'Inter, sans-serif'
        }
      }
    },
    colors: ['#3b82f6', '#f43f5e'],
    fill: {
      opacity: 1
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return `${val} incidentes`;
        }
      }
    },
    legend: {
      position: 'top',
      fontFamily: 'Inter, sans-serif',
    }
  };
  
  // Exportar para Excel
  const handleExportExcel = () => {
    try {
      exportReportToExcel({
        incidentes,
        metricas,
        filtroPeriodo,
        filtroAmbiente,
        ambienteFiltrado: filtroAmbiente 
          ? ambientes.find(a => a.id === filtroAmbiente)?.nome || 'Ambiente Selecionado'
          : 'Todos'
      });
      
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao exportar relatório para Excel');
    }
  };
  
  // Exportar para PDF
  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      setExportProgress(0);

      exportReportToPDF({
        incidentes,
        metricas,
        filtroPeriodo,
        filtroAmbiente,
        ambienteFiltrado: filtroAmbiente
          ? ambientes.find(a => a.id === filtroAmbiente)?.nome || 'Ambiente Selecionado' 
          : 'Todos',
        onProgress: (progress) => {
          setExportProgress(progress);
        }
      });
      
      toast.success('Relatório PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar relatório PDF:', error);
      toast.error('Erro ao exportar relatório para PDF');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualize e exporte métricas e estatísticas do sistema
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex space-x-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={loading || incidentes.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </button>
          
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={loading || incidentes.length === 0 || isExporting}
          >
            <FileText className="mr-2 h-4 w-4" />
            {isExporting ? `Exportando (${exportProgress}%)` : 'Exportar PDF'}
          </button>
        </div>
      </div>
      
      {/* Filtros */}
      <FilterBar 
        ambientes={ambientes}
        filtroAmbiente={filtroAmbiente}
        filtroPeriodo={filtroPeriodo}
        setFiltroAmbiente={setFiltroAmbiente}
        setFiltroPeriodo={setFiltroPeriodo}
      />
      
      {/* Tabs */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap overflow-x-auto">
            <button
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeView === 'metricas'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveView('metricas')}
            >
              <BarChart2 className="inline-block h-4 w-4 mr-2" />
              Métricas
            </button>
            
            <button
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeView === 'tiposIncidente'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveView('tiposIncidente')}
            >
              <PieChart className="inline-block h-4 w-4 mr-2" />
              Tipos de Incidente
            </button>
            
            <button
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeView === 'historico'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveView('historico')}
            >
              <Clock1 className="inline-block h-4 w-4 mr-2" />
              Tendência
            </button>
            
            <button
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeView === 'impacto'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveView('impacto')}
            >
              <Layers className="inline-block h-4 w-4 mr-2" />
              Análise de Impacto
            </button>
            
            <button
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeView === 'metas'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveView('metas')}
            >
              <Award className="inline-block h-4 w-4 mr-2" />
              Metas
            </button>
            
            <button
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeView === 'detalhado'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveView('detalhado')}
            >
              <ListFilter className="inline-block h-4 w-4 mr-2" />
              Detalhado
            </button>
            
            <button
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeView === 'criticidade'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveView('criticidade')}
            >
              <AlertTriangle className="inline-block h-4 w-4 mr-2" />
              Por Criticidade
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-pulse flex space-x-4 justify-center">
                <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
                <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
                <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
              </div>
              <p className="text-sm text-gray-500 mt-4">Carregando dados do relatório...</p>
            </div>
          ) : incidentes.length === 0 && activeView !== 'metas' ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Sem dados para exibir</h3>
              <p className="mt-1 text-sm text-gray-500">
                Nenhum incidente encontrado para os filtros selecionados.
              </p>
            </div>
          ) : (
            <>
              {/* View: Métricas */}
              {activeView === 'metricas' && (
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-6">
                    Métricas de Performance e Disponibilidade
                  </h2>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ambiente
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Incidentes
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Críticos
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            MTTR (h)
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Meta MTTR
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ating. MTTR (%)
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            MTBF (dias)
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Meta MTBF
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ating. MTBF (%)
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Disponibilidade
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Meta Disp.
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ating. Disp. (%)
                          </th>
                        </tr>
                      </thead>
                      
                      <tbody className="bg-white divide-y divide-gray-200">
                        {metricas.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="px-6 py-4 text-center text-sm text-gray-500">
                              Sem dados para exibir
                            </td>
                          </tr>
                        ) : (
                          metricas.map((metrica, index) => (
                            <tr key={metrica.ambiente_id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {metrica.ambiente_nome}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {metrica.incidentes_total}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {metrica.incidentes_criticos}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                                metrica.meta_mttr && metrica.mttr <= metrica.meta_mttr
                                  ? 'text-green-600 font-medium'
                                  : 'text-red-600 font-medium'
                              }`}>
                                {metrica.mttr.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {metrica.meta_mttr ? metrica.meta_mttr.toFixed(2) : '-'}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                                metrica.mttr_percentual >= 95 ? 'text-green-600 font-medium' :
                                metrica.mttr_percentual >= 80 ? 'text-blue-600 font-medium' :
                                'text-red-600 font-medium'
                              }`}>
                                {metrica.mttr_percentual.toFixed(1)}%
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                                metrica.meta_mtbf && (metrica.mtbf / 24) >= (metrica.meta_mtbf / 24)
                                  
                                  ? 'text-green-600 font-medium'
                                  : 'text-red-600 font-medium'
                              }`}>
                                {(metrica.mtbf / 24).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {metrica.meta_mtbf ? (metrica.meta_mtbf / 24).toFixed(2) : '-'}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                                metrica.mtbf_percentual >= 95 ? 'text-green-600 font-medium' :
                                metrica.mtbf_percentual >= 80 ? 'text-blue-600 font-medium' :
                                'text-red-600 font-medium'
                              }`}>
                                {metrica.mtbf_percentual.toFixed(1)}%
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                                metrica.meta_disponibilidade && metrica.disponibilidade >= metrica.meta_disponibilidade
                                  ? 'text-green-600 font-medium'
                                  : 'text-red-600 font-medium'
                              }`}>
                                {metrica.disponibilidade.toFixed(3)}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {metrica.meta_disponibilidade ? `${metrica.meta_disponibilidade.toFixed(3)}%` : '-'}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                                metrica.disponibilidade_percentual >= 95 ? 'text-green-600 font-medium' :
                                metrica.disponibilidade_percentual >= 80 ? 'text-blue-600 font-medium' :
                                'text-red-600 font-medium'
                              }`}>
                                {metrica.disponibilidade_percentual.toFixed(1)}%
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* View: Tipos de Incidente */}
              {activeView === 'tiposIncidente' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-medium text-gray-900">
                    Análise por Tipo de Incidente
                  </h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-gray-200">
                        <h3 className="text-md font-medium text-gray-900">Distribuição por Tipo</h3>
                      </div>
                      <div className="p-4 h-80">
                        <Chart 
                          options={tiposIncidenteChartOptions} 
                          series={tiposIncidenteChartData.series} 
                          type="donut" 
                          height="100%" 
                        />
                      </div>
                    </div>
                    
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-gray-200">
                        <h3 className="text-md font-medium text-gray-900">Quantidade por Tipo</h3>
                      </div>
                      <div className="p-4 h-80">
                        <IncidentTypeQuantityChart incidentes={incidentes} titulo="" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* View: Histórico */}
              {activeView === 'historico' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-medium text-gray-900">
                    Tendência de Incidentes ao Longo do Tempo
                  </h2>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <IncidentTrendChart 
                      incidentes={incidentes}
                      periodo={filtroPeriodo}
                      agrupamento="dia"
                      titulo="Tendência de Incidentes"
                    />
                    
                    {/* Gráfico de barras histórico (existente) */}
                    <div className="bg-white rounded-lg shadow p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Histórico de Incidentes por Dia</h3>
                      <div className="h-80">
                        <Chart 
                          options={historicoChartOptions} 
                          series={historicoChartData.series} 
                          type="bar" 
                          height="100%" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* View: Análise de Impacto */}
              {activeView === 'impacto' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-medium text-gray-900">
                    Análise de Impacto
                  </h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-gray-200">
                        <h3 className="text-md font-medium text-gray-900">Horas de Impacto por Tipo</h3>
                      </div>
                      <div className="p-4 h-80">
                        <IncidentImpactHoursChart 
                          incidentes={incidentes}
                          titulo=""
                          apenasDowntime={false}
                        />
                      </div>
                    </div>
                    
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-gray-200">
                        <h3 className="text-md font-medium text-gray-900">Horas de Downtime por Tipo</h3>
                      </div>
                      <div className="p-4 h-80">
                        <IncidentImpactHoursChart 
                          incidentes={incidentes}
                          titulo=""
                          apenasDowntime={true}
                        />
                      </div>
                    </div>
                    
                    <div className="lg:col-span-2 bg-white shadow rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-gray-200">
                        <h3 className="text-md font-medium text-gray-900">Métricas de Impacto por Ambiente</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Ambiente
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Incidentes
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Incidentes Críticos
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                % de Criticidade
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Disponibilidade
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {metricas.map((metrica) => (
                              <tr key={metrica.ambiente_id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {metrica.ambiente_nome}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {metrica.incidentes_total}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {metrica.incidentes_criticos}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {metrica.incidentes_total ? 
                                    ((metrica.incidentes_criticos / metrica.incidentes_total) * 100).toFixed(1) + '%' 
                                    : '0%'}
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                                  metrica.meta_disponibilidade && metrica.disponibilidade >= metrica.meta_disponibilidade
                                    ? 'text-green-600 font-medium'
                                    : 'text-red-600 font-medium'
                                }`}>
                                  {metrica.disponibilidade.toFixed(3)}%
                                  {metrica.meta_disponibilidade ? 
                                    ` (Meta: ${metrica.meta_disponibilidade.toFixed(3)}%)` 
                                    : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* View: Metas */}
              {activeView === 'metas' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    Atingimento de Metas
                  </h2>
                  
                  <div className="mb-6">
                    <div className="flex items-center mb-4">
                      <span className="text-gray-600 text-sm">
                        {filtroAmbiente ? `Ambiente: ${metricas.find(m => m.ambiente_id === filtroAmbiente)?.ambiente_nome || 'Selecionado'}` : 'Todos os ambientes'}
                      </span>
                      <span className="mx-2 text-gray-400">•</span>
                      <span className="text-gray-600 text-sm">
                        Período: {new Date(filtroPeriodo.inicio).toLocaleDateString('pt-BR')} a {new Date(filtroPeriodo.fim).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      {/* MTTR */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h4 className="text-md font-medium text-gray-900 mb-2">
                          MTTR - Atingimento Global
                        </h4>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {calcularAtingimentoGeral('mttr').toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500">Meta ponderada</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className={`h-2.5 rounded-full ${
                              calcularAtingimentoGeral('mttr') >= 90 ? 'bg-green-500' : 
                              calcularAtingimentoGeral('mttr') >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, calcularAtingimentoGeral('mttr'))}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* MTBF */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h4 className="text-md font-medium text-gray-900 mb-2">
                          MTBF - Atingimento Global
                        </h4>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {calcularAtingimentoGeral('mtbf').toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500">Meta ponderada</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className={`h-2.5 rounded-full ${
                              calcularAtingimentoGeral('mtbf') >= 90 ? 'bg-green-500' : 
                              calcularAtingimentoGeral('mtbf') >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, calcularAtingimentoGeral('mtbf'))}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Disponibilidade */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h4 className="text-md font-medium text-gray-900 mb-2">
                          Disponibilidade - Atingimento Global
                        </h4>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {calcularAtingimentoGeral('disponibilidade').toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500">Meta ponderada</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className={`h-2.5 rounded-full ${
                              calcularAtingimentoGeral('disponibilidade') >= 90 ? 'bg-green-500' : 
                              calcularAtingimentoGeral('disponibilidade') >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, calcularAtingimentoGeral('disponibilidade'))}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Cards de métricas por ambiente */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {metricas.filter(m => m.meta_mttr !== null).map(metrica => (
                      <div key={metrica.ambiente_id} className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                          <div>
                            <h3 className="font-medium text-gray-900">{metrica.ambiente_nome}</h3>
                            {metrica.peso_percentual !== null && (
                              <span className="text-xs text-gray-500">
                                Peso na meta global: {metrica.peso_percentual}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-4 space-y-4">
                          {/* MTTR */}
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">MTTR</span>
                              <div className="text-sm">
                                <span className={metrica.mttr <= (metrica.meta_mttr || 0) ? "text-green-600" : "text-red-600"}>
                                  {metrica.mttr.toFixed(2)}h
                                </span>
                                {" / "}
                                <span className="text-gray-500">{metrica.meta_mttr?.toFixed(2)}h</span>
                                {metrica.mttr_permite_superacao && metrica.mttr_percentual > 100 && (
                                  <span className="ml-2 text-xs text-green-600">
                                    ({metrica.mttr_percentual.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  metrica.mttr_percentual >= 95 ? 'bg-green-500' : 
                                  metrica.mttr_percentual >= 80 ? 'bg-blue-500' : 
                                  metrica.mttr_percentual >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, metrica.mttr_percentual)}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* MTBF */}
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">MTBF</span>
                              <div className="text-sm">
                                <span className={metrica.mtbf >= (metrica.meta_mtbf || 0) ? "text-green-600" : "text-red-600"}>
                                  {(metrica.mtbf / 24).toFixed(2)} dias
                                </span>
                                {" / "}
                                <span className="text-gray-500">{metrica.meta_mtbf ? (metrica.meta_mtbf / 24).toFixed(2) : '-'} dias</span>
                                {metrica.mtbf_permite_superacao && metrica.mtbf_percentual > 100 && (
                                  <span className="ml-2 text-xs text-green-600">
                                    ({metrica.mtbf_percentual.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  metrica.mtbf_percentual >= 95 ? 'bg-green-500' : 
                                  metrica.mtbf_percentual >= 80 ? 'bg-blue-500' : 
                                  metrica.mtbf_percentual >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, metrica.mtbf_percentual)}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* Disponibilidade */}
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">Disponibilidade</span>
                              <div className="text-sm">
                                <span className={metrica.disponibilidade >= (metrica.meta_disponibilidade || 0) ? "text-green-600" : "text-red-600"}>
                                  {metrica.disponibilidade.toFixed(3)}%
                                </span>
                                {" / "}
                                <span className="text-gray-500">{metrica.meta_disponibilidade?.toFixed(3)}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  metrica.disponibilidade_percentual >= 95 ? 'bg-green-500' : 
                                  metrica.disponibilidade_percentual >= 80 ? 'bg-blue-500' : 
                                  metrica.disponibilidade_percentual >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, metrica.disponibilidade_percentual)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {metricas.filter(m => m.meta_mttr !== null).length === 0 && (
                      <div className="col-span-full bg-white rounded-lg shadow p-8 text-center">
                        <Award className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-lg font-medium text-gray-900">Nenhuma meta configurada</h3>
                        <p className="mt-1 text-gray-500">
                          Configure metas para os ambientes na seção de Configurações para visualizar o atingimento das metas.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* View: Detalhado */}
              {activeView === 'detalhado' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    Relatório Detalhado de Incidentes
                  </h2>
                  
                  <DetailedReportTable incidentes={incidentes} />
                </div>
              )}
              
              {activeView === 'criticidade' && (
                <CriticidadeMetricsReport />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Relatorios;