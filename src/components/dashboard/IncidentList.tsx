import React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

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
  };
  descricao: string;
}

interface IncidentListProps {
  incidentes: Incidente[];
}

const IncidentList: React.FC<IncidentListProps> = ({ incidentes }) => {
  const navigate = useNavigate();

  const handleClick = (id: number) => {
    navigate(`/incidentes/editar/${id}`);
  };

  // Função para formatar duração em horas e minutos
  const formatDuracao = (minutos: number | null) => {
    if (minutos === null) return 'Em andamento';
    
    const horas = Math.floor(minutos / 60);
    const min = minutos % 60;
    
    if (horas === 0) return `${min}min`;
    return `${horas}h ${min}min`;
  };

  // Se não houver incidentes, mostrar mensagem
  if (incidentes.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-500">Nenhum incidente encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Versão desktop - tabela completa */}
      <div className="hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Início
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ambiente
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Criticidade
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duração
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {incidentes.map((incidente) => (
              <tr 
                key={incidente.id} 
                onClick={() => handleClick(incidente.id)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {format(parseISO(incidente.inicio), 'dd/MM/yyyy')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(parseISO(incidente.inicio), 'HH:mm')}
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
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{incidente.tipo.nome}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-[${incidente.criticidade.cor}] text-white`}>
                    {incidente.criticidade.nome}
                  </span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Versão mobile - cards */}
      <div className="md:hidden space-y-4">
        {incidentes.map((incidente) => (
          <div 
            key={incidente.id}
            onClick={() => handleClick(incidente.id)}
            className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
          >
            {/* Header do card */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">#{incidente.id}</span>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  incidente.fim ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {incidente.fim ? 'Resolvido' : 'Em andamento'}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {format(parseISO(incidente.inicio), 'dd/MM/yyyy HH:mm')}
              </div>
            </div>

            {/* Ambiente e Segmento */}
            <div className="mb-2">
              <div className="text-sm font-medium text-gray-900">{incidente.ambiente.nome}</div>
              <div className="text-xs text-gray-500">{incidente.segmento.nome}</div>
            </div>

            {/* Tipo e Criticidade */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                {incidente.tipo.nome}
              </span>
              <span 
                className="text-xs px-2 py-1 rounded font-medium"
                style={{ 
                  backgroundColor: `${incidente.criticidade.cor}20`, 
                  color: incidente.criticidade.cor 
                }}
              >
                {incidente.criticidade.nome}
              </span>
            </div>

            {/* Duração */}
            <div className="text-xs text-gray-500">
              Duração: {formatDuracao(incidente.duracao_minutos)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IncidentList;