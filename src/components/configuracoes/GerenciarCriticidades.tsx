import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Edit, Trash, Plus, Save, X, AlertTriangle } from 'lucide-react';
import supabase from '../../lib/supabase';
import { Criticidade } from '../../pages/Configuracoes';

const GerenciarCriticidades: React.FC = () => {
  const [criticidades, setCriticidades] = useState<Criticidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criandoCriticidade, setCriandoCriticidade] = useState(false);
  const [modalExcluir, setModalExcluir] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Criticidade>>({
    nome: '',
    cor: '#f97316',
    descricao: '',
    peso: 1,
    is_downtime: false
  });
  
  // Cores predefinidas
  const coresPredefinidas = [
    { nome: 'Vermelho', valor: '#dc2626' },
    { nome: 'Laranja', valor: '#ea580c' },
    { nome: 'Amarelo', valor: '#f59e0b' },
    { nome: 'Verde Lima', valor: '#65a30d' },
    { nome: 'Verde', valor: '#16a34a' },
    { nome: 'Azul', valor: '#0ea5e9' },
    { nome: 'Roxo', valor: '#8b5cf6' },
    { nome: 'Rosa', valor: '#ec4899' },
    { nome: 'Cinza', valor: '#6b7280' }
  ];
  
  // Carregar criticidades
  useEffect(() => {
    const fetchCriticidades = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('criticidades')
          .select('*')
          .order('peso');
        
        if (error) throw error;
        
        if (data) {
          setCriticidades(data);
        }
      } catch (error) {
        console.error('Erro ao carregar criticidades:', error);
        toast.error('Erro ao carregar dados de criticidades');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCriticidades();
  }, []);
  
  // Handler para mudanças nos campos do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: target.checked }));
    } else if (name === 'peso') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Iniciar edição
  const handleEdit = (criticidade: Criticidade) => {
    setEditandoId(criticidade.id);
    setFormData({
      nome: criticidade.nome,
      cor: criticidade.cor,
      descricao: criticidade.descricao,
      peso: criticidade.peso,
      is_downtime: criticidade.is_downtime
    });
  };
  
  // Cancelar edição
  const handleCancelEdit = () => {
    setEditandoId(null);
    setCriandoCriticidade(false);
    setFormData({
      nome: '',
      cor: '#f97316',
      descricao: '',
      peso: 1,
      is_downtime: false
    });
  };
  
  // Iniciar criação
  const handleStartCreate = () => {
    setCriandoCriticidade(true);
    setFormData({
      nome: '',
      cor: '#f97316',
      descricao: '',
      peso: 1,
      is_downtime: false
    });
  };
  
  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (modalExcluir === null) return;
    
    try {
      // Verificar se há incidentes relacionados
      const { data: incidentesRelacionados, error: incidentesError } = await supabase
        .from('incidentes')
        .select('id')
        .eq('criticidade_id', modalExcluir);
      
      if (incidentesError) throw incidentesError;
      
      if (incidentesRelacionados && incidentesRelacionados.length > 0) {
        toast.error('Não é possível excluir esta criticidade pois existem incidentes relacionados');
        setModalExcluir(null);
        return;
      }
      
      // Excluir criticidade
      const { error } = await supabase
        .from('criticidades')
        .delete()
        .eq('id', modalExcluir);
      
      if (error) throw error;
      
      // Atualizar lista
      setCriticidades(prev => prev.filter(c => c.id !== modalExcluir));
      toast.success('Criticidade excluída com sucesso');
    } catch (error) {
      console.error('Erro ao excluir criticidade:', error);
      toast.error('Erro ao excluir criticidade');
    } finally {
      setModalExcluir(null);
    }
  };
  
  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    // Validar campos
    if (!formData.nome || !formData.cor || formData.peso === undefined) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      if (editandoId) {
        // Atualizando criticidade existente
        const { error } = await supabase
          .from('criticidades')
          .update(formData)
          .eq('id', editandoId);
        
        if (error) throw error;
        
        // Atualizar lista
        setCriticidades(prev => prev.map(c => 
          c.id === editandoId ? { ...c, ...formData as Criticidade } : c
        ));
        
        toast.success('Criticidade atualizada com sucesso');
      } else {
        // Criando nova criticidade
        const { data, error } = await supabase
          .from('criticidades')
          .insert(formData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualizar lista
        if (data) {
          setCriticidades(prev => [...prev, data]);
        }
        
        toast.success('Criticidade criada com sucesso');
      }
      
      // Limpar formulário
      handleCancelEdit();
    } catch (error) {
      console.error('Erro ao salvar criticidade:', error);
      toast.error('Erro ao salvar criticidade');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Gerenciar Criticidades</h2>
          <p className="text-sm text-gray-500 mt-1">
            Adicione, edite ou remova níveis de criticidade para incidentes
          </p>
        </div>
        
        <button
          onClick={handleStartCreate}
          disabled={criandoCriticidade || editandoId !== null}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Criticidade
        </button>
      </div>
      
      {/* Lista de Criticidades */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cor
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Peso
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                É Downtime
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descrição
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Formulário para nova criticidade */}
            {criandoCriticidade && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    placeholder="Nome da criticidade"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <select
                      name="cor"
                      value={formData.cor}
                      onChange={handleChange}
                      className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    >
                      {coresPredefinidas.map(cor => (
                        <option key={cor.valor} value={cor.valor}>{cor.nome}</option>
                      ))}
                    </select>
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: formData.cor }}
                    ></div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    name="peso"
                    value={formData.peso}
                    onChange={handleChange}
                    min="1"
                    max="100"
                    className="w-20 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    name="is_downtime"
                    checked={formData.is_downtime}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
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
            
            {/* Lista de criticidades */}
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando criticidades...
                </td>
              </tr>
            ) : criticidades.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhuma criticidade encontrada
                </td>
              </tr>
            ) : (
              criticidades.map(criticidade => (
                editandoId === criticidade.id ? (
                  // Formulário de edição
                  <tr key={criticidade.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        name="nome"
                        value={formData.nome}
                        onChange={handleChange}
                        placeholder="Nome da criticidade"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <select
                          name="cor"
                          value={formData.cor}
                          onChange={handleChange}
                          className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          {coresPredefinidas.map(cor => (
                            <option key={cor.valor} value={cor.valor}>{cor.nome}</option>
                          ))}
                        </select>
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: formData.cor }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        name="peso"
                        value={formData.peso}
                        onChange={handleChange}
                        min="1"
                        max="100"
                        className="w-20 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        name="is_downtime"
                        checked={formData.is_downtime}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
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
                  <tr key={criticidade.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div 
                          className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full" 
                          style={{ backgroundColor: criticidade.cor, color: 'white' }}
                        >
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{criticidade.nome}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-6 h-6 rounded-full" 
                          style={{ backgroundColor: criticidade.cor }}
                        ></div>
                        <span className="text-sm text-gray-500">{criticidade.cor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {criticidade.peso}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        criticidade.is_downtime ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {criticidade.is_downtime ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {criticidade.descricao || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(criticidade)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setModalExcluir(criticidade.id)}
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
              Tem certeza que deseja excluir esta criticidade? Esta ação não pode ser desfeita.
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

export default GerenciarCriticidades;