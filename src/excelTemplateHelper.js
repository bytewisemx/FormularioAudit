import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { DEFAULT_SECTIONS } from './defaultSections';

// Paleta de colores corporativos ByteWise
const COLOR_PRIMARY_NAVY = 'FF1E3A8A'; // Azul Marino Corporativo #1E3A8A
const COLOR_SECONDARY_BLUE = 'FF2563EB'; // Azul Corporativo #2563EB
const COLOR_ACCENT_CYAN = 'FF0284C7'; // Cyan #0284C7
const COLOR_GRID_BORDER = 'FFE2E8F0'; // Borde sutil gris claro #E2E8F0
const COLOR_TEXT_DARK = 'FF1E293B'; // Texto pizarra oscuro #1E293B

// Colores de estado y severidad
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
 * Configuración por defecto de la plantilla de auditoría
 */
export const DEFAULT_TEMPLATE_CONFIG = {
  nombre_plantilla: 'Plantilla Integral de Auditoría de TI ByteWise',
  marco_referencia: 'ISO/IEC 27001:2022, NIST CSF 2.0 y COBIT 2019',
  version: '2.0',
  escala_minima: 0,
  escala_maxima: 4,
  modalidad_auditoria: 'colaborativa',
  requiere_evidencia_obligatoria: 'NO',
};

/**
 * Rúbrica oficial de criterios técnicos de evaluación (Nivel 0 al Nivel 4)
 */
export const DEFAULT_EVALUATION_CRITERIA = [
  {
    nivel_puntaje: 0,
    etiqueta_nivel: 'No Implementado / Inexistente',
    porcentaje_equivalente: '0%',
    criterio_tecnico_evaluacion: 'No existe política, control técnico, proceso formal ni asignación de responsabilidades. La organización opera en omisión total de la directriz con riesgo crítico no mitigado.',
    accion_requerida: 'Diseñar e implementar el control desde cero con carácter prioritario y urgente.',
  },
  {
    nivel_puntaje: 1,
    etiqueta_nivel: 'Inicial / Informal / Reactivo',
    porcentaje_equivalente: '25%',
    criterio_tecnico_evaluacion: 'Existen prácticas aisladas o reactivas aplicadas por iniciativa individual sin documentación formal, aprobación de la dirección ni trazabilidad técnica.',
    accion_requerida: 'Formalizar procedimientos operativos, documentar el control y designar responsables formales.',
  },
  {
    nivel_puntaje: 2,
    etiqueta_nivel: 'Gestionado / Parcialmente Implementado',
    porcentaje_equivalente: '50%',
    criterio_tecnico_evaluacion: 'Controles definidos y documentados en su mayoría; implementación operativa parcial o irregular en ciertas áreas, sistemas o sedes de la organización.',
    accion_requerida: 'Estandarizar la aplicación en toda la infraestructura tecnológica, capacitar al personal y subsanar brechas.',
  },
  {
    nivel_puntaje: 3,
    etiqueta_nivel: 'Definido / Operativo y Establecido',
    porcentaje_equivalente: '75%',
    criterio_tecnico_evaluacion: 'Control formalmente aprobado, documentado, implementado en su totalidad y en operación continua verificable con evidencias operativas periódicas.',
    accion_requerida: 'Establecer métricas clave de desempeño (KPIs), monitoreo sistemático y automatización tecnológica.',
  },
  {
    nivel_puntaje: 4,
    etiqueta_nivel: 'Optimizado / Proactivo y Continuo',
    porcentaje_equivalente: '100%',
    criterio_tecnico_evaluacion: 'Control automatizado, integrado a la cultura corporativa, medido en tiempo real, probado ante contingencias con alta disponibilidad y mejora continua comprobable.',
    accion_requerida: 'Mantener la vigencia del estándar, revisiones periódicas y optimización tecnológica proactiva.',
  },
];

/**
 * Aplica estilos corporativos estándar a los encabezados de tabla en Excel
 */
const applyHeaderStyle = (row, bgColor = COLOR_PRIMARY_NAVY) => {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
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
 * Agrega banner de título corporativo en la fila 1
 */
const addSheetTitleBanner = (ws, title, endColLetter = 'C', bgColor = COLOR_PRIMARY_NAVY) => {
  const row = ws.addRow([title]);
  row.height = 32;
  const cell = row.getCell(1);
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.mergeCells(`A1:${endColLetter}1`);
};

/**
 * Genera y descarga la plantilla oficial de preguntas en formato Excel (.xlsx)
 * con las 3 hojas estructuradas exactas:
 * 1. 1_Configuracion
 * 2. 2_Criterios_Evaluacion
 * 3. 3_Cuestionario_Auditoria
 */
export const downloadExcelTemplate = async (sourceSections = DEFAULT_SECTIONS) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ByteWise Auditoría TI';
    workbook.created = new Date();

    // ========================================================
    // HOJA 1: 1_Configuracion
    // ========================================================
    const wsConfig = workbook.addWorksheet('1_Configuracion');
    wsConfig.views = [{ showGridLines: true }];

    addSheetTitleBanner(wsConfig, 'BYTEWISE — CONFIGURACIÓN DEL SISTEMA DE AUDITORÍA TI', 'C', COLOR_PRIMARY_NAVY);

    // Fila 2: Encabezados
    const configHeaders = wsConfig.addRow(['clave_sistema', 'valor', 'descripcion_ayuda']);
    applyHeaderStyle(configHeaders, COLOR_SECONDARY_BLUE);

    const configRows = [
      {
        clave: 'nombre_plantilla',
        valor: DEFAULT_TEMPLATE_CONFIG.nombre_plantilla,
        desc: 'Nombre descriptivo de la plantilla técnica que se mostrará en el sistema.',
      },
      {
        clave: 'marco_referencia',
        valor: DEFAULT_TEMPLATE_CONFIG.marco_referencia,
        desc: 'Estándares y marcos normativos base de la evaluación (ISO 27001, NIST CSF, COBIT).',
      },
      {
        clave: 'version',
        valor: DEFAULT_TEMPLATE_CONFIG.version,
        desc: 'Versión del cuestionario de auditoría (ej. 1.0, 2.0).',
      },
      {
        clave: 'escala_minima',
        valor: DEFAULT_TEMPLATE_CONFIG.escala_minima,
        desc: 'Calificación numérica mínima para cada control (habitualmente 0).',
      },
      {
        clave: 'escala_maxima',
        valor: DEFAULT_TEMPLATE_CONFIG.escala_maxima,
        desc: 'Calificación numérica máxima para cada control (habitualmente 4).',
      },
      {
        clave: 'modalidad_auditoria',
        valor: DEFAULT_TEMPLATE_CONFIG.modalidad_auditoria,
        desc: 'Modalidad de trabajo recomendada: "colaborativa" (máx 2 auditores) o "single" (individual).',
      },
      {
        clave: 'requiere_evidencia_obligatoria',
        valor: DEFAULT_TEMPLATE_CONFIG.requiere_evidencia_obligatoria,
        desc: 'Define si es obligatorio ingresar evidencia textual o documental para calificar ("SI" o "NO").',
      },
    ];

    configRows.forEach((item) => {
      const r = wsConfig.addRow([item.clave, item.valor, item.desc]);
      r.height = 24;
      r.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', wrapText: true, horizontal: colNum === 1 ? 'center' : 'left' };
      });
      r.getCell(1).font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
    });

    wsConfig.getColumn(1).width = 30;
    wsConfig.getColumn(2).width = 44;
    wsConfig.getColumn(3).width = 65;

    // ========================================================
    // HOJA 2: 2_Criterios_Evaluacion
    // ========================================================
    const wsCriteria = workbook.addWorksheet('2_Criterios_Evaluacion');
    wsCriteria.views = [{ showGridLines: true }];

    addSheetTitleBanner(wsCriteria, 'RÚBRICA DE EVALUACIÓN Y NIVELES DE MADUREZ (ESCALA 0 A 4)', 'E', COLOR_PRIMARY_NAVY);

    // Fila 2: Encabezados
    const criteriaHeaders = wsCriteria.addRow([
      'nivel_puntaje',
      'etiqueta_nivel',
      'porcentaje_equivalente',
      'criterio_tecnico_evaluacion',
      'accion_requerida',
    ]);
    applyHeaderStyle(criteriaHeaders, COLOR_SECONDARY_BLUE);

    DEFAULT_EVALUATION_CRITERIA.forEach((item) => {
      const r = wsCriteria.addRow([
        item.nivel_puntaje,
        item.etiqueta_nivel,
        item.porcentaje_equivalente,
        item.criterio_tecnico_evaluacion,
        item.accion_requerida,
      ]);
      r.height = 36;
      r.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = thinBorder;
        cell.alignment = {
          vertical: 'top',
          wrapText: true,
          horizontal: colNum === 1 || colNum === 3 ? 'center' : 'left',
        };
      });

      if (item.nivel_puntaje === 0) {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_DANGER_BG } };
        r.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_DANGER_TEXT } };
      } else if (item.nivel_puntaje === 4) {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SUCCESS_BG } };
        r.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_SUCCESS_TEXT } };
      }
    });

    wsCriteria.getColumn(1).width = 14;
    wsCriteria.getColumn(2).width = 30;
    wsCriteria.getColumn(3).width = 22;
    wsCriteria.getColumn(4).width = 65;
    wsCriteria.getColumn(5).width = 45;

    // ========================================================
    // HOJA 3: 3_Cuestionario_Auditoria
    // ========================================================
    const wsQuestions = workbook.addWorksheet('3_Cuestionario_Auditoria');
    wsQuestions.views = [{ showGridLines: true }];

    addSheetTitleBanner(wsQuestions, 'CUESTIONARIO DE CONTROLES DE AUDITORÍA TI — CONTROLES Y EVALUACIÓN', 'K', COLOR_PRIMARY_NAVY);

    // Fila 2: Encabezados obligatorios y extendidos
    const questionHeaders = wsQuestions.addRow([
      'id_control',
      'dominio',
      'subdominio',
      'norma_referencia',
      'pregunta_control',
      'criterio_cumplimiento',
      'evidencia_esperada',
      'criticidad',
      'peso_ponderacion',
      'puntaje_inicial',
      'observaciones_base',
    ]);
    applyHeaderStyle(questionHeaders, COLOR_SECONDARY_BLUE);

    const sectionsToUse = sourceSections && Object.keys(sourceSections).length > 0
      ? sourceSections
      : DEFAULT_SECTIONS;

    // Llenar controles con datos enriquecidos
    Object.entries(sectionsToUse).forEach(([area, questions]) => {
      (questions || []).forEach((q, idx) => {
        const idStr = String(q.id || `CTRL-${idx + 1}`);

        // Inferir subdominio y norma si no vienen definidos
        let subdominio = q.subdominio || '';
        let norma = q.normaReferencia || q.norma || '';
        let criticidad = q.criticidad || 'Alta';
        let peso = q.pesoPonderacion || q.peso || 1;

        if (!subdominio) {
          if (area.includes('Site')) subdominio = 'Instalaciones y Respaldo Físico';
          else if (area.includes('ISO 27001') || area.includes('Cláusula')) subdominio = 'Gobernanza y Cumplimiento SGSI';
          else if (area.includes('Seguridad')) subdominio = 'Controles Técnicos y Operativos';
          else if (area.includes('IA') || area.includes('LFPDPPP')) subdominio = 'Privacidad y Nuevas Tecnologías';
          else subdominio = 'Operaciones de TI';
        }

        if (!norma) {
          if (area.includes('Cláusula 4')) norma = 'ISO/IEC 27001 Cláusula 4';
          else if (area.includes('Cláusula 5')) norma = 'ISO/IEC 27001 Cláusula 5';
          else if (area.includes('Cláusula 6')) norma = 'ISO/IEC 27001 Cláusula 6';
          else if (area.includes('Cláusula 7')) norma = 'ISO/IEC 27001 Cláusula 7';
          else if (area.includes('Cláusula 8')) norma = 'ISO/IEC 27001 Cláusula 8';
          else if (area.includes('Cláusula 9')) norma = 'ISO/IEC 27001 Cláusula 9';
          else if (area.includes('Cláusula 10')) norma = 'ISO/IEC 27001 Cláusula 10';
          else if (area.includes('Site')) norma = 'ISO/IEC 27001:2022 A.7.1 / TIA-942';
          else if (area.includes('IA')) norma = 'LFPDPPP / ISO 42001';
          else norma = 'ISO/IEC 27001:2022 / NIST CSF';
        }

        const criterioCumplimiento = q.criterioCumplimiento || q.requisito || q.nota || 'Verificación formal del cumplimiento de la directriz técnica y operativa.';
        const evidenciaEsperada = q.evidenciaEsperada || q.evidencia || 'Políticas documentadas, bitácoras de eventos, configuraciones técnicas o diagramas.';

        const r = wsQuestions.addRow([
          idStr,
          area,
          subdominio,
          norma,
          q.pregunta || '',
          criterioCumplimiento,
          evidenciaEsperada,
          criticidad,
          peso,
          '', // puntaje_inicial vacío por defecto para que el auditor califique
          q.observacionesBase || '',
        ]);

        r.height = 38;
        r.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.border = thinBorder;
          cell.alignment = {
            vertical: 'top',
            wrapText: true,
            horizontal: colNum === 1 || colNum === 8 || colNum === 9 || colNum === 10 ? 'center' : 'left',
          };
        });

        // 1. DataValidation para 'criticidad' (Columna 8 / H)
        const criticidadCell = r.getCell(8);
        criticidadCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Crítica,Alta,Media,Baja"'],
          showErrorMessage: true,
          errorTitle: 'Criticidad no válida',
          error: 'Por favor selecciona un valor de la lista desplegable: Crítica, Alta, Media o Baja.',
        };

        // 2. DataValidation para 'puntaje_inicial' (Columna 10 / J)
        const puntajeCell = r.getCell(10);
        puntajeCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"0,1,2,3,4"'],
          showErrorMessage: true,
          errorTitle: 'Calificación no válida',
          error: 'Por favor selecciona un puntaje entre 0 y 4 (según la hoja 2_Criterios_Evaluacion).',
        };
      });
    });

    wsQuestions.getColumn(1).width = 14; // id_control
    wsQuestions.getColumn(2).width = 28; // dominio
    wsQuestions.getColumn(3).width = 24; // subdominio
    wsQuestions.getColumn(4).width = 22; // norma_referencia
    wsQuestions.getColumn(5).width = 54; // pregunta_control
    wsQuestions.getColumn(6).width = 38; // criterio_cumplimiento
    wsQuestions.getColumn(7).width = 34; // evidencia_esperada
    wsQuestions.getColumn(8).width = 16; // criticidad
    wsQuestions.getColumn(9).width = 18; // peso_ponderacion
    wsQuestions.getColumn(10).width = 16; // puntaje_inicial
    wsQuestions.getColumn(11).width = 32; // observaciones_base

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, 'Plantilla_Cuestionario_Auditoria_TI.xlsx');
    return true;
  } catch (err) {
    console.error('Error al generar plantilla Excel:', err);
    alert('Error al descargar la plantilla de Excel: ' + (err.message || ''));
    throw err;
  }
};

/**
 * Genera y descarga el esquema estructurado en formato JSON (.json)
 */
export const downloadJsonTemplate = async (sourceSections = DEFAULT_SECTIONS) => {
  try {
    const sectionsToUse = sourceSections && Object.keys(sourceSections).length > 0
      ? sourceSections
      : DEFAULT_SECTIONS;

    const questionsList = [];
    Object.entries(sectionsToUse).forEach(([area, questions]) => {
      (questions || []).forEach((q, idx) => {
        questionsList.push({
          id_control: String(q.id || `CTRL-${idx + 1}`),
          dominio: area,
          subdominio: q.subdominio || 'General',
          norma_referencia: q.normaReferencia || q.norma || 'ISO/IEC 27001:2022',
          pregunta_control: q.pregunta || '',
          criterio_cumplimiento: q.criterioCumplimiento || q.requisito || q.nota || '',
          evidencia_esperada: q.evidenciaEsperada || q.evidencia || '',
          criticidad: q.criticidad || 'Alta',
          peso_ponderacion: q.pesoPonderacion || 1,
          puntaje_inicial: q.puntajeInicial !== undefined ? q.puntajeInicial : null,
          observaciones_base: q.observacionesBase || '',
        });
      });
    });

    const exportPayload = {
      config: DEFAULT_TEMPLATE_CONFIG,
      criteria: DEFAULT_EVALUATION_CRITERIA,
      questions: questionsList,
    };

    const jsonString = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'Plantilla_Cuestionario_Auditoria_TI.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    return true;
  } catch (err) {
    console.error('Error al generar plantilla JSON:', err);
    alert('Error al descargar la plantilla JSON.');
    throw err;
  }
};

/**
 * Helper para normalizar textos de nombres de columnas
 */
const cleanColName = (val) => {
  return String(val || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_]/g, '');
};

/**
 * Lee un archivo .xlsx o .json y lo transforma en la estructura de secciones, criterios y configuración.
 * Compatible con la plantilla de 3 hojas y archivos heredados.
 */
export const parseQuestionsFile = async (file) => {
  const fileName = (file.name || '').toLowerCase();

  // ========================================================
  // Caso 1: Archivo JSON
  // ========================================================
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('El archivo JSON tiene una sintaxis corrupta o no es un JSON válido.');
    }

    if (!data || typeof data !== 'object') {
      throw new Error('El archivo JSON no contiene un objeto válido.');
    }

    let parsed = {};
    let config = { ...DEFAULT_TEMPLATE_CONFIG };
    let criteria = [...DEFAULT_EVALUATION_CRITERIA];
    const initialResponses = {};

    // Formato estructurado { config, criteria, questions }
    if (data.questions && Array.isArray(data.questions)) {
      if (data.config) config = { ...config, ...data.config };
      if (Array.isArray(data.criteria) && data.criteria.length > 0) criteria = data.criteria;

      data.questions.forEach((q, idx) => {
        const dom = q.dominio || q.area || 'Dominio General';
        if (!parsed[dom]) parsed[dom] = [];

        const idVal = q.id_control || q.id || `CTRL-${idx + 1}`;
        const item = {
          id: idVal,
          pregunta: q.pregunta_control || q.pregunta || '',
          dominio: dom,
          subdominio: q.subdominio || '',
          normaReferencia: q.norma_referencia || q.norma || '',
          criterioCumplimiento: q.criterio_cumplimiento || q.requisito || q.nota || '',
          requisito: q.criterio_cumplimiento || q.requisito || q.nota || '',
          evidenciaEsperada: q.evidencia_esperada || q.evidencia || '',
          evidencia: q.evidencia_esperada || q.evidencia || '',
          criticidad: q.criticidad || 'Alta',
          pesoPonderacion: Number(q.peso_ponderacion || q.peso || 1),
          observacionesBase: q.observaciones_base || '',
        };
        parsed[dom].push(item);

        if (q.puntaje_inicial !== undefined && q.puntaje_inicial !== null && q.puntaje_inicial !== '') {
          const key = `${dom}-${idVal}`;
          initialResponses[key] = {
            evaluacion: Number(q.puntaje_inicial),
            score: Number(q.puntaje_inicial),
            observaciones: q.observaciones_base || '',
          };
        }
      });
    } else {
      // Formato directo por áreas { "Área 1": [ ...preguntas ] }
      const sourceObj = data.parsed || data;
      Object.entries(sourceObj).forEach(([area, list]) => {
        if (Array.isArray(list)) {
          parsed[area] = list.map((item, idx) => ({
            id: item.id || idx + 1,
            pregunta: item.pregunta || '',
            criterioCumplimiento: item.criterioCumplimiento || item.requisito || item.nota || '',
            requisito: item.requisito || item.criterioCumplimiento || item.nota || '',
            evidenciaEsperada: item.evidenciaEsperada || item.evidencia || '',
            evidencia: item.evidencia || item.evidenciaEsperada || '',
            criticidad: item.criticidad || 'Alta',
            pesoPonderacion: Number(item.pesoPonderacion || 1),
            subdominio: item.subdominio || '',
            normaReferencia: item.normaReferencia || '',
            escalaEvaluacion: item.escalaEvaluacion || null,
          }));
        }
      });
    }

    let totalQ = 0;
    Object.values(parsed).forEach(list => { totalQ += list.length; });

    if (totalQ === 0) {
      throw new Error('El archivo JSON no contiene ninguna pregunta o control válido en sus dominios.');
    }

    return {
      parsed,
      areasCount: Object.keys(parsed).length,
      questionsCount: totalQ,
      config,
      criteria,
      initialResponses,
    };
  }

  // ========================================================
  // Caso 2: Archivo Excel (.xlsx / .xls)
  // ========================================================
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error('El archivo Excel no contiene ninguna hoja de cálculo.');
  }

  // 1. Detección de Hoja de Configuración
  let wsConfig = workbook.worksheets.find(ws => {
    const n = cleanColName(ws.name);
    return n.includes('configuracion') || n.includes('config');
  });

  // 2. Detección de Hoja de Criterios
  let wsCriteria = workbook.worksheets.find(ws => {
    const n = cleanColName(ws.name);
    return n.includes('criterios') || n.includes('rubrica') || n.includes('evaluacion');
  });

  // 3. Detección de Hoja del Cuestionario
  let wsQuestions = workbook.worksheets.find(ws => {
    const n = cleanColName(ws.name);
    return n.includes('cuestionario') || n.includes('preguntas') || n.includes('controles') || n.includes('auditoria');
  });

  // Fallback si los nombres no coinciden exactamente
  if (!wsQuestions) {
    if (workbook.worksheets.length >= 3) {
      wsConfig = wsConfig || workbook.worksheets[0];
      wsCriteria = wsCriteria || workbook.worksheets[1];
      wsQuestions = workbook.worksheets[2];
    } else if (workbook.worksheets.length === 2) {
      wsQuestions = workbook.worksheets[1];
    } else {
      wsQuestions = workbook.worksheets[0];
    }
  }

  // Parsear Configuración
  const parsedConfig = { ...DEFAULT_TEMPLATE_CONFIG };
  if (wsConfig) {
    let keyCol = -1;
    let valCol = -1;
    wsConfig.eachRow((row, rowNumber) => {
      if (rowNumber <= 3 && keyCol === -1) {
        row.eachCell((cell, colNum) => {
          const val = cleanColName(cell.value);
          if (val.includes('clave') || val.includes('parametro') || val.includes('campo')) keyCol = colNum;
          if (val.includes('valor') || val.includes('dato') || val.includes('configuracion')) valCol = colNum;
        });
      } else if (keyCol !== -1 && valCol !== -1) {
        const k = String(row.getCell(keyCol).value || '').trim();
        const v = row.getCell(valCol).value;
        if (k && v !== undefined && v !== null) {
          parsedConfig[k] = v;
        }
      }
    });
  }

  // Parsear Criterios de Evaluación
  let parsedCriteria = [...DEFAULT_EVALUATION_CRITERIA];
  if (wsCriteria) {
    let nivelCol = -1;
    let etiquetaCol = -1;
    let porcentajeCol = -1;
    let criterioCol = -1;
    let accionCol = -1;
    const tempCriteria = [];

    wsCriteria.eachRow((row, rowNumber) => {
      if (rowNumber <= 3 && nivelCol === -1) {
        row.eachCell((cell, colNum) => {
          const val = cleanColName(cell.value);
          if (val.includes('nivel') || val.includes('puntaje') || val.includes('calificacion')) nivelCol = colNum;
          if (val.includes('etiqueta') || val.includes('nombre') || val.includes('madurez')) etiquetaCol = colNum;
          if (val.includes('porcentaje') || val.includes('equivalente')) porcentajeCol = colNum;
          if (val.includes('criterio') || val.includes('descripcion')) criterioCol = colNum;
          if (val.includes('accion') || val.includes('requerida') || val.includes('sugerencia')) accionCol = colNum;
        });
      } else if (nivelCol !== -1) {
        const rawNivel = row.getCell(nivelCol).value;
        if (rawNivel !== null && rawNivel !== undefined && rawNivel !== '') {
          const nivelNum = Number(String(rawNivel).replace(/[^\d]/g, ''));
          tempCriteria.push({
            nivel_puntaje: isNaN(nivelNum) ? tempCriteria.length : nivelNum,
            etiqueta_nivel: String(row.getCell(etiquetaCol !== -1 ? etiquetaCol : 2).value || `Nivel ${nivelNum}`).trim(),
            porcentaje_equivalente: String(row.getCell(porcentajeCol !== -1 ? porcentajeCol : 3).value || `${nivelNum * 25}%`).trim(),
            criterio_tecnico_evaluacion: String(row.getCell(criterioCol !== -1 ? criterioCol : 4).value || '').trim(),
            accion_requerida: String(row.getCell(accionCol !== -1 ? accionCol : 5).value || '').trim(),
          });
        }
      }
    });

    if (tempCriteria.length >= 3) {
      parsedCriteria = tempCriteria.sort((a, b) => a.nivel_puntaje - b.nivel_puntaje);
    }
  }

  // ========================================================
  // Parsear Cuestionario de Auditoría
  // ========================================================
  let headerRowIndex = -1;
  const colMap = {
    id: -1,
    dominio: -1,
    subdominio: -1,
    norma: -1,
    pregunta: -1,
    criterio: -1,
    evidencia: -1,
    criticidad: -1,
    peso: -1,
    puntaje: -1,
    observaciones: -1,
    // Compatibilidad con columnas de escala de versiones antiguas
    nivel0: -1,
    nivel1: -1,
    nivel2: -1,
    nivel3: -1,
    nivel4: -1,
  };

  // Escanear las primeras 5 filas para detectar los encabezados
  const maxScanRows = Math.min(wsQuestions.rowCount || 5, 5);
  for (let r = 1; r <= maxScanRows; r++) {
    const row = wsQuestions.getRow(r);
    let matchedKeyCols = 0;

    row.eachCell((cell, colNumber) => {
      const val = cleanColName(cell.value);

      if (val === 'idcontrol' || val === 'id' || val === 'idpregunta' || val === 'codigo' || val === 'controlid') {
        colMap.id = colNumber;
        matchedKeyCols++;
      } else if (val === 'dominio' || val === 'area' || val === 'areadominio' || val === 'seccion' || val === 'categoria') {
        colMap.dominio = colNumber;
        matchedKeyCols++;
      } else if (val === 'subdominio' || val === 'subcategoria' || val === 'subarea' || val === 'tema') {
        colMap.subdominio = colNumber;
      } else if (val.includes('norma') || val.includes('referencia') || val.includes('estandar')) {
        colMap.norma = colNumber;
      } else if (val === 'preguntacontrol' || val === 'pregunta' || val === 'control' || val === 'enunciado') {
        colMap.pregunta = colNumber;
        matchedKeyCols++;
      } else if (val === 'criteriocumplimiento' || val === 'criterio' || val === 'requisito' || val === 'nota') {
        colMap.criterio = colNumber;
        matchedKeyCols++;
      } else if (val.includes('evidencia')) {
        colMap.evidencia = colNumber;
      } else if (val.includes('criticidad') || val.includes('prioridad')) {
        colMap.criticidad = colNumber;
      } else if (val.includes('peso') || val.includes('ponderacion')) {
        colMap.peso = colNumber;
      } else if (val.includes('puntaje') || val.includes('score') || val.includes('calificacion')) {
        colMap.puntaje = colNumber;
      } else if (val.includes('observacion') || val.includes('hallazgo') || val.includes('comentario')) {
        colMap.observaciones = colNumber;
      } else if (val.includes('nivel0')) colMap.nivel0 = colNumber;
      else if (val.includes('nivel1')) colMap.nivel1 = colNumber;
      else if (val.includes('nivel2')) colMap.nivel2 = colNumber;
      else if (val.includes('nivel3')) colMap.nivel3 = colNumber;
      else if (val.includes('nivel4')) colMap.nivel4 = colNumber;
    });

    if (matchedKeyCols >= 2 && (colMap.pregunta !== -1 || colMap.dominio !== -1)) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se pudo identificar la fila de encabezados en la hoja del cuestionario. Asegúrate de incluir columnas como "id_control", "dominio", "pregunta_control" y "criterio_cumplimiento".');
  }

  // Validación de columnas obligatorias
  const missingCols = [];
  if (colMap.id === -1) missingCols.push('id_control');
  if (colMap.dominio === -1) missingCols.push('dominio');
  if (colMap.pregunta === -1) missingCols.push('pregunta_control');
  if (colMap.criterio === -1) missingCols.push('criterio_cumplimiento');

  if (missingCols.length > 0) {
    throw new Error(`La hoja del cuestionario no contiene las siguientes columnas obligatorias: ${missingCols.join(', ')}. Verifica que la fila ${headerRowIndex} tenga los nombres correctos.`);
  }

  const parsed = {};
  const initialResponses = {};
  let currentDomain = 'Dominio General';
  let totalQuestions = 0;

  wsQuestions.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return; // Saltar títulos y encabezados

    const idVal = row.getCell(colMap.id).value;
    const domVal = String(row.getCell(colMap.dominio).value || '').trim();
    const preguntaVal = String(row.getCell(colMap.pregunta).value || '').trim();
    const criterioVal = String(row.getCell(colMap.criterio).value || '').trim();
    const evidenciaVal = colMap.evidencia !== -1 ? String(row.getCell(colMap.evidencia).value || '').trim() : '';
    const subdominioVal = colMap.subdominio !== -1 ? String(row.getCell(colMap.subdominio).value || '').trim() : '';
    const normaVal = colMap.norma !== -1 ? String(row.getCell(colMap.norma).value || '').trim() : '';
    const criticidadVal = colMap.criticidad !== -1 ? String(row.getCell(colMap.criticidad).value || '').trim() : 'Alta';
    const rawPeso = colMap.peso !== -1 ? row.getCell(colMap.peso).value : 1;
    const pesoVal = Number(rawPeso) > 0 ? Number(rawPeso) : 1;
    const puntajeVal = colMap.puntaje !== -1 ? row.getCell(colMap.puntaje).value : null;
    const obsVal = colMap.observaciones !== -1 ? String(row.getCell(colMap.observaciones).value || '').trim() : '';

    // Si la fila está totalmente vacía, ignorarla limpiamente
    if (!idVal && !domVal && !preguntaVal) {
      return;
    }

    // Si tiene ID o Dominio pero falta la pregunta
    if (!preguntaVal) {
      throw new Error(`En la fila ${rowNumber} del cuestionario, el campo "pregunta_control" está vacío. Completa la pregunta o elimina la fila vacía.`);
    }

    if (domVal) {
      currentDomain = domVal;
    }

    if (!parsed[currentDomain]) {
      parsed[currentDomain] = [];
    }

    const qIdStr = idVal ? String(idVal).trim() : String(parsed[currentDomain].length + 1);
    const qId = isNaN(Number(qIdStr)) ? qIdStr : Number(qIdStr);

    // Escala específica de pregunta si viene en columnas antiguas nivel0-nivel4
    const escalaEspecifica = [];
    if (colMap.nivel0 !== -1 && row.getCell(colMap.nivel0).value) escalaEspecifica.push(String(row.getCell(colMap.nivel0).value).trim());
    if (colMap.nivel1 !== -1 && row.getCell(colMap.nivel1).value) escalaEspecifica.push(String(row.getCell(colMap.nivel1).value).trim());
    if (colMap.nivel2 !== -1 && row.getCell(colMap.nivel2).value) escalaEspecifica.push(String(row.getCell(colMap.nivel2).value).trim());
    if (colMap.nivel3 !== -1 && row.getCell(colMap.nivel3).value) escalaEspecifica.push(String(row.getCell(colMap.nivel3).value).trim());
    if (colMap.nivel4 !== -1 && row.getCell(colMap.nivel4).value) escalaEspecifica.push(String(row.getCell(colMap.nivel4).value).trim());

    const questionItem = {
      id: qId,
      pregunta: preguntaVal,
      dominio: currentDomain,
      subdominio: subdominioVal,
      normaReferencia: normaVal,
      criterioCumplimiento: criterioVal,
      requisito: criterioVal, // retrocompatibilidad
      evidenciaEsperada: evidenciaVal,
      evidencia: evidenciaVal, // retrocompatibilidad
      criticidad: criticidadVal || 'Alta',
      pesoPonderacion: pesoVal,
      observacionesBase: obsVal,
      escalaEvaluacion: escalaEspecifica.length >= 2 ? escalaEspecifica : null,
    };

    parsed[currentDomain].push(questionItem);
    totalQuestions++;

    // Extraer puntaje inicial si se indicó en el Excel
    if (puntajeVal !== null && puntajeVal !== undefined && puntajeVal !== '') {
      const numScore = Number(String(puntajeVal).trim());
      if (!isNaN(numScore) && numScore >= 0 && numScore <= 4) {
        const key = `${currentDomain}-${qId}`;
        initialResponses[key] = {
          evaluacion: numScore,
          score: numScore,
          observaciones: obsVal,
          evidencia: evidenciaVal,
        };
      }
    }
  });

  if (totalQuestions === 0) {
    throw new Error('No se encontraron preguntas en la hoja del cuestionario. Asegúrate de ingresar al menos un control.');
  }

  return {
    parsed,
    areasCount: Object.keys(parsed).length,
    questionsCount: totalQuestions,
    config: parsedConfig,
    criteria: parsedCriteria,
    initialResponses,
  };
};

/**
 * Genera y descarga el Libro Excel de Exportación Completo de Resultados de Auditoría
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

    // 1. Pestaña: Resumen y Dominios
    const wsSummary = workbook.addWorksheet('Resumen y Dominios');
    wsSummary.views = [{ showGridLines: true }];

    addSheetTitleBanner(wsSummary, 'BYTEWISE — RESUMEN EJECUTIVO DE AUDITORÍA TI', 'F', COLOR_PRIMARY_NAVY);

    wsSummary.addRow([]);
    const empName = introData?.nombreEmpresa || 'N/A';
    const audName = actor?.nombreAuditor || 'N/A';
    const numAvg = Number(avgScore || 0);
    const numTot = Number(totalScore || 0);
    const matNivel = scoreLevel?.nivel || 'N/A';
    const matDesc = scoreLevel?.descripcion || 'N/A';

    wsSummary.addRow(['Empresa Evaluada:', empName, '', 'Auditor Líder:', audName, '']);
    wsSummary.addRow(['Puntaje Promedio:', `${numAvg.toFixed(2)} / 4.0`, '', 'Puntaje Bruto:', `${numTot.toFixed(0)} pts`, '']);
    wsSummary.addRow(['Madurez TI:', matNivel, '', 'Diagnóstico:', matDesc, '']);
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
        trafficLabel,
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

    if (positiveComments || negativeComments || recommendations || generalComments) {
      wsSummary.addRow([]);
      const cTitle = wsSummary.addRow(['CONCLUSIONES Y DICTAMEN DE AUDITORÍA']);
      cTitle.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR_PRIMARY_NAVY } };

      if (generalComments) {
        wsSummary.addRow(['Diagnóstico General:']);
        const r = wsSummary.addRow([generalComments]);
        wsSummary.mergeCells(r.number, 1, r.number, 6);
        r.height = 40;
        r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      }
      if (recommendations) {
        wsSummary.addRow(['Recomendaciones Prioritarias:']);
        const r = wsSummary.addRow([recommendations]);
        wsSummary.mergeCells(r.number, 1, r.number, 6);
        r.height = 40;
        r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      }
    }

    wsSummary.getColumn(1).width = 38;
    wsSummary.getColumn(2).width = 18;
    wsSummary.getColumn(3).width = 16;
    wsSummary.getColumn(4).width = 16;
    wsSummary.getColumn(5).width = 18;
    wsSummary.getColumn(6).width = 18;

    // 2. Pestaña: Resultados y Respuestas
    const wsResults = workbook.addWorksheet('Resultados y Respuestas');
    wsResults.views = [{ showGridLines: true }];

    addSheetTitleBanner(wsResults, 'EVALUACIÓN DETALLADA DE CONTROLES Y HALLAZGOS', 'I', COLOR_PRIMARY_NAVY);

    const resHeaders = wsResults.addRow([
      'ID Control',
      'Área / Dominio',
      'Subdominio',
      'Pregunta / Control Evaluado',
      'Puntaje Asignado',
      'Estado / Madurez',
      'Criticidad',
      'Comentarios del Auditor / Hallazgos',
      'Evidencia Verificada',
    ]);
    applyHeaderStyle(resHeaders, COLOR_SECONDARY_BLUE);

    Object.entries(customSections).forEach(([area, questions]) => {
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

        const row = wsResults.addRow([
          String(q.id),
          area,
          q.subdominio || 'General',
          q.pregunta,
          scoreText,
          estadoText,
          q.criticidad || 'Alta',
          resp.observaciones || resp.comment || '',
          resp.evidencia || resp.evidence || '',
        ]);

        row.height = 32;
        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
        row.getCell(5).alignment = { vertical: 'top', horizontal: 'center' };
        row.getCell(6).alignment = { vertical: 'top', horizontal: 'center' };
        row.getCell(7).alignment = { vertical: 'top', horizontal: 'center' };

        row.eachCell((cell) => {
          cell.border = thinBorder;
          cell.font = { name: 'Calibri', size: 10 };
        });

        const scoreCell = row.getCell(5);
        const estadoCell = row.getCell(6);
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        scoreCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: textArgb } };
        estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        estadoCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: textArgb } };
      });
    });

    wsResults.getColumn(1).width = 14;
    wsResults.getColumn(2).width = 28;
    wsResults.getColumn(3).width = 24;
    wsResults.getColumn(4).width = 50;
    wsResults.getColumn(5).width = 18;
    wsResults.getColumn(6).width = 24;
    wsResults.getColumn(7).width = 16;
    wsResults.getColumn(8).width = 45;
    wsResults.getColumn(9).width = 35;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const sanitized = (introData.nombreEmpresa || 'Empresa').replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    saveAs(blob, `Reporte_Auditoria_TI_${sanitized}.xlsx`);
    return true;
  } catch (err) {
    console.error('Error al exportar reporte Excel profesional:', err);
    throw err;
  }
};
