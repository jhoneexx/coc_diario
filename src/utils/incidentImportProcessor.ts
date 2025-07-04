import * as XLSX from 'xlsx';
import supabase from '../lib/supabase';
import { toast } from 'react-toastify';

// Tipos para o processamento de importação
export interface ImportedIncident {
  dataHoraInicio: string;
  dataHoraFim: string | null;
  tipoIncidente: string;
  criticidade: string;
  ambiente: string;
  segmento: string;
  descricaoIncidente: string;
  acoesTomadas: string | null;
  // Campos processados
  inicio?: string;
  fim?: string | null;
  tipo_id?: number;
  criticidade_id?: number;
  ambiente_id?: number;
  segmento_id?: number;
  descricao?: string;
  acoes_tomadas?: string | null;
  duracao_minutos?: number | null;
  // Status de validação
  isValid?: boolean;
  errors?: string[];
  rowIndex?: number;
}

export interface ImportValidationResult {
  validRecords: ImportedIncident[];
  invalidRecords: ImportedIncident[];
  totalProcessed: number;
  summary: {
    valid: number;
    invalid: number;
    duplicates: number;
  };
}

export interface ReferenceData {
  tipos: Array<{ id: number; nome: string }>;
  criticidades: Array<{ id: number; nome: string }>;
  ambientes: Array<{ id: number; nome: string }>;
  segmentos: Array<{ id: number; nome: string; ambiente_id: number }>;
}

// Mapeamento de colunas da planilha
const COLUMN_MAPPING = {
  'Data início': 'dataInicio',
  'Data Inicio': 'dataInicio',
  'Data de início': 'dataInicio',
  'Data de Inicio': 'dataInicio',
  'Hora de início': 'horaInicio',
  'Hora de Inicio': 'horaInicio',
  'Hora início': 'horaInicio',
  'Hora Inicio': 'horaInicio',
  'Data Fim': 'dataFim',
  'Data de Fim': 'dataFim',
  'Data fim': 'dataFim',
  'Hora de fim': 'horaFim',
  'Hora de Fim': 'horaFim',
  'Hora fim': 'horaFim',
  'Hora Fim': 'horaFim',
  'Natureza': 'tipoIncidente',
  'Tipo': 'tipoIncidente',
  'Tipo de Incidente': 'tipoIncidente',
  'Criticidade': 'criticidade',
  'Ambiente': 'ambiente',
  'Segmento': 'segmento',
  'Problema': 'descricaoIncidente',
  'Descrição': 'descricaoIncidente',
  'Descrição do Problema': 'descricaoIncidente',
  'Solução': 'acoesTomadas',
  'Ações Tomadas': 'acoesTomadas',
  'Ações': 'acoesTomadas'
};

// Função para ler arquivo Excel/CSV
export const readExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Pegar a primeira planilha
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converter para JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          raw: false
        });
        
        // Converter array de arrays para array de objetos
        if (jsonData.length < 2) {
          reject(new Error('Arquivo deve conter pelo menos uma linha de cabeçalho e uma linha de dados'));
          return;
        }
        
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];
        
        const result = rows.map((row, index) => {
          const obj: any = { __rowIndex: index + 2 }; // +2 porque começamos da linha 2 (após cabeçalho)
          headers.forEach((header, colIndex) => {
            obj[header] = row[colIndex] || '';
          });
          return obj;
        });
        
        resolve(result);
      } catch (error) {
        reject(new Error('Erro ao processar arquivo: ' + (error as Error).message));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
};

// Função para carregar dados de referência
export const loadReferenceData = async (): Promise<ReferenceData> => {
  try {
    const [tiposResult, criticidadesResult, ambientesResult, segmentosResult] = await Promise.all([
      supabase.from('tipos_incidente').select('id, nome'),
      supabase.from('criticidades').select('id, nome'),
      supabase.from('ambientes').select('id, nome'),
      supabase.from('segmentos').select('id, nome, ambiente_id')
    ]);
    
    if (tiposResult.error) throw tiposResult.error;
    if (criticidadesResult.error) throw criticidadesResult.error;
    if (ambientesResult.error) throw ambientesResult.error;
    if (segmentosResult.error) throw segmentosResult.error;
    
    return {
      tipos: tiposResult.data || [],
      criticidades: criticidadesResult.data || [],
      ambientes: ambientesResult.data || [],
      segmentos: segmentosResult.data || []
    };
  } catch (error) {
    console.error('Erro ao carregar dados de referência:', error);
    throw new Error('Erro ao carregar dados de referência do sistema');
  }
};

// Função para mapear colunas da planilha
const mapColumns = (rawData: any[]): ImportedIncident[] => {
  return rawData.map((row, index) => {
    const mapped: any = {
      rowIndex: row.__rowIndex || index + 1,
      dataInicio: '',
      horaInicio: '',
      dataFim: '',
      horaFim: '',
      tipoIncidente: '',
      criticidade: '',
      ambiente: '',
      segmento: '',
      descricaoIncidente: '',
      acoesTomadas: ''
    };
    
    // Mapear colunas baseado no nome
    Object.keys(row).forEach(columnName => {
      if (columnName === '__rowIndex') return;
      
      const mappedField = COLUMN_MAPPING[columnName as keyof typeof COLUMN_MAPPING];
      if (mappedField && row[columnName]) {
        mapped[mappedField] = String(row[columnName]).trim();
      }
    });
    
    // Concatenar data e hora de início
    if (mapped.dataInicio && mapped.horaInicio) {
      mapped.dataHoraInicio = `${mapped.dataInicio} ${mapped.horaInicio}`;
    } else if (mapped.dataInicio) {
      mapped.dataHoraInicio = mapped.dataInicio;
    }
    
    // Concatenar data e hora de fim
    if (mapped.dataFim && mapped.horaFim) {
      mapped.dataHoraFim = `${mapped.dataFim} ${mapped.horaFim}`;
    } else if (mapped.dataFim) {
      mapped.dataHoraFim = mapped.dataFim;
    } else {
      mapped.dataHoraFim = null;
    }
    
    return {
      dataHoraInicio: mapped.dataHoraInicio,
      dataHoraFim: mapped.dataHoraFim,
      tipoIncidente: mapped.tipoIncidente,
      criticidade: mapped.criticidade,
      ambiente: mapped.ambiente,
      segmento: mapped.segmento,
      descricaoIncidente: mapped.descricaoIncidente,
      acoesTomadas: mapped.acoesTomadas || null,
      rowIndex: mapped.rowIndex
    };
  });
};

