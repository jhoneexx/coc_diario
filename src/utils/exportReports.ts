import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Chart from 'react-apexcharts';
import { Cloud } from 'lucide-react';

// Tipos
interface Incidente {
  id: number;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  tipo: { nome: string };
  ambiente: { nome: string };
  segmento: { nome: string };
  criticidade: { 
    nome: string;
    cor: string;
    is_downtime: boolean;
  };
  descricao: string;
  acoes_tomadas?: string | null;
  criado_por?: string;
}

interface Metrica {
  ambiente_id: number;
  ambiente_nome: string;
  mttr: number;
  mtbf: number;
  disponibilidade: number;
  incidentes_total: number;
  incidentes_criticos: number;
  meta_mttr: number | null;
  meta_mtbf: number | null;
  meta_disponibilidade: number | null;
}

interface ExportOptions {
  incidentes: Incidente[];
  metricas: Metrica[];
  filtroPeriodo: {
    inicio: string;
    fim: string;
  };
  filtroAmbiente: number | null;
  ambienteFiltrado: string;
}

interface ReportSection {
  title: string;
  include: boolean;
}

interface PDFExportOptions extends ExportOptions {
  sections?: ReportSection[];
  onProgress?: (progress: number) => void;
}

// Função para exportar relatório para Excel
export const exportReportToExcel = (options: ExportOptions) => {
  const { incidentes, metricas, filtroPeriodo, ambienteFiltrado } = options;
  
  // Criar workbook
  const wb = XLSX.utils.book_new();
  
  // Aba de Resumo
  const resumoData = [
    ['Relatório de Incidentes - Cloud Operations Center'],
    [''],
    ['Período:', `${new Date(filtroPeriodo.inicio).toLocaleDateString('pt-BR')} a ${new Date(filtroPeriodo.fim).toLocaleDateString('pt-BR')}`],
    ['Ambiente:', ambienteFiltrado],
    ['Data de geração:', new Date().toLocaleString('pt-BR')],
    [''],
    ['Métricas de Performance'],
    [''],
    ['Ambiente', 'Incidentes', 'Críticos', 'MTTR (h)', 'Meta MTTR', 'MTBF (dias)', 'Meta MTBF', 'Disponibilidade (%)', 'Meta Disponibilidade (%)']
  ];
  
  metricas.forEach(m => {
    resumoData.push([
      m.ambiente_nome,
      m.incidentes_total.toString(),
      m.incidentes_criticos.toString(),
      m.mttr.toFixed(2),
      m.meta_mttr ? m.meta_mttr.toFixed(2) : '-',
      (m.mtbf / 24).toFixed(2),
      m.meta_mtbf ? (m.meta_mtbf / 24).toFixed(2) : '-',
      m.disponibilidade.toFixed(3),
      m.meta_disponibilidade ? m.meta_disponibilidade.toFixed(3) : '-'
    ]);
  });
  
  const resumoSheet = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, resumoSheet, 'Resumo');
  
  // Aba de Incidentes Detalhados
  const incidentesHeaders = [
    'ID', 
    'Ambiente', 
    'Segmento', 
    'Início', 
    'Fim', 
    'Duração (h)', 
    'Tipo', 
    'Criticidade', 
    'Downtime', 
    'Descrição', 
    'Ações Tomadas', 
    'Registrado por'
  ];
  
  const incidentesData = incidentes.map(inc => [
    inc.id,
    inc.ambiente.nome,
    inc.segmento.nome,
    new Date(inc.inicio).toLocaleString('pt-BR'),
    inc.fim ? new Date(inc.fim).toLocaleString('pt-BR') : 'Em andamento',
    inc.duracao_minutos ? (inc.duracao_minutos / 60).toFixed(2) : '-',
    inc.tipo.nome,
    inc.criticidade.nome,
    inc.criticidade.is_downtime ? 'Sim' : 'Não',
    inc.descricao,
    inc.acoes_tomadas || '-',
    inc.criado_por || '-'
  ]);
  
  incidentesData.unshift(incidentesHeaders);
  
  const incidentesSheet = XLSX.utils.aoa_to_sheet(incidentesData);
  XLSX.utils.book_append_sheet(wb, incidentesSheet, 'Incidentes');
  
  // Aba de análise por tipo de incidente
  const tiposHeaders = ['Tipo de Incidente', 'Quantidade', 'Quantidade (Críticos)', 'Horas Totais', 'Horas de Downtime'];
  
  // Agrupar por tipo
  const tiposMap = new Map<string, { 
    count: number; 
    countCritical: number; 
    hours: number; 
    downtimeHours: number;
  }>();
  
  incidentes.forEach(inc => {
    const tipoNome = inc.tipo.nome;
    const isCritical = inc.criticidade.is_downtime;
    const horas = inc.duracao_minutos ? inc.duracao_minutos / 60 : 0;
    
    if (!tiposMap.has(tipoNome)) {
      tiposMap.set(tipoNome, { 
        count: 0, 
        countCritical: 0, 
        hours: 0, 
        downtimeHours: 0 
      });
    }
    
    const tipoData = tiposMap.get(tipoNome)!;
    tipoData.count++;
    
    if (isCritical) {
      tipoData.countCritical++;
    }
    
    if (inc.duracao_minutos) {
      tipoData.hours += horas;
      
      if (isCritical) {
        tipoData.downtimeHours += horas;
      }
    }
  });
  
  // Converter para arrays
  const tiposData = Array.from(tiposMap.entries()).map(([tipo, data]) => [
    tipo,
    data.count,
    data.countCritical,
    data.hours.toFixed(2),
    data.downtimeHours.toFixed(2)
  ]);
  
  // Ordenar por quantidade (maior para menor)
  tiposData.sort((a, b) => Number(b[1]) - Number(a[1]));
  
  // Adicionar headers
  tiposData.unshift(tiposHeaders);
  
  const tiposSheet = XLSX.utils.aoa_to_sheet(tiposData);
  XLSX.utils.book_append_sheet(wb, tiposSheet, 'Análise por Tipo');
  
  // Configurar nome do arquivo
  const fileName = `relatorio_incidentes_${ambienteFiltrado.replace(/\s+/g, '_')}_${filtroPeriodo.inicio}_${filtroPeriodo.fim}.xlsx`;
  
  // Exportar arquivo
  XLSX.writeFile(wb, fileName);
};

