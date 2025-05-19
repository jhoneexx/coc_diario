import React, { useMemo } from 'react';
import { Award, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetaAtingimentoCardProps {
  titulo: string;
  valor: number;
  meta: number | undefined;
  unidade: string;
  descricao?: string;
  pesoPercentual?: number;
  menorMelhor?: boolean; // Para métricas como MTTR, valores menores são melhores
  permiteSuperacao?: boolean; // Indica se o percentual pode ultrapassar 100%
  icon?: React.ReactNode;
}

const MetaAtingimentoCard: React.FC<MetaAtingimentoCardProps> = ({
  titulo,
  valor,
  meta,
  unidade,
  descricao,
  pesoPercentual,
  menorMelhor = false,
  permiteSuperacao = true,
  icon
}) => {
  // Calcular percentual de atingimento
  const percentualAtingimento = useMemo(() => {
    if (!meta || meta === 0) return 100;

    let percentual;
    if (menorMelhor) {
      // Para métricas onde valores menores são melhores (ex: MTTR)
      percentual = (meta / Math.max(0.001, valor)) * 100;
    } else {
      // Para métricas onde valores maiores são melhores (ex: MTBF, Disponibilidade)
      percentual = (valor / meta) * 100;
    }
    
    // Se não permitir superação, limitar a 100%
    if (!permiteSuperacao) {
      return Math.min(100, percentual);
    }
    
    // Caso especial: disponibilidade nunca deve ultrapassar 100%
    if (unidade === '%') {
      return Math.min(100, percentual);
    }
    
    return percentual;
  }, [valor, meta, menorMelhor, permiteSuperacao, unidade]);

  // Determinar status baseado no percentual de atingimento
  const status = useMemo(() => {
    if (percentualAtingimento >= 95) return 'excelente';
    if (percentualAtingimento >= 80) return 'bom';
    if (percentualAtingimento >= 60) return 'regular';
    return 'ruim';
  }, [percentualAtingimento]);

  // Obter cores baseadas no status
  const getStatusColor = () => {
    switch (status) {
      case 'excelente': return 'text-green-600 bg-green-100';
      case 'bom': return 'text-blue-600 bg-blue-100';
      case 'regular': return 'text-amber-600 bg-amber-100';
      case 'ruim': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Obter ícone de tendência
  const getTrendIcon = () => {
    if (!meta) return <Minus className="h-4 w-4" />;
    
    if (menorMelhor) {
      return valor <= meta 
        ? <ArrowDownRight className="h-4 w-4 text-green-600" /> 
        : <ArrowUpRight className="h-4 w-4 text-red-600" />;
    } else {
      return valor >= meta 
        ? <ArrowUpRight className="h-4 w-4 text-green-600" /> 
        : <ArrowDownRight className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 transition-all hover:shadow-md">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center">
            <h3 className="text-sm font-medium text-gray-500">{titulo}</h3>
            {pesoPercentual !== undefined && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                {pesoPercentual}%
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{valor.toFixed(2)}</p>
            <p className="ml-1 text-sm text-gray-500">{unidade}</p>
          </div>
        </div>
        <div className="p-2 rounded-full bg-gray-50">
          {icon || <Award className="h-5 w-5 text-blue-500" />}
        </div>
      </div>
      
      {meta !== undefined && (
        <>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-gray-500">Meta: {meta.toFixed(2)} {unidade}</span>
            <span className="text-xs text-gray-500">
              Atingimento: {percentualAtingimento > 999 ? '999+' : percentualAtingimento.toFixed(0)}%
            </span>
          </div>
          
          <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                percentualAtingimento >= 95 ? 'bg-green-500' :
                percentualAtingimento >= 80 ? 'bg-blue-500' :
                percentualAtingimento >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, percentualAtingimento)}%` }}
            ></div>
          </div>
        </>
      )}
      
      {descricao && (
        <div className="mt-2 flex items-center">
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getStatusColor()}`}>
            {getTrendIcon()}
            <span>{descricao}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaAtingimentoCard;