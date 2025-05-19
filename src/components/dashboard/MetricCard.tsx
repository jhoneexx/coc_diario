import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  statusColor?: 'green' | 'red' | 'yellow' | 'none';
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  icon, 
  description, 
  color, 
  statusColor = 'none' 
}) => {
  // Determinar cor do status
  const getStatusColor = () => {
    switch (statusColor) {
      case 'green': return 'bg-green-500';
      case 'red': return 'bg-red-500';
      case 'yellow': return 'bg-amber-500';
      default: return 'hidden';
    }
  };

  return (
    <div className={`metric-card ${color} rounded-lg overflow-hidden`}>
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <div className="mt-1 flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
            </div>
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          </div>
          <div className="p-2 rounded-full">{icon}</div>
        </div>
      </div>
      {/* Indicador de status */}
      <div className={`h-1 ${getStatusColor()}`}></div>
    </div>
  );
};

export default MetricCard;