
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileText, FileSpreadsheet, RefreshCw } from 'lucide-react';

import { saveAs } from "file-saver";
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
import logoPng from "./assets/logo.png";



const AuditForm = () => {
 


  const [expandedSections, setExpandedSections] = useState({ 'Información General': true });
  const [responses, setResponses] = useState({});
  const [generalComments, setGeneralComments] = useState('');
  const [introData, setIntroData] = useState({
    nombreEmpresa: '',
    nombre: '',
    puesto: '',
    contacto: '',
    giro: '',
    colaboradores: '',
    modalidad: '',
    proporcionaEquipos: '',
    tipoEquipos: '',
    estructuraTI: '',
    dependenciaRed: '',
    incidenciasRecientes: ''
  });
  const [rewriting, setRewriting] = useState(false);

const hasComments = (generalComments || '').trim().length > 0;
const canRewrite = hasComments && !rewriting;


const rewriteCommentsWithAI = async () => {
  try {
    const userText = (generalComments || "").trim();
    if (!userText) return alert("Primero escribe comentarios.");

    const avgScore = calculateTotalScore();
    const totalQuestions = 46;
    const answeredCount = Object.keys(responses).filter(
      (k) => responses[k]?.evaluacion !== undefined
    ).length;

    const areaScores = calculateAreaScores();

    const res = await fetch(
      "https://n8n-n8n.bg5sbc.easypanel.host/webhook/rewrite-comments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "bw_ai_comments_9F3xL8Qp_2026",
        },
        body: JSON.stringify({
          text: userText,
          context: {
            empresa: introData.nombreEmpresa || "",
            giro: introData.giro || "",
            auditor: actor?.nombreAuditor || "",
            rol: actor?.rol || "",
          },
          scores: {
            avgScore,
            totalQuestions,
            answeredCount,
            projectedPoints: avgScore * totalQuestions,
            areas: areaScores,
          },
        }),
      }
    );

    if (!res.ok) throw new Error("Error al llamar IA");

    const data = await res.json();

    /**
     * 🧹 LIMPIEZA DEFINITIVA
     * - Toma SOLO rewritten
     * - Convierte \n visibles en saltos reales
     * - Elimina llaves o wrappers si llegan por error
     */
    let cleanText = String(data.rewritten || "")
      .replace(/^({\s*)?"?rewritten"?\s*:\s*"?/i, "") // por si llega {"rewritten":
      .replace(/"}\s*$/, "")                          // por si cierra con "}
      .replace(/\\n/g, "\n")                           // \n → salto real
      .replace(/\\r/g, "")
  .replace(/"\s*$/, "")  // quita comilla final
  .replace(/\s*}\s*$/, "") // quita llave final

      .trim();

    // 🧠 Normaliza encabezados SIEMPRE
    cleanText = cleanText
      .replace(/OBSERVACIÓN:\s*/gi, "OBSERVACIÓN:\n")
      .replace(/\s*IMPACTO:\s*/gi, "\n\nIMPACTO:\n")
      .replace(/\s*RECOMENDACIÓN:\s*/gi, "\n\nRECOMENDACIÓN:\n")
      .trim();

    setGeneralComments(cleanText);
  } catch (err) {
    console.error(err);
    alert("Error al reescribir con IA");
  }
};



 
 

 // =========================
  // ✅ PASO PREVIO (AUDITOR / CLIENTE)
  // =========================
  const [step, setStep] = useState('gate'); // 'gate' | 'form'
  const [actor, setActor] = useState({
    nombreAuditor: '',
    rol: '' // 'Auditor' | 'Cliente'
  });

  const continueToForm = () => {
    if (!actor.nombreAuditor.trim()) {
      alert('Por favor escribe el nombre de quien audita.');
      return;
    }
    if (!actor.rol) {
      alert('Por favor selecciona si eres Auditor o Cliente.');
      return;
    }
    setStep('form');
  };


  const updateIntroData = (field, value) => {
    setIntroData(prev => ({
      ...prev,
      [field]: value
    }));
  };



  const startNewEvaluation = () => {
    if (confirm('¿Estás seguro de que deseas iniciar una nueva evaluación? Se perderán todos los datos no exportados.')) {
      setResponses({});
      setGeneralComments('');
      setIntroData({
        nombreEmpresa: '',
        nombre: '',
        puesto: '',
        contacto: '',
        giro: '',
        colaboradores: '',
        modalidad: '',
        proporcionaEquipos: '',
        tipoEquipos: '',
        estructuraTI: '',
        dependenciaRed: '',
        incidenciasRecientes: ''
      });
      setExpandedSections({ 'Información General': true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const sections = {
    'Infraestructura del Site': [
      { id: 1, pregunta: '¿El site cuenta con mecanismos que aseguren la continuidad operativa ante fallas de energía o conectividad (UPS, planta, enlaces redundantes)?', evidencia: 'Autonomía eléctrica, Enlaces de Internet disponibles, Proveedor/SLA', nota: 'Cubre: UPS, planta, enlaces, módems, balanceador' },
      { id: 2, pregunta: '¿El site cuenta con condiciones físicas y ambientales adecuadas para la operación (ubicación controlada, climatización, racks, orden y limpieza)?', evidencia: 'Descripción del site, Fotos (opcional)', nota: 'Cubre: ubicación aislada, climatización, racks, cableado físico' },
      { id: 3, pregunta: '¿La infraestructura tecnológica del site es suficiente, funcional y está correctamente implementada (red, servidores, almacenamiento, telecomunicaciones)?', evidencia: 'Descripción general de componentes, Arquitectura o listado resumido', nota: 'Cubre: switches, routers, firewall, servidores, NAS, PBX, SIP' },
      { id: 4, pregunta: '¿Existen controles de seguridad física y lógica implementados para proteger el site y los activos (control de acceso, CCTV, seguridad perimetral, extinción)?', evidencia: 'Controles implementados, Responsables/proveedor', nota: 'Cubre: CCTV, control acceso, firewall/UTM, FM-200' },
      { id: 5, pregunta: '¿El site cuenta con gestión formal que asegure su operación continua (inventario actualizado, mantenimiento, continuidad y control de accesos)?', evidencia: 'Inventario, Plan de continuidad, Procedimientos operativos', nota: 'Cubre: Inventario, Mantenimiento, Continuidad, Autorización de accesos' }
    ],
    'Seguridad de la Información': [
      { id: 1, pregunta: '¿Existe una política formal de seguridad/ciberseguridad, aprobada y vigente, que ha sido comunicada a todo el personal y que especifica al menos: alcance, roles/responsables y sanciones por incumplimiento?', evidencia: 'documentado' },
      { id: 2, pregunta: '¿Se realizan evaluaciones de riesgos y auditorías periódicas (mínimo anual)?', evidencia: '' },
      { id: 3, pregunta: '¿El control de accesos y autenticación incluye MFA(Autenticación Multifactor, política de contraseña) y gestión de privilegios mínimos?', evidencia: '' },
      { id: 4, pregunta: '¿Se mantiene un inventario actualizado de todos los activos tecnológicos?', evidencia: '' },
      { id: 5, pregunta: '¿Existe y se prueba regularmente un Plan de Respuesta a Incidentes (IRP)?', evidencia: '' },
      { id: 6, pregunta: '¿Se aplican medidas de protección de datos sensibles (cifrado, DLP(Data Lost Prevention), clasificación)?', evidencia: '' },
      { id: 7, pregunta: '¿Se gestionan parches y actualizaciones de seguridad en tiempo oportuno?', evidencia: '' },
      { id: 8, pregunta: '¿El personal recibe capacitación periódica y pruebas de concientización en ciberseguridad/phishing con seguimiento de resultados y acciones de mejora?', evidencia: '' },
      { id: 9, pregunta: '¿Existen sistemas de monitoreo y detección de amenazas (SIEM, EDR, XDR)?', evidencia: '' },
      { id: 10, pregunta: '¿Los equipos corporativos tienen instalado y actualizado un sistema de protección (antivirus/EDR) administrado de forma centralizada o por un tercero especializado?', evidencia: 'Política, evidencia técnica, registro' },
      { id: 11, pregunta: '¿Existen lineamientos para trabajo remoto y dispositivos personales (acceso seguro, separación de datos, revocación de acceso)?', evidencia: 'Política, evidencia técnica, registro' },
      { id: 12, pregunta: '¿Los proveedores que tratan información de la empresa tienen contratos con cláusulas de seguridad/SLA y evaluaciones periódicas?', evidencia: 'Política, evidencia técnica, registro' },
      { id: 13, pregunta: 'Cuando se asigna un acceso, ¿el procedimiento exige la firma/aceptación de un acuerdo de confidencialidad que proteja la información crítica?', evidencia: 'Política, evidencia técnica, registro' },
      { id: 14, pregunta: '¿La red inalámbrica está correctamente segmentada y controlada? — Invitados: aislada de la red corporativa, con control de ancho de banda y portal cautivo/credenciales temporales. — Corporativa: autenticación robusta (WPA2-Enterprise/802.1X) y rotación periódica de credenciales.', evidencia: 'Política, evidencia técnica, registro' },
      { id: 15, pregunta: '¿Se revisan periódicamente los puertos de alto riesgo (p. ej. RDP 3389, SSH 22, SMB 445, DB 1433/3306, SMTP 25, VPN) y las aperturas de puertos o reglas cuentan con ticket, vigencia definida y cierre al finalizar el requerimiento?', evidencia: 'Política, evidencia técnica, registro' }
    ],
    'Cláusula 4: Contexto de la Organización': [
      { id: '4.1', pregunta: '¿Tu organización tiene identificados los factores internos y externos que podrían afectar la seguridad de su información?', requisito: '4.1 Comprensión de la organización y su contexto' },
      { id: '4.2', pregunta: '¿Conoces quiénes son las partes interesadas en la seguridad de la información (clientes, socios, empleados, reguladores)? ¿Tienes claridad sobre qué esperan respecto al manejo seguro de la información?', requisito: '4.2 Comprensión de las necesidades y expectativas de las partes interesadas' },
      { id: '4.3', pregunta: '¿Tienes definido cuáles procesos, áreas o sistemas se deberían proteger si implementaras un SGSI? ¿Sabrías por dónde empezar?', requisito: '4.3 Determinación del alcance del SGSI' },
      { id: '4.4', pregunta: '¿La organización ha intentado estructurar o formalizar algún tipo de sistema para proteger su información? Aunque no sea con base en normas, ¿existen esfuerzos aislados?', requisito: '4.4 Sistema de gestión de seguridad de la información' }
    ],
    'Cláusula 5: Liderazgo': [
      { id: '5.1', pregunta: '¿La alta dirección es consciente de los riesgos asociados a la seguridad de la información? ¿Están preocupados por pérdida de datos, ciberataques, errores internos?', requisito: '5.1 Liderazgo y compromiso' },
      { id: '5.2', pregunta: '¿Existe alguna política, directriz o declaración que exprese cómo la organización protege su información? ¿O es algo implícito, informal o reactivo?', requisito: '5.2 Política de seguridad de la información' },
      { id: '5.3', pregunta: '¿Hay responsables claros sobre quién toma decisiones o gestiona temas de seguridad? ¿O las responsabilidades están repartidas sin definición?', requisito: '5.3 Roles, responsabilidades y autoridades' }
    ],
    'Cláusula 6: Planificación': [
      { id: '6.1', pregunta: '¿Han identificado alguna vez riesgos que podrían afectar la confidencialidad, integridad o disponibilidad de su información? ¿Qué hacen cuando identifican uno?', requisito: '6.1 Acciones para abordar riesgos y oportunidades' },
      { id: '6.2', pregunta: '¿La organización se ha planteado objetivos en torno a la mejora de la seguridad de la información? ¿Cómo miden si están mejorando o no?', requisito: '6.2 Objetivos de seguridad de la información y planificación para lograrlos' }
    ],
    'Cláusula 7: Apoyo': [
      { id: '7.1', pregunta: '¿Cuentan con recursos (humanos, tecnológicos, financieros) asignados para temas de seguridad? ¿O dependen de lo que se pueda en el momento?', requisito: '7.1 Recursos' },
      { id: '7.2', pregunta: '¿El personal tiene conocimientos básicos sobre buenas prácticas de seguridad? ¿Han recibido alguna capacitación? ¿Saben cómo actuar frente a incidentes?', requisito: '7.2 Competencia' },
      { id: '7.3', pregunta: '¿Los colaboradores entienden la importancia de proteger la información en su día a día?', requisito: '7.3 Toma de conciencia' },
      { id: '7.4', pregunta: '¿Cómo se comunican actualmente los temas relacionados con la seguridad de la información dentro de la empresa?', requisito: '7.4 Comunicación' },
      { id: '7.5', pregunta: '¿Dónde se documentan las políticas o procedimientos que se siguen respecto a la información? ¿Hay manuales, procedimientos, diagramas, instructivos?', requisito: '7.5 Información documentada' }
    ],
    'Cláusula 8: Operación': [
      { id: '8.1', pregunta: '¿Existen procesos operativos definidos para manejar la seguridad de la información? Por ejemplo: acceso a sistemas, respaldo de datos, control de dispositivos, etc.', requisito: '8.1 Planificación y control operacional' },
      { id: '8.2', pregunta: '¿Se han realizado evaluaciones formales o informales sobre posibles amenazas o vulnerabilidades?', requisito: '8.2 Evaluación de riesgos de seguridad de la información' },
      { id: '8.3', pregunta: '¿Qué hace la empresa cuando detecta un riesgo o incidente de seguridad? ¿Existe un procedimiento o es una respuesta improvisada?', requisito: '8.3 Tratamiento de riesgos de seguridad de la información' }
    ],
    'Cláusula 9: Evaluación del desempeño': [
      { id: '9.1', pregunta: '¿Se hace algún seguimiento al rendimiento de las prácticas de seguridad? ¿Cómo saben si están funcionando?', requisito: '9.1 Seguimiento, medición, análisis y evaluación' },
      { id: '9.2', pregunta: '¿Han hecho alguna auditoría o revisión de cómo se está manejando la información?', requisito: '9.2 Auditoría interna' },
      { id: '9.3', pregunta: '¿La dirección revisa periódicamente temas relacionados con riesgos y seguridad?', requisito: '9.3 Revisión por la dirección' }
    ],
    'Cláusula 10: Mejora': [
      { id: '10.1', pregunta: '¿Se han presentado incidentes o fallos en la seguridad? ¿Qué se hizo al respecto? ¿Se aprendió algo? ¿Se cambió algo?', requisito: '10.1 No conformidad y acción correctiva' },
      { id: '10.2', pregunta: '¿Existe interés o iniciativas por mejorar la seguridad, aunque no haya un sistema formal? ¿O es un tema que no se considera prioritario?', requisito: '10.2 Mejora continua' }
    ],
    'Inteligencia Artificial y LFPDPPP': [
      { id: 'IA-1', pregunta: '🧠 IA: ¿La organización utiliza o planea utilizar inteligencia artificial y con qué objetivo principal?', evidencia: 'Áreas impactadas, Casos de uso actuales o planeados (ej. Copilot, chatbots, automatización)', nota: 'Cubre: Uso actual de IA, Objetivo de IA, Áreas impactadas, Necesidad inmediata vs mediano plazo' },
      { id: 'IA-2', pregunta: '🧠 IA: ¿Qué nivel de automatización con IA se tiene o se planea implementar y qué riesgos o inquietudes se han identificado?', evidencia: 'Nivel: Automatización básica / Asistente con IA / Integración con sistemas internos. Riesgos percibidos (privacidad, control, errores, impacto laboral)', nota: 'Cubre: Chatbot completo, Inquietudes y temores, Nivel de autonomía, Integración con sistemas' },
      { id: 'DP-1', pregunta: '🔐 LFPDPPP: ¿La organización cumple con los requisitos básicos de la LFPDPPP (aviso de privacidad vigente, finalidades claras y consentimiento adecuado)?', evidencia: 'Aviso de privacidad, Fecha de actualización, Diferenciación de tipos de datos', nota: 'Cubre: Aviso de privacidad, Finalidades, Consentimiento expreso/tácito' },
      { id: 'DP-2', pregunta: '🔐 LFPDPPP: ¿La organización cuenta con medidas y procedimientos formales para la protección de datos personales (seguridad, ARCO, responsables y transferencias)?', evidencia: 'Procedimiento ARCO, Responsable designado, Medidas administrativas/técnicas/físicas, Contratos/cláusulas de transferencia', nota: 'Cubre: Procedimiento ARCO, Responsable de datos, Medidas de seguridad, Transferencias nacionales/internacionales' }
    ]
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateResponse = (section, id, field, value) => {
    const key = `${section}-${id}`;
    setResponses(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const calculateSectionScore = (section) => {
    const questions = sections[section];
    let total = 0;
    let count = 0;
    
    questions.forEach(q => {
      const key = `${section}-${q.id}`;
      if (responses[key]?.evaluacion !== undefined) {
        total += parseInt(responses[key].evaluacion);
        count++;
      }
    });
    
    return count > 0 ? (total / count).toFixed(1) : 'N/A';
  };

  const calculateAreaScores = () => {
    const areas = {
      'Infraestructura del Site': ['Infraestructura del Site'],
      'Seguridad de la Información': ['Seguridad de la Información'],
      'Cláusulas ISO 27001': [
        'Cláusula 4: Contexto de la Organización',
        'Cláusula 5: Liderazgo',
        'Cláusula 6: Planificación',
        'Cláusula 7: Apoyo',
        'Cláusula 8: Operación',
        'Cláusula 9: Evaluación del desempeño',
        'Cláusula 10: Mejora'
      ],
      'IA y LFPDPPP': ['Inteligencia Artificial y LFPDPPP']
    };

    const areaScores = {};
    
    Object.keys(areas).forEach(area => {
      let totalScore = 0;
      let totalQuestions = 0;
      let answeredQuestions = 0;
      
      areas[area].forEach(section => {
        if (sections[section]) {
          sections[section].forEach(q => {
            totalQuestions++;
            const key = `${section}-${q.id}`;
            if (responses[key]?.evaluacion !== undefined) {
              totalScore += parseInt(responses[key].evaluacion);
              answeredQuestions++;
            }
          });
        }
      });

      
      areaScores[area] = {
        score: answeredQuestions > 0 ? (totalScore / answeredQuestions).toFixed(2) : 0,
        percentage: answeredQuestions > 0 ? ((totalScore / answeredQuestions) * 25).toFixed(1) : 0,
        answered: answeredQuestions,
        total: totalQuestions
      };
    });
    
    return areaScores;
  };

  const calculateTotalScore = () => {
    let total = 0;
    let count = 0;
    
    Object.keys(sections).forEach(section => {
      sections[section].forEach(q => {
        const key = `${section}-${q.id}`;
        if (responses[key]?.evaluacion !== undefined) {
          total += parseInt(responses[key].evaluacion);
          count++;
        }
      });
    });
    
    return count > 0 ? (total / count) : 0;
  };

  const getScoreLevel = (score) => {
    const totalScore = score * 46; // 46 preguntas en total * promedio
    
    if (totalScore <= 55) return { nivel: 'Crítico', descripcion: 'Urgente mejora en la postura de seguridad.', color: 'from-red-500 to-red-600' };
    if (totalScore <= 85) return { nivel: 'Básico', descripcion: 'Existen medidas iniciales, pero faltan controles clave.', color: 'from-orange-500 to-orange-600' };
    if (totalScore <= 110) return { nivel: 'Intermedio', descripcion: 'Buen nivel, requiere fortalecimiento y formalización.', color: 'from-yellow-500 to-yellow-600' };
    if (totalScore <= 130) return { nivel: 'Avanzado', descripcion: 'Seguridad sólida, enfocarse en optimización.', color: 'from-blue-500 to-blue-600' };
    return { nivel: 'Óptimo', descripcion: 'Seguridad madura, alineada con mejores prácticas.', color: 'from-green-500 to-green-600' };
  };








 const exportToDocxPro = async () => {
  try {
    // ✅ Cambia aquí la tipografía del DOCX
    const DOC_FONT = "Calibri"; // o "Aptos", "Arial", "Times New Roman"

    // ✅ Helpers
    const today = new Date();
    const fecha = today.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });

    const clean = (s) => String(s ?? "").replace(/\r/g, "");

    const H2 = (text) =>
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text, bold: true, size: 28, font: DOC_FONT })],
        spacing: { before: 260, after: 140 },
      });

    const P = (text, opts = {}) =>
      new Paragraph({
        children: [
          new TextRun({
            text: clean(text),
            size: 22,
            font: DOC_FONT,
            ...opts,
          }),
        ],
        spacing: { after: 100 },
      });

    const KV = (label, value) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 22, font: DOC_FONT }),
          new TextRun({ text: clean(value || "N/A"), size: 22, font: DOC_FONT }),
        ],
        spacing: { after: 80 },
      });

    // ✅ Cargar logo SIN estirarlo (respeta proporción)
    const loadImageBytesAndSize = (src) =>
      new Promise(async (resolve, reject) => {
        try {
          // 1) bytes correctos (Uint8Array evita "docx dañado" en varios casos)
          const res = await fetch(src);
          if (!res.ok) throw new Error("No se pudo cargar el logo (fetch)");
          const ab = await res.arrayBuffer();
          const bytes = new Uint8Array(ab);

          // 2) obtener dimensiones reales
          const img = new Image();
          img.onload = () => resolve({ bytes, w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error("No se pudo leer el logo (Image)"));
          img.src = src;
        } catch (e) {
          reject(e);
        }
      });

    let logoRun = null;
    try {
      const { bytes, w, h } = await loadImageBytesAndSize(logoPng);

      // Ajusta ancho máximo del logo (rectangular). Word usa "px aprox" aquí.
      const targetWidth = 320; // 🔧 prueba 280-360 según te guste
      const targetHeight = Math.round((h / w) * targetWidth);

      logoRun = new ImageRun({
        data: bytes,
        transformation: { width: targetWidth, height: targetHeight },
      });
    } catch (e) {
      console.warn("Logo omitido:", e);
      logoRun = null; // no revienta el doc
    }

    // ✅ Data
    const avgScore = calculateTotalScore();
    const totalQuestions = 46;
    const answeredCount = Object.keys(responses).filter(
      (k) => responses[k]?.evaluacion !== undefined
    ).length;

    const projectedPoints = avgScore * totalQuestions;
    const level = getScoreLevel(avgScore);
    const areaScores = calculateAreaScores();

    // ✅ Semáforo helper
    const traffic = (percentage) => {
      const p = Number(percentage);
      if (p >= 75) return { label: "Optimo", fill: "22C55E" };
      if (p >= 50) return { label: "Intermedio", fill: "F59E0B" };
      return { label: "Critico/Bajo", fill: "EF4444" };
    };

    const tableBorders = {
      top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
    };

    const areaTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: [
        new TableRow({
          children: ["Área", "Semáforo", "Porcentaje", "Promedio", "Respondidas/Total"].map(
            (h, i) =>
              new TableCell({
                width: { size: i === 0 ? 40 : 15, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: "F3F4F6" },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: h, bold: true, size: 22, font: DOC_FONT })],
                  }),
                ],
              })
          ),
        }),
        ...Object.entries(areaScores).map(([area, d]) => {
          const t = traffic(d.percentage);
          return new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                children: [P(area)],
              }),
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: t.fill },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: t.label,
                        bold: true,
                        size: 22,
                        color: "FFFFFF",
                        font: DOC_FONT,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${d.percentage}%`, size: 22, font: DOC_FONT })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${d.score}/4`, size: 22, font: DOC_FONT })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: `${d.answered}/${d.total}`, size: 22, font: DOC_FONT }),
                    ],
                  }),
                ],
              }),
            ],
          });
        }),
      ],
    });

    // ✅ Build doc
    const empresaTitle = introData.nombreEmpresa ? ` — ${introData.nombreEmpresa}` : "";
    const children = [];

    if (logoRun) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [logoRun],
          spacing: { after: 160 },
        })
      );
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `REPORTE DE AUDITORÍA DE TI${empresaTitle}`,
            bold: true,
            size: 34,
            font: DOC_FONT,
          }),
        ],
        spacing: { after: 120 },
      })
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Fecha: ${fecha}`, size: 22, font: DOC_FONT })],
        spacing: { after: 260 },
      })
    );

    children.push(H2("Información general de la empresa"));
    children.push(KV("Empresa", introData.nombreEmpresa));
    children.push(KV("Giro", introData.giro));
    children.push(KV("Contacto", introData.contacto));

    children.push(H2("Persona que auditó"));
    children.push(KV("Auditor", actor?.nombreAuditor));
    children.push(KV("Rol", actor?.rol));

    children.push(H2("Resumen general de la encuesta"));
    children.push(KV("Preguntas respondidas", `${answeredCount}/${totalQuestions}`));
    children.push(KV("Promedio (respondidas)", `${avgScore.toFixed(2)}/4`));
    children.push(KV("Puntuación proyectada", `${projectedPoints.toFixed(0)} pts`));
    children.push(KV("Nivel", level.nivel));
    children.push(P(level.descripcion));

    children.push(H2("Semáforo por área"));
    children.push(areaTable);

    if ((generalComments || "").trim()) {
      children.push(H2("Comentarios generales"));
      clean(generalComments)
        .split("\n")
        .filter((l) => l.trim())
        .forEach((line) => children.push(P(line)));
    }

    // ✅ Documento con estilo default (tipografía global)
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: DOC_FONT },
            paragraph: { spacing: { line: 276 } }, // interlineado aprox 1.15
          },
        },
      },
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `Reporte_Auditoria_TI_${(introData.nombreEmpresa || "Empresa")
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]/g, "")}.docx`;

    saveAs(blob, fileName);
  } catch (err) {
    console.error(err);
    alert("Error al exportar Word. Revisa la consola (F12).");
  }
};









  const exportToExcel = () => {
  const avgScore = calculateTotalScore();
  const totalScore = avgScore * 46;
  const scoreLevel = getScoreLevel(avgScore);
  const areaScores = calculateAreaScores();

  let csvContent = "";

  // Encabezado
  csvContent += "REPORTE DE AUDITORÍA DE TI\n\n";

  // Información General
  csvContent += "INFORMACIÓN GENERAL\n";
  csvContent += `Empresa,${introData.nombreEmpresa || 'N/A'}\n`;
  csvContent += `Nombre,${introData.nombre || 'N/A'}\n`;
  csvContent += `Puesto,${introData.puesto || 'N/A'}\n`;
  csvContent += `Contacto,${introData.contacto || 'N/A'}\n`;
  csvContent += `Giro de la empresa,${introData.giro || 'N/A'}\n`;
  csvContent += `Colaboradores,${introData.colaboradores || 'N/A'}\n`;
  csvContent += `Modalidad,${introData.modalidad || 'N/A'}\n`;
  csvContent += `Proporciona equipos,${introData.proporcionaEquipos || 'N/A'}\n`;
  csvContent += `Tipo de equipos,${introData.tipoEquipos || 'N/A'}\n`;
  csvContent += `Estructura TI,${introData.estructuraTI || 'N/A'}\n`;
  csvContent += `Dependencia de red,${introData.dependenciaRed || 'N/A'}\n`;
  csvContent += `Incidencias recientes,${introData.incidenciasRecientes || 'N/A'}\n\n`;

  // Puntuación General
  csvContent += "PUNTUACIÓN GENERAL\n";
  csvContent += `Puntuación Total,${totalScore.toFixed(0)}\n`;
  csvContent += `Promedio,${avgScore.toFixed(2)}\n`;
  csvContent += `Nivel,${scoreLevel.nivel}\n`;
  csvContent += `Descripción,${scoreLevel.descripcion}\n\n`;

  // Puntuación por Áreas
  csvContent += "PUNTUACIÓN POR ÁREAS\n";
  csvContent += "Área,Porcentaje,Promedio,Respondidas,Total\n";
  Object.entries(areaScores).forEach(([area, data]) => {
    csvContent += `${area},${data.percentage}%,${data.score},${data.answered},${data.total}\n`;
  });
  csvContent += "\n";

  // Detalle
  csvContent += "DETALLE DE EVALUACIÓN\n";
  csvContent += "Sección,ID,Pregunta,Evaluación,Evidencia,Observaciones\n";

  Object.keys(sections).forEach(section => {
    sections[section].forEach(q => {
      const key = `${section}-${q.id}`;
      const r = responses[key] || {};
      csvContent += `"${section}","${q.id}","${q.pregunta.replace(/"/g,'""')}",` +
                    `"${r.evaluacion ?? ''}","${(r.evidencia || '').replace(/"/g,'""')}",` +
                    `"${(r.observaciones || '').replace(/"/g,'""')}"\n`;
    });
  });

  // 🔥 DESCARGA SEGURA
 // 🔧 Forzar UTF-8 para Excel (BOM)
