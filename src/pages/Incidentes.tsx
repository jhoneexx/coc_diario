import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Download, FileText, CheckSquare } from 'lucide-react';
import supabase from '../lib/supabase';
import FilterBar from '../components/common/FilterBar';
import IncidentList from '../components/dashboard/IncidentList';
import { useAuth } from '../contexts/AuthContext';

// Tipos
interface Ambiente {
  id: number;
  nome: string;
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

const Incidentes: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isGestor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  
  // Filtros
  const [filtroAmbiente, setFiltroAmbiente] = useState<number | null>(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState<{inicio: string, fim: string}>({
    inicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    fim: new Date().toISOString().split('T')[0]
  });

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
        
        // Os incidentes serão carregados em outro useEffect que depende dos filtros
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Efeito para carregar incidentes quando os filtros mudam
  useEffect(() => {
    const fetchIncidentes = async () => {
      setLoading(true);
      try {
        // Construir query base
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
        
        const { data, error } = await query.order('inicio', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
          setIncidentes(data);
        }
      } catch (error) {
        console.error('Erro ao carregar incidentes:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchIncidentes();
  }, [filtroAmbiente, filtroPeriodo]);
  
  // Verificar pendências de aprovação para gestor/admin
  useEffect(() => {
    if (!isGestor() && !isAdmin()) return;
    
    const fetchPendingApprovals = async () => {
      try {
        let query = supabase
          .from('aprovacoes_incidentes')
          .select('count', { count: 'exact', head: true })
          .eq('status', 'pendente');
        
        if (isGestor() && !isAdmin()) {
          // Gestor só vê aprovações de operadores
          query = query.eq('dados_antes->perfil_solicitante', 'operador');
        }
        
        const { count, error } = await query;
        
        if (error) throw error;
        
        setPendingApprovals(count || 0);
      } catch (error) {
        console.error('Erro ao verificar aprovações pendentes:', error);
      }
    };
    
    fetchPendingApprovals();
    
    // Configurar atualização periódica a cada 1 minuto
    const intervalId = setInterval(fetchPendingApprovals, 60000);
    
    return () => clearInterval(intervalId);
  }, [isGestor, isAdmin]);

  // Handler para criar novo incidente
  const handleNovoIncidente = () => {
    navigate('/incidentes/novo');
  };
  
  // Toggle para mostrar/esconder filtros
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };
  
  // Ir para a tela de aprovações
  const handleVerAprovacoes = () => {
    navigate('/incidentes/aprovacoes');
  };
  
  // Exportar para CSV
  const exportarCSV = () => {
    if (incidentes.length === 0) return;
    
    // Preparar dados para CSV
    const headers = ['ID', 'Início', 'Fim', 'Duração (min)', 'Tipo', 'Ambiente', 'Segmento', 'Criticidade', 'Descrição'];
    
    const csvData = incidentes.map(inc => [
      inc.id,
      inc.inicio,
      inc.fim || 'Em andamento',
      inc.duracao_minutos || 'N/A',
      inc.tipo.nome,
      inc.ambiente.nome,
      inc.segmento.nome,
      inc.criticidade.nome,
      inc.descricao.replace(/"/g, '""') // Escapar aspas duplas
    ]);
    
    // Adicionar headers
    csvData.unshift(headers);
    
    // Converter para string CSV
    const csvString = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Criar blob e fazer download
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'incidentes.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão de Incidentes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualize e gerencie todos os incidentes registrados
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          <button 
            onClick={toggleFilters}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </button>
          
          <button 
            onClick={exportarCSV}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </button>
          
          {(isAdmin() || isGestor()) && (
            <button
              onClick={handleVerAprovacoes}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 relative"
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Aprovações
              {pendingApprovals > 0 && (
                <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                  {pendingApprovals}
                </span>
              )}
            </button>
          )}
          
          <button 
            onClick={handleNovoIncidente}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Incidente
          </button>
        </div>
      </div>
      
      {/* Filtros */}
      {showFilters && (
        <FilterBar 
          ambientes={ambientes}
          filtroAmbiente={filtroAmbiente}
          filtroPeriodo={filtroPeriodo}
          setFiltroAmbiente={setFiltroAmbiente}
          setFiltroPeriodo={setFiltroPeriodo}
        />
      )}
      
      {/* Lista de Incidentes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Incidentes</h2>
            <p className="text-sm text-gray-500 mt-1">
              {incidentes.length} registros encontrados
            </p>
          </div>
          
          {incidentes.length === 0 && !loading && (
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum incidente encontrado</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comece registrando um novo incidente.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleNovoIncidente}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Novo Incidente
                </button>
              </div>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-6">
            <div className="animate-pulse flex space-x-4 justify-center">
              <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
              <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
              <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Carregando incidentes...</p>
          </div>
        ) : incidentes.length > 0 ? (
          <IncidentList incidentes={incidentes} />
        ) : null}
      </div>
    </div>
  );
};

export default Incidentes;