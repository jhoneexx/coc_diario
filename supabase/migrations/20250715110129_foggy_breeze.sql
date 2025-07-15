/*
  # Integração com Supabase Auth para Login Seguro

  1. Alterações na Tabela de Usuários
    - Adiciona coluna `auth_user_id` para vincular com auth.users
    - Adiciona coluna `email` para armazenar o email do usuário
    - Torna a coluna `senha` nullable (será removida após migração)
    - Adiciona índices e constraints necessários

  2. Segurança
    - Mantém RLS habilitado
    - Adiciona políticas para vincular com auth.users
    - Garante integridade referencial
*/

-- Adicionar coluna para vincular com auth.users
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Adicionar coluna de email
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Tornar a coluna senha nullable (será removida após migração completa)
ALTER TABLE usuarios 
ALTER COLUMN senha DROP NOT NULL;

-- Criar índice único para auth_user_id
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_auth_user_id_key 
ON usuarios(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Criar índice para email
CREATE INDEX IF NOT EXISTS usuarios_email_idx ON usuarios(email);

-- Atualizar constraint de login para ser nullable também (temporariamente)
ALTER TABLE usuarios 
ALTER COLUMN login DROP NOT NULL;

-- Adicionar políticas RLS para integração com auth
CREATE POLICY IF NOT EXISTS "Users can read own profile via auth"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY IF NOT EXISTS "Users can update own profile via auth"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Função para sincronizar usuário após criação no auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Esta função será chamada quando um novo usuário for criado no auth.users
  -- Ela pode ser usada para criar automaticamente um registro em public.usuarios
  -- se necessário (para novos usuários criados via interface)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novos usuários (comentado por enquanto)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();