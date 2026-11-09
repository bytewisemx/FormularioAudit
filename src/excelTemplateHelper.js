import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { DEFAULT_SECTIONS } from './defaultSections';

const COLOR_PRIMARY_NAVY = 'FF1E3A8A'; // Azul Marino Corporativo #1E3A8A
const COLOR_SECONDARY_BLUE = 'FF2563EB'; // Azul Corporativo #2563EB
const COLOR_GRID_BORDER = 'FFE2E8F0'; // Borde sutil gris claro #E2E8F0
const COLOR_TEXT_DARK = 'FF1E293B'; // Texto pizarra oscuro #1E293B

// Colores de formato condicional suave
const COLOR_SUCCESS_BG = 'FFDCFCE7'; // Verde suave #DCFCE7
const COLOR_SUCCESS_TEXT = 'FF166534'; // Verde oscuro #166534

const COLOR_WARNING_BG = 'FFFEF3C7'; // Ámbar suave #FEF3C7
const COLOR_WARNING_TEXT = 'FF92400E'; // Ámbar oscuro #92400E

const COLOR_DANGER_BG = 'FFFEE2E2'; // Rojo suave #FEE2E2
const COLOR_DANGER_TEXT = 'FF991B1B'; // Rojo oscuro #991B1B

const COLOR_MUTED_BG = 'FFF1F5F9'; // Gris suave #F1F5F9
const COLOR_MUTED_TEXT = 'FF64748B'; // Gris oscuro #64748B

const thinBorder = {
  top: { style: 'thin', color: { argb: COLOR_GRID_BORDER } },
  left: { style: 'thin', color: { argb: COLOR_GRID_BORDER } },
  bottom: { style: 'thin', color: { argb: COLOR_GRID_BORDER } },
  right: { style: 'thin', color: { argb: COLOR_GRID_BORDER } },
};

/**
 * Aplica estilos corporativos estándar a los encabezados de tabla en Excel
 */
const applyHeaderStyle = (row, bgColor = COLOR_PRIMARY_NAVY) => {
  row.height = 30;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: bgColor } },
      left: { style: 'thin', color: { argb: 'FF3B82F6' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF3B82F6' } },
    };
  });
};

/**
 * Agrega la Pestaña 1: "Instrucciones" a cualquier Workbook
 */
