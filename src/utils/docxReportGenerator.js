import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  ShadingType,
} from "docx";
import { saveAs } from "file-saver";

const DOC_FONT = "Calibri";
const COLOR_PRIMARY = "1E3A8A"; // Azul Marino Corporativo
const COLOR_TEXT = "334155"; // Pizarra oscuro
const COLOR_MUTED = "64748B"; // Pizarra medio
const COLOR_BORDER = "E2E8F0"; // Borde suave
const COLOR_BG_HEADER = "F8FAFC"; // Fondo suave encabezados

const clean = (s) => String(s ?? "").replace(/\r/g, "");

const createTitle = (text, size = 32, before = 240, after = 120) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({
        text: clean(text),
        bold: true,
        size,
        font: DOC_FONT,
        color: COLOR_PRIMARY,
      }),
    ],
    spacing: { before, after },
  });

const createParagraph = (text, opts = {}) =>
  new Paragraph({
    children: [
      new TextRun({
        text: clean(text),
        size: opts.size || 21, // 10.5pt
        font: DOC_FONT,
        color: opts.color || COLOR_TEXT,
        bold: opts.bold || false,
        italics: opts.italics || false,
      }),
    ],
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: { after: opts.after !== undefined ? opts.after : 80 },
  });

const createKeyValue = (label, value) =>
  new Paragraph({
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        size: 21,
        font: DOC_FONT,
        color: COLOR_PRIMARY,
      }),
      new TextRun({
        text: clean(value || "N/A"),
        size: 21,
        font: DOC_FONT,
        color: COLOR_TEXT,
      }),
    ],
    spacing: { after: 70 },
  });

const getScoreBadge = (scoreNum) => {
  const s = Number(scoreNum);
  if (isNaN(s)) return { label: "Sin evaluar", fill: "F1F5F9", textColor: "475569" };
  if (s >= 3.5) return { label: `${s}/4 - Óptimo / Redundante`, fill: "DCFCE7", textColor: "166534" };
  if (s >= 2.5) return { label: `${s}/4 - Definido y Operativo`, fill: "E0F2FE", textColor: "0369A1" };
  if (s >= 1.5) return { label: `${s}/4 - Parcial / En Proceso`, fill: "FEF3C7", textColor: "92400E" };
  if (s > 0) return { label: `${s}/4 - Inicial / Ad-hoc`, fill: "FEE2E2", textColor: "991B1B" };
  return { label: `0/4 - No Implementado`, fill: "FEE2E2", textColor: "991B1B" };
};

const getTrafficLevel = (percentage) => {
  const p = Number(percentage);
  if (p >= 75) return { label: "Óptimo", fill: "DCFCE7", color: "166534" };
  if (p >= 50) return { label: "Intermedio", fill: "FEF3C7", color: "92400E" };
  return { label: "Crítico / Bajo", fill: "FEE2E2", color: "991B1B" };
};

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
  left: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
  right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
};

/**
 * Genera y descarga el reporte profesional de auditoría en Word (.docx)
 */
