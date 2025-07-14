import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { User, Edit, Trash, Plus, Save, X, Eye, EyeOff } from 'lucide-react';
import supabase from '../../lib/supabase';
import { Usuario } from '../../pages/Configuracoes';

const GerenciarUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criandoUsuario, setCriandoUsuario] = useState(false);
  const [modalExcluir, setModalExcluir] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Usuario>>({
    nome: '',
    login: '',
    senha: '',
    perfil: 'operador'
  });
  const [showPassword, setShowPassword] = useState(false);
  
  // Carregar usuários
  useEffect(() => {
    const fetchUsuarios = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .order('nome');
        
        if (error) throw error;
        
        if (data) {
          setUsuarios(data);
        }
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        toast.error('Erro ao carregar dados de usuários');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsuarios();
  }, []);
  
  // Handler para mudanças nos campos do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Iniciar edição
  const handleEdit = (usuario: Usuario) => {
    setEditandoId(usuario.id);
    setFormData({
      nome: usuario.nome,
      login: usuario.login,
      senha: '',  // Não preenche a senha por segurança
      perfil: usuario.perfil
    });
  };
  
  // Cancelar edição
  const handleCancelEdit = () => {
    setEditandoId(null);
    setCriandoUsuario(false);
    setFormData({
      nome: '',
      login: '',
      senha: '',
      perfil: 'operador'
    });
  };
  
  // Iniciar criação
  const handleStartCreate = () => {
    setCriandoUsuario(true);
    setFormData({
      nome: '',
      login: '',
      senha: '',
      perfil: 'operador'
    });
  };
  
  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (modalExcluir === null) return;
    
    try {
      // Primeiro, excluir todos os logs de acesso do usuário
      const { error: logsError } = await supabase
        .from('logs_acesso')
        .delete()
        .eq('usuario_id', modalExcluir);
      
      if (logsError) throw logsError;
      
      // Depois, excluir o usuário
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', modalExcluir);
      
      if (error) throw error;
      
      // Atualizar lista
      setUsuarios(prev => prev.filter(u => u.id !== modalExcluir));
      toast.success('Usuário excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast.error('Erro ao excluir usuário');
    } finally {
      setModalExcluir(null);
    }
  };
  
  // Salvar (criar ou atualizar)
  const handleSave = async () => {
    // Validar campos
    if (!formData.nome || !formData.login || (!editandoId && !formData.senha) || !formData.perfil) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      if (editandoId) {
        // Atualizando usuário existente
        const updateData = { ...formData };
        
        // Se senha estiver vazia, não atualiza a senha
        if (!updateData.senha) {
          delete updateData.senha;
        }
        
        const { error } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', editandoId);
        
        if (error) throw error;
        
        // Atualizar lista
        setUsuarios(prev => prev.map(u => 
          u.id === editandoId ? { ...u, ...updateData } : u
        ));
        
        toast.success('Usuário atualizado com sucesso');
      } else {
        // Criando novo usuário
        const { data, error } = await supabase
          .from('usuarios')
          .insert(formData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualizar lista
        if (data) {
          setUsuarios(prev => [...prev, data]);
        }
        
        toast.success('Usuário criado com sucesso');
      }
      
      // Limpar formulário
      handleCancelEdit();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.error('Erro ao salvar usuário');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Gerenciar Usuários</h2>
          <p className="text-sm text-gray-500 mt-1">
            Adicione, edite ou remova usuários do sistema
          </p>
        </div>
        
        <button
          onClick={handleStartCreate}
          disabled={criandoUsuario || editandoId !== null}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </button>
      </div>
      
      {/* Lista de Usuários */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Login
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Perfil
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Último Acesso
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Formulário para novo usuário */}
            {criandoUsuario && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    placeholder="Nome do usuário"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    name="login"
                    value={formData.login}
                    onChange={handleChange}
                    placeholder="Login"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    name="perfil"
                    value={formData.perfil}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="gestor">Gestor</option>
                    <option value="operador">Operador</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap relative">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="senha"
                      value={formData.senha}
                      onChange={handleChange}
                      placeholder="Senha"
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
            
            {/* Lista de usuários */}
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando usuários...
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              usuarios.map(usuario => (
                editandoId === usuario.id ? (
                  // Formulário de edição
                  <tr key={usuario.id} className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        name="nome"
                        value={formData.nome}
                        onChange={handleChange}
                        placeholder="Nome do usuário"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        name="login"
                        value={formData.login}
                        onChange={handleChange}
                        placeholder="Login"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        name="perfil"
                        value={formData.perfil}
                        onChange={handleChange}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      >
                        <option value="admin">Admin</option>
                        <option value="gestor">Gestor</option>
                        <option value="operador">Operador</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="senha"
                          value={formData.senha}
                          onChange={handleChange}
                          placeholder="Nova senha (deixe em branco para manter)"
                          className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
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
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{usuario.nome}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {usuario.login}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        usuario.perfil === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : usuario.perfil === 'gestor'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {usuario.perfil === 'admin' ? 'Administrador' : 
                          usuario.perfil === 'gestor' ? 'Gestor' : 'Operador'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {usuario.ultimo_acesso ? new Date(usuario.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca acessou'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(usuario)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setModalExcluir(usuario.id)}
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
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
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

export default GerenciarUsuarios;