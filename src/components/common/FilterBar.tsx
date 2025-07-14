import React from 'react';
import { Calendar } from 'lucide-react';

interface Ambiente {
  id: number;
  nome: string;
}

interface FilterBarProps {
  ambientes: Ambiente[];
  filtroAmbiente: number | null;
  filtroPeriodo?: {
    inicio: string;
    fim: string;
  };
  setFiltroAmbiente: (id: number | null) => void;
  setFiltroPeriodo?: (periodo: {inicio: string, fim: string}) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ 
  ambientes, 
  filtroAmbiente, 
  filtroPeriodo, 
  setFiltroAmbiente, 
  setFiltroPeriodo 
}) => {
  // Handler para mudança de ambiente
  const handleAmbienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFiltroAmbiente(value ? parseInt(value, 10) : null);
  };
  
  // Handler para mudança de data
  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFiltroPeriodo && setFiltroPeriodo({
      ...filtroPeriodo,
      [name]: value
    });
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
      case 'ano':
        inicio = new Date(hoje.getFullYear(), 0, 1);
        break;
      default:
        break;
    }
    
    setFiltroPeriodo && setFiltroPeriodo({
      inicio: inicio.toISOString().split('T')[0],
      fim
    });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="flex flex-col space-y-4">
        {/* Primeira linha - Ambiente */}
        <div className="w-full">
          <label htmlFor="ambiente" className="block text-sm font-medium text-gray-700 mb-2">
            Ambiente
          </label>
          <select
            id="ambiente"
            name="ambiente"
            className="w-full h-12 px-4 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-base"
            value={filtroAmbiente || ''}
            onChange={handleAmbienteChange}
          >
            <option value="">Todos os Ambientes</option>
            {ambientes.map(ambiente => (
              <option key={ambiente.id} value={ambiente.id}>
                {ambiente.nome}
              </option>
            ))}
          </select>
        </div>
        
        {/* Renderiza os filtros de período apenas se setFiltroPeriodo for fornecido */}
        {setFiltroPeriodo && filtroPeriodo && (
          <>
            {/* Segunda linha - Período */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Período
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
                <div className="flex-1">
                  <input
                    type="date"
                    name="inicio"
                    value={filtroPeriodo.inicio}
                    onChange={handleDataChange}
                    className="w-full h-12 px-4 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-base"
                  />
                </div>
                <span className="text-gray-500 text-center sm:text-left text-sm">até</span>
                <div className="flex-1">
                  <input
                    type="date"
                    name="fim"
                    value={filtroPeriodo.fim}
                    onChange={handleDataChange}
                    className="w-full h-12 px-4 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-base"
                  />
                </div>
              </div>
            </div>
            
            {/* Terceira linha - Atalhos de Período */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Atalhos de Período
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodoPreset('hoje')}
                  className="inline-flex items-center justify-center px-3 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 active:bg-gray-100 transition-colors"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodoPreset('7dias')}
                  className="inline-flex items-center justify-center px-3 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 active:bg-gray-100 transition-colors"
                >
                  7 dias
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodoPreset('30dias')}
                  className="inline-flex items-center justify-center px-3 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 active:bg-gray-100 transition-colors"
                >
                  30 dias
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodoPreset('mes')}
                  className="inline-flex items-center justify-center px-3 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 active:bg-gray-100 transition-colors"
                >
                  Mês atual
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodoPreset('ano')}
                  className="inline-flex items-center justify-center px-3 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 active:bg-gray-100 transition-colors col-span-2 sm:col-span-1"
                >
                  Ano atual
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FilterBar;