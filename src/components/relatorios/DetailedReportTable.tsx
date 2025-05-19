import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowUpDown, Search } from 'lucide-react';

interface Incidente {
  id: number;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  tipo: { nome: string };
  ambiente: { nome: string };
  segmento: { nome: string };
  criticidade: { 
    nome: string;
    cor: string;
    is_downtime: boolean;
  };
  descricao: string;
  acoes_tomadas: string | null;
  criado_por: string;
}

interface DetailedReportTableProps {
  incidentes: Incidente[];
  onRowClick?: (id: number) => void;
}

// Tipo para ordenação
type SortField = 'inicio' | 'ambiente' | 'tipo' | 'criticidade' | 'duracao' | null;
type SortDirection = 'asc' | 'desc';

const DetailedReportTable: React.FC<DetailedReportTableProps> = ({ 
  incidentes,
  onRowClick
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{field: SortField, direction: SortDirection}>({
    field: null,
    direction: 'desc'
  });
  const [filteredIncidentes, setFilteredIncidentes] = useState<Incidente[]>(incidentes);
  
  // Atualizar incidentes filtrados quando os incidentes ou termo de busca mudam
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredIncidentes(sortIncidentes(incidentes));
      return;
    }
    
    const termLower = searchTerm.toLowerCase();
    const filtered = incidentes.filter(inc => 
      inc.ambiente.nome.toLowerCase().includes(termLower) ||
      inc.segmento.nome.toLowerCase().includes(termLower) ||
      inc.tipo.nome.toLowerCase().includes(termLower) ||
      inc.criticidade.nome.toLowerCase().includes(termLower) ||
      inc.descricao.toLowerCase().includes(termLower) ||
      (inc.acoes_tomadas && inc.acoes_tomadas.toLowerCase().includes(termLower))
    );
    
    setFilteredIncidentes(sortIncidentes(filtered));
  }, [searchTerm, incidentes, sortConfig]);
  
  // Ordenar incidentes
  const sortIncidentes = (incs: Incidente[]) => {
    if (!sortConfig.field) return [...incs];
    
    return [...incs].sort((a, b) => {
      if (sortConfig.field === 'inicio') {
        return sortConfig.direction === 'asc'
          ? new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
          : new Date(b.inicio).getTime() - new Date(a.inicio).getTime();
      }
      
      if (sortConfig.field === 'ambiente') {
        return sortConfig.direction === 'asc'
          ? a.ambiente.nome.localeCompare(b.ambiente.nome)
          : b.ambiente.nome.localeCompare(a.ambiente.nome);
      }
      
      if (sortConfig.field === 'tipo') {
        return sortConfig.direction === 'asc'
          ? a.tipo.nome.localeCompare(b.tipo.nome)
          : b.tipo.nome.localeCompare(a.tipo.nome);
      }
      
      if (sortConfig.field === 'criticidade') {
        return sortConfig.direction === 'asc'
          ? a.criticidade.nome.localeCompare(b.criticidade.nome)
          : b.criticidade.nome.localeCompare(a.criticidade.nome);
      }
      
      if (sortConfig.field === 'duracao') {
        const duracaoA = a.duracao_minutos || 0;
        const duracaoB = b.duracao_minutos || 0;
        return sortConfig.direction === 'asc'
          ? duracaoA - duracaoB
          : duracaoB - duracaoA;
      }
      
      return 0;
    });
  };
  
  // Função para alternar ordenação
  const toggleSort = (field: SortField) => {
    if (sortConfig.field === field) {
      setSortConfig({
        field,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setSortConfig({
        field,
        direction: 'asc'
      });
    }
  };
  
  // Função para renderizar ícone de ordenação
  const renderSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />;
    }
    
    return <ArrowUpDown className="h-4 w-4 ml-1" />;
  };
  
  // Função para formatar duração em horas e minutos
  const formatDuracao = (minutos: number | null) => {
    if (minutos === null) return 'Em andamento';
    
    const horas = Math.floor(minutos / 60);
    const min = minutos % 60;
    
    if (horas === 0) return `${min}min`;
    return `${horas}h ${min}min`;
  };
  
  // Handle click em linha da tabela
  const handleRowClick = (id: number) => {
    if (onRowClick) {
      onRowClick(id);
    } else {
      navigate(`/incidentes/editar/${id}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header com busca */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-primary-500 focus:ring focus:ring-primary-500 focus:ring-opacity-50"
            placeholder="Buscar em incidentes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Tabela de incidentes */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('inicio')}
              >
                <div className="flex items-center">
                  Início
                  {renderSortIcon('inicio')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('ambiente')}
              >
                <div className="flex items-center">
                  Ambiente
                  {renderSortIcon('ambiente')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('tipo')}
              >
                <div className="flex items-center">
                  Tipo
                  {renderSortIcon('tipo')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('criticidade')}
              >
                <div className="flex items-center">
                  Criticidade
                  {renderSortIcon('criticidade')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('duracao')}
              >
                <div className="flex items-center">
                  Duração
                  {renderSortIcon('duracao')}
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registrado por
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredIncidentes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchTerm ? 'Nenhum incidente encontrado com esse termo de busca.' : 'Nenhum incidente encontrado.'}
                </td>
              </tr>
            ) : (
              filteredIncidentes.map((incidente) => (
                <tr 
                  key={incidente.id} 
                  onClick={() => handleRowClick(incidente.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(incidente.inicio).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(incidente.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {incidente.ambiente.nome}
                    </div>
                    <div className="text-xs text-gray-500">
                      {incidente.segmento.nome}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {incidente.tipo.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span 
                      className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                      style={{ 
                        backgroundColor: `${incidente.criticidade.cor}20`, 
                        color: incidente.criticidade.cor 
                      }}
                    >
                      {incidente.criticidade.nome}
                    </span>
                    {incidente.criticidade.is_downtime && (
                      <div className="text-xs text-red-500 mt-1 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Downtime
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuracao(incidente.duracao_minutos)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      incidente.fim ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {incidente.fim ? 'Resolvido' : 'Em andamento'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {incidente.criado_por}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Paginação ou informações finais */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex justify-between sm:hidden">
          <div></div>
          <div></div>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Mostrando <span className="font-medium">{filteredIncidentes.length}</span> de{" "}
              <span className="font-medium">{incidentes.length}</span> incidentes
              {searchTerm && ` (filtrados por "${searchTerm}")`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailedReportTable;