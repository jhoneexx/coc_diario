import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// Configuração do cliente Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variáveis de ambiente do Supabase não encontradas. Por favor, conecte seu projeto ao Supabase.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export default supabase;