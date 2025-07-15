import supabase from '../lib/supabase';
import { toast } from 'react-toastify';

interface LegacyUser {
  id: number;
  nome: string;
  login: string;
  senha: string;
  perfil: string;
}

interface MigrationResult {
  success: number;
  errors: number;
  details: string[];
}

/**
 * Script de migração de usuários para o Supabase Auth
 * ATENÇÃO: Este script deve ser executado apenas UMA VEZ
 */
export const migrateUsersToSupabaseAuth = async (): Promise<MigrationResult> => {
  const result: MigrationResult = {
    success: 0,
    errors: 0,
    details: []
  };

  try {
    // 1. Buscar todos os usuários que ainda não foram migrados
    const { data: legacyUsers, error: fetchError } = await supabase
      .from('usuarios')
      .select('id, nome, login, senha, perfil')
      .is('auth_user_id', null)
      .not('senha', 'is', null);

    if (fetchError) {
      throw new Error(`Erro ao buscar usuários: ${fetchError.message}`);
    }

    if (!legacyUsers || legacyUsers.length === 0) {
      result.details.push('Nenhum usuário encontrado para migração');
      return result;
    }

    result.details.push(`Encontrados ${legacyUsers.length} usuários para migração`);

    // 2. Migrar cada usuário
    for (const user of legacyUsers) {
      try {
        // Usar o login como email (assumindo que login é um email válido)
        const email = user.login.includes('@') ? user.login : `${user.login}@senior.com.br`;
        
        // Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email,
          password: user.senha,
          email_confirm: true // Confirmar email automaticamente
        });

        if (authError) {
          result.errors++;
          result.details.push(`Erro ao criar usuário ${user.nome}: ${authError.message}`);
          continue;
        }

        if (!authData.user) {
          result.errors++;
          result.details.push(`Erro: Usuário ${user.nome} não foi criado no Supabase Auth`);
          continue;
        }

        // Atualizar registro na tabela usuarios com o auth_user_id e email
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({
            auth_user_id: authData.user.id,
            email: email,
            senha: null // Limpar senha da tabela (agora gerenciada pelo Supabase Auth)
          })
          .eq('id', user.id);

        if (updateError) {
          result.errors++;
          result.details.push(`Erro ao atualizar usuário ${user.nome}: ${updateError.message}`);
          
          // Tentar remover o usuário criado no Auth se a atualização falhou
          try {
            await supabase.auth.admin.deleteUser(authData.user.id);
          } catch (cleanupError) {
            result.details.push(`Erro ao limpar usuário ${user.nome} do Auth: ${cleanupError}`);
          }
          continue;
        }

        result.success++;
        result.details.push(`✓ Usuário ${user.nome} migrado com sucesso`);

      } catch (userError) {
        result.errors++;
        result.details.push(`Erro inesperado ao migrar ${user.nome}: ${userError}`);
      }
    }

    // 3. Criar usuário admin específico se não existir
    const adminEmail = 'jhone.silva@senior.com.br';
    const { data: existingAdmin } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (!existingAdmin) {
      try {
        // Criar usuário admin no Supabase Auth
        const { data: adminAuthData, error: adminAuthError } = await supabase.auth.admin.createUser({
          email: adminEmail,
          password: 'COC2025',
          email_confirm: true
        });

        if (adminAuthError) {
          result.details.push(`Erro ao criar usuário admin: ${adminAuthError.message}`);
        } else if (adminAuthData.user) {
          // Criar registro na tabela usuarios
          const { error: adminInsertError } = await supabase
            .from('usuarios')
            .insert({
              nome: 'Jhone Silva',
              login: adminEmail,
              email: adminEmail,
              perfil: 'admin',
              auth_user_id: adminAuthData.user.id
            });

          if (adminInsertError) {
            result.details.push(`Erro ao criar registro do admin: ${adminInsertError.message}`);
            // Limpar usuário do Auth
            await supabase.auth.admin.deleteUser(adminAuthData.user.id);
          } else {
            result.success++;
            result.details.push(`✓ Usuário admin ${adminEmail} criado com sucesso`);
          }
        }
      } catch (adminError) {
        result.details.push(`Erro inesperado ao criar admin: ${adminError}`);
      }
    } else {
      result.details.push(`Usuário admin ${adminEmail} já existe`);
    }

  } catch (error) {
    result.details.push(`Erro geral na migração: ${error}`);
  }

  return result;
};

/**
 * Função para verificar se a migração é necessária
 */
export const checkMigrationStatus = async (): Promise<{
  needsMigration: boolean;
  legacyUsersCount: number;
  migratedUsersCount: number;
}> => {
  try {
    // Contar usuários não migrados (com senha e sem auth_user_id)
    const { count: legacyCount } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .is('auth_user_id', null)
      .not('senha', 'is', null);

    // Contar usuários já migrados (com auth_user_id)
    const { count: migratedCount } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .not('auth_user_id', 'is', null);

    return {
      needsMigration: (legacyCount || 0) > 0,
      legacyUsersCount: legacyCount || 0,
      migratedUsersCount: migratedCount || 0
    };
  } catch (error) {
    console.error('Erro ao verificar status da migração:', error);
    return {
      needsMigration: false,
      legacyUsersCount: 0,
      migratedUsersCount: 0
    };
  }
};