const addInstructionsSheet = (workbook, empresa = '') => {
  const ws = workbook.addWorksheet('Instrucciones');
  ws.views = [{ showGridLines: true }];

  // Título Principal
  const titleRow = ws.addRow(['BYTEWISE — GUÍA DE LLENADO Y EVALUACIÓN DE AUDITORÍA TI']);
  titleRow.height = 34;
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY_NAVY } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(1, 1, 1, 6);

  ws.addRow([]);

  // Sección 1: Propósito
  const sub1 = ws.addRow(['1. OBJETIVO DEL DOCUMENTO']);
  sub1.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR_PRIMARY_NAVY } };
  
  const desc1 = ws.addRow([
    'Esta plantilla permite la carga estructurada del cuestionario de controles y la exportación de resultados para la auditoría de TI' +
    (empresa ? ` de ${empresa}.` : '.') + 
    ' Diseñada bajo mejores prácticas de seguridad de la información, continuidad operativa y estándares internacionales.'
  ]);
  desc1.getCell(1).font = { name: 'Calibri', size: 11, color: { argb: COLOR_TEXT_DARK } };
  ws.mergeCells(desc1.number, 1, desc1.number, 6);
  desc1.height = 28;

  ws.addRow([]);

  // Sección 2: Escala de Puntuación
  const sub2 = ws.addRow(['2. CRITERIOS Y ESCALA DE EVALUACIÓN (0 A 4 PUNTOS)']);
  sub2.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR_PRIMARY_NAVY } };

  const scaleHeader = ws.addRow(['Nivel', 'Calificación', 'Criterio Operativo', 'Descripción y Grado de Cumplimiento']);
  scaleHeader.height = 26;
  scaleHeader.eachCell((c) => {
    c.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECONDARY_BLUE } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const scaleData = [
    { nivel: 'Nivel 0', pts: '0', crit: 'No Implementado / Inexistente', desc: 'No existe ningún mecanismo, política, equipo o procedimiento. Riesgo crítico.' },
    { nivel: 'Nivel 1', pts: '1', crit: 'Inicial / Ad-hoc / Informal', desc: 'Existe de manera informal por iniciativa individual, sin documentación ni estandarización.' },
    { nivel: 'Nivel 2', pts: '2', crit: 'En Proceso / Parcial', desc: 'Se cuenta con controles o políticas parciales en desarrollo; faltan pruebas o cobertura total.' },
    { nivel: 'Nivel 3', pts: '3', crit: 'Definido y Operativo', desc: 'Control documentado, aprobado por la dirección, formalmente implementado y en operación continua.' },
    { nivel: 'Nivel 4', pts: '4', crit: 'Optimizado y Redundante', desc: 'Control probado periódicamente, con alta disponibilidad/redundancia y mejora continua.' },
  ];

  scaleData.forEach((item, index) => {
    const row = ws.addRow([item.nivel, item.pts, item.crit, item.desc]);
    row.height = 24;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: colNumber <= 2 ? 'center' : 'left' };
      if (index === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
      if (index === 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    });
  });

  ws.addRow([]);

  // Sección 3: Reglas de Importación
  const sub3 = ws.addRow(['3. RECOMENDACIONES PARA CARGA MASIVA Y MODIFICACIÓN']);
  sub3.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR_PRIMARY_NAVY } };

  const tips = [
    '• Pestaña "Cuestionario - Preguntas": No modifiques los nombres de los encabezados de las columnas para evitar errores de sintaxis al importar.',
    '• Identificadores: En la columna "ID Pregunta" puedes utilizar números (1, 2) o códigos normativos (4.1, A.5.1).',
    '• Nuevas Áreas: Para agregar una nueva área o dominio, escribe su nombre en la columna "Área / Dominio" en las filas deseadas.',
    '• Niveles 0 a 4: Puedes enriquecer o personalizar el criterio específico de cada nivel para cada pregunta o control.'
  ];

  tips.forEach((tip) => {
    const r = ws.addRow([tip]);
    r.getCell(1).font = { name: 'Calibri', size: 10.5, color: { argb: COLOR_TEXT_DARK } };
    ws.mergeCells(r.number, 1, r.number, 6);
  });

  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 30;
  ws.getColumn(4).width = 75;
  ws.getColumn(5).width = 20;
  ws.getColumn(6).width = 20;

  return ws;
};

/**
 * Genera y descarga la plantilla oficial de preguntas en formato Excel (.xlsx)
 * con las 2 pestañas estructuradas: "Instrucciones" y "Cuestionario - Preguntas".
 */
