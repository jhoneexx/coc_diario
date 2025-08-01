import React, { useState, useEffect, useMemo } from 'react';
import { Cloud, BarChart3, Calendar, CheckCircle, Clock, BarChart2, Clock1, Award, AlertTriangle } from 'lucide-react';
import supabase from '../lib/supabase';
import HeatMapCalendar from '../components/dashboard/HeatMapCalendar';
import YearHeatMapCalendar from '../components/dashboard/YearHeatMapCalendar';
import EnvironmentOverviewHeatmap from '../components/dashboard/EnvironmentOverviewHeatmap';
import MetricCard from '../components/dashboard/MetricCard';
import MetaAtingimentoCard from '../components/dashboard/MetaAtingimentoCard';
import IncidentTypeQuantityChart from '../components/dashboard/IncidentTypeQuantityChart';
import IncidentImpactHoursChart from '../components/dashboard/IncidentImpactHoursChart';
import ExecutiveSummary from '../components/dashboard/ExecutiveSummary';
import CriticidadeMetricsReport from '../components/relatorios/CriticidadeMetricsReport';
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
}

interface DashboardStats {
  totalIncidentes: number;
  incidentesAbertos: number;
  incidentesCriticos: number;
  disponibilidadeMedia: number;
  mttr: number;
  mtbf: number;
  maxDiasSemIncidentes: number;
}

const ClienteDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalIncidentes: 0,
    incidentesAbertos: 0,
    incidentesCriticos: 0,
    disponibilidadeMedia: 0,
    mttr: 0,
    mtbf: 0,
    maxDiasSemIncidentes: 0
  });
  const [metas, setMetas] = useState<Meta[]>([]);
  
  // Filtros
  const [filtroAmbiente, setFiltroAmbiente] = useState<number | null>(null);
  
  // Período fixo: ano atual (01/01 até hoje)
  const periodoAnual = useMemo(() => {
    const hoje = new Date();
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    return {
      inicio: inicioAno.toISOString().split('T')[0],
      fim: hoje.toISOString().split('T')[0]
    };
  }, []);
  
  // Estado para controlar qual mapa de calor exibir
  const [mapaTipo, setMapaTipo] = useState<'mensal' | 'anual'>('mensal');
  
  // Estado para controlar qual visualização está ativa
  const [activeView, setActiveView] = useState<'metricas' | 'resumo' | 'metas'>('metricas');

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
          // Comentado para iniciar com todos os ambientes (null)
          // if (!filtroAmbiente && ambientesData.length > 0) {
          //   setFiltroAmbiente(ambientesData[0].id);
          // }
        }
        
        // Carregar metas
        const { data: metasData } = await supabase
          .from('metas')
          .select('*');
        
        if (metasData) {
          setMetas(metasData);
        }
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Efeito para carregar incidentes e estatísticas quando os filtros mudam
  useEffect(() => {
    const fetchDataFiltrada = async () => {
      try {
        // Carregar incidentes
        let query = supabase
          .from('incidentes')
          .select(`
            *,
            tipo:tipos_incidente(nome),
            ambiente:ambientes(nome),
            segmento:segmentos(nome),
            criticidade:criticidades(nome, cor, is_downtime)
          `)
          .gte('inicio', periodoAnual.inicio)
          .lte('inicio', `${periodoAnual.fim}T23:59:59`);
        
        if (filtroAmbiente) {
          query = query.eq('ambiente_id', filtroAmbiente);
        }
        
        const { data: incidentesData, error } = await query.order('inicio', { ascending: false });
        
        if (error) throw error;
        
        if (incidentesData) {
          setIncidentes(incidentesData);
          
          // Calcular estatísticas
          const incidentesAbertos = incidentesData.filter(inc => !inc.fim).length;
          const incidentesCriticos = incidentesData.filter(inc => inc.criticidade.is_downtime).length;
          
          // Calcular MTTR, MTBF e disponibilidade usando nossas funções
          const mttrResult = calcularMTTR(incidentesData, true); // Manter filtro por downtime
          const mtbfResult = calcularMTBF(incidentesData, periodoAnual.inicio, periodoAnual.fim, true); // Manter filtro por downtime
          const dispResult = calcularDisponibilidade(incidentesData, periodoAnual.inicio, periodoAnual.fim);
          
          // Calcular máximo de dias sem incidentes
          const diasPeriodo = new Set();
          // Preencher todos os dias do período
          const inicio = new Date(periodoAnual.inicio);
          const fim = new Date(periodoAnual.fim);
          for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
            diasPeriodo.add(d.toISOString().split('T')[0]);
          }
          
          // Remover dias com incidentes
          incidentesData.forEach(inc => {
            const dia = new Date(inc.inicio).toISOString().split('T')[0];
            if (diasPeriodo.has(dia)) {
              diasPeriodo.delete(dia);
            }
          });
          
          setStats({
            totalIncidentes: incidentesData.length,
            incidentesAbertos,
            incidentesCriticos,
            disponibilidadeMedia: dispResult,
            mttr: mttrResult,
            mtbf: mtbfResult,
            maxDiasSemIncidentes: diasPeriodo.size
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados filtrados:', error);
      }
    };
    
    fetchDataFiltrada();
  }, [filtroAmbiente, periodoAnual]);

  // Função para encontrar meta do ambiente selecionado
  const getMetaAmbiente = (): Meta | undefined => {
    return metas.find(m => m.ambiente_id === filtroAmbiente);
  };

  // Handler para mudança de ambiente
  const handleAmbienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFiltroAmbiente(value ? parseInt(value, 10) : null);
  };
  
  // Toggle para alternar entre mapa mensal e anual
  const toggleMapaTipo = () => {
    setMapaTipo(mapaTipo === 'mensal' ? 'anual' : 'mensal');
  };
  
  // Obter nome do ambiente selecionado
  const getAmbienteNome = () => {
    if (!filtroAmbiente) return '';
    const ambiente = ambientes.find(a => a.id === filtroAmbiente);
    return ambiente ? ambiente.nome : '';
  };

  // Calcular percentuais de atingimento de metas
  const calcularPercentualMTTR = () => {
    const meta = getMetaAmbiente();
    if (!meta || !meta.mttr_meta || stats.mttr === 0) return 100;
    
    const percentual = 100 * (meta.mttr_meta / stats.mttr);
    
    // Se não permite superação, limitar a 100%
    if (!meta.mttr_permite_superacao) {
      return Math.min(100, percentual);
    }
    
    return percentual;
  };

  const calcularPercentualMTBF = () => {
    const meta = getMetaAmbiente();
    if (!meta || !meta.mtbf_meta || stats.mtbf === 0) return 0;
    
    const percentual = 100 * (stats.mtbf / meta.mtbf_meta);
    
    // Se não permite superação, limitar a 100%
    if (!meta.mtbf_permite_superacao) {
      return Math.min(100, percentual);
    }
    
    return percentual;
  };

  const calcularPercentualDisponibilidade = () => {
    const meta = getMetaAmbiente();
    if (!meta || !meta.disponibilidade_meta || stats.disponibilidadeMedia === 0) return 0;
    // Disponibilidade sempre é limitada a 100%
    return Math.min(100, 100 * (stats.disponibilidadeMedia / meta.disponibilidade_meta));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Cloud className="h-10 w-10 mr-4" />
              <div>
                <h1 className="text-2xl font-bold">Cloud Operations Center</h1>
                <p className="text-primary-200">Dashboard de Status e Disponibilidade - {new Date().getFullYear()}</p>
              </div>
            </div>
            <div className="flex space-x-4 items-center">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  onClick={() => setActiveView('metricas')}
                  className={`px-4 py-2 text-sm font-medium border ${
                    activeView === 'metricas'
                      ? 'bg-white text-primary-700 border-white'
                      : 'bg-primary-700 text-white border-primary-700 hover:bg-primary-800'
                  } ${activeView === 'metricas' ? 'rounded-l-lg' : activeView === 'resumo' ? 'border-r-0' : 'rounded-l-lg'}`}
                >
                  <BarChart2 className="inline-block h-4 w-4 mr-2" />
                  Métricas
                </button>
                <button
                  onClick={() => setActiveView('metas')}
                  className={`px-4 py-2 text-sm font-medium border ${
                    activeView === 'metas'
                      ? 'bg-white text-primary-700 border-white'
                      : 'bg-primary-700 text-white border-primary-700 hover:bg-primary-800'
                  } ${activeView === 'resumo' ? 'rounded-r-lg' : 'border-r-0'}`}
                >
                  <Award className="inline-block h-4 w-4 mr-2" />
                  Metas
                </button>
                <button
                  onClick={() => setActiveView('resumo')}
                  className={`px-4 py-2 text-sm font-medium border ${
                    activeView === 'resumo'
                      ? 'bg-white text-primary-700 border-white'
                      : 'bg-primary-700 text-white border-primary-700 hover:bg-primary-800'
                  } ${activeView === 'resumo' ? 'rounded-r-lg' : 'rounded-r-lg'}`}
                >
                  <Clock1 className="inline-block h-4 w-4 mr-2" />
                  Resumo Executivo
                </button>
              </div>
              <a href="/login" className="text-white hover:text-primary-100 text-sm">
                Acesso Administrativo
              </a>
            </div>
          </div>
        </div>
      </header>
      
      {/* Filtros */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <label htmlFor="ambiente" className="block text-sm font-medium text-gray-700 mb-1">
                Ambiente
              </label>
              <select
                id="ambiente"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                value={filtroAmbiente || ''}
                onChange={handleAmbienteChange}
              >
                <option value="">Todos os ambientes</option>
                {ambientes.map(ambiente => (
                  <option key={ambiente.id} value={ambiente.id}>
                    {ambiente.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 lg:flex-initial">
              <div className="text-sm text-gray-600 mt-6">
                Período: {new Date(periodoAnual.inicio).toLocaleDateString('pt-BR')} até {new Date(periodoAnual.fim).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
        
        {activeView === 'resumo' ? (
          /* Visualização de Resumo Executivo */
          <ExecutiveSummary
            stats={stats}
            metas={getMetaAmbiente()}
            periodo={periodoAnual}
            ambiente={getAmbienteNome()}
          />
        ) : activeView === 'metas' ? (
          /* Visualização de Atingimento de Metas */
          <CriticidadeMetricsReport 
            filtroAmbiente={filtroAmbiente}
            periodo={periodoAnual}
            showFilters={false}
          />
        ) : (
          /* Visualização de Métricas */
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Status do Ambiente</h2>
            
            {loading ? (
              <div className="text-center py-6">
                <div className="animate-pulse flex space-x-4 justify-center">
                  <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
                  <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
                  <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
                </div>
                <p className="text-sm text-gray-500 mt-4">Carregando dados...</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <MetricCard 
                    title="Disponibilidade"
                    value={`${stats.disponibilidadeMedia.toFixed(3)}%`}
                    icon={<CheckCircle className="h-6 w-6 text-green-500" />}
                    description={`Meta: ${getMetaAmbiente()?.disponibilidade_meta.toFixed(3) || '-'}%`}
                    color="bg-green-50"
                    statusColor={getMetaAmbiente() && stats.disponibilidadeMedia >= getMetaAmbiente()!.disponibilidade_meta ? 'green' : 'red'}
                  />
                  
                  <MetricCard 
                    title="MTTR (horas)"
                    value={stats.mttr.toFixed(2)}
                    icon={<Clock className="h-6 w-6 text-red-500" />}
                    description={`Meta: ${getMetaAmbiente()?.mttr_meta.toFixed(2) || '-'} horas`}
                    color="bg-red-50"
                    statusColor={getMetaAmbiente() && stats.mttr <= getMetaAmbiente()!.mttr_meta ? 'green' : 'red'}
                  />
                  
                  <MetricCard 
                    title="MTBF (dias)"
                    value={(stats.mtbf / 24).toFixed(2)}
                    icon={<CheckCircle className="h-6 w-6 text-blue-500" />}
                    description={`Meta: ${getMetaAmbiente() ? (getMetaAmbiente()!.mtbf_meta / 24).toFixed(2) : '-'} dias`}
                    color="bg-blue-50"
                    statusColor={getMetaAmbiente() && stats.mtbf >= getMetaAmbiente()!.mtbf_meta ? 'green' : 'red'}
                  />
                  
                  <MetricCard 
                    title="Incidentes no Período"
                    value={stats.totalIncidentes.toString()}
                    icon={<BarChart3 className="h-6 w-6 text-amber-500" />}
                    description={`${stats.incidentesCriticos} críticos`}
                    color="bg-amber-50"
                  />
                </div>
                
                {/* Toggle para alternar entre mapa mensal e anual */}
                {filtroAmbiente && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={toggleMapaTipo}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      {mapaTipo === 'mensal' ? 'Ver Mapa Anual' : 'Ver Mapa Mensal'}
                    </button>
                  </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border p-4 lg:col-span-2">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {!filtroAmbiente 
                        ? 'Mapa de Calor - Visão Geral por Ambiente/Segmento' 
                        : mapaTipo === 'mensal' 
                          ? 'Mapa de Calor Mensal' 
                          : 'Mapa de Calor Anual'
                      }
                    </h3>
                    
                    {!filtroAmbiente ? (
                      <EnvironmentOverviewHeatmap />
                    ) : (
                      mapaTipo === 'mensal' ? (
                        <HeatMapCalendar 
                          incidentes={incidentes} 
                          periodo={periodoAnual}
                        />
                      ) : (
                        <YearHeatMapCalendar 
                          incidentes={incidentes}
                          ano={new Date().getFullYear()}
                        />
                      )
                    )}
                  </div>
                </div>
                
                {/* Novos gráficos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  <div className="bg-white rounded-lg border p-4">
                    <IncidentTypeQuantityChart 
                      incidentes={incidentes}
                      titulo="Quantidade por Tipo de Incidente" 
                    />
                  </div>
                  
                  <div className="bg-white rounded-lg border p-4">
                    <IncidentImpactHoursChart 
                      incidentes={incidentes}
                      titulo="Horas de Impacto por Tipo de Incidente"
                      apenasDowntime={true}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p>&copy; 2025 Cloud Operations Center. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ClienteDashboard;