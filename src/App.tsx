import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Layouts
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';

// Páginas
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Incidentes from './pages/Incidentes';
import NovoIncidente from './pages/NovoIncidente';
import EditarIncidente from './pages/EditarIncidente';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';
import ClienteDashboard from './pages/ClienteDashboard';
import NotFound from './pages/NotFound';
import AprovacoesIncidentes from './pages/AprovacoesIncidentes';

// Utilitários
import { initTheme } from './utils/theme';

function App() {
  const { currentUser } = useAuth();

  useEffect(() => {
    // Inicializa tema e preferências visuais
    initTheme();
  }, []);

  // Função para verificar acesso com base no perfil
  const ProtectedRoute = ({ 
    children, 
    allowedRoles 
  }: { 
    children: React.ReactNode, 
    allowedRoles: string[] 
  }) => {
    if (!currentUser) {
      return <Navigate to="/login" replace />;
    }
    
    if (!allowedRoles.includes(currentUser.role)) {
      // Redireciona para dashboard apropriado baseado no perfil
      if (currentUser.role === 'cliente') {
        return <Navigate to="/cliente" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
    
    return <>{children}</>;
  };

  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/login" element={
        <AuthLayout>
          <Login />
        </AuthLayout>
      } />
      
      <Route path="/forgot-password" element={
        <AuthLayout>
          <ForgotPassword />
        </AuthLayout>
      } />
      
      <Route path="/reset-password" element={<ResetPassword />} />
      
      <Route path="/cliente" element={<ClienteDashboard />} />
      
      {/* Rotas Protegidas */}
      <Route path="/" element={
        <AppLayout>
          <ProtectedRoute allowedRoles={['admin', 'operador', 'gestor']}>
            <Dashboard />
          </ProtectedRoute>
        </AppLayout>
      } />
      
      <Route path="/dashboard" element={
        <AppLayout>
          <ProtectedRoute allowedRoles={['admin', 'operador', 'gestor']}>
            <Dashboard />
          </ProtectedRoute>
        </AppLayout>
      } />
      
      <Route path="/incidentes" element={
        <AppLayout>
          <ProtectedRoute allowedRoles={['admin', 'operador', 'gestor']}>
            <Incidentes />
          </ProtectedRoute>
        </AppLayout>
      } />
      
      <Route path="/incidentes/novo" element={
        <AppLayout>
          <ProtectedRoute allowedRoles={['admin', 'operador', 'gestor']}>
            <NovoIncidente />
          </ProtectedRoute>
        </AppLayout>
      } />
      
      <Route path="/incidentes/editar/:id" element={
        <AppLayout>
          <ProtectedRoute allowedRoles={['admin', 'operador', 'gestor']}>
            <EditarIncidente />
          </ProtectedRoute>
        </AppLayout>
      } />
      
      <Route path="/incidentes/aprovacoes" element={
        <AppLayout>
          <ProtectedRoute allowedRoles={['admin', 'gestor']}>
            <AprovacoesIncidentes />
          </ProtectedRoute>
        </AppLayout>
      } />
      
      <Route path="/relatorios" element={
        <AppLayout>
          <ProtectedRoute allowedRoles={['admin', 'gestor']}>
            <Relatorios />
          </ProtectedRoute>
        </AppLayout>
      } />
      
      <Route path="/configuracoes" element={
        <AppLayout>
          <ProtectedRoute allowedRoles={['admin']}>
            <Configuracoes />
          </ProtectedRoute>
        </AppLayout>
      } />
      
      {/* Rota 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;