// Função para exportar relatório para PDF
export const exportReportToPDF = async (options: PDFExportOptions) => {
  const { incidentes, metricas, filtroPeriodo, ambienteFiltrado, sections, onProgress } = options;
  
  // Criar documento PDF
  const doc = new jsPDF();
  let currentPage = 1;
  
  // Configurar fonte padrão
  doc.setFont('helvetica');
  
  // Função auxiliar para atualizar progresso
  const updateProgress = (value: number) => {
    if (onProgress) {
      onProgress(Math.min(100, Math.max(0, value)));
    }
  };
  
  // Função para adicionar cabeçalho e rodapé
  const addHeaderFooter = (pageNum: number, totalPages: number, sectionTitle?: string) => {
    // Cabeçalho
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    if (sectionTitle) {
      doc.text(sectionTitle, 14, 10);
    }
    
    // Rodapé
    doc.text('Cloud Operations Center - Relatório Gerado Automaticamente', 14, doc.internal.pageSize.height - 10);
    doc.text(`Página ${pageNum} de ${totalPages}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
  };
  
  // Função para adicionar quebra de página
  const addPageBreak = () => {
    doc.addPage();
    currentPage++;
  };
  
  // Capa do relatório
  updateProgress(5);
  
  // Adicionar logo
  const logoSize = 40;
  const pageWidth = doc.internal.pageSize.width;
  const logoX = (pageWidth - logoSize) / 2;
  
  // Desenhar círculo azul como fundo do logo
  doc.setFillColor(37, 99, 235);
  doc.circle(logoX + logoSize/2, 50, logoSize/2, 'F');
  
  // Adicionar texto do logo em branco
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('COC', logoX + 8, 58);
  
  // Título do relatório
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.text('Relatório de Incidentes', pageWidth/2, 100, { align: 'center' });
  
  // Nome do ambiente
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(ambienteFiltrado, pageWidth/2, 130, { align: 'center' });
  
  // Período
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${new Date(filtroPeriodo.inicio).toLocaleDateString('pt-BR')} a ${new Date(filtroPeriodo.fim).toLocaleDateString('pt-BR')}`,
    pageWidth/2,
    150,
    { align: 'center' }
  );
  
  // Data de geração
  doc.setFontSize(12);
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    pageWidth/2,
    doc.internal.pageSize.height - 20,
    { align: 'center' }
  );
  
  updateProgress(10);
  
  // Índice
  addPageBreak();
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Índice', 14, 30);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  let currentY = 50;
  const sections = [
    'Métricas de Performance',
    'Análise por Tipo de Incidente',
    'Tendência de Incidentes',
    'Análise de Impacto',
    'Atingimento de Metas',
    'Detalhamento de Incidentes'
  ];
  
  sections.forEach((section, index) => {
    doc.text(`${index + 1}. ${section}`, 30, currentY);
    currentY += 15;
  });
  
  updateProgress(20);
  
  // Seção 1: Métricas de Performance
  addPageBreak();
  addHeaderFooter(currentPage, sections.length + 2, '1. Métricas de Performance');
  
  // ... (rest of the implementation for each section)
  
  // Finalizar e salvar
  updateProgress(100);
  
  // Configurar nome do arquivo
  const fileName = `relatorio_${ambienteFiltrado.toLowerCase().replace(/\s+/g, '_')}_${filtroPeriodo.inicio}_${filtroPeriodo.fim}.pdf`;
  
  // Salvar o PDF
  doc.save(fileName);
};