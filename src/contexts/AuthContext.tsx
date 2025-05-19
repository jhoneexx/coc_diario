import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'react-toastify';
import supabase from '../lib/supabase';

// Tipos
interface User {
  id: number;
  nome: string;
  login: string;
  perfil: string;
  role: string; // Conveniente para verificação de acesso
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
  isGestor: () => boolean;
  isOperador: () => boolean;
  canManageSystem: () => boolean;
  canViewReports: () => boolean;
}

// Contexto de Autenticação
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider para o contexto
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verifica se o usuário já está logado ao iniciar a aplicação
  useEffect(() => {
    const checkUser = async () => {
      try {
        const storedUser = localStorage.getItem('cloudOpsUser');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          
          // Registra acesso no log
          if (parsedUser?.id) {
            await supabase.from('logs_acesso').insert({
              usuario_id: parsedUser.id,
              acao: 'sessão_recuperada',
              detalhes: 'Sessão recuperada automaticamente'
            });
            
            // Atualiza último acesso
            await supabase
              .from('usuarios')
              .update({ ultimo_acesso: new Date().toISOString() })
              .eq('id', parsedUser.id);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  // Função de login
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('login', username)
        .single();
      
      if (error || !data) {
        toast.error('Usuário não encontrado');
        return false;
      }
      
      // Verificação simples de senha (em produção, usaria bcrypt)
      if (data.senha !== password) {
        toast.error('Senha incorreta');
        return false;
      }
      
      // Mapeia o perfil para o campo role para facilitar verificações
      const user: User = {
        id: data.id,
        nome: data.nome,
        login: data.login,
        perfil: data.perfil,
        role: data.perfil // Garante o mesmo valor para ambos os campos
      };
      
      // Salva o usuário no localStorage
      localStorage.setItem('cloudOpsUser', JSON.stringify(user));
      setCurrentUser(user);
      
      // Registra login no log
      await supabase.from('logs_acesso').insert({
        usuario_id: data.id,
        acao: 'login',
        detalhes: 'Login realizado com sucesso'
      });
      
      // Atualiza último acesso
      await supabase
        .from('usuarios')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', data.id);
      
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
      // Registra logout no log se houver usuário
      if (currentUser?.id) {
        await supabase.from('logs_acesso').insert({
          usuario_id: currentUser.id,
          acao: 'logout',
          detalhes: 'Logout realizado'
        });
      }
      
      // Remove usuário do localStorage
      localStorage.removeItem('cloudOpsUser');
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

  const contextValue: AuthContextType = {
    currentUser,
    loading,
    login,
    logout,
    isAdmin,
    isGestor,
    isOperador,
    canManageSystem,
    canViewReports
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