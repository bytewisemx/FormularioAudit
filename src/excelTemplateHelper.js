import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { DEFAULT_SECTIONS } from './defaultSections';

/**
 * Genera y descarga la plantilla oficial de preguntas en formato Excel (.xlsx)
 * con diseño profesional y las preguntas base precargadas como guía.
 */
export const downloadExcelTemplate = async (sourceSections = DEFAULT_SECTIONS) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ByteWise Auditoría TI';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Cuestionario');

    // Configurar columnas
    worksheet.columns = [
      { header: 'Area', key: 'area', width: 34 },
      { header: 'ID', key: 'id', width: 12 },
      { header: 'Pregunta', key: 'pregunta', width: 65 },
      { header: 'Evidencia', key: 'evidencia', width: 35 },
      { header: 'Nota', key: 'nota', width: 35 },
      { header: 'Requisito', key: 'requisito', width: 25 },
    ];

    // Estilo de la fila de encabezado
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate-900
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF00D4FF' } }, // Borde Cyan ByteWise
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    // Filas con la plantilla base de preguntas
    const sectionsToUse = sourceSections && Object.keys(sourceSections).length > 0 
      ? sourceSections 
      : DEFAULT_SECTIONS;

    Object.entries(sectionsToUse).forEach(([area, questions]) => {
      (questions || []).forEach((q) => {
        const row = worksheet.addRow({
          area: area,
          id: q.id,
          pregunta: q.pregunta,
          evidencia: q.evidencia || '',
          nota: q.nota || '',
          requisito: q.requisito || '',
        });
        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell(2).alignment = { vertical: 'top', horizontal: 'center' };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, 'Plantilla_Preguntas_Auditoria.xlsx');
  } catch (err) {
    console.error('Error al generar plantilla Excel:', err);
    alert('Error al descargar la plantilla de Excel.');
  }
};

/**
 * Lee un archivo .xlsx o .json y lo transforma en la estructura de secciones y preguntas
 * del formulario.
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
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('El archivo Excel no contiene ninguna hoja de cálculo.');
  }

  const colMap = { area: -1, id: -1, pregunta: -1, evidencia: -1, nota: -1, requisito: -1 };
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (val.includes('area') || val.includes('seccion') || val.includes('dominio')) colMap.area = colNumber;
    else if (val === 'id' || val.includes('codigo') || val.includes('num')) colMap.id = colNumber;
    else if (val.includes('pregunta') || val.includes('cuestion') || val.includes('item')) colMap.pregunta = colNumber;
    else if (val.includes('evidencia')) colMap.evidencia = colNumber;
    else if (val.includes('nota') || val.includes('ayuda')) colMap.nota = colNumber;
    else if (val.includes('requisito') || val.includes('norma') || val.includes('control')) colMap.requisito = colNumber;
  });

  // Si no encontró por nombre exacto, usar columnas por defecto 1 a 6
  if (colMap.area === -1) colMap.area = 1;
  if (colMap.id === -1) colMap.id = 2;
  if (colMap.pregunta === -1) colMap.pregunta = 3;
  if (colMap.evidencia === -1) colMap.evidencia = 4;
  if (colMap.nota === -1) colMap.nota = 5;
  if (colMap.requisito === -1) colMap.requisito = 6;

  const parsed = {};
  let currentArea = 'Área Inicial';
  let totalQuestions = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Saltar fila de encabezado

    const areaVal = String(row.getCell(colMap.area).value || '').trim();
    const idVal = row.getCell(colMap.id).value;
    const preguntaVal = String(row.getCell(colMap.pregunta).value || '').trim();
    const evidenciaVal = String(row.getCell(colMap.evidencia).value || '').trim();
    const notaVal = String(row.getCell(colMap.nota).value || '').trim();
    const requisitoVal = String(row.getCell(colMap.requisito).value || '').trim();

    if (areaVal) {
      currentArea = areaVal;
    }

    if (preguntaVal) {
      if (!parsed[currentArea]) {
        parsed[currentArea] = [];
      }
      const qId = idVal ? String(idVal).trim() : String(parsed[currentArea].length + 1);
      parsed[currentArea].push({
        id: isNaN(Number(qId)) ? qId : Number(qId),
        pregunta: preguntaVal,
        evidencia: evidenciaVal,
        nota: notaVal,
        requisito: requisitoVal,
      });
      totalQuestions++;
    }
  });

  if (totalQuestions === 0) {
    throw new Error("No se encontraron preguntas en el archivo Excel. Asegúrate de que la columna 'Pregunta' contenga texto.");
  }

  return {
    parsed,
    areasCount: Object.keys(parsed).length,
    questionsCount: totalQuestions,
  };
};