export const generateExecutiveDocx = async ({
  introData = {},
  actor = {},
  customSections = {},
  responses = {},
  areaScores = {},
  avgScore = 0,
  totalScore = 0,
  totalQuestions = 0,
  answeredCount = 0,
  scoreLevel = {},
  positiveComments = '',
  negativeComments = '',
  recommendations = '',
  generalComments = '',
  evaluatorsList = [],
  logoUrl = null,
}) => {
  try {
    const today = new Date();
    const fecha = today.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });

    let logoRun = null;
    if (logoUrl) {
      try {
        const res = await fetch(logoUrl);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const bytes = new Uint8Array(ab);
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            img.src = logoUrl;
          });
          const targetWidth = 280;
          const targetHeight = img.naturalWidth ? Math.round((img.naturalHeight / img.naturalWidth) * targetWidth) : 65;
          logoRun = new ImageRun({
            data: bytes,
            transformation: { width: targetWidth, height: targetHeight },
          });
        }
      } catch (e) {
        console.warn("Logo omitido en reporte Word:", e);
      }
    }

    const children = [];

    // ==========================================
    // 1. PORTADA CORPORATIVA
    // ==========================================
    if (logoRun) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [logoRun],
          spacing: { before: 180, after: 200 },
        })
      );
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "REPORTE EJECUTIVO DE AUDITORÍA TI",
            bold: true,
            size: 36, // 18pt
            font: DOC_FONT,
            color: COLOR_PRIMARY,
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    const companyName = introData.nombreEmpresa || "Empresa Auditada";
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: companyName.toUpperCase(),
            bold: true,
            size: 28, // 14pt
            font: DOC_FONT,
            color: COLOR_TEXT,
          }),
        ],
        spacing: { after: 200 },
      })
    );

    // Badge / Recuadro de Madurez Tecnológica
    const maturityInfo = scoreLevel || { nivel: "Nivel en Evaluación", descripcion: "" };
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: "F0F9FF" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: `ESTADO DE MADUREZ TI: ${maturityInfo.nivel || 'Evaluado'}`,
                        bold: true,
                        size: 24,
                        font: DOC_FONT,
                        color: COLOR_PRIMARY,
                      }),
                    ],
                    spacing: { before: 80, after: 40 },
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: maturityInfo.descripcion || "Evaluación diagnóstica basada en estándares ISO 27001 y mejores prácticas de TI.",
                        italics: true,
                        size: 20,
                        font: DOC_FONT,
                        color: COLOR_MUTED,
                      }),
                    ],
                    spacing: { after: 80 },
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    // Metadatos de la Portada
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({ text: "Datos de la Evaluación", bold: true, size: 24, color: COLOR_PRIMARY, font: DOC_FONT }),
        ],
      })
    );

    children.push(createKeyValue("Fecha de Emisión", fecha));
    children.push(createKeyValue("Giro / Sector", introData.giro || "Tecnología / General"));
    children.push(createKeyValue("Contacto Principal", `${introData.contacto || 'N/A'} ${introData.puesto ? `(${introData.puesto})` : ''}`));
    if (introData.sitioWeb) children.push(createKeyValue("Sitio Web", introData.sitioWeb));

    // Auditores
    const auditorPrincipal = actor?.nombreAuditor || "Auditor Asignado";
    const rolAuditor = actor?.rol || "Auditor Principal";
    children.push(createKeyValue("Auditor Responsable", `${auditorPrincipal} — ${rolAuditor}`));

    if (evaluatorsList && evaluatorsList.length > 0) {
      const coAuditores = evaluatorsList
        .filter(ev => ev.auditorName && ev.auditorName !== auditorPrincipal)
        .map(ev => `${ev.auditorName} (${ev.role || 'Co-Auditor'})`)
        .join(", ");
      if (coAuditores) {
        children.push(createKeyValue("Equipo Evaluador", coAuditores));
      }
    }

    // Salto de página para el contenido
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        children: [],
      })
    );

    // ==========================================
    // 2. RESUMEN EJECUTIVO
    // ==========================================
    children.push(createTitle("1. Resumen Ejecutivo y Métricas Globales", 28, 100, 140));

    // Tabla de Métricas Clave
    const percentageGlobal = totalQuestions > 0 ? Math.round((avgScore / 4) * 100) : 0;
    const metricsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLOR_BG_HEADER },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Cumplimiento Global", bold: true, size: 20, font: DOC_FONT })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${percentageGlobal}%`, bold: true, size: 30, color: COLOR_PRIMARY, font: DOC_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLOR_BG_HEADER },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Promedio (/4)", bold: true, size: 20, font: DOC_FONT })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${avgScore.toFixed(2)} / 4.0`, bold: true, size: 30, color: COLOR_PRIMARY, font: DOC_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLOR_BG_HEADER },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Puntaje Ponderado", bold: true, size: 20, font: DOC_FONT })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${totalScore.toFixed(0)} pts`, bold: true, size: 30, color: COLOR_PRIMARY, font: DOC_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLOR_BG_HEADER },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Controles Evaluados", bold: true, size: 20, font: DOC_FONT })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${answeredCount} / ${totalQuestions}`, bold: true, size: 30, color: COLOR_PRIMARY, font: DOC_FONT })],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    children.push(metricsTable);

    // Tabla de Dominios / Áreas
    children.push(createTitle("Desempeño por Dominios Auditados", 24, 200, 100));

    const domainRows = [
      new TableRow({
        children: ["Dominio / Área de Control", "Cumplimiento", "Promedio", "Estado", "Evaluadas"].map((header, idx) =>
          new TableCell({
            width: { size: idx === 0 ? 40 : 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
            children: [
              new Paragraph({
                alignment: idx === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                children: [new TextRun({ text: header, bold: true, size: 20, color: "FFFFFF", font: DOC_FONT })],
              }),
            ],
          })
        ),
      }),
      ...Object.entries(areaScores).map(([area, data]) => {
        const traffic = getTrafficLevel(data.percentage);
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              children: [createParagraph(area, { bold: true, size: 20 })],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${data.percentage}%`, bold: true, size: 20, font: DOC_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${data.score} / 4`, size: 20, font: DOC_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: traffic.fill },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: traffic.label, bold: true, size: 20, color: traffic.color, font: DOC_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${data.answered}/${data.total}`, size: 20, font: DOC_FONT })],
                }),
              ],
            }),
          ],
        });
      }),
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: domainRows,
      })
    );

    // ==========================================
    // 3. DESGLOSE DETALLADO DE PREGUNTAS Y RESPUESTAS
    // ==========================================
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        children: [],
      })
    );

    children.push(createTitle("2. Desglose Detallado de Preguntas y Respuestas", 28, 100, 140));
    children.push(
      createParagraph(
        "A continuación se presenta el análisis detallado de cada uno de los controles evaluados, incluyendo la calificación asignada, requisitos normativos asociados, hallazgos u observaciones del auditor y las evidencias verificadas.",
        { color: COLOR_MUTED, after: 180 }
      )
    );

    Object.entries(customSections).forEach(([sectionName, questions], sectionIndex) => {
      if (!questions || questions.length === 0) return;

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Dominio ${sectionIndex + 1}: ${sectionName}`,
              bold: true,
              size: 24, // 12pt
              font: DOC_FONT,
              color: COLOR_PRIMARY,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      questions.forEach((q, qIndex) => {
        const key = `${sectionName}-${q.id}`;
        const resp = responses[key] || {};
        const scoreVal = resp.evaluacion !== undefined ? resp.evaluacion : (resp.score !== undefined ? resp.score : null);
        const badge = getScoreBadge(scoreVal);
        const obs = resp.observaciones || resp.comment || "Sin observaciones o comentarios registrados.";
        const evid = resp.evidencia || resp.evidence || q.evidencia || "Sin evidencia adjunta.";
        const req = q.requisito || q.nota || "Buenas prácticas de ciberseguridad y continuidad TI";

        // Tarjeta de la Pregunta en formato Tabla
        const questionCard = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: [
            // Fila 1: Encabezado con Enunciado y Puntaje
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 70, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: COLOR_BG_HEADER },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `Control ${q.id || qIndex + 1}: `,
                          bold: true,
                          size: 21,
                          font: DOC_FONT,
                          color: COLOR_PRIMARY,
                        }),
                        new TextRun({
                          text: q.pregunta,
                          bold: true,
                          size: 21,
                          font: DOC_FONT,
                          color: COLOR_TEXT,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: badge.fill },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: badge.label,
                          bold: true,
                          size: 20,
                          font: DOC_FONT,
                          color: badge.textColor,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            // Fila 2: Requisito Normativo
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Requisito / Control: ", bold: true, size: 19, font: DOC_FONT, color: COLOR_MUTED }),
                        new TextRun({ text: req, size: 19, font: DOC_FONT, color: COLOR_TEXT }),
                      ],
                      spacing: { after: 40 },
                    }),
                  ],
                }),
              ],
            }),
            // Fila 3: Hallazgos y Observaciones
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Hallazgos y Observaciones del Auditor:", bold: true, size: 20, font: DOC_FONT, color: COLOR_PRIMARY }),
                      ],
                      spacing: { after: 30 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: obs, size: 20, font: DOC_FONT, color: COLOR_TEXT }),
                      ],
                      spacing: { after: 40 },
                    }),
                  ],
                }),
              ],
            }),
            // Fila 4: Evidencias
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  shading: { type: ShadingType.CLEAR, fill: "FBFDFE" },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Evidencias Verificadas: ", bold: true, size: 19, font: DOC_FONT, color: COLOR_MUTED }),
                        new TextRun({ text: evid, size: 19, font: DOC_FONT, color: COLOR_TEXT }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });

        children.push(questionCard);
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      });
    });

    // ==========================================
    // 4. CONCLUSIONES Y RECOMENDACIONES
    // ==========================================
    if (positiveComments || negativeComments || recommendations || generalComments) {
      children.push(
        new Paragraph({
          pageBreakBefore: true,
          children: [],
        })
      );

      children.push(createTitle("3. Conclusiones y Plan de Acción", 28, 100, 140));

      if ((positiveComments || "").trim()) {
        children.push(createTitle("Fortalezas y Aspectos Positivos", 22, 140, 80));
        clean(positiveComments)
          .split("\n")
          .filter((l) => l.trim())
          .forEach((line) => children.push(createParagraph(line, { color: "15803D" })));
      }

      if ((negativeComments || "").trim()) {
        children.push(createTitle("Hallazgos y Vulnerabilidades Detectadas", 22, 140, 80));
        clean(negativeComments)
          .split("\n")
          .filter((l) => l.trim())
          .forEach((line) => children.push(createParagraph(line, { color: "B91C1C" })));
      }

      if ((recommendations || "").trim()) {
        children.push(createTitle("Recomendaciones Estratégicas Prioritarias", 22, 140, 80));
        clean(recommendations)
          .split("\n")
          .filter((l) => l.trim())
          .forEach((line) => children.push(createParagraph(line, { color: "0369A1" })));
      }

      if ((generalComments || "").trim()) {
        children.push(createTitle("Comentarios Adicionales del Equipo de Auditoría", 22, 140, 80));
        clean(generalComments)
          .split("\n")
          .filter((l) => l.trim())
          .forEach((line) => children.push(createParagraph(line)));
      }
    }

    // Configuración general del documento
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: DOC_FONT },
            paragraph: { spacing: { line: 276 } }, // Interlineado 1.15
          },
        },
      },
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const sanitizedName = (introData.nombreEmpresa || "Empresa")
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]/g, "");
    const fileName = `Reporte_Ejecutivo_TI_${sanitizedName}.docx`;

    saveAs(blob, fileName);
    return true;
  } catch (error) {
    console.error("Error al generar reporte Word ejecutivo:", error);
    throw error;
  }
};

