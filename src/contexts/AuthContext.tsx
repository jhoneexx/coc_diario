import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'react-toastify';
import supabase from '../lib/supabase';

// Tipos
interface User {
  id: number;
  nome: string;
  login: string;
  email: string;
  perfil: string;
  role: string; // Conveniente para verificação de acesso
  auth_user_id: string; // ID do usuário no Supabase Auth
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
  isGestor: () => boolean;
  isOperador: () => boolean;
  canManageSystem: () => boolean;
  canViewReports: () => boolean;
  canApproveRequests: () => boolean;
}

// Contexto de Autenticação
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider para o contexto
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Função para buscar dados do usuário na tabela public.usuarios
  const fetchUserProfile = async (authUserId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single();
      
      if (error || !data) {
        console.error('Erro ao buscar perfil do usuário:', error);
        return null;
      }
      
      // Mapear dados para o formato esperado
      return {
        id: data.id,
        nome: data.nome,
        login: data.login || data.email,
        email: data.email,
        perfil: data.perfil,
        role: data.perfil,
        auth_user_id: authUserId
      };
    } catch (error) {
      console.error('Erro ao buscar perfil do usuário:', error);
      return null;
    }
  };

  // Verifica se o usuário já está logado ao iniciar a aplicação
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Verificar sessão atual
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao verificar sessão:', error);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          // Buscar dados do perfil do usuário
          const userProfile = await fetchUserProfile(session.user.id);
          
          if (userProfile) {
            setCurrentUser(userProfile);
            
            // Registrar acesso no log
            await supabase.from('logs_acesso').insert({
              usuario_id: userProfile.id,
              acao: 'sessão_recuperada',
              detalhes: 'Sessão recuperada automaticamente'
            });
            
            // Atualizar último acesso
            await supabase
              .from('usuarios')
              .update({ ultimo_acesso: new Date().toISOString() })
              .eq('id', userProfile.id);
          } else {
            // Se não encontrou o perfil, fazer logout
            await supabase.auth.signOut();
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Escutar mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const userProfile = await fetchUserProfile(session.user.id);
          if (userProfile) {
            setCurrentUser(userProfile);
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Função de login
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('E-mail ou senha incorretos');
        } else {
          toast.error('Erro ao fazer login: ' + error.message);
        }
        return false;
      }
      
      if (!data.user) {
        toast.error('Erro ao fazer login');
        return false;
      }
      
      // Buscar dados do perfil do usuário
      const userProfile = await fetchUserProfile(data.user.id);
      
      if (!userProfile) {
        toast.error('Usuário não encontrado no sistema');
        await supabase.auth.signOut();
        return false;
      }
      
      setCurrentUser(userProfile);
      
      // Registrar login no log
      await supabase.from('logs_acesso').insert({
        usuario_id: userProfile.id,
        acao: 'login',
        detalhes: 'Login realizado com sucesso via Supabase Auth'
      });
      
      // Atualizar último acesso
      await supabase
        .from('usuarios')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', userProfile.id);
      
      toast.success('Login realizado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      toast.error('Erro ao fazer login. Tente novamente.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Função de logout
  const logout = async (): Promise<void> => {
    try {
      // Registrar logout no log se houver usuário
      if (currentUser?.id) {
        await supabase.from('logs_acesso').insert({
          usuario_id: currentUser.id,
          acao: 'logout',
          detalhes: 'Logout realizado'
        });
      }
      
      // Fazer logout no Supabase Auth
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Erro ao fazer logout:', error);
      }
      
      setCurrentUser(null);
      toast.info('Logout realizado com sucesso');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  // Funções de verificação de perfil
  const isAdmin = (): boolean => currentUser?.role === 'admin';
  const isGestor = (): boolean => currentUser?.role === 'gestor';
  const isOperador = (): boolean => currentUser?.role === 'operador';
  
  // Funções de verificação de permissões
  const canManageSystem = (): boolean => isAdmin();
  const canViewReports = (): boolean => isAdmin() || isGestor();
  const canApproveRequests = (): boolean => isAdmin() || isGestor();

  const contextValue: AuthContextType = {
    currentUser,
    loading,
    login,
    logout,
    isAdmin,
    isGestor,
    isOperador,
    canManageSystem,
    canViewReports,
    canApproveRequests
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// Hook para usar o contexto
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};