const BOM = '\uFEFF';
const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);

const link = document.createElement('a');
link.href = url;
link.download = 'auditoria-ti.csv';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);

URL.revokeObjectURL(url);





};

 



   if (step === 'gate') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-blue-900 p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Antes de iniciar</h1>
          <p className="text-gray-600 mt-1">Identifica quién realiza la evaluación y el rol.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre de quien audita *
              </label>
              <input
                type="text"
                value={actor.nombreAuditor}
                onChange={(e) => setActor(prev => ({ ...prev, nombreAuditor: e.target.value }))}
                placeholder="Ej: Oscar Pérez"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Rol *
              </label>
              <select
                value={actor.rol}
                onChange={(e) => setActor(prev => ({ ...prev, rol: e.target.value }))}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">Seleccionar...</option>
                <option value="Auditor">Auditor</option>
                <option value="Cliente">Cliente</option>
              </select>
              <div className="mt-2 text-xs text-gray-500">
                * Auditor: evalúa. Cliente: contesta y aporta evidencia.
              </div>
            </div>

            <button
              onClick={continueToForm}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-semibold"
            >
              Continuar al formulario
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-blue-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Portada */}
        <div className="mb-6 rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-r from-cyan-900 via-blue-800 to-cyan-900">
          <div className="relative w-full h-48 md:h-64 flex items-center justify-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDAsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
            <div className="relative z-10 text-center px-4">
              <div className="flex items-center justify-center mb-4">
                <svg className="w-20 h-20 md:w-24 md:h-24 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">
                ByteWise
              </h1>
              <p className="text-cyan-300 text-lg md:text-xl font-light tracking-wide">
                DATA & CYBERSECURITY
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-500 mb-2">
            Auditoría de TI
          </h1>
          <p className="text-gray-600">Evaluación integral de infraestructura, seguridad y cumplimiento</p>
          
          {/* Score Dashboard */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`bg-gradient-to-r ${getScoreLevel(calculateTotalScore()).color} rounded-xl p-6 text-white`}>
              <div className="text-sm opacity-90">Puntuación Total</div>
              <div className="text-4xl font-bold">{(calculateTotalScore() * 46).toFixed(0)} pts</div>
              <div className="text-sm mt-2 font-semibold">{getScoreLevel(calculateTotalScore()).nivel}</div>
              <div className="text-xs mt-1 opacity-90">{getScoreLevel(calculateTotalScore()).descripcion}</div>
            </div>
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl p-6 text-white">
              <div className="text-sm opacity-90">Progreso de Evaluación</div>
              <div className="text-4xl font-bold">
                {Object.keys(responses).filter(k => responses[k]?.evaluacion !== undefined).length}/46
              </div>
              <div className="text-sm mt-2">
                {((Object.keys(responses).filter(k => responses[k]?.evaluacion !== undefined).length / 46) * 100).toFixed(0)}% Completado
              </div>
            </div>
          </div>
