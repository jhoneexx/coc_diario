import React from 'react';
import { Link } from 'react-router-dom';
import { Cloud } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary-100 p-3">
            <Cloud className="h-12 w-12 text-primary-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Cloud Operations Center
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Diário de Bordo e Monitoramento
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {children}
        </div>
        
        <div className="mt-4 text-center">
          <Link to="/cliente" className="text-sm text-primary-600 hover:text-primary-800">
            Acessar Dashboard do Cliente
          </Link>
        </div>
      </div>
      
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>&copy; 2025 Cloud Operations Center. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default AuthLayout;