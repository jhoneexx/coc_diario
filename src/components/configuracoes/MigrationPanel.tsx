import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, CheckCircle, Users, Database, Play, RefreshCw } from 'lucide-react';
import { migrateUsersToSupabaseAuth, checkMigrationStatus } from '../../utils/userMigration';

interface MigrationStatus {
  needsMigration: boolean;
  legacyUsersCount: number;
  migratedUsersCount: number;
}

const MigrationPanel: React.FC = () => {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    needsMigration: false,
    legacyUsersCount: 0,
    migratedUsersCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: number;
    errors: number;
    details: string[];
  } | null>(null);

  // Verificar status da migração
  const checkStatus = async () => {
    setLoading(true);
    try {
      const status = await checkMigrationStatus();
      setMigrationStatus(status);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      toast.error('Erro ao verificar status da migração');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Executar migração
  const handleMigration = async () => {
    if (!confirm('ATENÇÃO: Esta operação irá migrar todos os usuários para o sistema de autenticação seguro do Supabase. Esta ação não pode ser desfeita. Deseja continuar?')) {
      return;
    }

    setMigrating(true);
    setMigrationResult(null);

    try {
      const result = await migrateUsersToSupabaseAuth();
      setMigrationResult(result);
      
      if (result.success > 0) {
        toast.success(`Migração concluída! ${result.success} usuários migrados com sucesso.`);
        // Atualizar status após migração
        await checkStatus();
      }
      
      if (result.errors > 0) {
        toast.warning(`Migração concluída com ${result.errors} erros. Verifique os detalhes.`);
      }
    } catch (error) {
      console.error('Erro na migração:', error);
      toast.error('Erro durante a migração: ' + (error as Error).message);
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-primary-600 mr-2" />
          <span>Verificando status da migração...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <Database className="h-6 w-6 text-primary-600 mr-3" />
          <div>
            <h2 className="text-lg font-medium text-gray-900">Migração para Autenticação Segura</h2>
            <p className="text-sm text-gray-500 mt-1">
              Migre os usuários para o sistema de autenticação seguro do Supabase
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Status da Migração */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{migrationStatus.legacyUsersCount}</p>
                <p className="text-sm text-blue-800">Usuários Pendentes</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-green-600">{migrationStatus.migratedUsersCount}</p>
                <p className="text-sm text-green-800">Usuários Migrados</p>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg ${migrationStatus.needsMigration ? 'bg-yellow-50' : 'bg-green-50'}`}>
            <div className="flex items-center">
              {migrationStatus.needsMigration ? (
                <AlertTriangle className="h-8 w-8 text-yellow-600 mr-3" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
              )}
              <div>
                <p className={`text-2xl font-bold ${migrationStatus.needsMigration ? 'text-yellow-600' : 'text-green-600'}`}>
                  {migrationStatus.needsMigration ? 'Pendente' : 'Completa'}
                </p>
                <p className={`text-sm ${migrationStatus.needsMigration ? 'text-yellow-800' : 'text-green-800'}`}>
                  Status da Migração
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Informações sobre a Migração */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-800 mb-2">O que esta migração faz:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Migra todos os usuários para o sistema de autenticação seguro do Supabase</li>
            <li>• Remove senhas em texto simples da tabela de usuários</li>
            <li>• Habilita funcionalidades como recuperação de senha por e-mail</li>
            <li>• Cria o usuário administrador jhone.silva@senior.com.br</li>
            <li>• Mantém todos os perfis e permissões existentes</li>
          </ul>
        </div>

        {/* Botão de Migração */}
        {migrationStatus.needsMigration && (
          <div className="mb-6">
            <button
              onClick={handleMigration}
              disabled={migrating}
              className={`inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                migrating ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {migrating ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Migrando Usuários...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Executar Migração
                </>
              )}
            </button>
          </div>
        )}

        {/* Resultado da Migração */}
        {migrationResult && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Resultado da Migração:</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{migrationResult.success}</p>
                <p className="text-sm text-green-800">Sucessos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{migrationResult.errors}</p>
                <p className="text-sm text-red-800">Erros</p>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Detalhes:</h4>
              <div className="space-y-1">
                {migrationResult.details.map((detail, index) => (
                  <p key={index} className={`text-sm ${
                    detail.startsWith('✓') ? 'text-green-700' : 
                    detail.startsWith('Erro') ? 'text-red-700' : 'text-gray-600'
                  }`}>
                    {detail}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Botão para Atualizar Status */}
        <div className="mt-4">
          <button
            onClick={checkStatus}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Status
          </button>
        </div>
      </div>
    </div>
  );
};

export default MigrationPanel;