import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Edit, Trash, Plus, Save, X, Server } from 'lucide-react';
import supabase from '../../lib/supabase';
import { Ambiente } from '../../pages/Configuracoes';

const GerenciarAmbientes: React.FC = () => {
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criandoAmbiente, setCriandoAmbiente] = useState(false);
  const [modalExcluir, setModalExcluir] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Ambiente>>({
    nome: '',
    descricao: ''
  });
  
  // Carregar ambientes
  useEffect(() => {
    const fetchAmbientes = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ambientes')
          .select('*')
          .order('nome');
        
        if (error) throw error;
        
        if (data) {
          setAmbientes(data);
        }
      } catch (error) {
        console.error('Erro ao carregar ambientes:', error);
        toast.error('Erro ao carregar dados de ambientes');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAmbientes();
  }, []);
  
  // Handler para mudanças nos campos do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Iniciar edição
  const handleEdit = (ambiente: Ambiente) => {
    setEditandoId(ambiente.id);
    setFormData({
      nome: ambiente.nome,
      descricao: ambiente.descricao
    });
  };
  
  // Cancelar edição
  const handleCancelEdit = () => {
    setEditandoId(null);
    setCriandoAmbiente(false);
    setFormData({
      nome: '',
      descricao: ''
    });
  };
  
  // Iniciar criação
  const handleStartCreate = () => {
    setCriandoAmbiente(true);
    setFormData({
      nome: '',
      descricao: ''
    });
  };
  
  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (modalExcluir === null) return;
    
    try {
      // Verificar se há segmentos relacionados
      const { data: segmentosRelacionados, error: segmentosError } = await supabase
        .from('segmentos')
        .select('id')
        .eq('ambiente_id', modalExcluir);
      
      if (segmentosError) throw segmentosError;
      
      if (segmentosRelacionados && segmentosRelacionados.length > 0) {
        toast.error('Não é possível excluir este ambiente pois existem segmentos relacionados');
        setModalExcluir(null);
        return;
      }
      
      // Verificar se há incidentes relacionados
      const { data: incidentesRelacionados, error: incidentesError } = await supabase
        .from('incidentes')
        .select('id')
        .eq('ambiente_id', modalExcluir);
      
      if (incidentesError) throw incidentesError;
      
      if (incidentesRelacionados && incidentesRelacionados.length > 0) {
        toast.error('Não é possível excluir este ambiente pois existem incidentes relacionados');
        setModalExcluir(null);
        return;
      }
      
      // Verificar se há metas relacionadas
      const { data: metasRelacionadas, error: metasError } = await supabase
        .from('metas')
        .select('id')
        .eq('ambiente_id', modalExcluir);
      
      if (metasError) throw metasError;
      
      if (metasRelacionadas && metasRelacionadas.length > 0) {
        // Excluir metas relacionadas
        const { error: deleteMetasError } = await supabase
          .from('metas')
          .delete()
          .eq('ambiente_id', modalExcluir);
        
        if (deleteMetasError) throw deleteMetasError;
      }
      
      // Excluir ambiente
      const { error } = await supabase
        .from('ambientes')
        .delete()
        .eq('id', modalExcluir);
      
      if (error) throw error;
      
      // Atualizar lista
      setAmbientes(prev => prev.filter(a => a.id !== modalExcluir));
      toast.success('Ambiente excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir ambiente:', error);
      toast.error('Erro ao excluir ambiente');
    } finally {
      setModalExcluir(null);
    }
  };
  
  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    // Validar campos
    if (!formData.nome) {
      toast.error('Por favor, informe o nome do ambiente');
      return;
    }
    
    try {
      if (editandoId) {
        // Atualizando ambiente existente
        const { error } = await supabase
          .from('ambientes')
          .update(formData)
          .eq('id', editandoId);
        
        if (error) throw error;
        
        // Atualizar lista
        setAmbientes(prev => prev.map(a => 
          a.id === editandoId ? { ...a, ...formData as Ambiente } : a
        ));
        
        toast.success('Ambiente atualizado com sucesso');
      } else {
        // Criando novo ambiente
        const { data, error } = await supabase
          .from('ambientes')
          .insert(formData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualizar lista
        if (data) {
          setAmbientes(prev => [...prev, data]);
        }
        
        toast.success('Ambiente criado com sucesso');
      }
      
      // Limpar formulário
      handleCancelEdit();
    } catch (error) {
      console.error('Erro ao salvar ambiente:', error);
      toast.error('Erro ao salvar ambiente');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Gerenciar Ambientes</h2>
          <p className="text-sm text-gray-500 mt-1">
            Adicione, edite ou remova ambientes do sistema
          </p>
        </div>
        
        <button
          onClick={handleStartCreate}
          disabled={criandoAmbiente || editandoId !== null}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Ambiente
        </button>
      </div>
      
      {/* Lista de Ambientes */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
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
            {/* Formulário para novo ambiente */}
            {criandoAmbiente && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    placeholder="Nome do ambiente"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
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
            
            {/* Lista de ambientes */}
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando ambientes...
                </td>
              </tr>
            ) : ambientes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhum ambiente encontrado
                </td>
              </tr>
            ) : (
              ambientes.map(ambiente => (
                editandoId === ambiente.id ? (
                  // Formulário de edição
                  <tr key={ambiente.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        name="nome"
                        value={formData.nome}
                        onChange={handleChange}
                        placeholder="Nome do ambiente"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
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
                      {new Date(ambiente.criado_em).toLocaleString('pt-BR')}
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
                  <tr key={ambiente.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full">
                          <Server className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{ambiente.nome}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ambiente.descricao || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ambiente.criado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(ambiente)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setModalExcluir(ambiente.id)}
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
              Tem certeza que deseja excluir este ambiente? Esta ação não pode ser desfeita e removerá todas as metas associadas.
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

export default GerenciarAmbientes;