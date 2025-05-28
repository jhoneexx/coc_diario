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
  const { incidentes, metricas, filtroPeriodo, ambienteFiltrado, onProgress } = options;
  
  // Criar documento PDF
  const doc = new jsPDF();
  let currentPage = 1;
  let totalPages = 8; // Capa + Índice + 6 seções
  
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
  addHeaderFooter(currentPage, totalPages, 'Índice');
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Índice', 14, 30);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  let currentY = 50;
  const reportSections = [
    'Métricas de Performance',
    'Análise por Tipo de Incidente',
    'Tendência de Incidentes',
    'Análise de Impacto',
    'Atingimento de Metas',
    'Detalhamento de Incidentes'
  ];
  
  reportSections.forEach((section, index) => {
    doc.text(`${index + 1}. ${section}`, 30, currentY);
    currentY += 15;
  });
  
  updateProgress(20);
  
  // Seção 1: Métricas de Performance
  addPageBreak();
  addHeaderFooter(currentPage, totalPages, '1. Métricas de Performance');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Métricas de Performance e Disponibilidade', 14, 30);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${new Date(filtroPeriodo.inicio).toLocaleDateString('pt-BR')} a ${new Date(filtroPeriodo.fim).toLocaleDateString('pt-BR')}`, 14, 40);
  doc.text(`Ambiente: ${ambienteFiltrado}`, 14, 45);
  
  // Tabela de métricas
  const metricasTableData = metricas.map(m => [
    m.ambiente_nome,
    m.incidentes_total.toString(),
    m.incidentes_criticos.toString(),
    m.mttr.toFixed(2),
    m.meta_mttr ? m.meta_mttr.toFixed(2) : '-',
    (m.mtbf / 24).toFixed(2),
    m.meta_mtbf ? (m.meta_mtbf / 24).toFixed(2) : '-',
    m.disponibilidade.toFixed(3) + '%',
    m.meta_disponibilidade ? m.meta_disponibilidade.toFixed(3) + '%' : '-'
  ]);
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: 50,
    head: [['Ambiente', 'Inc.', 'Crít.', 'MTTR (h)', 'Meta MTTR', 'MTBF (dias)', 'Meta MTBF', 'Disp. (%)', 'Meta Disp.']],
    body: metricasTableData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    styles: { fontSize: 8 }
  });
  
  updateProgress(30);
  
  // Seção 2: Análise por Tipo de Incidente
  addPageBreak();
  addHeaderFooter(currentPage, totalPages, '2. Análise por Tipo de Incidente');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Análise por Tipo de Incidente', 14, 30);
  
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
  
  // Converter para arrays e ordenar por quantidade
  const tiposData = Array.from(tiposMap.entries())
    .map(([tipo, data]) => [
      tipo,
      data.count.toString(),
      data.countCritical.toString(),
      data.hours.toFixed(2),
      data.downtimeHours.toFixed(2)
    ])
    .sort((a, b) => parseInt(b[1] as string) - parseInt(a[1] as string));
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: 40,
    head: [['Tipo de Incidente', 'Quantidade', 'Críticos', 'Horas Totais', 'Horas de Downtime']],
    body: tiposData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] }
  });
  
  // Adicionar gráfico de pizza (representação textual)
  // @ts-ignore - Current y position after previous table
  const tiposY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.text('Distribuição por Tipo de Incidente', 14, tiposY);
  
  // Tabela de distribuição percentual
  const totalIncidentes = incidentes.length;
  const distribuicaoData = tiposData.map(row => {
    const tipo = row[0] as string;
    const quantidade = parseInt(row[1] as string);
    const percentual = totalIncidentes > 0 ? (quantidade / totalIncidentes * 100).toFixed(1) + '%' : '0%';
    return [tipo, quantidade.toString(), percentual];
  });
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: tiposY + 10,
    head: [['Tipo de Incidente', 'Quantidade', 'Percentual']],
    body: distribuicaoData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] }
  });
  
  updateProgress(40);
  
  // Seção 3: Tendência de Incidentes
  addPageBreak();
  addHeaderFooter(currentPage, totalPages, '3. Tendência de Incidentes');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Tendência de Incidentes ao Longo do Tempo', 14, 30);
  
  // Agrupar incidentes por mês
  const incidentesPorMes: Record<string, { total: number, criticos: number }> = {};
  
  // Preencher todos os meses do intervalo
  const inicio = new Date(filtroPeriodo.inicio);
  const fim = new Date(filtroPeriodo.fim);
  
  for (let d = new Date(inicio.getFullYear(), inicio.getMonth(), 1); 
       d <= new Date(fim.getFullYear(), fim.getMonth() + 1, 0); 
       d.setMonth(d.getMonth() + 1)) {
    const mesStr = d.toISOString().slice(0, 7); // YYYY-MM
    incidentesPorMes[mesStr] = { total: 0, criticos: 0 };
  }
  
  // Contar incidentes por mês
  incidentes.forEach(inc => {
    const mesStr = inc.inicio.slice(0, 7); // YYYY-MM
    if (incidentesPorMes[mesStr]) {
      incidentesPorMes[mesStr].total++;
      if (inc.criticidade.is_downtime) {
        incidentesPorMes[mesStr].criticos++;
      }
    }
  });
  
  // Converter para array para a tabela
  const tendenciaData = Object.entries(incidentesPorMes).map(([mes, dados]) => {
    const [ano, mesNum] = mes.split('-');
    const mesNome = new Date(parseInt(ano), parseInt(mesNum) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return [mesNome, dados.total.toString(), dados.criticos.toString()];
  });
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: 40,
    head: [['Mês', 'Total de Incidentes', 'Incidentes Críticos']],
    body: tendenciaData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] }
  });
  
  // Adicionar descrição da tendência
  // @ts-ignore - Current y position after previous table
  const tendenciaDescY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(12);
  doc.text('Análise de Tendência:', 14, tendenciaDescY);
  
  // Calcular tendência (aumento ou diminuição)
  const meses = Object.keys(incidentesPorMes).sort();
  if (meses.length >= 2) {
    const primeiro = incidentesPorMes[meses[0]].total;
    const ultimo = incidentesPorMes[meses[meses.length - 1]].total;
    const diferenca = ultimo - primeiro;
    
    doc.setFontSize(10);
    if (diferenca > 0) {
      doc.text(`• Aumento de ${diferenca} incidentes entre ${meses[0]} e ${meses[meses.length - 1]}`, 20, tendenciaDescY + 10);
    } else if (diferenca < 0) {
      doc.text(`• Redução de ${Math.abs(diferenca)} incidentes entre ${meses[0]} e ${meses[meses.length - 1]}`, 20, tendenciaDescY + 10);
    } else {
      doc.text(`• Estabilidade no número de incidentes entre ${meses[0]} e ${meses[meses.length - 1]}`, 20, tendenciaDescY + 10);
    }
  }
  
  updateProgress(50);
  
  // Seção 4: Análise de Impacto
  addPageBreak();
  addHeaderFooter(currentPage, totalPages, '4. Análise de Impacto');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Análise de Impacto', 14, 30);
  
  // Tabela de impacto por ambiente
  const impactoData = metricas.map(m => [
    m.ambiente_nome,
    m.incidentes_total.toString(),
    m.incidentes_criticos.toString(),
    m.incidentes_total > 0 ? ((m.incidentes_criticos / m.incidentes_total) * 100).toFixed(1) + '%' : '0%',
    m.disponibilidade.toFixed(3) + '%'
  ]);
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: 40,
    head: [['Ambiente', 'Total Incidentes', 'Incidentes Críticos', '% de Criticidade', 'Disponibilidade']],
    body: impactoData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] }
  });
  
  // Horas de impacto por tipo
  // @ts-ignore - Current y position after previous table
  const impactoHorasY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.text('Horas de Impacto por Tipo de Incidente', 14, impactoHorasY);
  
  // Calcular horas de impacto por tipo
  const horasPorTipo: Record<string, { total: number, downtime: number }> = {};
  
  incidentes.forEach(inc => {
    if (inc.duracao_minutos) {
      const tipo = inc.tipo.nome;
      const horas = inc.duracao_minutos / 60;
      
      if (!horasPorTipo[tipo]) {
        horasPorTipo[tipo] = { total: 0, downtime: 0 };
      }
      
      horasPorTipo[tipo].total += horas;
      
      if (inc.criticidade.is_downtime) {
        horasPorTipo[tipo].downtime += horas;
      }
    }
  });
  
  // Converter para array e ordenar por horas totais
  const horasData = Object.entries(horasPorTipo)
    .map(([tipo, horas]) => [
      tipo,
      horas.total.toFixed(2),
      horas.downtime.toFixed(2)
    ])
    .sort((a, b) => parseFloat(b[1] as string) - parseFloat(a[1] as string));
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: impactoHorasY + 10,
    head: [['Tipo de Incidente', 'Horas Totais', 'Horas de Downtime']],
    body: horasData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] }
  });
  
  updateProgress(60);
  
  // Seção 5: Atingimento de Metas
  addPageBreak();
  addHeaderFooter(currentPage, totalPages, '5. Atingimento de Metas');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Atingimento de Metas', 14, 30);
  
  // Calcular atingimento de metas por ambiente
  const metasData = metricas
    .filter(m => m.meta_mttr !== null || m.meta_mtbf !== null || m.meta_disponibilidade !== null)
    .map(m => {
      // Calcular percentuais de atingimento
      const mttrPercentual = m.meta_mttr && m.mttr > 0 ? Math.min(100, 100 * (m.meta_mttr / m.mttr)) : 0;
      const mtbfPercentual = m.meta_mtbf && m.mtbf > 0 ? Math.min(100, 100 * (m.mtbf / m.meta_mtbf)) : 0;
      const dispPercentual = m.meta_disponibilidade ? Math.min(100, 100 * (m.disponibilidade / m.meta_disponibilidade)) : 0;
      
      return [
        m.ambiente_nome,
        m.mttr.toFixed(2),
        m.meta_mttr ? m.meta_mttr.toFixed(2) : '-',
        mttrPercentual.toFixed(1) + '%',
        (m.mtbf / 24).toFixed(2),
        m.meta_mtbf ? (m.meta_mtbf / 24).toFixed(2) : '-',
        mtbfPercentual.toFixed(1) + '%',
        m.disponibilidade.toFixed(3) + '%',
        m.meta_disponibilidade ? m.meta_disponibilidade.toFixed(3) + '%' : '-',
        dispPercentual.toFixed(1) + '%'
      ];
    });
  
  if (metasData.length > 0) {
    // @ts-ignore - jspdf-autotable extension
    doc.autoTable({
      startY: 40,
      head: [['Ambiente', 'MTTR', 'Meta', 'Ating.', 'MTBF (dias)', 'Meta', 'Ating.', 'Disp. (%)', 'Meta', 'Ating.']],
      body: metasData,
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      styles: { fontSize: 8 }
    });
  } else {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Não há metas configuradas para os ambientes selecionados.', 14, 50);
  }
  
  updateProgress(80);
  
  // Seção 6: Detalhamento de Incidentes
  addPageBreak();
  addHeaderFooter(currentPage, totalPages, '6. Detalhamento de Incidentes');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento de Incidentes', 14, 30);
  
  // Limitar a 20 incidentes para não ficar muito grande
  const incidentesDetalhados = incidentes.slice(0, 20);
  
  const incidentesDetalhadosData = incidentesDetalhados.map(inc => [
    inc.id.toString(),
    new Date(inc.inicio).toLocaleDateString('pt-BR'),
    inc.ambiente.nome,
    inc.segmento.nome,
    inc.tipo.nome,
    inc.criticidade.nome,
    inc.duracao_minutos ? (inc.duracao_minutos / 60).toFixed(2) + 'h' : '-',
    inc.fim ? 'Resolvido' : 'Em andamento'
  ]);
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: 40,
    head: [['ID', 'Data', 'Ambiente', 'Segmento', 'Tipo', 'Criticidade', 'Duração', 'Status']],
    body: incidentesDetalhadosData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    styles: { fontSize: 8 }
  });
  
  // Se houver mais incidentes do que os mostrados
  if (incidentes.length > incidentesDetalhados.length) {
    // @ts-ignore - Current y position after previous table
    const notaY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`* Exibindo ${incidentesDetalhados.length} de ${incidentes.length} incidentes. Exporte para Excel para ver todos.`, 14, notaY);
  }
  
  updateProgress(95);
  
  // Finalizar e salvar
  updateProgress(100);
  
  // Configurar nome do arquivo
  const fileName = `relatorio_${ambienteFiltrado.toLowerCase().replace(/\s+/g, '_')}_${filtroPeriodo.inicio}_${filtroPeriodo.fim}.pdf`;
  
  // Salvar o PDF
  doc.save(fileName);
};