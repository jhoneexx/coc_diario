import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Edit, Trash, Plus, Save, X, AlertCircle } from 'lucide-react';
import supabase from '../../lib/supabase';
import { TipoIncidente } from '../../pages/Configuracoes';
import { useAuth } from '../../contexts/AuthContext';

const GerenciarTiposIncidente: React.FC = () => {
  const { currentUser } = useAuth();
  const [tiposIncidente, setTiposIncidente] = useState<TipoIncidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [modalExcluir, setModalExcluir] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<TipoIncidente>>({
    nome: '',
    descricao: ''
  });
  
  // Carregar tipos de incidente
  useEffect(() => {
    const fetchTiposIncidente = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('tipos_incidente')
          .select('*')
          .order('nome');
        
        if (error) throw error;
        
        if (data) {
          setTiposIncidente(data);
        }
      } catch (error) {
        console.error('Erro ao carregar tipos de incidente:', error);
        toast.error('Erro ao carregar dados de tipos de incidente');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTiposIncidente();
  }, []);
  
  // Handler para mudanças nos campos do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Iniciar edição
  const handleEdit = (tipo: TipoIncidente) => {
    setEditandoId(tipo.id);
    setFormData({
      nome: tipo.nome,
      descricao: tipo.descricao
    });
  };
  
  // Cancelar edição
  const handleCancelEdit = () => {
    setEditandoId(null);
    setCriandoTipo(false);
    setFormData({
      nome: '',
      descricao: ''
    });
  };
  
  // Iniciar criação
  const handleStartCreate = () => {
    setCriandoTipo(true);
    setFormData({
      nome: '',
      descricao: ''
    });
  };
  
  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (modalExcluir === null) return;
    
    try {
      const tipoParaExcluir = tiposIncidente.find(t => t.id === modalExcluir);
      
      // Verificar se há incidentes relacionados
      const { data: incidentesRelacionados, error: incidentesError } = await supabase
        .from('incidentes')
        .select('id')
        .eq('tipo_id', modalExcluir);
      
      if (incidentesError) throw incidentesError;
      
      if (incidentesRelacionados && incidentesRelacionados.length > 0) {
        toast.error('Não é possível excluir este tipo de incidente pois existem incidentes relacionados');
        setModalExcluir(null);
        return;
      }
      
      // Excluir tipo de incidente
      const { error } = await supabase
        .from('tipos_incidente')
        .delete()
        .eq('id', modalExcluir);
      
      if (error) throw error;
      
      // Atualizar lista
      setTiposIncidente(prev => prev.filter(t => t.id !== modalExcluir));
      
      // Registrar log de auditoria
      if (currentUser && tipoParaExcluir) {
        await supabase.from('logs_acesso').insert({
          usuario_id: currentUser.id,
          acao: 'excluir_tipo_incidente',
          detalhes: `Tipo de incidente excluído: ID ${modalExcluir}, Nome: "${tipoParaExcluir.nome}"`
        });
      }
      
      toast.success('Tipo de incidente excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir tipo de incidente:', error);
      toast.error('Erro ao excluir tipo de incidente');
    } finally {
      setModalExcluir(null);
    }
  };
  
  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    // Validar campos
    if (!formData.nome) {
      toast.error('Por favor, informe o nome do tipo de incidente');
      return;
    }
    
    try {
      if (editandoId) {
        // Atualizando tipo de incidente existente
        const tipoAnterior = tiposIncidente.find(t => t.id === editandoId);
        
        const { error } = await supabase
          .from('tipos_incidente')
          .update(formData)
          .eq('id', editandoId);
        
        if (error) throw error;
        
        // Atualizar lista
        setTiposIncidente(prev => prev.map(t => 
          t.id === editandoId ? { ...t, ...formData as TipoIncidente } : t
        ));
        
        // Registrar log de auditoria
        if (currentUser && tipoAnterior) {
          await supabase.from('logs_acesso').insert({
            usuario_id: currentUser.id,
            acao: 'editar_tipo_incidente',
            detalhes: `Tipo de incidente editado: ID ${editandoId}, Nome: "${tipoAnterior.nome}" → "${formData.nome}", Descrição: "${tipoAnterior.descricao || ''}" → "${formData.descricao || ''}"`
          });
        }
        
        toast.success('Tipo de incidente atualizado com sucesso');
      } else {
        // Criando novo tipo de incidente
        const { data, error } = await supabase
          .from('tipos_incidente')
          .insert(formData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualizar lista
        if (data) {
          setTiposIncidente(prev => [...prev, data]);
          
          // Registrar log de auditoria
          if (currentUser) {
            await supabase.from('logs_acesso').insert({
              usuario_id: currentUser.id,
              acao: 'criar_tipo_incidente',
              detalhes: `Tipo de incidente criado: ID ${data.id}, Nome: "${data.nome}", Descrição: "${data.descricao || ''}"`
            });
          }
        }
        
        toast.success('Tipo de incidente criado com sucesso');
      }
      
      // Limpar formulário
      handleCancelEdit();
    } catch (error) {
      console.error('Erro ao salvar tipo de incidente:', error);
      toast.error('Erro ao salvar tipo de incidente');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Gerenciar Tipos de Incidente</h2>
          <p className="text-sm text-gray-500 mt-1">
            Adicione, edite ou remova tipos de incidente do sistema
          </p>
        </div>
        
        <button
          onClick={handleStartCreate}
          disabled={criandoTipo || editandoId !== null}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Tipo
        </button>
      </div>
      
      {/* Lista de Tipos de Incidente */}
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
            {/* Formulário para novo tipo */}
            {criandoTipo && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    placeholder="Nome do tipo de incidente"
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
            
            {/* Lista de tipos */}
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando tipos de incidente...
                </td>
              </tr>
            ) : tiposIncidente.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhum tipo de incidente encontrado
                </td>
              </tr>
            ) : (
              tiposIncidente.map(tipo => (
                editandoId === tipo.id ? (
                  // Formulário de edição
                  <tr key={tipo.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        name="nome"
                        value={formData.nome}
                        onChange={handleChange}
                        placeholder="Nome do tipo de incidente"
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
                      {new Date(tipo.criado_em).toLocaleString('pt-BR')}
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
                  <tr key={tipo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-red-100 text-red-700 rounded-full">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{tipo.nome}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tipo.descricao || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tipo.criado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(tipo)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setModalExcluir(tipo.id)}
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
              Tem certeza que deseja excluir este tipo de incidente? Esta ação não pode ser desfeita.
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

export default GerenciarTiposIncidente;