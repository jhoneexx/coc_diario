import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Edit, Plus, Save, X, Target, PieChart, ChevronDown, ChevronUp, Trash, Search, ArrowUpDown } from 'lucide-react';
import supabase from '../../lib/supabase';
import { Meta, Ambiente, Segmento } from '../../pages/Configuracoes';
import { calcularMTTR, calcularMTBF, calcularDisponibilidade } from '../../utils/metricsCalculations';

interface MetaRealizacaoData {
  ambiente_id: number;
  ambiente_nome: string;
  mttr: number;
  mtbf: number;
  disponibilidade: number;
  mttr_meta: number;
  mtbf_meta: number;
  disponibilidade_meta: number;
  peso_percentual: number;
  mttr_percentual_atingido: number;
  mtbf_percentual_atingido: number;
  disponibilidade_percentual_atingido: number;
}

const GerenciarMetas: React.FC = () => {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [allSegments, setAllSegments] = useState<Segmento[]>([]);
  const [filteredSegments, setFilteredSegments] = useState<Segmento[]>([]);
  const [ambientesSemMeta, setAmbientesSemMeta] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criandoMeta, setCriandoMeta] = useState(false);
  const [modalExcluir, setModalExcluir] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Meta>>({
    ambiente_id: 0,
    segmento_id: null,
    mttr_meta: 4.0,
    mtbf_meta: 168.0, // 7 dias em horas
    disponibilidade_meta: 99.9,
    peso_percentual: 10.0,
    mttr_permite_superacao: true,
    mtbf_permite_superacao: true
  });
  
  // Estado para filtro de ambiente
  const [filtroAmbiente, setFiltroAmbiente] = useState<number | null>(null);
  
  // Estado para ordenação
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Estado para controlar a exibição da visualização de realização de metas
  const [showMetaRealizacao, setShowMetaRealizacao] = useState(false);
  
  // Estado para armazenar os dados de realização das metas
  const [metaRealizacao, setMetaRealizacao] = useState<MetaRealizacaoData[]>([]);
  
  // Estado para armazenar o período para análise de realização das metas
  const [periodoRealizacao, setPeriodoRealizacao] = useState<{inicio: string, fim: string}>({
    inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // Primeiro dia do mês
    fim: new Date().toISOString().split('T')[0] // Hoje
  });
  
  // Calcular soma do peso percentual das metas (exceto a que está sendo editada)
  const totalPesoPercentual = metas
    .filter(m => editandoId !== m.id && !criandoMeta)
    .reduce((total, meta) => total + meta.peso_percentual, 0);
  
  // Calcular o percentual disponível para atribuir (considerando edição ou criação)
  const percentualDisponivel = 100 - totalPesoPercentual;
  
  // Verificar se o peso percentual é inválido (excede 100% no total ou é negativo)
  const isPercentualInvalido = (formData.peso_percentual || 0) > percentualDisponivel || (formData.peso_percentual || 0) < 0;
  
  // Efeito para filtrar segmentos quando o ambiente muda
  useEffect(() => {
    if (formData.ambiente_id && allSegments.length > 0) {
      const segmentosDoAmbiente = allSegments.filter(s => s.ambiente_id === formData.ambiente_id);
      setFilteredSegments(segmentosDoAmbiente);
    } else {
      setFilteredSegments([]);
    }
  }, [formData.ambiente_id, allSegments]);
  
  // Função para ordenar metas
  const sortedMetas = React.useMemo(() => {
    let sortableMetas = [...metas];
    
    // Aplicar filtro de ambiente se selecionado
    if (filtroAmbiente) {
      sortableMetas = sortableMetas.filter(meta => meta.ambiente_id === filtroAmbiente);
    }
    
    if (sortConfig !== null) {
      sortableMetas.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortConfig.key) {
          case 'ambiente':
            aValue = a.ambiente?.nome || '';
            bValue = b.ambiente?.nome || '';
            break;
          case 'segmento':
            aValue = a.segmento?.nome || '';
            bValue = b.segmento?.nome || '';
            break;
          case 'peso':
            aValue = a.peso_percentual;
            bValue = b.peso_percentual;
            break;
          case 'mttr':
            aValue = a.mttr_meta;
            bValue = b.mttr_meta;
            break;
          case 'mtbf':
            aValue = a.mtbf_meta;
            bValue = b.mtbf_meta;
            break;
          case 'disponibilidade':
            aValue = a.disponibilidade_meta;
            bValue = b.disponibilidade_meta;
            break;
          default:
            aValue = a.id;
            bValue = b.id;
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return sortableMetas;
  }, [metas, sortConfig, filtroAmbiente]);
  
  // Função para lidar com a ordenação
  const handleSort = (key: string) => {
    setSortConfig(prevConfig => {
      if (prevConfig && prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'asc' };
    });
  };
  
  // Função para renderizar o ícone de ordenação
  const getSortIcon = (key: string) => {
    if (sortConfig && sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? 
        <ChevronUp className="h-4 w-4 inline-block ml-1" /> : 
        <ChevronDown className="h-4 w-4 inline-block ml-1" />;
    }
    return <ArrowUpDown className="h-4 w-4 inline-block ml-1 opacity-30" />;
  };
  
  // Carregar metas e ambientes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Carregar ambientes
        const { data: ambientesData, error: ambientesError } = await supabase
          .from('ambientes')
          .select('*')
          .order('nome');
        
        if (ambientesError) throw ambientesError;
        
        if (ambientesData) {
          setAmbientes(ambientesData);
        }
        
        // Carregar todos os segmentos
        const { data: segmentosData, error: segmentosError } = await supabase
          .from('segmentos')
          .select('*')
          .order('nome');
        
        if (segmentosError) throw segmentosError;
        
        if (segmentosData) {
          setAllSegments(segmentosData);
        }
        
        // Carregar metas com join em ambientes
        const { data: metasData, error: metasError } = await supabase
          .from('metas')
          .select(`
            *,
            ambiente:ambientes(nome),
            segmento:segmentos(nome)
          `)
          .order('id');
        
        if (metasError) throw metasError;
        
        if (metasData) {
          setMetas(metasData);
          
          // Filtrar ambientes sem meta
          if (ambientesData) {
            const ambientesComMeta = new Set(metasData.map(m => m.ambiente_id));
            const semMeta = ambientesData.filter(a => !ambientesComMeta.has(a.id));
            setAmbientesSemMeta(semMeta);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Handler para mudanças nos campos do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'ambiente_id') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: parseInt(value, 10) || 0,
        segmento_id: null // Resetar segmento_id ao mudar o ambiente
      }));
    } else if (name === 'segmento_id') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value === "" ? null : parseInt(value, 10) 
      }));
    } else if (['mttr_meta', 'mtbf_meta', 'disponibilidade_meta', 'peso_percentual'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Iniciar edição
  const handleEdit = (meta: Meta) => {
    setEditandoId(meta.id);
    setFormData({
      ambiente_id: meta.ambiente_id,
      segmento_id: meta.segmento_id || null,
      mttr_meta: meta.mttr_meta,
      mtbf_meta: meta.mtbf_meta,
      disponibilidade_meta: meta.disponibilidade_meta,
      peso_percentual: meta.peso_percentual,
      mttr_permite_superacao: meta.mttr_permite_superacao,
      mtbf_permite_superacao: meta.mtbf_permite_superacao
    });
  };
  
  // Cancelar edição
  const handleCancelEdit = () => {
    setEditandoId(null);
    setCriandoMeta(false);
    setModalExcluir(null);
    setFormData({
      ambiente_id: 0,
      segmento_id: null,
      mttr_meta: 4,
      mtbf_meta: 168,
      disponibilidade_meta: 99.9,
      peso_percentual: 100,
      mttr_permite_superacao: true,
      mtbf_permite_superacao: true
    });
  };
  
  // Iniciar criação
  const handleStartCreate = () => {
    setCriandoMeta(true);
    // Usar o primeiro ambiente disponível ou o primeiro da lista completa
    const firstAmbienteId = ambientes.length > 0 ? ambientes[0].id : 0;
    setFormData({
      ambiente_id: firstAmbienteId,
      segmento_id: null,
      mttr_meta: 4,
      mtbf_meta: 168,
      disponibilidade_meta: 99.9,
      peso_percentual: 100, // Meta geral sempre tem 100%
      mttr_permite_superacao: true,
      mtbf_permite_superacao: true
    });
  };
  
  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (modalExcluir === null) return;
    
    try {
      const { error } = await supabase
        .from('metas')
        .delete()
        .eq('id', modalExcluir);
      
      if (error) throw error;
      
      // Atualizar lista
      setMetas(prev => prev.filter(m => m.id !== modalExcluir));
      toast.success('Meta excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir meta:', error);
      toast.error('Erro ao excluir meta');
    } finally {
      setModalExcluir(null);
    }
  };
  
  // Handler para mudança no período de realização
  const handlePeriodoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPeriodoRealizacao(prev => ({ ...prev, [name]: value }));
  };
  
  // Analisar realização das metas
  const analisarRealizacaoMetas = async () => {
    setLoading(true);
    try {
      // Buscar incidentes para o período
      const { data: incidentesData, error: incidentesError } = await supabase
        .from('incidentes')
        .select(`
          *,
          tipo:tipos_incidente(nome),
          ambiente:ambientes(nome),
          segmento:segmentos(nome),
          criticidade:criticidades(nome, cor, is_downtime)
        `)
        .gte('inicio', periodoRealizacao.inicio)
        .lte('inicio', `${periodoRealizacao.fim}T23:59:59`);
      
      if (incidentesError) throw incidentesError;
      
      const metasRealizacao: MetaRealizacaoData[] = [];
      
      // Calcular métricas para cada ambiente com meta
      for (const meta of metas) {
        const ambienteNome = meta.ambiente?.nome || `Ambiente ${meta.ambiente_id}`;
        
        // Filtrar incidentes deste ambiente
        const incidentesDoAmbiente = incidentesData?.filter(inc => inc.ambiente_id === meta.ambiente_id) || [];
        
        // Calcular métricas reais
        const mttrReal = calcularMTTR(incidentesDoAmbiente, true); // Manter filtro por downtime
        const mtbfReal = calcularMTBF(incidentesDoAmbiente, periodoRealizacao.inicio, periodoRealizacao.fim, true); // Manter filtro por downtime
        const dispReal = calcularDisponibilidade(incidentesDoAmbiente, periodoRealizacao.inicio, periodoRealizacao.fim);
        
        // Calcular percentual de atingimento (considerando que valores menores são melhores para MTTR,
        // e valores maiores são melhores para MTBF e disponibilidade)
        let mttrPercentualAtingido = meta.mttr_meta > 0 
          ? 100 * (meta.mttr_meta / Math.max(0.01, mttrReal))
          : 0;
        
        // Se permitir superação, não limitar a 100%
        if (!meta.mttr_permite_superacao) {
          mttrPercentualAtingido = Math.min(100, mttrPercentualAtingido);
        }
          
        let mtbfPercentualAtingido = mtbfReal > 0
          ? 100 * (mtbfReal / Math.max(0.01, meta.mtbf_meta))
          : 0;
        
        // Se permitir superação, não limitar a 100%
        if (!meta.mtbf_permite_superacao) {
          mtbfPercentualAtingido = Math.min(100, mtbfPercentualAtingido);
        }
          
        // Disponibilidade sempre limitada a 100%
        const dispPercentualAtingido = meta.disponibilidade_meta > 0
          ? Math.min(100, 100 * (dispReal / meta.disponibilidade_meta))
          : 0;
        
        metasRealizacao.push({
          ambiente_id: meta.ambiente_id,
          ambiente_nome: ambienteNome,
          mttr: mttrReal,
          mtbf: mtbfReal,
          disponibilidade: dispReal,
          mttr_meta: meta.mttr_meta,
          mtbf_meta: meta.mtbf_meta,
          disponibilidade_meta: meta.disponibilidade_meta,
          peso_percentual: meta.peso_percentual,
          mttr_percentual_atingido: mttrPercentualAtingido,
          mtbf_percentual_atingido: mtbfPercentualAtingido,
          disponibilidade_percentual_atingido: dispPercentualAtingido
        });
      }
      
      setMetaRealizacao(metasRealizacao);
      setShowMetaRealizacao(true);
    } catch (error) {
      console.error('Erro ao analisar realização de metas:', error);
      toast.error('Erro ao analisar realização de metas');
    } finally {
      setLoading(false);
    }
  };
  
  // Calcular atingimento geral das metas (ponderado pelo peso percentual)
  const calcularAtingimentoGeral = (tipoMetrica: 'mttr' | 'mtbf' | 'disponibilidade') => {
    if (metaRealizacao.length === 0) return 0;
    
    const totalPercentual = metaRealizacao.reduce((sum, meta) => sum + meta.peso_percentual, 0);
    if (totalPercentual <= 0) return 0;
    
    const somaPonderada = metaRealizacao.reduce((sum, meta) => {
      let percentualAtingido;
      switch (tipoMetrica) {
        case 'mttr':
          percentualAtingido = meta.mttr_percentual_atingido;
          break;
        case 'mtbf':
          percentualAtingido = meta.mtbf_percentual_atingido;
          break;
        case 'disponibilidade':
          percentualAtingido = meta.disponibilidade_percentual_atingido;
          break;
        default:
          percentualAtingido = 0;
      }
      
      return sum + (percentualAtingido * meta.peso_percentual / totalPercentual);
    }, 0);
    
    return somaPonderada;
  };

  // Fechar visão de realização de metas
  const fecharMetaRealizacao = () => {
    setShowMetaRealizacao(false);
  };
  
  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    // Validar campos
    if (!formData.ambiente_id || formData.mttr_meta === undefined ||
        formData.mtbf_meta === undefined || formData.disponibilidade_meta === undefined ||
        formData.peso_percentual === undefined) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    // Validar peso percentual global
    const pesoTotal = totalPesoPercentual + (editandoId ? 0 : (formData.peso_percentual || 0));
    if (pesoTotal > 100) {
      toast.error(`A soma dos pesos percentuais não pode exceder 100%. Atual: ${pesoTotal.toFixed(1)}%`);
      return;
    }

    // Validar outros valores
    if (formData.mttr_meta <= 0) {
      toast.error('O MTTR deve ser maior que zero');
      return;
    }
    
    if (formData.mtbf_meta <= 0) {
      toast.error('O MTBF deve ser maior que zero');
      return;
    }
    
    if (formData.disponibilidade_meta <= 0 || formData.disponibilidade_meta > 100) {
      toast.error('A disponibilidade deve estar entre 0 e 100%');
      return;
    }

    try {
      if (editandoId) {
        // Atualizando meta existente
        const { error } = await supabase
          .from('metas')
          .update(formData)
          .eq('id', editandoId);
        
        if (error) throw error;
        
        // Buscar meta atualizada (com join em ambiente)
        const { data: metaAtualizada, error: fetchError } = await supabase
          .from('metas')
          .select(`
            *,
            ambiente:ambientes(nome),
            segmento:segmentos(nome)
          `)
          .eq('id', editandoId)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Atualizar lista
        setMetas(prev => prev.map(m => 
          m.id === editandoId ? metaAtualizada : m
        ));
        
        toast.success('Meta atualizada com sucesso');
      } else {
        // Criando nova meta
        const { data, error } = await supabase
          .from('metas')
          .insert(formData)
          .select(`
            *,
            ambiente:ambientes(nome),
            segmento:segmentos(nome)
          `)
          .single();
        
        if (error) throw error;
        
        // Atualizar lista
        if (data) {
          setMetas(prev => [...prev, data]);
          
          // Atualizar lista de ambientes sem meta
          setAmbientesSemMeta(prev => prev.filter(a => a.id !== formData.ambiente_id));
        }
        
        toast.success('Meta criada com sucesso');
      }

      // Limpar formulário
      handleCancelEdit();
    } catch (error: any) {
      console.error('Erro ao salvar meta:', error);
      if (error.code === '23505') { // Código de erro para violação de unicidade
        toast.error('Já existe uma meta para este ambiente e segmento.');
      } else {
        toast.error('Erro ao salvar meta');
      }
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Gerenciar Metas</h2>
          <p className="text-sm text-gray-500 mt-1">
            Defina metas de MTTR, MTBF e disponibilidade para ambientes e segmentos
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={analisarRealizacaoMetas}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={loading || metas.length === 0}
          >
            <PieChart className="h-4 w-4 mr-2" />
            Analisar Realização das Metas
          </button>
          
          <button
            onClick={handleStartCreate}
            disabled={criandoMeta || editandoId !== null}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </button>
        </div>
      </div>
      
      {/* Filtro de ambiente e pesquisa */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
          <div className="w-full md:w-1/3">
            <label htmlFor="filtroAmbiente" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Ambiente
            </label>
            <select
              id="filtroAmbiente"
              value={filtroAmbiente || ''}
              onChange={(e) => setFiltroAmbiente(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="">Todos os Ambientes</option>
              {ambientes.map(ambiente => (
                <option key={ambiente.id} value={ambiente.id}>
                  {ambiente.nome}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 flex justify-end">
            <div className="text-sm text-gray-700">
              <div className="flex items-center space-x-2">
                <div className="font-medium">
                  Peso total alocado: {totalPesoPercentual.toFixed(1)}%
                </div>
                <div className="text-green-700">
                  Disponível: {percentualDisponivel.toFixed(1)}%
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className={`h-2 rounded-full ${totalPesoPercentual > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, totalPesoPercentual)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Visão de Realização das Metas */}
      {showMetaRealizacao && (
        <div className="p-6 border-b border-gray-200 bg-gray-50 animate-fadeIn">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Realização das Metas</h3>
              <p className="text-sm text-gray-500 mt-1">
                Período: {new Date(periodoRealizacao.inicio).toLocaleDateString('pt-BR')} até {new Date(periodoRealizacao.fim).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button
              onClick={fecharMetaRealizacao}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* MTTR */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                MTTR - Atingimento Geral
              </h4>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {calcularAtingimentoGeral('mttr').toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500">Meta Geral Ponderada</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, calcularAtingimentoGeral('mttr'))}%` }}
                ></div>
              </div>
            </div>
            
            {/* MTBF */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                MTBF - Atingimento Geral
              </h4>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {calcularAtingimentoGeral('mtbf').toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500">Meta Geral Ponderada</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, calcularAtingimentoGeral('mtbf'))}%` }}
                ></div>
              </div>
            </div>
            
            {/* Disponibilidade */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Disponibilidade - Atingimento Geral
              </h4>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {calcularAtingimentoGeral('disponibilidade').toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500">Meta Geral Ponderada</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-purple-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, calcularAtingimentoGeral('disponibilidade'))}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Início
              </label>
              <input
                type="date"
                name="inicio"
                value={periodoRealizacao.inicio}
                onChange={handlePeriodoChange}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Fim
              </label>
              <input
                type="date"
                name="fim"
                value={periodoRealizacao.fim}
                onChange={handlePeriodoChange}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div className="flex-1 flex items-end">
              <button
                onClick={analisarRealizacaoMetas}
                className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={loading}
              >
                Atualizar Análise
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ambiente
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peso (%)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MTTR
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MTBF
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Disponibilidade
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metaRealizacao.map((realizacao) => (
                  <tr key={realizacao.ambiente_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {realizacao.ambiente_nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {realizacao.peso_percentual.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {realizacao.mttr.toFixed(2)}h / Meta: {realizacao.mttr_meta.toFixed(2)}h
                      </div>
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              realizacao.mttr_percentual_atingido >= 90 ? 'bg-green-500' : 
                              realizacao.mttr_percentual_atingido >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, realizacao.mttr_percentual_atingido)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Atingido: {realizacao.mttr_percentual_atingido.toFixed(1)}%
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {(realizacao.mtbf / 24).toFixed(2)} dias / Meta: {(realizacao.mtbf_meta / 24).toFixed(2)} dias
                      </div>
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              realizacao.mtbf_percentual_atingido >= 90 ? 'bg-green-500' : 
                              realizacao.mtbf_percentual_atingido >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, realizacao.mtbf_percentual_atingido)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Atingido: {realizacao.mtbf_percentual_atingido.toFixed(1)}%
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {realizacao.disponibilidade.toFixed(3)}% / Meta: {realizacao.disponibilidade_meta.toFixed(3)}%
                      </div>
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              realizacao.disponibilidade_percentual_atingido >= 90 ? 'bg-green-500' : 
                              realizacao.disponibilidade_percentual_atingido >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, realizacao.disponibilidade_percentual_atingido)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Atingido: {realizacao.disponibilidade_percentual_atingido.toFixed(1)}%
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Lista de Metas */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('ambiente')}
              >
                Ambiente {getSortIcon('ambiente')}
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('segmento')}
              >
                Segmento {getSortIcon('segmento')}
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('peso')}
              >
                Peso (%) {getSortIcon('peso')}
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('mttr')}
              >
                MTTR Meta (horas) {getSortIcon('mttr')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Superação MTTR
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('mtbf')}
              >
                MTBF Meta (horas) {getSortIcon('mtbf')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Superação MTBF
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MTBF Meta (dias)
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('disponibilidade')}
              >
                Disponibilidade Meta (%) {getSortIcon('disponibilidade')}
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Formulário para nova meta */}
            {criandoMeta && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    name="ambiente_id"
                    value={formData.ambiente_id || ''}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="">Selecione um ambiente</option>
                    {ambientes.map(ambiente => (
                      <option key={ambiente.id} value={ambiente.id}>
                        {ambiente.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    name="segmento_id"
                    value={formData.segmento_id === null ? "" : formData.segmento_id}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    disabled={!formData.ambiente_id}
                  >
                    <option value="">Meta Geral do Ambiente</option>
                    {filteredSegments.map(segmento => (
                      <option key={segmento.id} value={segmento.id}>
                        {segmento.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    name="peso_percentual"
                    value={formData.peso_percentual}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.1"
                    className={`w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      isPercentualInvalido ? 'border-red-500 bg-red-50' : ''
                    }`}
                  />
                  {isPercentualInvalido && (
                    <p className="text-red-500 text-xs mt-1">Excede o percentual disponível ({percentualDisponivel.toFixed(1)}%)</p>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    name="mttr_meta"
                    value={formData.mttr_meta}
                    onChange={handleChange}
                    min="0.1"
                    step="0.1"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <input
                    type="checkbox"
                    name="mttr_permite_superacao"
                    checked={formData.mttr_permite_superacao}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    name="mtbf_meta"
                    value={formData.mtbf_meta}
                    onChange={handleChange}
                    min="1"
                    step="1"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <input
                    type="checkbox"
                    name="mtbf_permite_superacao"
                    checked={formData.mtbf_permite_superacao}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(formData.mtbf_meta ? formData.mtbf_meta / 24 : 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    name="disponibilidade_meta"
                    value={formData.disponibilidade_meta}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={handleSave}
                    className="text-green-600 hover:text-green-900 mr-3"
                    disabled={isPercentualInvalido}
                  >
                    <Save className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            )}
            
            {/* Lista de metas */}
            {loading ? (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando metas...
                </td>
              </tr>
            ) : metas.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhuma meta encontrada
                </td>
              </tr>
            ) : (
              sortedMetas.map(meta => (
                editandoId === meta.id ? (
                  // Formulário de edição
                  <tr key={meta.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {meta.ambiente?.nome || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        name="segmento_id"
                        value={formData.segmento_id === null ? "" : formData.segmento_id}
                        onChange={handleChange}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        disabled={!formData.ambiente_id}
                      >
                        <option value="">Meta Geral do Ambiente</option>
                        {filteredSegments.map(segmento => (
                          <option key={segmento.id} value={segmento.id}>
                            {segmento.nome}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        name="peso_percentual"
                        value={formData.peso_percentual}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        step="0.1"
                        className={`w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                          isPercentualInvalido ? 'border-red-500 bg-red-50' : ''
                        }`}
                      />
                      {isPercentualInvalido && (
                        <p className="text-red-500 text-xs mt-1">Excede o percentual disponível ({percentualDisponivel.toFixed(1)}%)</p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        name="mttr_meta"
                        value={formData.mttr_meta}
                        onChange={handleChange}
                        min="0.1"
                        step="0.1"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        name="mttr_permite_superacao"
                        checked={formData.mttr_permite_superacao}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        name="mtbf_meta"
                        value={formData.mtbf_meta}
                        onChange={handleChange}
                        min="1"
                        step="1"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        name="mtbf_permite_superacao"
                        checked={formData.mtbf_permite_superacao}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(formData.mtbf_meta ? formData.mtbf_meta / 24 : 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        name="disponibilidade_meta"
                        value={formData.disponibilidade_meta}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={handleSave}
                        className="text-green-600 hover:text-green-900 mr-3"
                        disabled={isPercentualInvalido}
                      >
                        <Save className="h-5 w-5" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ) : (
                  // Linha normal
                  <tr key={meta.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-green-100 text-green-700 rounded-full">
                          <Target className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{meta.ambiente?.nome || ''}</div>
                          <div className="text-xs text-gray-500">
                            {meta.segmento?.nome ? `Segmento: ${meta.segmento.nome}` : 'Meta Geral'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meta.segmento?.nome || 'Geral do Ambiente'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {meta.peso_percentual.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meta.mttr_meta.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        meta.mttr_permite_superacao 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {meta.mttr_permite_superacao ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meta.mtbf_meta.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        meta.mtbf_permite_superacao 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {meta.mtbf_permite_superacao ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(meta.mtbf_meta / 24).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meta.disponibilidade_meta.toFixed(3)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(meta)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setModalExcluir(meta.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Modal de confirmação de exclusão */}
      {modalExcluir !== null && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar Exclusão</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setModalExcluir(null)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GerenciarMetas;