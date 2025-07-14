import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BarChart2, Clock1, Award, Download } from 'lucide-react';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import YearHeatMapCalendar from '../components/dashboard/YearHeatMapCalendar';
import ExecutiveSummary from '../components/dashboard/ExecutiveSummary';
import CriticidadeMetricsReport from '../components/relatorios/CriticidadeMetricsReport';
import { calcularMTTR, calcularMTBF, calcularDisponibilidade } from '../utils/metricsCalculations';
import { exportReportToPDF } from '../utils/exportReports';

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
  const filtroAmbiente = null; // Sempre null para mostrar todos os ambientes
  
  // Período fixo: ano atual (01/01 até hoje)
  const periodoAnual = useMemo(() => {
    const hoje = new Date();
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    return {
      inicio: inicioAno.toISOString().split('T')[0],
      fim: hoje.toISOString().split('T')[0]
    };
  }, []);
  
  // Estado para controlar qual visualização está ativa
  const [activeView, setActiveView] = useState<'cards' | 'resumo' | 'metas'>('cards');
  
  // Estado para controlar o progresso da exportação do PDF
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Carregar metas
        const { data: metasData } = await supabase
          .from('metas')
          .select('*');
        
        if (metasData) {
          setMetas(metasData);
        }
        
        // Atualizar estatísticas e incidentes (feito em outro useEffect que depende dos filtros)
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

  // Handler para criar novo incidente
  const handleNovoIncidente = () => {
    navigate('/incidentes/novo');
  };

  // Obter nome do ambiente selecionado
  const getAmbienteNome = () => {
    if (!filtroAmbiente) return '';
    return '';
  };
  
  // Função para exportar relatório em PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      await exportReportToPDF({
        incidentes,
        metricas: [
          {
            ambiente_id: 0,
            ambiente_nome: 'Todos os ambientes',
            mttr: stats.mttr,
            mtbf: stats.mtbf,
            disponibilidade: stats.disponibilidadeMedia,
            incidentes_total: stats.totalIncidentes,
            incidentes_criticos: stats.incidentesCriticos,
            meta_mttr: getMetaAmbiente()?.mttr_meta || null,
            meta_mtbf: getMetaAmbiente()?.mtbf_meta || null,
            meta_disponibilidade: getMetaAmbiente()?.disponibilidade_meta || null
          }
        ],
        filtroPeriodo: periodoAnual,
        filtroAmbiente,
        ambienteFiltrado: 'Todos os ambientes',
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
              <span className="hidden sm:inline">Analytics</span>
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
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Período: {new Date(periodoAnual.inicio).toLocaleDateString('pt-BR')} até {new Date(periodoAnual.fim).toLocaleDateString('pt-BR')}
          </p>
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
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? `Exportando... ${exportProgress.toFixed(0)}%` : 'Exportar PDF'}
            </button>
          </div>
          <CriticidadeMetricsReport 
            filtroAmbiente={filtroAmbiente}
            periodo={periodoAnual}
            showFilters={false}
          />
        </div>
      ) : (
        /* Visualização de Cards */
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Mapa de Calor Anual - {new Date().getFullYear()}
          </h2>
          
          <YearHeatMapCalendar 
            incidentes={incidentes}
            ano={new Date().getFullYear()}
          />
        </div>
      )}
    </div>
  );
};

export default Dashboard;