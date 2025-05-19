import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
export const exportReportToPDF = (options: ExportOptions) => {
  const { incidentes, metricas, filtroPeriodo, ambienteFiltrado } = options;
  
  // Criar documento PDF
  const doc = new jsPDF();
  
  // Adicionar título e informações do relatório
  doc.setFontSize(18);
  doc.text('Relatório de Incidentes e Métricas', 14, 20);
  
  doc.setFontSize(11);
  doc.text(`Ambiente: ${ambienteFiltrado}`, 14, 30);
  doc.text(`Período: ${new Date(filtroPeriodo.inicio).toLocaleDateString('pt-BR')} a ${new Date(filtroPeriodo.fim).toLocaleDateString('pt-BR')}`, 14, 36);
  doc.text(`Data de geração: ${new Date().toLocaleString('pt-BR')}`, 14, 42);
  
  // Adicionar resumo dos dados
  doc.setFontSize(14);
  doc.text('Resumo dos Dados', 14, 55);
  
  const totalIncidentes = incidentes.length;
  const incidentesAbertos = incidentes.filter(inc => !inc.fim).length;
  const incidentesCriticos = incidentes.filter(inc => inc.criticidade.is_downtime).length;
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: 60,
    head: [['Total de Incidentes', 'Em Andamento', 'Críticos']],
    body: [[totalIncidentes, incidentesAbertos, incidentesCriticos]],
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] }
  });
  
  // Adicionar tabela de métricas
  // @ts-ignore - Current y position after previous table
  const metricasY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.text('Métricas de Performance', 14, metricasY);
  
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
    startY: metricasY + 5,
    head: [['Ambiente', 'Inc.', 'Crít.', 'MTTR (h)', 'Meta MTTR', 'MTBF (dias)', 'Meta MTBF', 'Disp. (%)', 'Meta Disp.']],
    body: metricasTableData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    styles: { fontSize: 8 }
  });
  
  // Análise por tipo de incidente
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
      data.hours.toFixed(2)
    ])
    .sort((a, b) => parseInt(b[1] as string) - parseInt(a[1] as string))
    // Limitar a 10 tipos mais frequentes para o PDF
    .slice(0, 10); 
  
  // @ts-ignore - Current y position after previous table
  const tiposY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.text('Incidentes por Tipo', 14, tiposY);
  
  // @ts-ignore - jspdf-autotable extension
  doc.autoTable({
    startY: tiposY + 5,
    head: [['Tipo de Incidente', 'Quantidade', 'Horas Totais']],
    body: tiposData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [240, 245, 255] }
  });
  
  // Adicionar tabela de incidentes (limitados a 15 para não ficar muito grande)
  const incidentesMostrados = incidentes.slice(0, 15);
  
  // @ts-ignore - Current y position after previous table
  const incidentesY = doc.lastAutoTable.finalY + 15;
  
  // Se não couber na página atual, criar nova página
  if (incidentesY > 250) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Incidentes Registrados', 14, 20);
    
    // @ts-ignore - jspdf-autotable extension
    doc.autoTable({
      startY: 25,
      head: [['Data', 'Ambiente', 'Tipo', 'Criticidade', 'Duração', 'Status']],
      body: incidentesMostrados.map(inc => [
        new Date(inc.inicio).toLocaleDateString('pt-BR'),
        inc.ambiente.nome,
        inc.tipo.nome,
        inc.criticidade.nome,
        inc.duracao_minutos ? `${(inc.duracao_minutos / 60).toFixed(1)}h` : '-',
        inc.fim ? 'Resolvido' : 'Em andamento'
      ]),
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [240, 245, 255] }
    });
  } else {
    doc.setFontSize(14);
    doc.text('Incidentes Registrados', 14, incidentesY);
    
    // @ts-ignore - jspdf-autotable extension
    doc.autoTable({
      startY: incidentesY + 5,
      head: [['Data', 'Ambiente', 'Tipo', 'Criticidade', 'Duração', 'Status']],
      body: incidentesMostrados.map(inc => [
        new Date(inc.inicio).toLocaleDateString('pt-BR'),
        inc.ambiente.nome,
        inc.tipo.nome,
        inc.criticidade.nome,
        inc.duracao_minutos ? `${(inc.duracao_minutos / 60).toFixed(1)}h` : '-',
        inc.fim ? 'Resolvido' : 'Em andamento'
      ]),
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [240, 245, 255] }
    });
  }
  
  // Se houver mais incidentes do que os mostrados
  if (incidentes.length > incidentesMostrados.length) {
    // @ts-ignore - Current y position after previous table
    const notaY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`* Exibindo ${incidentesMostrados.length} de ${incidentes.length} incidentes. Exporte para Excel para ver todos.`, 14, notaY);
  }
  
  // Adicionar rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Cloud Operations Center - Relatório Gerado Automaticamente', 14, doc.internal.pageSize.height - 10);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
  }
  
  // Salvar o PDF
  doc.save(`relatorio_incidentes_${ambienteFiltrado.replace(/\s+/g, '_')}_${filtroPeriodo.inicio}_${filtroPeriodo.fim}.pdf`);
};