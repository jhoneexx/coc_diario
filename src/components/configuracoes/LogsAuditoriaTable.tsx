import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FileText, Download, Filter } from 'lucide-react';
import supabase from '../../lib/supabase';
import { LogAuditoria } from '../../pages/Configuracoes';

const LogsAuditoriaTable: React.FC = () => {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroUsuario, setFiltroUsuario] = useState<number | null>(null);
  const [filtroAcao, setFiltroAcao] = useState<string | null>(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState<{inicio: string, fim: string}>({
    inicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    fim: new Date().toISOString().split('T')[0]
  });
  
  // Lista de usuários para filtro
  const [listaUsuarios, setListaUsuarios] = useState<{ id: number; nome: string }[]>([]);
  
  // Lista de ações para filtro
  const [listaAcoes, setListaAcoes] = useState<string[]>([]);
  
  // Carregar logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        // Construir query base
        let query = supabase
          .from('logs_acesso')
          .select(`
            *,
            usuario:usuarios(id, nome)
          `)
          .gte('data_acesso', filtroPeriodo.inicio)
          .lte('data_acesso', `${filtroPeriodo.fim}T23:59:59`);
        
        // Adicionar filtro de usuário se especificado
        if (filtroUsuario) {
          query = query.eq('usuario_id', filtroUsuario);
        }
        
        // Adicionar filtro de ação se especificado
        if (filtroAcao) {
          query = query.eq('acao', filtroAcao);
        }
        
        const { data, error } = await query.order('data_acesso', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
          setLogs(data);
          
          // Obter lista única de ações para filtro
          const acoes = [...new Set(data.map(log => log.acao))];
          setListaAcoes(acoes);
        }
        
        // Buscar lista de usuários para filtro
        const { data: usuariosData, error: usuariosError } = await supabase
          .from('usuarios')
          .select('id, nome')
          .order('nome');
        
        if (usuariosError) throw usuariosError;
        
        if (usuariosData) {
          setListaUsuarios(usuariosData);
        }
      } catch (error) {
        console.error('Erro ao carregar logs:', error);
        toast.error('Erro ao carregar logs de auditoria');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
  }, [filtroUsuario, filtroAcao, filtroPeriodo]);
  
  // Handler para mudança de filtro de usuário
  const handleUsuarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const valor = e.target.value;
    setFiltroUsuario(valor ? parseInt(valor, 10) : null);
  };
  
  // Handler para mudança de filtro de ação
  const handleAcaoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const valor = e.target.value;
    setFiltroAcao(valor || null);
  };
  
  // Handler para mudança de período
  const handlePeriodoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFiltroPeriodo(prev => ({ ...prev, [name]: value }));
  };
  
  // Exportar para CSV
  const exportarCSV = () => {
    if (logs.length === 0) return;
    
    // Preparar dados para CSV
    const headers = ['ID', 'Usuário', 'Data/Hora', 'Ação', 'Detalhes'];
    
    const csvData = logs.map(log => [
      log.id,
      log.usuario?.nome || '-',
      new Date(log.data_acesso).toLocaleString('pt-BR'),
      log.acao,
      log.detalhes || '-'
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
    link.setAttribute('download', 'logs_auditoria.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Atalhos para períodos comuns
  const setPeriodoPreset = (preset: string) => {
    const hoje = new Date();
    let inicio = new Date();
    const fim = hoje.toISOString().split('T')[0];
    
    switch (preset) {
      case 'hoje':
        inicio = hoje;
        break;
      case '7dias':
        inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - 7);
        break;
      case '30dias':
        inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - 30);
        break;
      case 'mes':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        break;
      default:
        break;
    }
    
    setFiltroPeriodo({
      inicio: inicio.toISOString().split('T')[0],
      fim
    });
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Logs de Auditoria</h2>
          <p className="text-sm text-gray-500 mt-1">
            Visualize e exporte logs de acesso e ações dos usuários
          </p>
        </div>
        
        <button
          onClick={exportarCSV}
          disabled={logs.length === 0}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </button>
      </div>
      
      {/* Filtros */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <label htmlFor="usuario" className="block text-sm font-medium text-gray-700 mb-1">
              Usuário
            </label>
            <select
              id="usuario"
              value={filtroUsuario || ''}
              onChange={handleUsuarioChange}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="">Todos os usuários</option>
              {listaUsuarios.map(usuario => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label htmlFor="acao" className="block text-sm font-medium text-gray-700 mb-1">
              Ação
            </label>
            <select
              id="acao"
              value={filtroAcao || ''}
              onChange={handleAcaoChange}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="">Todas as ações</option>
              {listaAcoes.map(acao => (
                <option key={acao} value={acao}>
                  {acao}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Período
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                name="inicio"
                value={filtroPeriodo.inicio}
                onChange={handlePeriodoChange}
                className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
              <span className="text-gray-500">até</span>
              <input
                type="date"
                name="fim"
                value={filtroPeriodo.fim}
                onChange={handlePeriodoChange}
                className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setPeriodoPreset('hoje')}
            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriodoPreset('7dias')}
            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Últimos 7 dias
          </button>
          <button
            onClick={() => setPeriodoPreset('30dias')}
            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Últimos 30 dias
          </button>
          <button
            onClick={() => setPeriodoPreset('mes')}
            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Mês atual
          </button>
        </div>
      </div>
      
      {/* Lista de Logs */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuário
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data/Hora
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ação
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detalhes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <FileText className="h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum log encontrado</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Não há logs de auditoria para os filtros selecionados.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {log.usuario?.nome || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.data_acesso).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      log.acao === 'login' ? 'bg-green-100 text-green-800' :
                      log.acao === 'logout' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.acao}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.detalhes || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Paginação ou informações de resultados */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            Anterior
          </button>
          <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            Próximo
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Mostrando <span className="font-medium">{logs.length}</span> logs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogsAuditoriaTable;