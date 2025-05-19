import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertCircle, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ChevronDown,
  User,
  CheckSquare,
  Bell
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { currentUser, logout, isAdmin, isGestor, canViewReports } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Função para verificar se uma rota está ativa
  const isActive = (path: string) => location.pathname === path;

  // Função de logout
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Toggle para o menu mobile
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  
  // Toggle para o menu de perfil
  const toggleProfileMenu = () => setProfileMenuOpen(!profileMenuOpen);
  
  // Verificar pendências de aprovação
  useEffect(() => {
    // Apenas verificar se o usuário for gestor ou admin
    if (!currentUser || (!isGestor() && !isAdmin())) {
      return;
    }
    
    const checkPendingApprovals = async () => {
      try {
        // Fetch all pending approvals first
        const { data, error } = await supabase
          .from('aprovacoes_incidentes')
          .select('*, dados_antes')
          .eq('status', 'pendente');
        
        if (error) throw error;
        
        let filteredData = data || [];
        
        // Filter data on client side for gestores
        if (isGestor() && !isAdmin()) {
          filteredData = filteredData.filter(item => 
            item.dados_antes && 
            item.dados_antes.perfil_solicitante === 'operador'
          );
        }
        
        setPendingCount(filteredData.length);
      } catch (error) {
        console.error('Erro ao verificar aprovações pendentes:', error);
      }
    };
    
    // Verificar imediatamente
    checkPendingApprovals();
    
    // E depois a cada minuto
    const interval = setInterval(checkPendingApprovals, 60000);
    
    return () => clearInterval(interval);
  }, [currentUser, isGestor, isAdmin]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={`bg-white shadow-md w-64 fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo e Título */}
          <div className="flex items-center justify-between px-6 h-16 border-b">
            <h1 className="text-xl font-semibold text-primary-600">Cloud Ops Center</h1>
            <button 
              className="md:hidden text-gray-600 hover:text-gray-900" 
              onClick={toggleSidebar}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Menu de Navegação */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            <button 
              onClick={() => navigate('/dashboard')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                isActive('/dashboard') 
                  ? 'bg-primary-50 text-primary-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <LayoutDashboard className="mr-3 h-5 w-5" />
              Dashboard
            </button>
            
            <button 
              onClick={() => navigate('/incidentes')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                isActive('/incidentes') || location.pathname.includes('/incidentes/') && !location.pathname.includes('/incidentes/aprovacoes')
                  ? 'bg-primary-50 text-primary-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <AlertCircle className="mr-3 h-5 w-5" />
              Incidentes
            </button>
            
            {(isAdmin() || isGestor()) && (
              <button 
                onClick={() => navigate('/incidentes/aprovacoes')}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive('/incidentes/aprovacoes') 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <CheckSquare className="mr-3 h-5 w-5" />
                <div className="flex items-center">
                  Aprovações
                  {pendingCount > 0 && (
                    <div className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                      {pendingCount}
                    </div>
                  )}
                </div>
              </button>
            )}
            
            {canViewReports() && (
              <button 
                onClick={() => navigate('/relatorios')}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive('/relatorios') 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="mr-3 h-5 w-5" />
                Relatórios
              </button>
            )}
            
            {isAdmin() && (
              <button 
                onClick={() => navigate('/configuracoes')}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive('/configuracoes') 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="mr-3 h-5 w-5" />
                Configurações
              </button>
            )}
          </nav>
          
          {/* Footer */}
          <div className="border-t p-4">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sair
            </button>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-6">
          <button 
            className="md:hidden text-gray-600 hover:text-gray-900" 
            onClick={toggleSidebar}
          >
            <Menu size={24} />
          </button>
          
          {/* Notificações */}
          {(isAdmin() || isGestor()) && pendingCount > 0 && (
            <div className="mr-4 md:mr-auto ml-4 md:ml-0">
              <button 
                onClick={() => navigate('/incidentes/aprovacoes')}
                className="relative p-1 text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                <Bell className="h-6 w-6" />
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                  {pendingCount}
                </span>
              </button>
            </div>
          )}
          
          {/* Profile Dropdown */}
          <div className="ml-auto relative">
            <button 
              onClick={toggleProfileMenu}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 focus:outline-none"
            >
              <div className="bg-primary-100 text-primary-700 w-8 h-8 rounded-full flex items-center justify-center">
                <User size={16} />
              </div>
              <span className="hidden md:block">{currentUser?.nome}</span>
              <ChevronDown size={16} />
            </button>
            
            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-40 animate-fadeIn">
                <div className="px-4 py-2 text-xs text-gray-500">
                  Logado como
                </div>
                <div className="px-4 py-2 text-sm border-b">
                  <p className="font-medium">{currentUser?.nome}</p>
                  <p className="text-gray-500 capitalize">{currentUser?.perfil}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
      
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
};

export default AppLayout;