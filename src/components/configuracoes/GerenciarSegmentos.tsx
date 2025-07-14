import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Edit, Trash, Plus, Save, X, ServerCrash } from 'lucide-react';
import supabase from '../../lib/supabase';
import { Segmento, Ambiente } from '../../pages/Configuracoes';
import { useAuth } from '../../contexts/AuthContext';

const GerenciarSegmentos: React.FC = () => {
  const { currentUser } = useAuth();
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criandoSegmento, setCriandoSegmento] = useState(false);
  const [modalExcluir, setModalExcluir] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Segmento>>({
    nome: '',
    ambiente_id: 0,
    descricao: ''
  });
  
  // Carregar segmentos e ambientes
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
        
        // Carregar segmentos com join em ambientes
        const { data: segmentosData, error: segmentosError } = await supabase
          .from('segmentos')
          .select(`
            *,
            ambiente:ambientes(nome)
          `)
          .order('nome');
        
        if (segmentosError) throw segmentosError;
        
        if (segmentosData) {
          setSegmentos(segmentosData);
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Converter valores numéricos
    if (name === 'ambiente_id') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Iniciar edição
  const handleEdit = (segmento: Segmento) => {
    setEditandoId(segmento.id);
    setFormData({
      nome: segmento.nome,
      ambiente_id: segmento.ambiente_id,
      descricao: segmento.descricao
    });
  };
  
  // Cancelar edição
  const handleCancelEdit = () => {
    setEditandoId(null);
    setCriandoSegmento(false);
    setFormData({
      nome: '',
      ambiente_id: 0,
      descricao: ''
    });
  };
  
  // Iniciar criação
  const handleStartCreate = () => {
    setCriandoSegmento(true);
    setFormData({
      nome: '',
      ambiente_id: ambientes.length > 0 ? ambientes[0].id : 0,
      descricao: ''
    });
  };
  
  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (modalExcluir === null) return;
    
    try {
      const segmentoParaExcluir = segmentos.find(s => s.id === modalExcluir);
      
      // Verificar se há incidentes relacionados
      const { data: incidentesRelacionados, error: incidentesError } = await supabase
        .from('incidentes')
        .select('id')
        .eq('segmento_id', modalExcluir);
      
      if (incidentesError) throw incidentesError;
      
      if (incidentesRelacionados && incidentesRelacionados.length > 0) {
        toast.error('Não é possível excluir este segmento pois existem incidentes relacionados');
        setModalExcluir(null);
        return;
      }
      
      // Excluir segmento
      const { error } = await supabase
        .from('segmentos')
        .delete()
        .eq('id', modalExcluir);
      
      if (error) throw error;
      
      // Atualizar lista
      setSegmentos(prev => prev.filter(s => s.id !== modalExcluir));
      
      // Registrar log de auditoria
      if (currentUser && segmentoParaExcluir) {
        await supabase.from('logs_acesso').insert({
          usuario_id: currentUser.id,
          acao: 'excluir_segmento',
          detalhes: `Segmento excluído: ID ${modalExcluir}, Nome: "${segmentoParaExcluir.nome}", Ambiente: "${segmentoParaExcluir.ambiente?.nome}"`
        });
      }
      
      toast.success('Segmento excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir segmento:', error);
      toast.error('Erro ao excluir segmento');
    } finally {
      setModalExcluir(null);
    }
  };
  
  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    // Validar campos
    if (!formData.nome || !formData.ambiente_id) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      if (editandoId) {
        // Atualizando segmento existente
        const segmentoAnterior = segmentos.find(s => s.id === editandoId);
        const ambienteAnterior = ambientes.find(a => a.id === segmentoAnterior?.ambiente_id);
        const ambienteNovo = ambientes.find(a => a.id === formData.ambiente_id);
        
        const { error } = await supabase
          .from('segmentos')
          .update(formData)
          .eq('id', editandoId);
        
        if (error) throw error;
        
        // Buscar segmento atualizado (com join em ambiente)
        const { data: segmentoAtualizado, error: fetchError } = await supabase
          .from('segmentos')
          .select(`
            *,
            ambiente:ambientes(nome)
          `)
          .eq('id', editandoId)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Atualizar lista
        setSegmentos(prev => prev.map(s => 
          s.id === editandoId ? segmentoAtualizado : s
        ));
        
        // Registrar log de auditoria
        if (currentUser && segmentoAnterior) {
          await supabase.from('logs_acesso').insert({
            usuario_id: currentUser.id,
            acao: 'editar_segmento',
            detalhes: `Segmento editado: ID ${editandoId}, Nome: "${segmentoAnterior.nome}" → "${formData.nome}", Ambiente: "${ambienteAnterior?.nome}" → "${ambienteNovo?.nome}", Descrição: "${segmentoAnterior.descricao || ''}" → "${formData.descricao || ''}"`
          });
        }
        
        toast.success('Segmento atualizado com sucesso');
      } else {
        // Criando novo segmento
        const ambienteNovo = ambientes.find(a => a.id === formData.ambiente_id);
        
        const { data, error } = await supabase
          .from('segmentos')
          .insert(formData)
          .select(`
            *,
            ambiente:ambientes(nome)
          `)
          .single();
        
        if (error) throw error;
        
        // Atualizar lista
        if (data) {
          setSegmentos(prev => [...prev, data]);
          
          // Registrar log de auditoria
          if (currentUser) {
            await supabase.from('logs_acesso').insert({
              usuario_id: currentUser.id,
              acao: 'criar_segmento',
              detalhes: `Segmento criado: ID ${data.id}, Nome: "${data.nome}", Ambiente: "${ambienteNovo?.nome}", Descrição: "${data.descricao || ''}"`
            });
          }
        }
        
        toast.success('Segmento criado com sucesso');
      }
      
      // Limpar formulário
      handleCancelEdit();
    } catch (error) {
      console.error('Erro ao salvar segmento:', error);
      toast.error('Erro ao salvar segmento');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Gerenciar Segmentos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Adicione, edite ou remova segmentos dos ambientes
          </p>
        </div>
        
        <button
          onClick={handleStartCreate}
          disabled={criandoSegmento || editandoId !== null || ambientes.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Segmento
        </button>
      </div>
      
      {/* Lista de Segmentos */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ambiente
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descrição
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Criado em
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Formulário para novo segmento */}
            {criandoSegmento && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    placeholder="Nome do segmento"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
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
                  <input
                    type="text"
                    name="descricao"
                    value={formData.descricao || ''}
                    onChange={handleChange}
                    placeholder="Descrição (opcional)"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={handleSave}
                    className="text-green-600 hover:text-green-900 mr-3"
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
            
            {/* Lista de segmentos */}
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando segmentos...
                </td>
              </tr>
            ) : segmentos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhum segmento encontrado
                </td>
              </tr>
            ) : (
              segmentos.map(segmento => (
                editandoId === segmento.id ? (
                  // Formulário de edição
                  <tr key={segmento.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        name="nome"
                        value={formData.nome}
                        onChange={handleChange}
                        placeholder="Nome do segmento"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
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
                      <input
                        type="text"
                        name="descricao"
                        value={formData.descricao || ''}
                        onChange={handleChange}
                        placeholder="Descrição (opcional)"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(segmento.criado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={handleSave}
                        className="text-green-600 hover:text-green-900 mr-3"
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
                  <tr key={segmento.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-cyan-100 text-cyan-700 rounded-full">
                          <ServerCrash className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{segmento.nome}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {segmento.ambiente?.nome || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {segmento.descricao || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(segmento.criado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(segmento)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setModalExcluir(segmento.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash className="h-5 w-5" />
                      </button>
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
              Tem certeza que deseja excluir este segmento? Esta ação não pode ser desfeita.
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

export default GerenciarSegmentos;