// Função para converter data/hora para formato ISO
const parseDateTime = (dateTimeStr: string): string | null => {
  if (!dateTimeStr) return null;
  
  try {
    // Tentar diferentes formatos de data
    const formats = [
      // DD/MM/YYYY HH:mm
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/,
      // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // YYYY-MM-DD HH:mm
      /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/,
      // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    ];
    
    for (const format of formats) {
      const match = dateTimeStr.match(format);
      if (match) {
        let year, month, day, hour = 0, minute = 0;
        
        if (format === formats[0]) { // DD/MM/YYYY HH:mm
          [, day, month, year, hour, minute] = match.map(Number);
        } else if (format === formats[1]) { // DD/MM/YYYY
          [, day, month, year] = match.map(Number);
        } else if (format === formats[2]) { // YYYY-MM-DD HH:mm
          [, year, month, day, hour, minute] = match.map(Number);
        } else if (format === formats[3]) { // YYYY-MM-DD
          [, year, month, day] = match.map(Number);
        }
        
        const date = new Date(year, month - 1, day, hour, minute);
        
        if (isNaN(date.getTime())) {
          return null;
        }
        
        return date.toISOString();
      }
    }
    
    // Tentar parsing direto como último recurso
    const date = new Date(dateTimeStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

// Função para validar e processar dados
export const validateAndProcessData = async (
  rawData: any[], 
  referenceData: ReferenceData
): Promise<ImportValidationResult> => {
  const mappedData = mapColumns(rawData);
  const validRecords: ImportedIncident[] = [];
  const invalidRecords: ImportedIncident[] = [];
  
  for (const record of mappedData) {
    const errors: string[] = [];
    
    // Validar campos obrigatórios
    if (!record.dataHoraInicio) {
      errors.push('Data/hora de início é obrigatória');
    }
    
    if (!record.tipoIncidente) {
      errors.push('Tipo de incidente é obrigatório');
    }
    
    if (!record.criticidade) {
      errors.push('Criticidade é obrigatória');
    }
    
    if (!record.ambiente) {
      errors.push('Ambiente é obrigatório');
    }
    
    if (!record.segmento) {
      errors.push('Segmento é obrigatório');
    }
    
    if (!record.descricaoIncidente) {
      errors.push('Descrição do incidente é obrigatória');
    }
    
    // Processar datas
    if (record.dataHoraInicio) {
      const inicio = parseDateTime(record.dataHoraInicio);
      if (!inicio) {
        errors.push('Formato de data/hora de início inválido');
      } else {
        record.inicio = inicio;
      }
    }
    
    if (record.dataHoraFim) {
      const fim = parseDateTime(record.dataHoraFim);
      if (!fim) {
        errors.push('Formato de data/hora de fim inválido');
      } else {
        record.fim = fim;
        
        // Calcular duração se ambas as datas estiverem presentes
        if (record.inicio) {
          const inicioDate = new Date(record.inicio);
          const fimDate = new Date(fim);
          const diffMs = fimDate.getTime() - inicioDate.getTime();
          record.duracao_minutos = Math.round(diffMs / (1000 * 60));
          
          if (record.duracao_minutos < 0) {
            errors.push('Data/hora de fim deve ser posterior à data/hora de início');
          }
        }
      }
    } else {
      record.fim = null;
      record.duracao_minutos = null;
    }
    
    // Buscar IDs de referência
    if (record.tipoIncidente) {
      const tipo = referenceData.tipos.find(t => 
        t.nome.toLowerCase() === record.tipoIncidente.toLowerCase()
      );
      if (tipo) {
        record.tipo_id = tipo.id;
      } else {
        errors.push(`Tipo de incidente "${record.tipoIncidente}" não encontrado no sistema`);
      }
    }
    
    if (record.criticidade) {
      const criticidade = referenceData.criticidades.find(c => 
        c.nome.toLowerCase() === record.criticidade.toLowerCase()
      );
      if (criticidade) {
        record.criticidade_id = criticidade.id;
      } else {
        errors.push(`Criticidade "${record.criticidade}" não encontrada no sistema`);
      }
    }
    
    if (record.ambiente) {
      const ambiente = referenceData.ambientes.find(a => 
        a.nome.toLowerCase() === record.ambiente.toLowerCase()
      );
      if (ambiente) {
        record.ambiente_id = ambiente.id;
      } else {
        errors.push(`Ambiente "${record.ambiente}" não encontrado no sistema`);
      }
    }
    
    if (record.segmento && record.ambiente_id) {
      const segmento = referenceData.segmentos.find(s => 
        s.nome.toLowerCase() === record.segmento.toLowerCase() &&
        s.ambiente_id === record.ambiente_id
      );
      if (segmento) {
        record.segmento_id = segmento.id;
      } else {
        errors.push(`Segmento "${record.segmento}" não encontrado no ambiente "${record.ambiente}"`);
      }
    }
    
    // Definir campos finais
    record.descricao = record.descricaoIncidente;
    record.acoes_tomadas = record.acoesTomadas;
    record.errors = errors;
    record.isValid = errors.length === 0;
    
    if (record.isValid) {
      validRecords.push(record);
    } else {
      invalidRecords.push(record);
    }
  }
  
  return {
    validRecords,
    invalidRecords,
    totalProcessed: mappedData.length,
    summary: {
      valid: validRecords.length,
      invalid: invalidRecords.length,
      duplicates: 0 // Será calculado na função de importação
    }
  };
};

// Função para verificar duplicatas
export const checkForDuplicates = async (records: ImportedIncident[]): Promise<ImportedIncident[]> => {
  const duplicateChecks = records.map(async (record) => {
    if (!record.inicio || !record.ambiente_id) return record;
    
    try {
      const { data, error } = await supabase
        .from('incidentes')
        .select('id')
        .eq('inicio', record.inicio)
        .eq('ambiente_id', record.ambiente_id)
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        record.isValid = false;
        record.errors = [...(record.errors || []), 'Incidente duplicado (mesmo início e ambiente)'];
      }
      
      return record;
    } catch (error) {
      console.error('Erro ao verificar duplicata:', error);
      return record;
    }
  });
  
  return Promise.all(duplicateChecks);
};

// Função para importar dados para o banco
export const importIncidents = async (
  records: ImportedIncident[],
  currentUser: { nome: string } | null,
  onProgress?: (progress: number) => void
): Promise<{ success: number; errors: number; errorDetails: string[] }> => {
  const results = {
    success: 0,
    errors: 0,
    errorDetails: [] as string[]
  };
  
  // Verificar duplicatas antes da importação
  const checkedRecords = await checkForDuplicates(records.filter(r => r.isValid));
  const validRecords = checkedRecords.filter(r => r.isValid);
  
  if (validRecords.length === 0) {
    throw new Error('Nenhum registro válido para importar');
  }
  
  // Processar em lotes para melhor performance
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < validRecords.length; i += batchSize) {
    batches.push(validRecords.slice(i, i + batchSize));
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    try {
      const incidentData = batch.map(record => ({
        inicio: record.inicio!,
        fim: record.fim,
        duracao_minutos: record.duracao_minutos,
        tipo_id: record.tipo_id!,
        ambiente_id: record.ambiente_id!,
        segmento_id: record.segmento_id!,
        criticidade_id: record.criticidade_id!,
        descricao: record.descricao!,
        acoes_tomadas: record.acoes_tomadas,
        criado_por: currentUser?.nome || 'Importação'
      }));
      
      const { error } = await supabase
        .from('incidentes')
        .insert(incidentData);
      
      if (error) {
        console.error('Erro no lote:', error);
        results.errors += batch.length;
        results.errorDetails.push(`Erro no lote ${batchIndex + 1}: ${error.message}`);
      } else {
        results.success += batch.length;
      }
    } catch (error) {
      console.error('Erro ao processar lote:', error);
      results.errors += batch.length;
      results.errorDetails.push(`Erro no lote ${batchIndex + 1}: ${(error as Error).message}`);
    }
    
    // Atualizar progresso
    if (onProgress) {
      const progress = ((batchIndex + 1) / batches.length) * 100;
      onProgress(progress);
    }
  }
  
  return results;
};