export const downloadExcelTemplate = async (sourceSections = DEFAULT_SECTIONS) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ByteWise Auditoría TI';
    workbook.created = new Date();

    // Pestaña 1: Instrucciones
    addInstructionsSheet(workbook);

    // Pestaña 2: Cuestionario - Preguntas (sin barra diagonal para evitar error de Excel)
    const wsQuestions = workbook.addWorksheet('Cuestionario - Preguntas');
    wsQuestions.views = [{ showGridLines: true }];

    wsQuestions.columns = [
      { header: 'ID Dominio', key: 'domainId', width: 14 },
      { header: 'Área / Dominio', key: 'area', width: 32 },
      { header: 'ID Pregunta', key: 'id', width: 14 },
      { header: 'Enunciado Principal', key: 'pregunta', width: 60 },
      { header: 'Requisito', key: 'requisito', width: 28 },
      { header: 'Evidencia Sugerida', key: 'evidencia', width: 32 },
      { header: 'Nivel 0', key: 'nivel0', width: 30 },
      { header: 'Nivel 1', key: 'nivel1', width: 30 },
      { header: 'Nivel 2', key: 'nivel2', width: 30 },
      { header: 'Nivel 3', key: 'nivel3', width: 30 },
      { header: 'Nivel 4', key: 'nivel4', width: 30 },
    ];

    applyHeaderStyle(wsQuestions.getRow(1));

    const sectionsToUse = sourceSections && Object.keys(sourceSections).length > 0 
      ? sourceSections 
      : DEFAULT_SECTIONS;

    let domainCounter = 1;
    Object.entries(sectionsToUse).forEach(([area, questions]) => {
      const domainId = `DOM-${String(domainCounter).padStart(2, '0')}`;
      domainCounter++;

      (questions || []).forEach((q) => {
        const escala = Array.isArray(q.escalaEvaluacion) ? q.escalaEvaluacion : [];
        const row = wsQuestions.addRow({
          domainId: domainId,
          area: area,
          id: q.id,
          pregunta: q.pregunta,
          requisito: q.requisito || q.nota || '',
          evidencia: q.evidencia || '',
          nivel0: escala[0] || '0 - Sin controles ni mecanismos implementados.',
          nivel1: escala[1] || '1 - Mecanismos básicos informales.',
          nivel2: escala[2] || '2 - Controles parciales en desarrollo.',
          nivel3: escala[3] || '3 - Control formalmente documentado y operativo.',
          nivel4: escala[4] || '4 - Control optimizado, redundante y probado.',
        });

        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
        row.getCell(3).alignment = { vertical: 'top', horizontal: 'center' };

        row.eachCell((cell) => {
          cell.border = thinBorder;
          cell.font = { name: 'Calibri', size: 10 };
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, 'Plantilla_Cuestionario_Auditoria_TI.xlsx');
    return true;
  } catch (err) {
    console.error('Error al generar plantilla Excel:', err);
    alert('Error al descargar la plantilla de Excel.');
    throw err;
  }
};

/**
 * Genera y descarga el Libro Excel de Exportación Completo de Resultados de Auditoría
 * Pestañas: "Instrucciones", "Resultados y Respuestas", "Cuestionario - Preguntas", "Resumen y Dominios"
 */
export const exportAuditToProfessionalExcel = async ({
  introData = {},
  actor = {},
  customSections = {},
  responses = {},
  areaScores = {},
  avgScore = 0,
  totalScore = 0,
  scoreLevel = {},
  positiveComments = '',
  negativeComments = '',
  recommendations = '',
  generalComments = '',
}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ByteWise Auditoría TI';
    workbook.created = new Date();

    // 1. Pestaña: Instrucciones
    addInstructionsSheet(workbook, introData.nombreEmpresa);

    // 2. Pestaña: Resultados y Respuestas
    const wsResults = workbook.addWorksheet('Resultados y Respuestas');
    wsResults.views = [{ showGridLines: true }];

    wsResults.columns = [
      { header: 'ID Dominio', key: 'domainId', width: 14 },
      { header: 'Área / Dominio', key: 'area', width: 30 },
      { header: 'ID Pregunta', key: 'id', width: 14 },
      { header: 'Pregunta / Control Evaluado', key: 'pregunta', width: 55 },
      { header: 'Puntaje Asignado', key: 'score', width: 18 },
      { header: 'Estado / Madurez', key: 'estado', width: 22 },
      { header: 'Comentarios del Auditor / Hallazgos', key: 'comentarios', width: 45 },
      { header: 'Evidencia Verificada', key: 'evidencia', width: 35 },
    ];

    applyHeaderStyle(wsResults.getRow(1));

    let domainCounter = 1;
    Object.entries(customSections).forEach(([area, questions]) => {
      const domainId = `DOM-${String(domainCounter).padStart(2, '0')}`;
      domainCounter++;

      (questions || []).forEach((q) => {
        const key = `${area}-${q.id}`;
        const resp = responses[key] || {};
        const scoreVal = resp.evaluacion !== undefined 
          ? resp.evaluacion 
          : (resp.score !== undefined ? resp.score : null);

        let scoreText = 'Sin evaluar';
        let estadoText = 'Pendiente';
        let bgArgb = COLOR_MUTED_BG;
        let textArgb = COLOR_MUTED_TEXT;

        if (scoreVal !== null && scoreVal !== undefined && scoreVal !== '') {
          const num = Number(scoreVal);
          scoreText = `${num} / 4`;
          if (num >= 3) {
            estadoText = num === 4 ? 'Excelente / Optimizado' : 'Cumple / Operativo';
            bgArgb = COLOR_SUCCESS_BG;
            textArgb = COLOR_SUCCESS_TEXT;
          } else if (num === 2) {
            estadoText = 'Parcial / En Desarrollo';
            bgArgb = COLOR_WARNING_BG;
            textArgb = COLOR_WARNING_TEXT;
          } else {
            estadoText = num === 1 ? 'Inicial / Informal' : 'No Implementado / Crítico';
            bgArgb = COLOR_DANGER_BG;
            textArgb = COLOR_DANGER_TEXT;
          }
        }

        const row = wsResults.addRow({
          domainId: domainId,
          area: area,
          id: q.id,
          pregunta: q.pregunta,
          score: scoreText,
          estado: estadoText,
          comentarios: resp.observaciones || resp.comment || '',
          evidencia: resp.evidencia || resp.evidence || '',
        });

        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
        row.getCell(3).alignment = { vertical: 'top', horizontal: 'center' };
        row.getCell(5).alignment = { vertical: 'top', horizontal: 'center' };
        row.getCell(6).alignment = { vertical: 'top', horizontal: 'center' };

        row.eachCell((cell) => {
          cell.border = thinBorder;
          cell.font = { name: 'Calibri', size: 10 };
        });

        // Formato condicional suave para las celdas de puntaje y estado
        const scoreCell = row.getCell(5);
        const estadoCell = row.getCell(6);
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        scoreCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: textArgb } };
        estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        estadoCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: textArgb } };
      });
    });

    // 3. Pestaña: Cuestionario - Preguntas Completo
    const wsQuestions = workbook.addWorksheet('Cuestionario - Preguntas');
    wsQuestions.views = [{ showGridLines: true }];

    wsQuestions.columns = [
      { header: 'ID Dominio', key: 'domainId', width: 14 },
      { header: 'Área / Dominio', key: 'area', width: 32 },
      { header: 'ID Pregunta', key: 'id', width: 14 },
      { header: 'Enunciado Principal', key: 'pregunta', width: 60 },
      { header: 'Requisito', key: 'requisito', width: 28 },
      { header: 'Evidencia Sugerida', key: 'evidencia', width: 32 },
      { header: 'Nivel 0', key: 'nivel0', width: 30 },
      { header: 'Nivel 1', key: 'nivel1', width: 30 },
      { header: 'Nivel 2', key: 'nivel2', width: 30 },
      { header: 'Nivel 3', key: 'nivel3', width: 30 },
      { header: 'Nivel 4', key: 'nivel4', width: 30 },
    ];

    applyHeaderStyle(wsQuestions.getRow(1));

    domainCounter = 1;
    Object.entries(customSections).forEach(([area, questions]) => {
      const domainId = `DOM-${String(domainCounter).padStart(2, '0')}`;
      domainCounter++;

      (questions || []).forEach((q) => {
        const escala = Array.isArray(q.escalaEvaluacion) ? q.escalaEvaluacion : [];
        const row = wsQuestions.addRow({
          domainId: domainId,
          area: area,
          id: q.id,
          pregunta: q.pregunta,
          requisito: q.requisito || q.nota || '',
          evidencia: q.evidencia || '',
          nivel0: escala[0] || '0 - No Implementado.',
          nivel1: escala[1] || '1 - Inicial o Ad-hoc.',
          nivel2: escala[2] || '2 - En desarrollo / Parcial.',
          nivel3: escala[3] || '3 - Definido y Operativo.',
          nivel4: escala[4] || '4 - Optimizado y Redundante.',
        });

        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
        row.getCell(3).alignment = { vertical: 'top', horizontal: 'center' };

        row.eachCell((cell) => {
          cell.border = thinBorder;
          cell.font = { name: 'Calibri', size: 10 };
        });
      });
    });

    // 4. Pestaña: Resumen Ejecutivo y Dominios
    const wsSummary = workbook.addWorksheet('Resumen y Dominios');
    wsSummary.views = [{ showGridLines: true }];

    const sumTitle = wsSummary.addRow(['RESUMEN EJECUTIVO DE DESEMPEÑO POR DOMINIOS']);
    sumTitle.height = 32;
    sumTitle.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    sumTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY_NAVY } };
    sumTitle.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    wsSummary.mergeCells(1, 1, 1, 6);

    wsSummary.addRow([]);
    const empName = introData?.nombreEmpresa || 'N/A';
    const audName = actor?.nombreAuditor || 'N/A';
    const numAvg = Number(avgScore || 0);
    const numTot = Number(totalScore || 0);
    const matNivel = scoreLevel?.nivel || 'N/A';
    const matDesc = scoreLevel?.descripcion || 'N/A';

    wsSummary.addRow(['Empresa:', empName, 'Auditor:', audName]);
    wsSummary.addRow(['Puntaje Promedio:', `${numAvg.toFixed(2)} / 4.0`, 'Puntaje Real:', `${numTot.toFixed(0)} pts`]);
    wsSummary.addRow(['Madurez TI:', matNivel, 'Descripción:', matDesc]);
    wsSummary.addRow([]);

    const domainHead = wsSummary.addRow(['Área / Dominio', 'Cumplimiento (%)', 'Promedio (/4)', 'Respondidas', 'Total Controles', 'Semáforo']);
    applyHeaderStyle(domainHead, COLOR_SECONDARY_BLUE);

    Object.entries(areaScores || {}).forEach(([area, data]) => {
      let trafficLabel = 'Crítico';
      let trafficBg = COLOR_DANGER_BG;
      let trafficText = COLOR_DANGER_TEXT;
      const pct = Number(data?.percentage || 0);

      if (pct >= 75) {
        trafficLabel = 'Óptimo';
        trafficBg = COLOR_SUCCESS_BG;
        trafficText = COLOR_SUCCESS_TEXT;
      } else if (pct >= 50) {
        trafficLabel = 'Intermedio';
        trafficBg = COLOR_WARNING_BG;
        trafficText = COLOR_WARNING_TEXT;
      }

      const row = wsSummary.addRow([
        area,
        `${pct}%`,
        data?.score ?? '0',
        data?.answered ?? 0,
        data?.total ?? 0,
        trafficLabel
      ]);

      row.height = 24;
      row.eachCell((c, colIdx) => {
        c.font = { name: 'Calibri', size: 10.5 };
        c.border = thinBorder;
        c.alignment = { vertical: 'middle', horizontal: colIdx === 1 ? 'left' : 'center' };
      });

      const trafficCell = row.getCell(6);
      trafficCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: trafficBg } };
      trafficCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: trafficText } };
    });

    // Conclusiones
    if (positiveComments || negativeComments || recommendations || generalComments) {
      wsSummary.addRow([]);
      const conHead = wsSummary.addRow(['CONCLUSIONES Y PLAN DE ACCIÓN']);
      conHead.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR_PRIMARY_NAVY } };
      wsSummary.mergeCells(conHead.number, 1, conHead.number, 6);

      if (positiveComments) {
        wsSummary.addRow(['Fortalezas y Aspectos Positivos:']);
        const r = wsSummary.addRow([positiveComments]);
        wsSummary.mergeCells(r.number, 1, r.number, 6);
        r.height = 50;
        r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      }
      if (negativeComments) {
        wsSummary.addRow(['Hallazgos y Vulnerabilidades:']);
        const r = wsSummary.addRow([negativeComments]);
        wsSummary.mergeCells(r.number, 1, r.number, 6);
        r.height = 50;
        r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      }
      if (recommendations) {
        wsSummary.addRow(['Recomendaciones Prioritarias:']);
        const r = wsSummary.addRow([recommendations]);
        wsSummary.mergeCells(r.number, 1, r.number, 6);
        r.height = 50;
        r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      }
    }

    wsSummary.getColumn(1).width = 38;
    wsSummary.getColumn(2).width = 18;
    wsSummary.getColumn(3).width = 16;
    wsSummary.getColumn(4).width = 16;
    wsSummary.getColumn(5).width = 18;
    wsSummary.getColumn(6).width = 18;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const sanitized = (introData.nombreEmpresa || 'Empresa').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    saveAs(blob, `Reporte_Auditoria_TI_${sanitized}.xlsx`);
    return true;
  } catch (err) {
    console.error('Error al exportar reporte Excel profesional:', err);
    throw err;
  }
};

