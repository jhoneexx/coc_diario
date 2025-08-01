import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Calendar, Plus, BarChart2, Clock1, Award, BarChart3 } from 'lucide-react';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import HeatMapCalendar from '../components/dashboard/HeatMapCalendar';
import YearHeatMapCalendar from '../components/dashboard/YearHeatMapCalendar';
import EnvironmentOverviewHeatmap from '../components/dashboard/EnvironmentOverviewHeatmap';
import MetricCard from '../components/dashboard/MetricCard';
import MetaAtingimentoCard from '../components/dashboard/MetaAtingimentoCard';
import IncidentList from '../components/dashboard/IncidentList';
import IncidentTypeQuantityChart from '../components/dashboard/IncidentTypeQuantityChart';
import IncidentImpactHoursChart from '../components/dashboard/IncidentImpactHoursChart';
import ExecutiveSummary from '../components/dashboard/ExecutiveSummary';
import CriticidadeMetricsReport from '../components/relatorios/CriticidadeMetricsReport';
import FilterBar from '../components/common/FilterBar';
import { calcularMTTR, calcularMTBF, calcularDisponibilidade } from '../utils/metricsCalculations';
import { Segmento } from './Configuracoes';

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

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [allSegments, setAllSegments] = useState<Segmento[]>([]);
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
  const [filtroSegmento, setFiltroSegmento] = useState<number | null>(null);
  
  // Período fixo: ano atual (01/01 até hoje)
  const periodoAnual = useMemo(() => {
    const hoje = new Date();
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    return {
      inicio: inicioAno.toISOString().split('T')[0],
      fim: hoje.toISOString().split('T')[0]
    };
  }, []);
  
  // Filtrar segmentos do ambiente selecionado
  const segmentosDoAmbienteSelecionado = useMemo(() => {
    if (!filtroAmbiente) return [];
    return allSegments.filter(s => s.ambiente_id === filtroAmbiente);
  }, [filtroAmbiente, allSegments]);
  
  // Estado para controlar qual mapa de calor exibir
  const [mapaTipo, setMapaTipo] = useState<'mensal' | 'anual'>('mensal');
  
  // Estado para controlar qual visualização está ativa
  const [activeView, setActiveView] = useState<'cards' | 'resumo' | 'metas'>('cards');

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
        
        // Carregar segmentos
        const { data: segmentosData, error: segmentosError } = await supabase
          .from('segmentos')
          .select('*')
          .order('nome');
        
        if (segmentosError) throw segmentosError;
        
        if (segmentosData) {
          setAllSegments(segmentosData);
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
        
        // Adicionar filtro de segmento se especificado
        if (filtroSegmento) {
          query = query.eq('segmento_id', filtroSegmento);
        }
        
        const { data: incidentesData, error } = await query.order('inicio', { ascending: false });
        
        if (error) throw error;
        
        if (incidentesData) {
          setIncidentes(incidentesData);
          
          // Calcular estatísticas
          const incidentesAbertos = incidentesData.filter(inc => !inc.fim).length;
          const incidentesCriticos = incidentesData.filter(inc => inc.criticidade.is_downtime).length;
          
          // Calcular MTTR, MTBF e disponibilidade usando nossas funções
          const mttrResult = calcularMTTR(incidentesData, true);
          const mtbfResult = calcularMTBF(incidentesData, periodoAnual.inicio, periodoAnual.fim, true);
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
  }, [filtroAmbiente, filtroSegmento, periodoAnual]);

  // Função para encontrar meta do ambiente selecionado
  const getMetaAmbiente = (): Meta | undefined => {
    return metas.find(m => m.ambiente_id === filtroAmbiente);
  };

  // Handler para criar novo incidente
  const handleNovoIncidente = () => {
    navigate('/incidentes/novo');
  };

  // Handler para mudança de ambiente
  const handleAmbienteChange = (id: number | null) => {
    setFiltroAmbiente(id);
    setFiltroSegmento(null); // Resetar filtro de segmento ao mudar de ambiente
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
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard Operacional</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visão geral dos incidentes e métricas de serviço - Ano {new Date().getFullYear()}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              onClick={() => setActiveView('cards')}
              className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border ${
                activeView === 'cards'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } rounded-l-lg`}
            >
              <BarChart2 className="inline-block h-4 w-4 mr-1 lg:mr-2" />
              <span className="hidden sm:inline">Métricas</span>
            </button>
            <button
              onClick={() => setActiveView('metas')}
              className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-t border-b ${
                activeView === 'metas'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Award className="inline-block h-4 w-4 mr-1 lg:mr-2" />
              <span className="hidden sm:inline">Analitcs</span>
            </button>
            <button
              onClick={() => setActiveView('resumo')}
              className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border ${
                activeView === 'resumo'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } rounded-r-lg`}
            >
              <Clock1 className="inline-block h-4 w-4 mr-1 lg:mr-2" />
              <span className="hidden sm:inline">Resumo</span>
            </button>
          </div>
          
          <button 
            onClick={handleNovoIncidente}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Registrar Incidente</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 lg:p-6 mb-6">
        <FilterBar 
          ambientes={ambientes}
          filtroAmbiente={filtroAmbiente}
          setFiltroAmbiente={handleAmbienteChange}
          segmentos={segmentosDoAmbienteSelecionado.length > 1 ? segmentosDoAmbienteSelecionado : undefined}
          filtroSegmento={filtroSegmento}
          setFiltroSegmento={setFiltroSegmento}
        />
        <div className="text-sm text-gray-600 mt-4">
          Período: {new Date(periodoAnual.inicio).toLocaleDateString('pt-BR')} até {new Date(periodoAnual.fim).toLocaleDateString('pt-BR')}
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
          filtroSegmento={filtroSegmento}
          periodo={periodoAnual}
          showFilters={false}
        />
      ) : (
        /* Visualização de Métricas */
        <div>
          {/* Mapa de Calor */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {!filtroAmbiente 
                ? 'Mapa de Calor - Visão Geral por Ambiente/Segmento' 
                : `Mapa de Calor Anual - ${getAmbienteNome()}`
              }
            </h2>
            
            {!filtroAmbiente ? (
              <EnvironmentOverviewHeatmap />
            ) : (
              <YearHeatMapCalendar 
                incidentes={incidentes}
                ano={new Date().getFullYear()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;