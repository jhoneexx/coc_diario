import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, X, Clock, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Tipos
interface TipoIncidente {
  id: number;
  nome: string;
}

interface Ambiente {
  id: number;
  nome: string;
}

interface Segmento {
  id: number;
  nome: string;
  ambiente_id: number;
}

interface Criticidade {
  id: number;
  nome: string;
  cor: string;
  is_downtime: boolean;
}

interface IncidenteData {
  id: number;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  tipo_id: number;
  ambiente_id: number;
  segmento_id: number;
  criticidade_id: number;
  descricao: string;
  acoes_tomadas: string | null;
  criado_em: string;
  criado_por: string;
}

const EditarIncidente: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  
  // Dados para os selects
  const [tiposIncidente, setTiposIncidente] = useState<TipoIncidente[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [criticidades, setCriticidades] = useState<Criticidade[]>([]);
  
  // Segmentos filtrados pelo ambiente selecionado
  const [segmentosFiltrados, setSegmentosFiltrados] = useState<Segmento[]>([]);
  
  // Dados do formulário
  const [formData, setFormData] = useState<IncidenteData | null>(null);
  
  // Indica se o incidente já foi resolvido
  const [incidenteResolvido, setIncidenteResolvido] = useState(false);
  
  // Carregar dados do incidente e dados para os selects
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // Carregar dados do incidente
        const { data: incidenteData, error } = await supabase
          .from('incidentes')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error || !incidenteData) {
          toast.error('Incidente não encontrado');
          navigate('/incidentes');
          return;
        }
        
        // Formatar datas para o formato esperado pelo input datetime-local
        const dataInicio = new Date(incidenteData.inicio)
          .toISOString()
          .slice(0, 16); // YYYY-MM-DDTHH:MM
        
        const dataFim = incidenteData.fim 
          ? new Date(incidenteData.fim).toISOString().slice(0, 16)
          : '';
        
        setFormData({
          ...incidenteData,
          inicio: dataInicio,
          fim: dataFim
        });
        
        setIncidenteResolvido(!!incidenteData.fim);
        
        // Carregar tipos de incidente
        const { data: tiposData } = await supabase
          .from('tipos_incidente')
          .select('*')
          .order('nome');
        
        if (tiposData) {
          setTiposIncidente(tiposData);
        }
        
        // Carregar ambientes
        const { data: ambientesData } = await supabase
          .from('ambientes')
          .select('*')
          .order('nome');
        
        if (ambientesData) {
          setAmbientes(ambientesData);
        }
        
        // Carregar segmentos
        const { data: segmentosData } = await supabase
          .from('segmentos')
          .select('*')
          .order('nome');
        
        if (segmentosData) {
          setSegmentos(segmentosData);
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
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados do incidente');
        navigate('/incidentes');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, navigate]);
  
  // Atualizar segmentos filtrados quando o ambiente mudar
  useEffect(() => {
    if (formData?.ambiente_id) {
      const filtered = segmentos.filter(s => s.ambiente_id === formData.ambiente_id);
      setSegmentosFiltrados(filtered);
    }
  }, [formData?.ambiente_id, segmentos]);
  
  // Handler para mudanças nos campos do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!formData) return;
    
    const { name, value } = e.target;
    
    // Converter valores numéricos
    if (['tipo_id', 'ambiente_id', 'segmento_id', 'criticidade_id'].includes(name)) {
      setFormData(prev => prev ? { ...prev, [name]: parseInt(value, 10) || 0 } : null);
      
      // Se mudou o ambiente, atualizar segmentos
      if (name === 'ambiente_id') {
        const ambienteId = parseInt(value, 10);
        const filtered = segmentos.filter(s => s.ambiente_id === ambienteId);
        setSegmentosFiltrados(filtered);
        
        // Limpar segmento selecionado
        setFormData(prev => prev ? { 
          ...prev, 
          ambiente_id: ambienteId,
          segmento_id: 0
        } : null);
      }
    } else {
      setFormData(prev => prev ? { ...prev, [name]: value } : null);
    }
  };
  
  // Toggle para incidente resolvido
  const toggleIncidenteResolvido = () => {
    if (!formData) return;
    
    const novoEstado = !incidenteResolvido;
    setIncidenteResolvido(novoEstado);
    
    // Se marcou como resolvido, preencher data/hora atual
    if (novoEstado) {
      setFormData({ 
        ...formData, 
        fim: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
      });
    } else {
      // Se desmarcou, limpar campo
      setFormData({ ...formData, fim: '' });
    }
  };
  
  // Cancelar e voltar
  const handleCancel = () => {
    navigate('/incidentes');
  };
  
  // Calcular duração em minutos
  const calcularDuracao = (inicio: string, fim: string | null): number | null => {
    if (!fim) return null;
    
    const dataInicio = new Date(inicio);
    const dataFim = new Date(fim);
    
    // Diferença em milissegundos
    const diffMs = dataFim.getTime() - dataInicio.getTime();
    
    // Converter para minutos
    return Math.round(diffMs / (1000 * 60));
  };
  
  // Salvar alterações
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData) return;
    
    // Validar formulário
    if (!formData.tipo_id || !formData.ambiente_id || !formData.segmento_id || 
        !formData.criticidade_id || !formData.descricao || !formData.inicio) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    setSaving(true);
    
    try {
      // Calcular duração se o incidente estiver resolvido
      const duracao = incidenteResolvido 
        ? calcularDuracao(formData.inicio, formData.fim)
        : null;
      
      // Preparar dados para atualização
      const incidenteData = {
        ...formData,
        fim: incidenteResolvido ? formData.fim : null,
        duracao_minutos: duracao,
        atualizado_em: new Date().toISOString(),
        atualizado_por: currentUser?.nome || 'Sistema'
      };
      
      // Remover campos que não devem ser atualizados
      delete incidenteData.id;
      delete incidenteData.criado_em;
      delete incidenteData.criado_por;
      
      // Atualizar no banco
      const { error } = await supabase
        .from('incidentes')
        .update(incidenteData)
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Incidente atualizado com sucesso!');
      navigate('/incidentes');
    } catch (error) {
      console.error('Erro ao atualizar incidente:', error);
      toast.error('Erro ao atualizar incidente');
    } finally {
      setSaving(false);
    }
  };
  
  // Excluir incidente
  const handleDelete = async () => {
    if (!id || !confirmarExclusao) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('incidentes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Incidente excluído com sucesso!');
      navigate('/incidentes');
    } catch (error) {
      console.error('Erro ao excluir incidente:', error);
      toast.error('Erro ao excluir incidente');
    } finally {
      setSaving(false);
      setConfirmarExclusao(false);
    }
  };

  // Se estiver carregando, mostrar indicador
  if (loading || !formData) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse flex space-x-4 justify-center">
          <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
          <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
          <div className="h-6 w-6 bg-gray-300 rounded-full"></div>
        </div>
        <p className="text-sm text-gray-500 mt-4">Carregando dados do incidente...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={handleCancel}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Editar Incidente</h1>
            <p className="text-sm text-gray-500">
              Incidente #{id} - Criado por {formData.criado_por} em {new Date(formData.criado_em).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setConfirmarExclusao(true)}
            className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            disabled={saving}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </button>
          
          <button
            onClick={handleCancel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={saving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </button>
          
          <button
            onClick={handleSubmit}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      
      {/* Modal de Confirmação de Exclusão */}
      {confirmarExclusao && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar Exclusão</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir este incidente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmarExclusao(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Formulário */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados Temporais */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Informações Temporais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="inicio" className="block text-sm font-medium text-gray-700 mb-1">
                    Data e Hora de Início <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="inicio"
                    name="inicio"
                    value={formData.inicio}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="fim" className="block text-sm font-medium text-gray-700">
                      Data e Hora de Fim
                    </label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="incidenteResolvido"
                        checked={incidenteResolvido}
                        onChange={toggleIncidenteResolvido}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="incidenteResolvido" className="ml-2 text-sm text-gray-600">
                        Incidente resolvido
                      </label>
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    id="fim"
                    name="fim"
                    value={formData.fim || ''}
                    onChange={handleChange}
                    disabled={!incidenteResolvido}
                    className={`w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      !incidenteResolvido ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
            </div>
            
            {/* Classificação do Incidente */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Classificação do Incidente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="tipo_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Incidente <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="tipo_id"
                    name="tipo_id"
                    value={formData.tipo_id}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                  >
                    <option value="">Selecione um tipo</option>
                    {tiposIncidente.map(tipo => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="criticidade_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Criticidade <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="criticidade_id"
                    name="criticidade_id"
                    value={formData.criticidade_id}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                  >
                    <option value="">Selecione a criticidade</option>
                    {criticidades.map(crit => (
                      <option key={crit.id} value={crit.id}>
                        {crit.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Localização do Incidente */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Localização do Incidente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="ambiente_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Ambiente <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ambiente_id"
                    name="ambiente_id"
                    value={formData.ambiente_id}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                  >
                    <option value="">Selecione um ambiente</option>
                    {ambientes.map(amb => (
                      <option key={amb.id} value={amb.id}>
                        {amb.nome}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="segmento_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Segmento <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="segmento_id"
                    name="segmento_id"
                    value={formData.segmento_id}
                    onChange={handleChange}
                    disabled={!formData.ambiente_id}
                    className={`w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      !formData.ambiente_id ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    required
                  >
                    <option value="">
                      {formData.ambiente_id ? 'Selecione um segmento' : 'Selecione um ambiente primeiro'}
                    </option>
                    {segmentosFiltrados.map(seg => (
                      <option key={seg.id} value={seg.id}>
                        {seg.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Descrição e Ações */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Descrição e Ações</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição do Incidente <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="descricao"
                    name="descricao"
                    rows={4}
                    value={formData.descricao}
                    onChange={handleChange}
                    placeholder="Descreva o que aconteceu com detalhes..."
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                  ></textarea>
                </div>
                
                <div>
                  <label htmlFor="acoes_tomadas" className="block text-sm font-medium text-gray-700 mb-1">
                    Ações Tomadas
                  </label>
                  <textarea
                    id="acoes_tomadas"
                    name="acoes_tomadas"
                    rows={4}
                    value={formData.acoes_tomadas || ''}
                    onChange={handleChange}
                    placeholder="Descreva as ações que foram tomadas para resolver o incidente..."
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  ></textarea>
                </div>
              </div>
            </div>
            
            {/* Botões */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setConfirmarExclusao(true)}
                className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={saving}
              >
                <Trash2 className="inline-block h-4 w-4 mr-2" />
                Excluir Incidente
              </button>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  disabled={saving}
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditarIncidente;