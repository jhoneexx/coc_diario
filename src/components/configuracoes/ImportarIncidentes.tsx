import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { Upload, FileText, Download, AlertTriangle, CheckCircle, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  readExcelFile,
  loadReferenceData,
  validateAndProcessData,
  importIncidents,
  ImportedIncident,
  ImportValidationResult,
  ReferenceData
} from '../../utils/incidentImportProcessor';

const ImportarIncidentes: React.FC = () => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [showInvalidRecords, setShowInvalidRecords] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  // Handler para seleção de arquivo
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar tipo de arquivo
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
        toast.error('Tipo de arquivo não suportado. Use arquivos Excel (.xlsx, .xls) ou CSV (.csv)');
        return;
      }
      
      setSelectedFile(file);
      setValidationResult(null);
    }
  };

  // Processar arquivo selecionado
  const processFile = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      // Carregar dados de referência
      const refData = await loadReferenceData();
      setReferenceData(refData);
      
      // Ler arquivo
      const rawData = await readExcelFile(selectedFile);
      
      if (rawData.length === 0) {
        toast.error('Arquivo está vazio ou não contém dados válidos');
        return;
      }
      
      // Validar e processar dados
      const result = await validateAndProcessData(rawData, refData);
      setValidationResult(result);
      
      if (result.summary.valid === 0) {
        toast.warning('Nenhum registro válido encontrado no arquivo');
      } else {
        toast.success(`${result.summary.valid} registros válidos encontrados`);
      }
      
      if (result.summary.invalid > 0) {
        toast.warning(`${result.summary.invalid} registros com erros encontrados`);
      }
      
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Executar importação
  const executeImport = async () => {
    if (!validationResult || validationResult.validRecords.length === 0) return;
    
    setImporting(true);
    setImportProgress(0);
    
    try {
      const result = await importIncidents(
        validationResult.validRecords,
        currentUser,
        (progress) => setImportProgress(progress)
      );
      
      if (result.success > 0) {
        toast.success(`${result.success} incidentes importados com sucesso!`);
        
        // Registrar log de auditoria
        if (currentUser) {
          await supabase.from('logs_acesso').insert({
            usuario_id: currentUser.id,
            acao: 'importar_incidentes',
            detalhes: `Importação de incidentes concluída: ${result.success} sucessos, ${result.errors} erros`
          });
        }
      }
      
      if (result.errors > 0) {
        toast.error(`${result.errors} incidentes falharam na importação`);
        result.errorDetails.forEach(error => {
          console.error('Erro de importação:', error);
        });
      }
      
      // Limpar estado após importação bem-sucedida
      if (result.errors === 0) {
        setSelectedFile(null);
        setValidationResult(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
      
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro na importação: ' + (error as Error).message);
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  // Limpar seleção
  const clearSelection = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setReferenceData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Toggle para mostrar/esconder registros inválidos
  const toggleShowInvalidRecords = () => {
    setShowInvalidRecords(!showInvalidRecords);
  };

  // Toggle para expandir/contrair erros de um registro
  const toggleExpandErrors = (rowIndex: number) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(rowIndex)) {
      newExpanded.delete(rowIndex);
    } else {
      newExpanded.add(rowIndex);
    }
    setExpandedErrors(newExpanded);
  };

  // Baixar template de exemplo
  const downloadTemplate = () => {
    const templateData = [
      ['Data início', 'Hora de início', 'Data Fim', 'Hora de fim', 'Natureza', 'Criticidade', 'Ambiente', 'Segmento', 'Problema', 'Solução'],
      ['26/03/2025', '12:30', '26/03/2025', '13:45', 'Falha de Sistema', 'Alto', 'Produção', 'Web Server', 'Servidor web não responde', 'Reinicialização do serviço'],
      ['27/03/2025', '09:15', '', '', 'Manutenção', 'Baixo', 'Desenvolvimento', 'Database', 'Atualização de schema', 'Aplicação de scripts SQL']
    ];
    
    const csvContent = templateData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_importacao_incidentes.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Importar Incidentes</h2>
            <p className="text-sm text-gray-500 mt-1">
              Importe incidentes em lote a partir de arquivos Excel ou CSV
            </p>
          </div>
          
          <button
            onClick={downloadTemplate}
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar Template
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Instruções */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Instruções de Importação</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• O arquivo deve conter as colunas: Data início, Hora de início, Natureza, Criticidade, Ambiente, Segmento, Problema</li>
            <li>• Colunas opcionais: Data Fim, Hora de fim, Solução</li>
            <li>• Formatos de data aceitos: DD/MM/YYYY ou YYYY-MM-DD</li>
            <li>• Formato de hora: HH:mm (ex: 14:30)</li>
            <li>• Os valores de Natureza, Criticidade, Ambiente e Segmento devem existir no sistema</li>
            <li>• Registros duplicados (mesmo início e ambiente) serão ignorados</li>
          </ul>
        </div>

        {/* Seleção de arquivo */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecionar Arquivo
          </label>
          
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>
            
            {selectedFile && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={processFile}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {loading ? 'Processando...' : 'Processar'}
                </button>
                
                <button
                  onClick={clearSelection}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          
          {selectedFile && (
            <div className="mt-2 flex items-center text-sm text-gray-600">
              <FileText className="h-4 w-4 mr-1" />
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* Resultado da validação */}
        {validationResult && (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Resumo da Validação</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                    <div>
                      <p className="text-2xl font-bold text-green-600">{validationResult.summary.valid}</p>
                      <p className="text-sm text-gray-600">Registros Válidos</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex items-center">
                    <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">{validationResult.summary.invalid}</p>
                      <p className="text-sm text-gray-600">Registros com Erro</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-blue-500 mr-3" />
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{validationResult.totalProcessed}</p>
                      <p className="text-sm text-gray-600">Total Processado</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de ação */}
            {validationResult.summary.valid > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={executeImport}
                    disabled={importing}
                    className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    {importing ? `Importando... ${importProgress.toFixed(0)}%` : `Importar ${validationResult.summary.valid} Registros`}
                  </button>
                  
                  {validationResult.summary.invalid > 0 && (
                    <button
                      onClick={toggleShowInvalidRecords}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      {showInvalidRecords ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                      {showInvalidRecords ? 'Ocultar' : 'Ver'} Registros com Erro
                    </button>
                  )}
                </div>
                
                {importing && (
                  <div className="w-full sm:w-64">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${importProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preview dos registros válidos */}
            {validationResult.validRecords.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-green-50 border-b">
                  <h4 className="text-md font-medium text-green-800">
                    Registros Válidos ({validationResult.validRecords.length})
                  </h4>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Início</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fim</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criticidade</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ambiente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segmento</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {validationResult.validRecords.slice(0, 10).map((record, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.rowIndex}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.inicio ? new Date(record.inicio).toLocaleString('pt-BR') : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.fim ? new Date(record.fim).toLocaleString('pt-BR') : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.tipoIncidente}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.criticidade}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.ambiente}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.segmento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {validationResult.validRecords.length > 10 && (
                    <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                      ... e mais {validationResult.validRecords.length - 10} registros
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Registros com erro */}
            {showInvalidRecords && validationResult.invalidRecords.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-red-50 border-b">
                  <h4 className="text-md font-medium text-red-800">
                    Registros com Erro ({validationResult.invalidRecords.length})
                  </h4>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {validationResult.invalidRecords.map((record, index) => (
                    <div key={index} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          Linha {record.rowIndex}
                        </span>
                        <button
                          onClick={() => toggleExpandErrors(record.rowIndex!)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          {expandedErrors.has(record.rowIndex!) ? 'Ocultar detalhes' : 'Ver detalhes'}
                        </button>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        {record.dataHoraInicio} | {record.tipoIncidente} | {record.ambiente} | {record.segmento}
                      </div>
                      
                      {expandedErrors.has(record.rowIndex!) && (
                        <div className="bg-red-50 rounded p-3">
                          <p className="text-sm font-medium text-red-800 mb-2">Erros encontrados:</p>
                          <ul className="text-sm text-red-700 space-y-1">
                            {record.errors?.map((error, errorIndex) => (
                              <li key={errorIndex}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportarIncidentes;