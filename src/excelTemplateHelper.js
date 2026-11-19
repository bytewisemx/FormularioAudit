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
 * con UNA SOLA HOJA ('Cuestionario_Auditoria') donde cada control incluye sus propios
 * criterios de evaluación del Nivel 0 al Nivel 4.
 * 
 * Fila 1: Banner de título corporativo
 * Fila 2: Subtítulo / Instrucciones de uso
 * Fila 3: Encabezados exactos del sistema
 */
export const downloadExcelTemplate = async (sourceSections = DEFAULT_SECTIONS) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ByteWise Auditoría TI';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Cuestionario_Auditoria');
    ws.views = [{ showGridLines: true }];

    // Fila 1: Banner de Título Corporativo (Fusionado A1:O1)
    const titleRow = ws.addRow(['BYTEWISE — CUESTIONARIO OFICIAL DE AUDITORÍA TI Y CIBERSEGURIDAD']);
    titleRow.height = 32;
    const titleCell = titleRow.getCell(1);
    titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY_NAVY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.mergeCells('A1:O1');

    // Fila 2: Subtítulo e Instrucciones de Uso (Fusionado A2:O2)
    const subRow = ws.addRow([
      'Instrucciones: Diligencie cada control por fila. Las columnas "criterio_nivel_0" a "criterio_nivel_4" definen la rúbrica técnica específica que el auditor visualizará para calificar la madurez (escala 0 a 4).'
    ]);
    subRow.height = 24;
    const subCell = subRow.getCell(1);
    subCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_MUTED_BG } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.mergeCells('A2:O2');

    // Fila 3: Encabezados Exactos del Cuestionario
    const headerRow = ws.addRow([
      'id_control',
      'dominio',
      'subdominio',
      'norma_referencia',
      'pregunta_control',
      'evidencia_esperada',
      'criticidad',
      'peso_ponderacion',
      'criterio_nivel_0',
      'criterio_nivel_1',
      'criterio_nivel_2',
      'criterio_nivel_3',
      'criterio_nivel_4',
      'puntaje_inicial',
      'observaciones_base',
    ]);
    applyHeaderStyle(headerRow, COLOR_SECONDARY_BLUE);

    const sectionsToUse = sourceSections && Object.keys(sourceSections).length > 0
      ? sourceSections
      : DEFAULT_SECTIONS;

    // Llenar controles con datos enriquecidos y sus 5 niveles de criterios específicos
    Object.entries(sectionsToUse).forEach(([area, questions]) => {
      (questions || []).forEach((q, idx) => {
        const idStr = String(q.id || `CTRL-${idx + 1}`);

        // Inferir subdominio y norma si no vienen definidos
        let subdominio = q.subdominio || '';
        let norma = q.normaReferencia || q.norma || '';
        let criticidad = q.criticidad || 'Alta';
        let peso = Number(q.pesoPonderacion || q.peso || 1.0);

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
          else norma = 'ISO/IEC 27001:2022 / NIST CSF 2.0';
        }

        const evidenciaEsperada = q.evidenciaEsperada || q.evidencia || 'Políticas documentadas, configuraciones técnicas, bitácoras o diagramas de arquitectura.';

        // Extraer o generar criterios específicos de Nivel 0 a Nivel 4 para este control
        const cbLevel = q.criteriaByLevel || {};
        let crit0 = cbLevel['0'] || (q.escalaEvaluacion?.[0] ?? '');
        let crit1 = cbLevel['1'] || (q.escalaEvaluacion?.[1] ?? '');
        let crit2 = cbLevel['2'] || (q.escalaEvaluacion?.[2] ?? '');
        let crit3 = cbLevel['3'] || (q.escalaEvaluacion?.[3] ?? '');
        let crit4 = cbLevel['4'] || (q.escalaEvaluacion?.[4] ?? '');

        if (!crit0) crit0 = 'Nivel 0: Inexistente / No implementado. No se cuenta con políticas, controles ni directrices establecidas.';
        if (!crit1) crit1 = 'Nivel 1: Inicial / Informal. Acciones reactivas o esporádicas sin formalización ni documentación oficial.';
        if (!crit2) crit2 = 'Nivel 2: En desarrollo / Parcial. Procedimientos parcialmente definidos con aplicación inconsistente.';
        if (!crit3) crit3 = 'Nivel 3: Definido y Operativo. Política formal aprobada, procedimiento implementado y evidencia verificable.';
        if (!crit4) crit4 = 'Nivel 4: Optimizado. Control automatizado, monitoreo continuo de métricas y mejora continua demostrable.';

        const r = ws.addRow([
          idStr,
          area,
          subdominio,
          norma,
          q.pregunta || '',
          evidenciaEsperada,
          criticidad,
          peso.toFixed(1),
          crit0,
          crit1,
          crit2,
          crit3,
          crit4,
          q.puntajeInicial !== undefined && q.puntajeInicial !== null ? String(q.puntajeInicial) : '',
          q.observacionesBase || '',
        ]);

        r.height = 42;
        r.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 9.5 };
          cell.border = thinBorder;
          cell.alignment = {
            vertical: 'top',
            wrapText: true,
            horizontal: colNum === 1 || colNum === 7 || colNum === 8 || colNum === 14 ? 'center' : 'left',
          };
        });

        // 1. DataValidation para 'criticidad' (Columna 7 / G)
        const criticidadCell = r.getCell(7);
        criticidadCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Crítica,Alta,Media,Baja"'],
          showErrorMessage: true,
          errorTitle: 'Criticidad no válida',
          error: 'Por favor selecciona un valor de la lista desplegable: Crítica, Alta, Media o Baja.',
        };

        // 2. DataValidation para 'puntaje_inicial' (Columna 14 / N)
        const puntajeCell = r.getCell(14);
        puntajeCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"0,1,2,3,4"'],
          showErrorMessage: true,
          errorTitle: 'Calificación no válida',
          error: 'Por favor selecciona un puntaje entre 0 y 4.',
        };
      });
    });

    // Anchos de columna configurados profesionalmente
    ws.getColumn(1).width = 13;  // id_control
    ws.getColumn(2).width = 28;  // dominio
    ws.getColumn(3).width = 24;  // subdominio
    ws.getColumn(4).width = 22;  // norma_referencia
    ws.getColumn(5).width = 55;  // pregunta_control
    ws.getColumn(6).width = 36;  // evidencia_esperada
    ws.getColumn(7).width = 14;  // criticidad
    ws.getColumn(8).width = 18;  // peso_ponderacion
    ws.getColumn(9).width = 36;  // criterio_nivel_0
    ws.getColumn(10).width = 36; // criterio_nivel_1
    ws.getColumn(11).width = 36; // criterio_nivel_2
    ws.getColumn(12).width = 36; // criterio_nivel_3
    ws.getColumn(13).width = 36; // criterio_nivel_4
    ws.getColumn(14).width = 16; // puntaje_inicial
    ws.getColumn(15).width = 30; // observaciones_base

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
 * reflejando la misma estructura de una sola hoja y criterios por nivel
 */
export const downloadJsonTemplate = async (sourceSections = DEFAULT_SECTIONS) => {
  try {
    const sectionsToUse = sourceSections && Object.keys(sourceSections).length > 0
      ? sourceSections
      : DEFAULT_SECTIONS;

    const questionsList = [];
    Object.entries(sectionsToUse).forEach(([area, questions]) => {
      (questions || []).forEach((q, idx) => {
        const cbLevel = q.criteriaByLevel || {};
        const crit0 = cbLevel['0'] || q.escalaEvaluacion?.[0] || 'Nivel 0: Inexistente / No implementado.';
        const crit1 = cbLevel['1'] || q.escalaEvaluacion?.[1] || 'Nivel 1: Inicial / Informal.';
        const crit2 = cbLevel['2'] || q.escalaEvaluacion?.[2] || 'Nivel 2: En desarrollo / Parcial.';
        const crit3 = cbLevel['3'] || q.escalaEvaluacion?.[3] || 'Nivel 3: Definido y Operativo.';
        const crit4 = cbLevel['4'] || q.escalaEvaluacion?.[4] || 'Nivel 4: Optimizado y Medido.';

        questionsList.push({
          id_control: String(q.id || `CTRL-${idx + 1}`),
          dominio: area,
          subdominio: q.subdominio || 'Operaciones de TI',
          norma_referencia: q.normaReferencia || q.norma || 'ISO/IEC 27001:2022',
          pregunta_control: q.pregunta || '',
          evidencia_esperada: q.evidenciaEsperada || q.evidencia || '',
          criticidad: q.criticidad || 'Alta',
          peso_ponderacion: Number(q.pesoPonderacion || q.peso || 1.0),
          criterio_nivel_0: crit0,
          criterio_nivel_1: crit1,
          criterio_nivel_2: crit2,
          criterio_nivel_3: crit3,
          criterio_nivel_4: crit4,
          criteriaByLevel: {
            "0": crit0,
            "1": crit1,
            "2": crit2,
            "3": crit3,
            "4": crit4
          },
          puntaje_inicial: q.puntajeInicial !== undefined ? q.puntajeInicial : null,
          observaciones_base: q.observacionesBase || '',
        });
      });
    });

    const exportPayload = {
      template: 'Cuestionario_Auditoria',
      version: '2.0',
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
 * Lee un archivo .xlsx o .json y lo transforma en la estructura de secciones y controles.
 * Diseñado para la plantilla de hoja única ('Cuestionario_Auditoria') donde cada control
 * contiene sus criterios de evaluación específicos del Nivel 0 al Nivel 4 (criteriaByLevel).
 */
export const parseQuestionsFile = async (file) => {
  const fileName = (file.name || '').toLowerCase();

  // ========================================================
  // Caso 1: Archivo JSON (.json)
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
    const initialResponses = {};

    // Formato estructurado { questions: [...] }
    const questionsArray = Array.isArray(data.questions)
      ? data.questions
      : (Array.isArray(data) ? data : null);

    if (questionsArray && Array.isArray(questionsArray)) {
      questionsArray.forEach((q, idx) => {
        const dom = q.dominio || q.area || 'Dominio General';
        if (!parsed[dom]) parsed[dom] = [];

        const idVal = q.id_control || q.id || `CTRL-${idx + 1}`;
        const rawCriteria = q.criteriaByLevel || {};

        const crit0 = rawCriteria['0'] || q.criterio_nivel_0 || (q.escalaEvaluacion?.[0] ?? 'Nivel 0: Inexistente / No implementado');
        const crit1 = rawCriteria['1'] || q.criterio_nivel_1 || (q.escalaEvaluacion?.[1] ?? 'Nivel 1: Inicial / Informal');
        const crit2 = rawCriteria['2'] || q.criterio_nivel_2 || (q.escalaEvaluacion?.[2] ?? 'Nivel 2: Parcialmente definido');
        const crit3 = rawCriteria['3'] || q.criterio_nivel_3 || (q.escalaEvaluacion?.[3] ?? 'Nivel 3: Definido y Operativo');
        const crit4 = rawCriteria['4'] || q.criterio_nivel_4 || (q.escalaEvaluacion?.[4] ?? 'Nivel 4: Optimizado con mejora continua');

        const criteriaByLevel = {
          "0": String(crit0).trim(),
          "1": String(crit1).trim(),
          "2": String(crit2).trim(),
          "3": String(crit3).trim(),
          "4": String(crit4).trim(),
        };

        const escalaEvaluacion = [
          criteriaByLevel["0"],
          criteriaByLevel["1"],
          criteriaByLevel["2"],
          criteriaByLevel["3"],
          criteriaByLevel["4"]
        ];

        const item = {
          id: idVal,
          pregunta: q.pregunta_control || q.pregunta || '',
          dominio: dom,
          subdominio: q.subdominio || '',
          normaReferencia: q.norma_referencia || q.norma || '',
          criterioCumplimiento: criteriaByLevel["3"],
          requisito: criteriaByLevel["3"],
          evidenciaEsperada: q.evidencia_esperada || q.evidencia || '',
          evidencia: q.evidencia_esperada || q.evidencia || '',
          criticidad: q.criticidad || 'Alta',
          pesoPonderacion: Number(q.peso_ponderacion || q.peso || 1.0),
          criteriaByLevel,
          escalaEvaluacion,
          observacionesBase: q.observaciones_base || q.observacionesBase || '',
        };
        parsed[dom].push(item);

        const initScore = q.puntaje_inicial !== undefined && q.puntaje_inicial !== null ? q.puntaje_inicial : q.puntajeInicial;
        if (initScore !== undefined && initScore !== null && initScore !== '') {
          const numScore = Number(initScore);
          if (!isNaN(numScore) && numScore >= 0 && numScore <= 4) {
            const key = `${dom}-${idVal}`;
            initialResponses[key] = {
              evaluacion: numScore,
              score: numScore,
              observaciones: item.observacionesBase,
              evidencia: item.evidenciaEsperada,
            };
          }
        }
      });
    } else {
      // Formato directo por áreas { "Área 1": [ ...preguntas ] }
      const sourceObj = data.parsed || data;
      Object.entries(sourceObj).forEach(([area, list]) => {
        if (Array.isArray(list)) {
          parsed[area] = list.map((q, idx) => {
            const idVal = q.id || idx + 1;
            const rawCriteria = q.criteriaByLevel || {};
            const crit0 = rawCriteria['0'] || q.criterio_nivel_0 || (q.escalaEvaluacion?.[0] ?? 'Nivel 0: Inexistente / No implementado');
            const crit1 = rawCriteria['1'] || q.criterio_nivel_1 || (q.escalaEvaluacion?.[1] ?? 'Nivel 1: Inicial / Informal');
            const crit2 = rawCriteria['2'] || q.criterio_nivel_2 || (q.escalaEvaluacion?.[2] ?? 'Nivel 2: Parcialmente definido');
            const crit3 = rawCriteria['3'] || q.criterio_nivel_3 || (q.escalaEvaluacion?.[3] ?? 'Nivel 3: Definido y Operativo');
            const crit4 = rawCriteria['4'] || q.criterio_nivel_4 || (q.escalaEvaluacion?.[4] ?? 'Nivel 4: Optimizado con mejora continua');

            const criteriaByLevel = {
              "0": String(crit0).trim(),
              "1": String(crit1).trim(),
              "2": String(crit2).trim(),
              "3": String(crit3).trim(),
              "4": String(crit4).trim(),
            };

            const escalaEvaluacion = [
              criteriaByLevel["0"],
              criteriaByLevel["1"],
              criteriaByLevel["2"],
              criteriaByLevel["3"],
              criteriaByLevel["4"]
            ];

            return {
              id: idVal,
              pregunta: q.pregunta || '',
              dominio: area,
              subdominio: q.subdominio || '',
              normaReferencia: q.normaReferencia || q.norma || '',
              criterioCumplimiento: criteriaByLevel["3"],
              requisito: criteriaByLevel["3"],
              evidenciaEsperada: q.evidenciaEsperada || q.evidencia || '',
              evidencia: q.evidencia || q.evidenciaEsperada || '',
              criticidad: q.criticidad || 'Alta',
              pesoPonderacion: Number(q.pesoPonderacion || q.peso || 1.0),
              criteriaByLevel,
              escalaEvaluacion,
              observacionesBase: q.observacionesBase || '',
            };
          });
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
      initialResponses,
      hasCriteriaByLevel: true,
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

  // Tomar la primera hoja (o la que se llame Cuestionario_Auditoria)
  const wsQuestions = workbook.worksheets.find(ws => {
    const n = cleanColName(ws.name);
    return n.includes('cuestionario') || n.includes('preguntas') || n.includes('controles') || n.includes('auditoria');
  }) || workbook.worksheets[0];

  // Helper para extraer texto seguro de una celda de ExcelJS
  const getCellSafeText = (cell) => {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object') {
      if (Array.isArray(cell.value.richText)) {
        return cell.value.richText.map(t => t.text).join('').trim();
      }
      if (cell.value.result !== undefined) {
        return String(cell.value.result).trim();
      }
      if (cell.value.text !== undefined) {
        return String(cell.value.text).trim();
      }
    }
    return String(cell.value).trim();
  };

  // Escanear las primeras 6 filas para detectar la fila de encabezados
  let headerRowIndex = -1;
  const colMap = {
    id: -1,
    dominio: -1,
    subdominio: -1,
    norma: -1,
    pregunta: -1,
    evidencia: -1,
    criticidad: -1,
    peso: -1,
    criterio0: -1,
    criterio1: -1,
    criterio2: -1,
    criterio3: -1,
    criterio4: -1,
    puntaje: -1,
    observaciones: -1,
  };

  const maxScanRows = Math.min(wsQuestions.rowCount || 6, 6);
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
      } else if (val.includes('evidencia')) {
        colMap.evidencia = colNumber;
      } else if (val.includes('criticidad') || val.includes('prioridad')) {
        colMap.criticidad = colNumber;
      } else if (val.includes('peso') || val.includes('ponderacion')) {
        colMap.peso = colNumber;
      } else if (val === 'criterionivel0' || val === 'criterio0' || val === 'nivel0') {
        colMap.criterio0 = colNumber;
      } else if (val === 'criterionivel1' || val === 'criterio1' || val === 'nivel1') {
        colMap.criterio1 = colNumber;
      } else if (val === 'criterionivel2' || val === 'criterio2' || val === 'nivel2') {
        colMap.criterio2 = colNumber;
      } else if (val === 'criterionivel3' || val === 'criterio3' || val === 'nivel3') {
        colMap.criterio3 = colNumber;
      } else if (val === 'criterionivel4' || val === 'criterio4' || val === 'nivel4') {
        colMap.criterio4 = colNumber;
      } else if (val.includes('puntaje') || val.includes('score') || val.includes('calificacion')) {
        colMap.puntaje = colNumber;
      } else if (val.includes('observacion') || val.includes('hallazgo') || val.includes('comentario')) {
        colMap.observaciones = colNumber;
      }
    });

    if (matchedKeyCols >= 2 && (colMap.pregunta !== -1 || colMap.dominio !== -1)) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se pudo identificar la fila de encabezados en el archivo Excel. Asegúrate de que la fila 3 contenga encabezados como "id_control", "dominio", "pregunta_control" y "criterio_nivel_0" a "criterio_nivel_4".');
  }

  // Validación de columnas obligatorias esenciales
  const missingCols = [];
  if (colMap.id === -1) missingCols.push('id_control');
  if (colMap.dominio === -1) missingCols.push('dominio');
  if (colMap.pregunta === -1) missingCols.push('pregunta_control');

  if (missingCols.length > 0) {
    throw new Error(`La hoja del cuestionario no contiene las siguientes columnas obligatorias: ${missingCols.join(', ')}. Verifica la fila ${headerRowIndex} de encabezados.`);
  }

  const parsed = {};
  const initialResponses = {};
  let currentDomain = 'Dominio General';
  let totalQuestions = 0;

  wsQuestions.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return; // Ignorar títulos y encabezados

    const idVal = getCellSafeText(row.getCell(colMap.id));
    const domVal = getCellSafeText(row.getCell(colMap.dominio));
    const preguntaVal = getCellSafeText(row.getCell(colMap.pregunta));
    const subdominioVal = colMap.subdominio !== -1 ? getCellSafeText(row.getCell(colMap.subdominio)) : '';
    const normaVal = colMap.norma !== -1 ? getCellSafeText(row.getCell(colMap.norma)) : '';
    const evidenciaVal = colMap.evidencia !== -1 ? getCellSafeText(row.getCell(colMap.evidencia)) : '';
    const criticidadVal = colMap.criticidad !== -1 ? getCellSafeText(row.getCell(colMap.criticidad)) : 'Alta';
    const rawPeso = colMap.peso !== -1 ? row.getCell(colMap.peso).value : 1.0;
    const pesoVal = Number(rawPeso) > 0 ? Number(rawPeso) : 1.0;

    const crit0Val = colMap.criterio0 !== -1 ? getCellSafeText(row.getCell(colMap.criterio0)) : '';
    const crit1Val = colMap.criterio1 !== -1 ? getCellSafeText(row.getCell(colMap.criterio1)) : '';
    const crit2Val = colMap.criterio2 !== -1 ? getCellSafeText(row.getCell(colMap.criterio2)) : '';
    const crit3Val = colMap.criterio3 !== -1 ? getCellSafeText(row.getCell(colMap.criterio3)) : '';
    const crit4Val = colMap.criterio4 !== -1 ? getCellSafeText(row.getCell(colMap.criterio4)) : '';

    const puntajeVal = colMap.puntaje !== -1 ? row.getCell(colMap.puntaje).value : null;
    const obsVal = colMap.observaciones !== -1 ? getCellSafeText(row.getCell(colMap.observaciones)) : '';

    // Si la fila está totalmente vacía, ignorarla limpiamente
    if (!idVal && !domVal && !preguntaVal) {
      return;
    }

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

    // Criterios específicos por nivel para este control
    const criteriaByLevel = {
      "0": crit0Val || "Nivel 0: Inexistente / No implementado. Sin directrices ni controles.",
      "1": crit1Val || "Nivel 1: Inicial / Informal. Prácticas esporádicas sin documentación formal.",
      "2": crit2Val || "Nivel 2: En desarrollo / Parcialmente documentado y formalizado.",
      "3": crit3Val || "Nivel 3: Definido y Operativo. Política aprobada y aplicada consistentemente.",
      "4": crit4Val || "Nivel 4: Optimizado. Automatizado con métricas y mejora continua.",
    };

    const escalaEvaluacion = [
      criteriaByLevel["0"],
      criteriaByLevel["1"],
      criteriaByLevel["2"],
      criteriaByLevel["3"],
      criteriaByLevel["4"]
    ];

    const questionItem = {
      id: qId,
      pregunta: preguntaVal,
      dominio: currentDomain,
      subdominio: subdominioVal,
      normaReferencia: normaVal,
      criterioCumplimiento: criteriaByLevel["3"],
      requisito: criteriaByLevel["3"],
      evidenciaEsperada: evidenciaVal,
      evidencia: evidenciaVal,
      criticidad: criticidadVal || 'Alta',
      pesoPonderacion: pesoVal,
      criteriaByLevel,
      escalaEvaluacion,
      observacionesBase: obsVal,
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
    initialResponses,
    hasCriteriaByLevel: true,
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
