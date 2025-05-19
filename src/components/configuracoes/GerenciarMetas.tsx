import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Edit, Plus, Save, X, Target } from 'lucide-react';
import supabase from '../../lib/supabase';
import { Meta, Ambiente } from '../../pages/Configuracoes';

const GerenciarMetas: React.FC = () => {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [ambientesSemMeta, setAmbientesSemMeta] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criandoMeta, setCriandoMeta] = useState(false);
  const [formData, setFormData] = useState<Partial<Meta>>({
    ambiente_id: 0,
    mttr_meta: 4,
    mtbf_meta: 168, // 7 dias em horas
    disponibilidade_meta: 99.9
  });
  
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
        
        // Carregar metas com join em ambientes
        const { data: metasData, error: metasError } = await supabase
          .from('metas')
          .select(`
            *,
            ambiente:ambientes(nome)
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
    const { name, value } = e.target;
    
    if (name === 'ambiente_id') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
    } else if (['mttr_meta', 'mtbf_meta', 'disponibilidade_meta'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Iniciar edição
  const handleEdit = (meta: Meta) => {
    setEditandoId(meta.id);
    setFormData({
      ambiente_id: meta.ambiente_id,
      mttr_meta: meta.mttr_meta,
      mtbf_meta: meta.mtbf_meta,
      disponibilidade_meta: meta.disponibilidade_meta
    });
  };
  
  // Cancelar edição
  const handleCancelEdit = () => {
    setEditandoId(null);
    setCriandoMeta(false);
    setFormData({
      ambiente_id: 0,
      mttr_meta: 4,
      mtbf_meta: 168,
      disponibilidade_meta: 99.9
    });
  };
  
  // Iniciar criação
  const handleStartCreate = () => {
    setCriandoMeta(true);
    setFormData({
      ambiente_id: ambientesSemMeta.length > 0 ? ambientesSemMeta[0].id : 0,
      mttr_meta: 4,
      mtbf_meta: 168,
      disponibilidade_meta: 99.9
    });
  };
  
  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    // Validar campos
    if (!formData.ambiente_id || formData.mttr_meta === undefined || 
        formData.mtbf_meta === undefined || formData.disponibilidade_meta === undefined) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    // Validar valores
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
            ambiente:ambientes(nome)
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
            ambiente:ambientes(nome)
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
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      toast.error('Erro ao salvar meta');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Gerenciar Metas</h2>
          <p className="text-sm text-gray-500 mt-1">
            Defina metas de MTTR, MTBF e disponibilidade para cada ambiente
          </p>
        </div>
        
        <button
          onClick={handleStartCreate}
          disabled={criandoMeta || editandoId !== null || ambientesSemMeta.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </button>
      </div>
      
      {/* Lista de Metas */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ambiente
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MTTR Meta (horas)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MTBF Meta (horas)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MTBF Meta (dias)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Disponibilidade Meta (%)
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
                    {ambientesSemMeta.map(ambiente => (
                      <option key={ambiente.id} value={ambiente.id}>
                        {ambiente.nome}
                      </option>
                    ))}
                  </select>
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
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando metas...
                </td>
              </tr>
            ) : metas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhuma meta encontrada
                </td>
              </tr>
            ) : (
              metas.map(meta => (
                editandoId === meta.id ? (
                  // Formulário de edição
                  <tr key={meta.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {meta.ambiente?.nome || ''}
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meta.mttr_meta.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meta.mtbf_meta.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(meta.mtbf_meta / 24).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {meta.disponibilidade_meta.toFixed(3)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(meta)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GerenciarMetas;