<div className="mt-6 relative">
  <label className="block text-sm font-bold text-gray-700 mb-2">
    Comentarios Generales para el Reporte
  </label>

<textarea
  value={generalComments}
  onChange={(e) => setGeneralComments(e.target.value)}
  rows={10}
  className="w-full whitespace-pre-wrap px-4 py-3 border-2 border-gray-300 rounded-lg resize-y"
/>


  <button
    type="button"
    onClick={rewriteCommentsWithAI}
    disabled={!canRewrite}
    title={!hasComments ? 'Escribe comentarios para habilitar' : (rewriting ? 'Mejorando...' : 'Mejorar con IA')}
    className={[
      "absolute top-9 right-3 w-9 h-9 rounded-full flex items-center justify-center",
      "border border-gray-200 bg-white shadow-sm transition",
      canRewrite ? "hover:shadow-md hover:scale-105" : "opacity-40 cursor-not-allowed",
      rewriting ? "animate-pulse" : ""
    ].join(" ")}
  >
    <span className="text-lg">⭐</span>
  </button>
</div>




        <button
  onClick={exportToDocxPro}
  className="mt-4 w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all"
>
  <FileText size={20} />
  Exportar Word (.docx)
</button>


          <button
            onClick={exportToExcel}
            
             className="mt-4 w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all"
          >
            <FileSpreadsheet size={20} />
            Exportar CSV/Excel
          </button>

          <button
            onClick={startNewEvaluation}
            className="mt-4 ml-0 md:ml-3 w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all"
          >
            <RefreshCw size={20} />
            Nueva Evaluación
          </button>
        </div>

        {/* Puntuación por Áreas */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 Puntuación por Áreas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(calculateAreaScores()).map(([area, data]) => {
              const getAreaIcon = (areaName) => {
                if (areaName === 'Infraestructura del Site') return '🏢';
                if (areaName === 'Seguridad de la Información') return '🔒';
                if (areaName === 'Cláusulas ISO 27001') return '📋';
                if (areaName === 'IA y LFPDPPP') return '🧠🔐';
                return '📌';
              };

              const getAreaColor = (percentage) => {
                if (percentage >= 75) return 'from-green-500 to-emerald-600';
                if (percentage >= 50) return 'from-blue-500 to-blue-600';
                if (percentage >= 25) return 'from-yellow-500 to-orange-500';
                return 'from-red-500 to-red-600';
              };


              return (
                <div key={area} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{getAreaIcon(area)}</span>
                    <h3 className="font-bold text-gray-800 text-sm">{area}</h3>
                  </div>
                  
                  <div className={`bg-gradient-to-r ${getAreaColor(data.percentage)} rounded-lg p-4 text-white mb-3`}>
                    <div className="text-3xl font-bold">{data.percentage}%</div>
                    <div className="text-sm opacity-90">Promedio: {data.score}/4</div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Respondidas: {data.answered}/{data.total}</span>
                    <span>{((data.answered / data.total) * 100).toFixed(0)}%</span>
                  </div>
                  
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(data.answered / data.total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sections */}
        {/* Sección de Información General */}
        <div className="mb-4 bg-white rounded-xl shadow-lg overflow-hidden border-2 border-cyan-300">
          <button
            onClick={() => toggleSection('Información General')}
            className="w-full p-4 md:p-6 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="text-left">
                <h2 className="text-lg md:text-xl font-bold text-cyan-800">📋 Información General</h2>
                <p className="text-sm text-cyan-600">Datos de identificación (no generan puntuación)</p>
              </div>
            </div>
            {expandedSections['Información General'] ? <ChevronUp className="text-cyan-600" /> : <ChevronDown className="text-cyan-600" />}
          </button>

          {expandedSections['Información General'] && (
            <div className="p-4 md:p-6 border-t bg-cyan-50/30 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre de la empresa *
                </label>
                <input
                  type="text"
                  value={introData.nombreEmpresa}
                  onChange={(e) => updateIntroData('nombreEmpresa', e.target.value)}
                  placeholder="Razón social o nombre comercial"
                  className="w-full px-4 py-2 border-2 border-cyan-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre de la persona auditada
                  </label>
                  <input
                    type="text"
                    value={introData.nombre}
                    onChange={(e) => updateIntroData('nombre', e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Puesto
                  </label>
                  <input
                    type="text"
                    value={introData.puesto}
                    onChange={(e) => updateIntroData('puesto', e.target.value)}
                    placeholder="Cargo o posición"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Correo o teléfono
                  </label>
                  <input
                    type="text"
                    value={introData.contacto}
                    onChange={(e) => updateIntroData('contacto', e.target.value)}
                    placeholder="email@ejemplo.com o +52 123 456 7890"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Giro de la empresa
                  </label>
                  <input
                    type="text"
                    value={introData.giro}
                    onChange={(e) => updateIntroData('giro', e.target.value)}
                    placeholder="Sector o industria"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ¿Cuántos colaboradores utilizan equipo de cómputo?
                  </label>
                  <input
                    type="text"
                    value={introData.colaboradores}
                    onChange={(e) => updateIntroData('colaboradores', e.target.value)}
                    placeholder="Número aproximado"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ¿Cuál es la modalidad predominante?
                  </label>
                  <select
                    value={introData.modalidad}
                    onChange={(e) => updateIntroData('modalidad', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Presencial">Presencial</option>
                    <option value="Remoto">Remoto</option>
                    <option value="Híbrido">Híbrido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ¿La empresa proporciona los equipos?
                  </label>
                  <select
                    value={introData.proporcionaEquipos}
                    onChange={(e) => updateIntroData('proporcionaEquipos', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Sí, todos">Sí, todos</option>
                    <option value="Parcialmente">Parcialmente</option>
                    <option value="No, BYOD">No, BYOD (traen su propio equipo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ¿Qué equipo entrega la empresa?
                  </label>
                  <input
                    type="text"
                    value={introData.tipoEquipos}
                    onChange={(e) => updateIntroData('tipoEquipos', e.target.value)}
                    placeholder="Laptops, desktops, tablets, smartphones..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ¿Cuál es la estructura organizacional del área de TI?
                </label>
                <textarea
                  value={introData.estructuraTI}
                  onChange={(e) => updateIntroData('estructuraTI', e.target.value)}
                  placeholder="Ej: Gerente TI, 2 analistas de soporte, 1 administrador de redes, outsourcing para desarrollo..."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ¿Qué tan dependientes son de la red/internet para realizar su trabajo?
                </label>
                <select
                  value={introData.dependenciaRed}
                  onChange={(e) => updateIntroData('dependenciaRed', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Totalmente dependiente - sin internet no hay operación">Totalmente dependiente - sin internet no hay operación</option>
                  <option value="Alta dependencia - mayoría de procesos requieren conectividad">Alta dependencia - mayoría de procesos requieren conectividad</option>
                  <option value="Dependencia moderada - algunos procesos offline">Dependencia moderada - algunos procesos offline</option>
                  <option value="Baja dependencia - principalmente local">Baja dependencia - principalmente local</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  En los últimos 12 meses, ¿han ocurrido incidencias que frenaron la operación?
                </label>
                <textarea
                  value={introData.incidenciasRecientes}
                  onChange={(e) => updateIntroData('incidenciasRecientes', e.target.value)}
                  placeholder="Descripción de incidentes: ransomware, caídas de red, pérdida de datos, ataques phishing, fallas de hardware, etc."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Secciones de evaluación */}
        {Object.keys(sections).map(section => (
          <div key={section} className="mb-4 bg-white rounded-xl shadow-lg overflow-hidden">
            <button
              onClick={() => toggleSection(section)}
              className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="text-left">
                  <h2 className="text-lg md:text-xl font-bold text-gray-800">{section}</h2>
                  <p className="text-sm text-gray-500">
                    {sections[section].length} preguntas • Promedio: {calculateSectionScore(section)}/4
                  </p>
                </div>
              </div>
              {expandedSections[section] ? <ChevronUp /> : <ChevronDown />}
            </button>

            {expandedSections[section] && (
              <div className="p-4 md:p-6 border-t space-y-6">
                {sections[section].map(item => {
                  const key = `${section}-${item.id}`;
                  const response = responses[key] || {};
                  
                  return (
                    <div key={item.id} className="border-l-4 border-purple-500 pl-4 py-2">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded text-sm font-semibold">
                          {item.id}
                        </span>
                        <p className="text-gray-700 flex-1">{item.pregunta}</p>
                      </div>

                      {item.requisito && (
                        <p className="text-xs text-gray-500 italic mb-3">📋 {item.requisito}</p>
                      )}

                      {item.nota && (
                        <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded mb-3">✅ {item.nota}</p>
                      )}

                      {item.evidencia && (
                        <p className="text-xs text-blue-600 mb-3">🔍 Evidencia sugerida: {item.evidencia}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Evaluación (0-4)
                          </label>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-800">
                            <div className="font-bold mb-1">Escala de Evaluación:</div>
                            <div>0 - No existe</div>
                            <div>1 - Existe informalmente</div>
                            <div>2 - Parcialmente documentado</div>
                            <div>3 - Documentado y aplicado</div>
                            <div>4 - Óptimo, aprobado y en mejora continua</div>
                          </div>
                          <div className="flex gap-2">
                            {[0, 1, 2, 3, 4].map(score => (
                              <button
                                key={score}
                                onClick={() => updateResponse(section, item.id, 'evaluacion', score)}
                                className={`w-12 h-12 rounded-lg font-bold transition-all ${
                                  response.evaluacion === score
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                                title={
                                  score === 0 ? 'No existe' :
                                  score === 1 ? 'Existe informalmente' :
                                  score === 2 ? 'Parcialmente documentado' :
                                  score === 3 ? 'Documentado y aplicado' :
                                  'Óptimo, aprobado y en mejora continua'
                                }
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Evidencia
                          </label>
                          <input
                            type="text"
                            value={response.evidencia || ''}
                            onChange={(e) => updateResponse(section, item.id, 'evidencia', e.target.value)}
                            placeholder="Documentos, sistemas, procesos..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                          />
                        </div>
                        
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Observaciones
                        </label>
                        <textarea
                          value={response.observaciones || ''}
                          onChange={(e) => updateResponse(section, item.id, 'observaciones', e.target.value)}
                          placeholder="Notas adicionales, hallazgos, recomendaciones..."
                          rows="2"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditForm;
