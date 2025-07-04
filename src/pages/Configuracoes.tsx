import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Users, Server, AlertTriangle, Award, Settings, Upload } from 'lucide-react';
import supabase from '../lib/supabase';

// Componentes
import GerenciarUsuarios from '../components/configuracoes/GerenciarUsuarios';
import GerenciarAmbientes from '../components/configuracoes/GerenciarAmbientes';
import GerenciarSegmentos from '../components/configuracoes/GerenciarSegmentos';
import GerenciarTiposIncidente from '../components/configuracoes/GerenciarTiposIncidente';
import GerenciarCriticidades from '../components/configuracoes/GerenciarCriticidades';
import GerenciarMetas from '../components/configuracoes/GerenciarMetas';
import LogsAuditoriaTable from '../components/configuracoes/LogsAuditoriaTable';
import ImportarIncidentes from '../components/configuracoes/ImportarIncidentes';

// Tipos
export interface Usuario {
  id: number;
  nome: string;
  login: string;
  senha: string;
  perfil: string;
  ultimo_acesso: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Ambiente {
  id: number;
  nome: string;
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Segmento {
  id: number;
  nome: string;
  ambiente_id: number;
  ambiente?: { nome: string };
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface TipoIncidente {
  id: number;
  nome: string;
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Criticidade {
  id: number;
  nome: string;
  cor: string;
  descricao: string | null;
  peso: number;
  is_downtime: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Meta {
  id: number;
  ambiente_id: number;
  ambiente?: { nome: string };
  mttr_meta: number;
  mtbf_meta: number;
  disponibilidade_meta: number;
  peso_percentual: number;
  mttr_permite_superacao: boolean;
  mtbf_permite_superacao: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface LogAuditoria {
  id: number;
  usuario_id: number;
  usuario?: { nome: string };
  data_acesso: string;
  acao: string;
  detalhes: string | null;
}

const Configuracoes: React.FC = () => {
  const [activeTab, setActiveTab] = useState("usuarios");
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie usuários, ambientes, tipos de incidente e outras configurações
        </p>
      </div>
      
      <Tabs defaultValue="usuarios" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 border-b border-gray-200 w-full flex overflow-x-auto space-x-8 pb-4">
          <TabsTrigger value="usuarios" className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            <span>Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="ambientes" className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            <span>Ambientes</span>
          </TabsTrigger>
          <TabsTrigger value="segmentos" className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            <span>Segmentos</span>
          </TabsTrigger>
          <TabsTrigger value="tipos-incidente" className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>Tipos de Incidente</span>
          </TabsTrigger>
          <TabsTrigger value="criticidades" className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>Criticidades</span>
          </TabsTrigger>
          <TabsTrigger value="metas" className="flex items-center">
            <Award className="h-5 w-5 mr-2" />
            <span>Metas</span>
          </TabsTrigger>
          <TabsTrigger value="importacao" className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            <span>Importação</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            <span>Logs de Auditoria</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="usuarios" className="mt-0">
          <GerenciarUsuarios />
        </TabsContent>
        
        <TabsContent value="ambientes" className="mt-0">
          <GerenciarAmbientes />
        </TabsContent>
        
        <TabsContent value="segmentos" className="mt-0">
          <GerenciarSegmentos />
        </TabsContent>
        
        <TabsContent value="tipos-incidente" className="mt-0">
          <GerenciarTiposIncidente />
        </TabsContent>
        
        <TabsContent value="criticidades" className="mt-0">
          <GerenciarCriticidades />
        </TabsContent>
        
        <TabsContent value="metas" className="mt-0">
          <GerenciarMetas />
        </TabsContent>
        
        <TabsContent value="importacao" className="mt-0">
          <ImportarIncidentes />
        </TabsContent>
        
        <TabsContent value="logs" className="mt-0">
          <LogsAuditoriaTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;