/**
 * Lee un archivo .xlsx o .json y lo transforma en la estructura de secciones y preguntas
 * Compatible tanto con la nueva plantilla de 2 pestañas como con hojas de cálculo individuales.
 */
export const parseQuestionsFile = async (file) => {
  const fileName = (file.name || '').toLowerCase();

  // Caso 1: Archivo JSON
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
      throw new Error('El archivo JSON no contiene un formato de áreas válido.');
    }
    let totalQuestions = 0;
    Object.keys(parsed).forEach((area) => {
      if (Array.isArray(parsed[area])) {
        totalQuestions += parsed[area].length;
      }
    });
    return {
      parsed,
      areasCount: Object.keys(parsed).length,
      questionsCount: totalQuestions,
    };
  }

  // Caso 2: Archivo Excel (.xlsx / .xls)
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Buscar inteligentemente la hoja de preguntas
  let worksheet = workbook.worksheets.find((ws) => {
    const name = (ws.name || '').toLowerCase();
    return name.includes('cuestionario') || name.includes('pregunta') || name.includes('preguntas');
  });

  // Si no se encuentra por nombre, probar con la segunda hoja (si la primera es "Instrucciones") o la primera
  if (!worksheet) {
    if (workbook.worksheets.length > 1 && (workbook.worksheets[0].name || '').toLowerCase().includes('instrucc')) {
      worksheet = workbook.worksheets[1];
    } else {
      worksheet = workbook.worksheets[0];
    }
  }

  if (!worksheet) {
    throw new Error('El archivo Excel no contiene ninguna hoja de cálculo.');
  }

  const colMap = { 
    area: -1, 
    id: -1, 
    pregunta: -1, 
    evidencia: -1, 
    nota: -1, 
    requisito: -1,
    nivel0: -1,
    nivel1: -1,
    nivel2: -1,
    nivel3: -1,
    nivel4: -1
  };
  
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (val.includes('area') || val.includes('seccion') || val.includes('dominio')) {
      if (!val.includes('id dominio') && colMap.area === -1) colMap.area = colNumber;
    }
    else if (val === 'id' || val.includes('id pregunta') || val.includes('codigo') || val.includes('num')) {
      if (colMap.id === -1) colMap.id = colNumber;
    }
    else if (val.includes('pregunta') || val.includes('enunciado') || val.includes('cuestion') || val.includes('item')) {
      if (colMap.pregunta === -1) colMap.pregunta = colNumber;
    }
    else if (val.includes('evidencia')) {
      if (colMap.evidencia === -1) colMap.evidencia = colNumber;
    }
    else if (val.includes('requisito') || val.includes('norma') || val.includes('control')) {
      if (colMap.requisito === -1) colMap.requisito = colNumber;
    }
    else if (val.includes('nota') || val.includes('ayuda')) {
      if (colMap.nota === -1) colMap.nota = colNumber;
    }
    else if (val.includes('nivel 0') || val.includes('nivel0')) colMap.nivel0 = colNumber;
    else if (val.includes('nivel 1') || val.includes('nivel1')) colMap.nivel1 = colNumber;
    else if (val.includes('nivel 2') || val.includes('nivel2')) colMap.nivel2 = colNumber;
    else if (val.includes('nivel 3') || val.includes('nivel3')) colMap.nivel3 = colNumber;
    else if (val.includes('nivel 4') || val.includes('nivel4')) colMap.nivel4 = colNumber;
  });

  // Si no se asignaron por coincidencia exacta, usar heurística por posición
  if (colMap.area === -1) colMap.area = colMap.pregunta === 4 ? 2 : 1;
  if (colMap.id === -1) colMap.id = colMap.pregunta === 4 ? 3 : 2;
  if (colMap.pregunta === -1) colMap.pregunta = 3;
  if (colMap.evidencia === -1) colMap.evidencia = 4;
  if (colMap.requisito === -1) colMap.requisito = 5;

  const parsed = {};
  let currentArea = 'Área Inicial';
  let totalQuestions = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Saltar encabezados

    const areaVal = String(row.getCell(colMap.area).value || '').trim();
    const idVal = row.getCell(colMap.id).value;
    const preguntaVal = String(row.getCell(colMap.pregunta).value || '').trim();
    const evidenciaVal = String(row.getCell(colMap.evidencia).value || '').trim();
    const requisitoVal = String(row.getCell(colMap.requisito).value || '').trim();
    const notaVal = colMap.nota !== -1 ? String(row.getCell(colMap.nota).value || '').trim() : '';

    const escala = [];
    if (colMap.nivel0 !== -1 && row.getCell(colMap.nivel0).value) escala.push(String(row.getCell(colMap.nivel0).value).trim());
    if (colMap.nivel1 !== -1 && row.getCell(colMap.nivel1).value) escala.push(String(row.getCell(colMap.nivel1).value).trim());
    if (colMap.nivel2 !== -1 && row.getCell(colMap.nivel2).value) escala.push(String(row.getCell(colMap.nivel2).value).trim());
    if (colMap.nivel3 !== -1 && row.getCell(colMap.nivel3).value) escala.push(String(row.getCell(colMap.nivel3).value).trim());
    if (colMap.nivel4 !== -1 && row.getCell(colMap.nivel4).value) escala.push(String(row.getCell(colMap.nivel4).value).trim());

    if (areaVal) {
      currentArea = areaVal;
    }

    if (preguntaVal) {
      if (!parsed[currentArea]) {
        parsed[currentArea] = [];
      }
      const qId = idVal ? String(idVal).trim() : String(parsed[currentArea].length + 1);
      const questionItem = {
        id: isNaN(Number(qId)) ? qId : Number(qId),
        pregunta: preguntaVal,
        evidencia: evidenciaVal,
        nota: notaVal,
        requisito: requisitoVal,
      };

      if (escala.length >= 2) {
        questionItem.escalaEvaluacion = escala;
      }

      parsed[currentArea].push(questionItem);
      totalQuestions++;
    }
  });

  if (totalQuestions === 0) {
    throw new Error("No se encontraron preguntas en la hoja de cálculo. Asegúrate de que la columna de preguntas contenga texto.");
  }

  return {
    parsed,
    areasCount: Object.keys(parsed).length,
    questionsCount: totalQuestions,
  };
};
