import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle, Info, Search, Filter, Eye } from 'lucide-react';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import FilterBar from '../components/common/FilterBar';

// Tipos
interface Ambiente {
  id: number;
  nome: string;
}

interface Usuario {
  id: number;
  nome: string;
  perfil: string;
}

interface AprovacaoIncidente {
  id: number;
  incidente_id: number;
  tipo_operacao: 'edicao' | 'exclusao';
  dados_antes: any;
  dados_depois: any;
  solicitado_por: number;
  solicitado_em: string;
  aprovador_id: number | null;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  data_aprovacao: string | null;
  motivo_rejeicao: string | null;
  // Relações
  incidente: {
    id: number;
    inicio: string;
    tipo: { nome: string };
    ambiente: { nome: string };
    segmento: { nome: string };
    criticidade: { nome: string; cor: string };
  };
  usuario_solicitante: {
    id: number;
    nome: string;
    perfil: string;
  };
  usuario_aprovador?: {
    id: number;
    nome: string;
    perfil: string;
  } | null;
}

const AprovacoesIncidentes: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isGestor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aprovacoes, setAprovacoes] = useState<AprovacaoIncidente[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [modalAprovacao, setModalAprovacao] = useState<AprovacaoIncidente | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  
  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('pendente');
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
        
        // As aprovações serão carregadas em outro useEffect que depende dos filtros
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Efeito para carregar aprovações quando os filtros mudam
  useEffect(() => {
    const fetchAprovacoes = async () => {
      setLoading(true);
      try {
        // Construir query base
        let query = supabase
          .from('aprovacoes_incidentes')
          .select(`
            *,
            dados_antes,
            dados_depois,
            incidente:incidentes(
              id,
              inicio,
              tipo:tipos_incidente(nome),
              ambiente:ambientes(nome),
              segmento:segmentos(nome),
              criticidade:criticidades(nome, cor)
            ),
            usuario_solicitante:usuarios!solicitado_por(id, nome, perfil)
          `)
          .gte('solicitado_em', filtroPeriodo.inicio)
          .lte('solicitado_em', `${filtroPeriodo.fim}T23:59:59`);
        
        // Adicionar filtro de status
        if (filtroStatus) {
          query = query.eq('status', filtroStatus);
        }
        
        // Adicionar filtro de ambiente se especificado
        // Note: isso é um pouco mais complexo pois precisamos filtrar em uma relação aninhada
        if (filtroAmbiente) {
          // Primeiro, buscamos os IDs dos incidentes do ambiente
          const { data: incidentesDoAmbiente } = await supabase
            .from('incidentes')
            .select('id')
            .eq('ambiente_id', filtroAmbiente);
          
          if (incidentesDoAmbiente && incidentesDoAmbiente.length > 0) {
            const incidenteIds = incidentesDoAmbiente.map(inc => inc.id);
            query = query.in('incidente_id', incidenteIds);
          } else {
            // Se não houver incidentes nesse ambiente, retornamos lista vazia
            setAprovacoes([]);
            setLoading(false);
            return;
          }
        }
        
        const { data, error } = await query.order('solicitado_em', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
          // Armazenar os IDs dos aprovadores para buscar seus detalhes
          const aprovadorIds = data
            .filter(item => item.aprovador_id !== null)
            .map(item => item.aprovador_id);
          
          // Inicialmente configuramos os aprovadores como null
          const aprovacoesWithoutAprovador = data.map(item => ({
            ...item,
            usuario_aprovador: null
          })) as AprovacaoIncidente[];
          
          setAprovacoes(aprovacoesWithoutAprovador);
          
          // Atualizar contador de pendências
          const pendentes = data.filter(item => item.status === 'pendente');
          setPendingCount(pendentes.length);
          
          // Buscar informações dos aprovadores em uma consulta separada
          if (aprovadorIds.length > 0) {
            const { data: aprovadoresData, error: aprovadoresError } = await supabase
              .from('usuarios')
              .select('id, nome, perfil')
              .in('id', aprovadorIds);
            
            if (aprovadoresError) {
              console.error('Erro ao buscar informações dos aprovadores:', aprovadoresError);
            } else if (aprovadoresData) {
              // Mapear aprovadores e atualizar o estado
              const aprovadoresMap = new Map<number, Usuario>();
              aprovadoresData.forEach(aprovador => {
                aprovadoresMap.set(aprovador.id, aprovador);
              });
              
              // Atualizar aprovações com informações dos aprovadores
              setAprovacoes(prev => prev.map(ap => {
                if (ap.aprovador_id && aprovadoresMap.has(ap.aprovador_id)) {
                  return {
                    ...ap,
                    usuario_aprovador: aprovadoresMap.get(ap.aprovador_id) || null
                  };
                }
                return ap;
              }));
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar aprovações:', error);
        toast.error('Erro ao carregar solicitações de aprovação');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAprovacoes();
  }, [filtroStatus, filtroAmbiente, filtroPeriodo, isAdmin, isGestor]);

  // Handler para ver detalhes e aprovar/rejeitar
  const handleVerDetalhes = (aprovacao: AprovacaoIncidente) => {
    setModalAprovacao(aprovacao);
    setMotivoRejeicao('');
  };
  
  // Verificar se o usuário atual pode aprovar esta solicitação
  const podeAprovar = (aprovacao: AprovacaoIncidente) => {
    if (!currentUser) return false;
    
    // Solicitações já processadas não podem ser aprovadas novamente
    if (aprovacao.status !== 'pendente') return false;
    
    // Admin pode aprovar tudo
    if (isAdmin()) return true;
    
    // Gestor só pode aprovar solicitações de operadores
    if (isGestor() && aprovacao.usuario_solicitante.perfil === 'operador') {
      return true;
    }
    
    return false;
  };
  
  // Aprovar solicitação
  const handleAprovar = async () => {
    if (!modalAprovacao || !currentUser) return;
    
    try {
      setLoading(true);
      
      if (modalAprovacao.tipo_operacao === 'edicao') {
        // Aprovar edição - Atualizar o incidente com os dados novos
        const { error: updateError } = await supabase
          .from('incidentes')
          .update(modalAprovacao.dados_depois)
          .eq('id', modalAprovacao.incidente_id);
        
        if (updateError) throw updateError;
        
        // Atualizar o status da aprovação
        const { error: approvalError } = await supabase
          .from('aprovacoes_incidentes')
          .update({
            status: 'aprovado',
            aprovador_id: currentUser.id,
            data_aprovacao: new Date().toISOString()
          })
          .eq('id', modalAprovacao.id);
        
        if (approvalError) throw approvalError;
        
        toast.success('Edição do incidente aprovada com sucesso!');
      } else if (modalAprovacao.tipo_operacao === 'exclusao') {
        // Aprovar exclusão - Excluir o incidente
        const { error: deleteError } = await supabase
          .from('incidentes')
          .delete()
          .eq('id', modalAprovacao.incidente_id);
        
        if (deleteError) throw deleteError;
        
        // Atualizar o status da aprovação
        const { error: approvalError } = await supabase
          .from('aprovacoes_incidentes')
          .update({
            status: 'aprovado',
            aprovador_id: currentUser.id,
            data_aprovacao: new Date().toISOString()
          })
          .eq('id', modalAprovacao.id);
        
        if (approvalError) throw approvalError;
        
        toast.success('Exclusão do incidente aprovada com sucesso!');
      }
      
      // Atualizar a lista de aprovações
      setAprovacoes(prev => prev.map(ap => 
        ap.id === modalAprovacao.id 
          ? {
              ...ap,
              status: 'aprovado',
              aprovador_id: currentUser.id,
              data_aprovacao: new Date().toISOString(),
              usuario_aprovador: {
                id: currentUser.id,
                nome: currentUser.nome,
                perfil: currentUser.role
              }
            }
          : ap
      ));
      
      // Atualizar contador de pendências
      setPendingCount(prev => prev - 1);
      
      // Fechar modal
      setModalAprovacao(null);
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      toast.error('Erro ao processar a aprovação');
    } finally {
      setLoading(false);
    }
  };
  
  // Rejeitar solicitação
  const handleRejeitar = async () => {
    if (!modalAprovacao || !currentUser || !motivoRejeicao.trim()) {
      toast.error('Por favor, informe o motivo da rejeição');
      return;
    }
    
    try {
      setLoading(true);
      
      // Atualizar o status da aprovação
      const { error } = await supabase
        .from('aprovacoes_incidentes')
        .update({
          status: 'rejeitado',
          aprovador_id: currentUser.id,
          data_aprovacao: new Date().toISOString(),
          motivo_rejeicao: motivoRejeicao
        })
        .eq('id', modalAprovacao.id);
      
      if (error) throw error;
      
      // Atualizar a lista de aprovações
      setAprovacoes(prev => prev.map(ap => 
        ap.id === modalAprovacao.id 
          ? {
              ...ap,
              status: 'rejeitado',
              aprovador_id: currentUser.id,
              data_aprovacao: new Date().toISOString(),
              motivo_rejeicao: motivoRejeicao,
              usuario_aprovador: {
                id: currentUser.id,
                nome: currentUser.nome,
                perfil: currentUser.role
              }
            }
          : ap
      ));
      
      // Atualizar contador de pendências
      setPendingCount(prev => prev - 1);
      
      toast.success('Solicitação rejeitada com sucesso');
      
      // Fechar modal
      setModalAprovacao(null);
      setMotivoRejeicao('');
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      toast.error('Erro ao processar a rejeição');
    } finally {
      setLoading(false);
    }
  };

  // Handler para mudança de status
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroStatus(e.target.value);
  };
  
  // Formatar diferenças entre versões para exibição
  const formatarDiferencas = (aprovacao: AprovacaoIncidente) => {
    if (aprovacao.tipo_operacao === 'exclusao') {
      return (
        <div className="text-red-600 font-medium">
          Solicitação para excluir o incidente
        </div>
      );
    }
    
    const dadosAntes = aprovacao.dados_antes;
    const dadosDepois = aprovacao.dados_depois;
    const diferencas: JSX.Element[] = [];
    
    // Campos para verificar diferenças
    const camposComparacao = [
      { chave: 'inicio', nome: 'Data/hora de início' },
      { chave: 'fim', nome: 'Data/hora de fim' },
      { chave: 'tipo_id', nome: 'Tipo de incidente', isRef: true, refName: 'tipo' },
      { chave: 'ambiente_id', nome: 'Ambiente', isRef: true, refName: 'ambiente' },
      { chave: 'segmento_id', nome: 'Segmento', isRef: true, refName: 'segmento' },
      { chave: 'criticidade_id', nome: 'Criticidade', isRef: true, refName: 'criticidade' },
      { chave: 'descricao', nome: 'Descrição' },
      { chave: 'acoes_tomadas', nome: 'Ações tomadas' }
    ];
    
    camposComparacao.forEach(campo => {
      if (dadosAntes[campo.chave] !== dadosDepois[campo.chave]) {
        diferencas.push(
          <div key={campo.chave} className="mb-2 pb-2 border-b border-gray-100">
            <div className="font-medium text-sm">{campo.nome}:</div>
            <div className="text-sm text-red-600 line-through">
              {campo.isRef 
                ? dadosAntes[`${campo.refName}_nome`] 
                : (
                    // Formatar datas se for início ou fim
                    campo.chave === 'inicio' || campo.chave === 'fim' 
                      ? dadosAntes[campo.chave] 
                        ? new Date(dadosAntes[campo.chave]).toLocaleString('pt-BR')
                        : 'Não informado'
                      : (dadosAntes[campo.chave] || 'Não informado')
                  )
              }
            </div>
            <div className="text-sm text-green-600">
              {campo.isRef 
                ? dadosDepois[`${campo.refName}_nome`] 
                : (
                    // Formatar datas se for início ou fim
                    campo.chave === 'inicio' || campo.chave === 'fim' 
                      ? dadosDepois[campo.chave] 
                        ? new Date(dadosDepois[campo.chave]).toLocaleString('pt-BR')
                        : 'Não informado'
                      : (dadosDepois[campo.chave] || 'Não informado')
                  )
              }
            </div>
          </div>
        );
      }
    });
    
    return diferencas.length > 0 ? diferencas : <div>Sem alterações significativas</div>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Aprovações de Incidentes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie solicitações de edição e exclusão de incidentes
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          {/* Seletor de status */}
          <select
            value={filtroStatus}
            onChange={handleStatusChange}
            className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-500 focus:ring-opacity-50 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Aprovados</option>
            <option value="rejeitado">Rejeitados</option>
          </select>
        </div>
      </div>
      
      {/* Filtros */}
      <FilterBar 
        ambientes={ambientes}
        filtroAmbiente={filtroAmbiente}
        filtroPeriodo={filtroPeriodo}
        setFiltroAmbiente={setFiltroAmbiente}
        setFiltroPeriodo={setFiltroPeriodo}
      />
      
      {/* Lista de Aprovações */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Solicitações de Aprovação</h2>
          <p className="text-sm text-gray-500 mt-1">
            {pendingCount} solicitações pendentes
          </p>
        </div>
        
        {loading ? (
          <div className="text-center py-6">
            <div className="animate-pulse flex space-x-4 justify-center">
              <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
              <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
              <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Carregando solicitações...</p>
          </div>
        ) : aprovacoes.length === 0 ? (
          <div className="text-center py-12">
            <Info className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma solicitação encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filtroStatus 
                ? `Não há solicitações com status "${filtroStatus}" para os filtros selecionados.`
                : 'Não há solicitações para os filtros selecionados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Incidente
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operação
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Solicitante
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Solicitação
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {aprovacoes.map(aprovacao => (
                  <tr 
                    key={aprovacao.id} 
                    className={`hover:bg-gray-50 transition-colors ${
                      aprovacao.status === 'pendente' ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {aprovacao.incidente ? `#${aprovacao.incidente.id} - ${aprovacao.incidente.ambiente.nome}` : 'Incidente não encontrado'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {aprovacao.incidente 
                          ? `${aprovacao.incidente.tipo.nome} - ${new Date(aprovacao.incidente.inicio).toLocaleDateString('pt-BR')}`
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        aprovacao.tipo_operacao === 'edicao'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {aprovacao.tipo_operacao === 'edicao' ? 'Edição' : 'Exclusão'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {aprovacao.usuario_solicitante?.nome || '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {aprovacao.usuario_solicitante?.perfil === 'admin' ? 'Administrador' : 
                         aprovacao.usuario_solicitante?.perfil === 'gestor' ? 'Gestor' : 'Operador'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(aprovacao.solicitado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        aprovacao.status === 'pendente'
                          ? 'bg-yellow-100 text-yellow-800'
                          : aprovacao.status === 'aprovado'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {aprovacao.status === 'pendente'
                          ? 'Pendente'
                          : aprovacao.status === 'aprovado'
                            ? 'Aprovado'
                            : 'Rejeitado'}
                      </span>
                      {aprovacao.status !== 'pendente' && aprovacao.usuario_aprovador && (
                        <div className="text-xs text-gray-500 mt-1">
                          por {aprovacao.usuario_aprovador.nome}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleVerDetalhes(aprovacao)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Modal de Detalhes e Aprovação */}
      {modalAprovacao && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium text-gray-900">
                Detalhes da Solicitação
              </h3>
              <button 
                onClick={() => setModalAprovacao(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Informações da solicitação */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Informações da Solicitação</h4>
                <div className="text-sm space-y-2">
                  <p>
                    <span className="font-medium">Tipo de operação:</span>{' '}
                    {modalAprovacao.tipo_operacao === 'edicao' ? 'Edição' : 'Exclusão'}
                  </p>
                  <p>
                    <span className="font-medium">Solicitado por:</span>{' '}
                    {modalAprovacao.usuario_solicitante?.nome} ({
                      modalAprovacao.usuario_solicitante?.perfil === 'admin' ? 'Administrador' : 
                      modalAprovacao.usuario_solicitante?.perfil === 'gestor' ? 'Gestor' : 'Operador'
                    })
                  </p>
                  <p>
                    <span className="font-medium">Data da solicitação:</span>{' '}
                    {new Date(modalAprovacao.solicitado_em).toLocaleString('pt-BR')}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      modalAprovacao.status === 'pendente'
                        ? 'bg-yellow-100 text-yellow-800'
                        : modalAprovacao.status === 'aprovado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {modalAprovacao.status === 'pendente'
                        ? 'Pendente'
                        : modalAprovacao.status === 'aprovado'
                          ? 'Aprovado'
                          : 'Rejeitado'}
                    </span>
                  </p>
                  {modalAprovacao.status !== 'pendente' && modalAprovacao.usuario_aprovador && (
                    <>
                      <p>
                        <span className="font-medium">Processado por:</span>{' '}
                        {modalAprovacao.usuario_aprovador.nome} ({
                          modalAprovacao.usuario_aprovador.perfil === 'admin' ? 'Administrador' : 
                          modalAprovacao.usuario_aprovador.perfil === 'gestor' ? 'Gestor' : 'Operador'
                        })
                      </p>
                      <p>
                        <span className="font-medium">Data do processamento:</span>{' '}
                        {modalAprovacao.data_aprovacao ? new Date(modalAprovacao.data_aprovacao).toLocaleString('pt-BR') : '-'}
                      </p>
                    </>
                  )}
                  {modalAprovacao.status === 'rejeitado' && modalAprovacao.motivo_rejeicao && (
                    <p>
                      <span className="font-medium">Motivo da rejeição:</span>{' '}
                      {modalAprovacao.motivo_rejeicao}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Informações do incidente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Informações do Incidente</h4>
                {modalAprovacao.incidente ? (
                  <div className="text-sm space-y-2">
                    <p>
                      <span className="font-medium">ID:</span> #{modalAprovacao.incidente.id}
                    </p>
                    <p>
                      <span className="font-medium">Data/hora de início:</span>{' '}
                      {new Date(modalAprovacao.incidente.inicio).toLocaleString('pt-BR')}
                    </p>
                    <p>
                      <span className="font-medium">Ambiente:</span>{' '}
                      {modalAprovacao.incidente.ambiente.nome}
                    </p>
                    <p>
                      <span className="font-medium">Segmento:</span>{' '}
                      {modalAprovacao.incidente.segmento.nome}
                    </p>
                    <p>
                      <span className="font-medium">Tipo:</span>{' '}
                      {modalAprovacao.incidente.tipo.nome}
                    </p>
                    <p>
                      <span className="font-medium">Criticidade:</span>{' '}
                      <span 
                        className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        style={{ 
                          backgroundColor: `${modalAprovacao.incidente.criticidade.cor}20`, 
                          color: modalAprovacao.incidente.criticidade.cor 
                        }}
                      >
                        {modalAprovacao.incidente.criticidade.nome}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Incidente não encontrado ou já excluído</p>
                )}
              </div>
            </div>
            
            {/* Alterações (no caso de edição) */}
            {modalAprovacao.tipo_operacao === 'edicao' && (
              <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Alterações Solicitadas</h4>
                <div className="text-sm">
                  {formatarDiferencas(modalAprovacao)}
                </div>
              </div>
            )}
            
            {/* Campo para motivo de rejeição (apenas para solicitações pendentes) */}
            {modalAprovacao.status === 'pendente' && podeAprovar(modalAprovacao) && (
              <div className="mt-4">
                <label htmlFor="motivo_rejeicao" className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo da rejeição (necessário apenas para rejeitar)
                </label>
                <textarea
                  id="motivo_rejeicao"
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  rows={2}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Informe o motivo caso vá rejeitar a solicitação..."
                ></textarea>
              </div>
            )}
            
            {/* Botões de ação */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setModalAprovacao(null)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Fechar
              </button>
              
              {modalAprovacao.status === 'pendente' && podeAprovar(modalAprovacao) && (
                <>
                  <div className="mr-2 flex items-center text-yellow-600 font-medium text-sm">
                    {pendingCount > 0 && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleRejeitar}
                    disabled={!motivoRejeicao.trim()}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Rejeitar
                  </button>
                  <button
                    onClick={handleAprovar}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Aprovar
                  </button>
                </>
              )}
              
              {modalAprovacao.status !== 'pendente' && (
                <div className="px-4 py-2 text-sm text-gray-700">
                  Esta solicitação já foi {modalAprovacao.status === 'aprovado' ? 'aprovada' : 'rejeitada'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AprovacoesIncidentes;