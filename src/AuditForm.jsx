
import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Download, FileText, FileSpreadsheet, RefreshCw, Mic, Sparkles, Building2, Shield, Brain, Hash, CheckCircle, Search } from 'lucide-react';
import { db } from "./firebase";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";

import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
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
import logoPng from "./assets/bytewise.mx.png";
import AudioAssistant from "./components/AudioAssistant";

const GENERIC_EVALUATION_SCALE = [
  '0 - No existe',
  '1 - Existe informalmente',
  '2 - Parcialmente documentado',
  '3 - Documentado y aplicado',
  '4 - Óptimo, aprobado y en mejora continua',
];


const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const AuditForm = () => {


  const [expandedSections, setExpandedSections] = useState({ 'Información General': true });
  const [responses, setResponses] = useState({});
  const [generalComments, setGeneralComments] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
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
  const [dictatingKey, setDictatingKey] = useState(null);
  const [rewritingKey, setRewritingKey] = useState(null);
  const [activeSection, setActiveSection] = useState('Información General');
  
  const [savedAudits, setSavedAudits] = useState([]);
  const [currentAuditId, setCurrentAuditId] = useState(null);
  const [step, setStep] = useState('gate'); // 'gate' | 'form'
  const [actor, setActor] = useState({ nombreEmpresa: '', nombreAuditor: '', rol: '', contrasena: '', contrasenaHash: '' });

  useEffect(() => {
    const loadAudits = async () => {
      try {
        if (!db) return;
        const querySnapshot = await getDocs(collection(db, "auditorias"));
        const audits = [];
        querySnapshot.forEach((docSnap) => {
          audits.push(docSnap.data());
        });
        audits.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        setSavedAudits(audits);
      } catch (e) {
        console.error("Error cargando auditorías desde Firebase:", e);
      }
    };
    loadAudits();
  }, []);

  const savedAuditsRef = React.useRef(savedAudits);
  useEffect(() => { savedAuditsRef.current = savedAudits; }, [savedAudits]);

  useEffect(() => {
    if (step === 'form' && currentAuditId) {
       const prevList = savedAuditsRef.current;
       const index = prevList.findIndex(a => a.id === currentAuditId);
       let newList = [...prevList];
       const auditData = {
         id: currentAuditId,
         lastModified: new Date().toISOString(),
         nombreEmpresa: introData.nombreEmpresa || 'Empresa sin nombre',
         data: { introData, responses, generalComments, actor }
       };
       if (index >= 0) {
         newList[index] = auditData;
       } else {
         newList.push(auditData);
       }
       setSavedAudits(newList);
       
       if (db) {
         try {
           const docRef = doc(db, "auditorias", currentAuditId);
           setDoc(docRef, auditData).catch(e => console.error("Error al guardar en Firebase:", e));
         } catch(e) {}
       }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introData, responses, generalComments, actor, currentAuditId, step]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

 const hasComments = (generalComments || '').trim().length > 0;
 const canRewrite = hasComments && !rewriting;


const rewriteCommentsWithAI = async () => {
  try {
    const userText = (generalComments || "").trim();
    if (!userText) return alert("Primero escribe comentarios.");

    const avgScore = calculateTotalScore();
    const totalQuestions = getTotalQuestions();
    const answeredCount = getAnsweredQuestions();

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
  } finally {
    setRewriting(false);
  }
};


const rewriteObservationWithAI = async (section, item) => {
  const key = `${section}-${item.id}`;
  const userText = (responses[key]?.observaciones || "").trim();
  if (!userText) return alert("Escribe o dicta algo en la observación primero.");

  setRewritingKey(key);
  try {
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
            tipo: "observacion_especifica",
            pregunta: item.pregunta,
            requisito: item.requisito || "",
            empresa: introData.nombreEmpresa || "",
          }
        }),
      }
    );

    if (!res.ok) throw new Error("Error al llamar IA");

    const data = await res.json();
    let cleanText = String(data.rewritten || "")
      .replace(/^({\s*)?"?rewritten"?\s*:\s*"?/i, "") 
      .replace(/"}\s*$/, "")                          
      .replace(/\\n/g, "\n")                           
      .replace(/\\r/g, "")
      .replace(/"\s*$/, "")  
      .replace(/\s*}\s*$/, "") 
      .trim();

    updateResponse(section, item.id, 'observaciones', cleanText);
  } catch (err) {
    console.error(err);
    alert("Error al mejorar la observación con IA");
  } finally {
    setRewritingKey(null);
  }
};

const startInlineDictation = (section, id) => {
  const key = `${section}-${id}`;
  
  if (dictatingKey === key) {
    setDictatingKey(null);
    if (window.inlineRecognition) window.inlineRecognition.stop();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Dictado no soportado en este navegador.");
  
  if (window.inlineRecognition) {
    window.inlineRecognition.stop();
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'es-MX';

  setDictatingKey(key);

  recognition.onresult = (event) => {
    let finalChunk = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalChunk += event.results[i][0].transcript + ' ';
      }
    }
    if (finalChunk) {
      setResponses(prev => {
         const current = prev[key]?.observaciones || '';
         const separator = current && !current.endsWith(' ') ? ' ' : '';
         return {
           ...prev,
           [key]: {
             ...prev[key],
             observaciones: current + separator + finalChunk.trim()
           }
         }
      });
    }
  };

  recognition.onerror = () => {
    setDictatingKey(null);
  };

  recognition.onend = () => {
    setDictatingKey(null);
  };

  recognition.start();
  window.inlineRecognition = recognition;
};



 
 

  // =========================
  // ✅ PASO PREVIO (AUDITOR / CLIENTE)
  // =========================
  // (State moved to top for auto-save logic)


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
      {
        id: 1,
        pregunta: '¿El site cuenta con mecanismos que aseguren la continuidad operativa ante fallas de energía o conectividad (UPS, planta, enlaces redundantes)?',
        evidencia: 'Autonomía eléctrica, Enlaces de Internet disponibles, Proveedor/SLA',
        nota: 'Cubre: UPS, planta, enlaces, módems, balanceador',
        escalaEvaluacion: [
          '0 - Sin respaldo eléctrico ni de conectividad.',
          '1 - Respaldo básico sin formalizar.',
          '2 - Respaldo parcial documentado.',
          '3 - Respaldo documentado y operativo.',
          '4 - Respaldo aprobado, probado y mejorado.',
        ],
      },
      {
        id: 2,
        pregunta: '¿El site cuenta con condiciones físicas y ambientales adecuadas para alojar y proteger la infraestructura tecnológica?',
        evidencia: 'Descripción del site, Fotos (opcional)',
        nota: 'Cubre: ubicación aislada, climatización, racks, cableado físico',
        escalaEvaluacion: [
          '0 - Sin control físico ni ambiental.',
          '1 - Control básico con varias deficiencias.',
          '2 - Control parcial de ambiente, racks, orden y limpieza.',
          '3 - Control adecuado, documentado y aplicado.',
          '4 - Control óptimo, monitoreado y mejorado.',
        ],
      },
      {
        id: 3,
        pregunta: '¿La infraestructura tecnológica del site es suficiente y funcional para soportar la operación?',
        evidencia: 'Descripción general de componentes, Arquitectura o listado resumido',
        nota: 'Cubre: switches, routers, firewall, servidores, NAS, PBX, SIP',
        escalaEvaluacion: [
          '0 - No existe infraestructura tecnológica suficiente.',
          '1 - Infraestructura básica con deficiencias importantes.',
          '2 - Infraestructura parcialmente suficiente y funcional.',
          '3 - Infraestructura suficiente, funcional y documentada.',
          '4 - Infraestructura óptima, monitoreada y mejorada.',
        ],
      },
      { id: 4, pregunta: '¿Existen controles de seguridad física y lógica para proteger el acceso al site y los activos tecnológicos?', evidencia: 'Controles implementados, Responsables/proveedor', nota: 'Cubre: CCTV, control acceso, firewall/UTM, FM-200' },
      {
        id: 5,
        pregunta: '¿La operación del site se gestiona de forma formal, con inventario actualizado, mantenimiento programado y responsables definidos?',
        evidencia: 'Inventario, Plan de continuidad, Procedimientos operativos',
        nota: 'Cubre: Inventario, Mantenimiento, Continuidad, Autorización de accesos',
        escalaEvaluacion: [
          '0 - Sin gestión del site.',
          '1 - Gestión informal.',
          '2 - Gestión parcialmente documentada.',
          '3 - Gestión documentada y aplicada.',
          '4 - Gestión monitoreada y mejorada.',
        ],
      }
    ],
    'Cláusula 4: Contexto de la organización': [
      { id: '4.1', pregunta: '¿La organización tiene identificados los factores internos y externos que pueden afectar la seguridad de la información?', requisito: '4.1 Factores internos y externos', escalaEvaluacion: ['0 - No identificados.', '1 - Identificados informalmente.', '2 - Parcialmente documentados.', '3 - Documentados y considerados.', '4 - Revisados y actualizados periódicamente.'] },
      { id: '4.2', pregunta: '¿La organización tiene identificadas las partes interesadas y sus expectativas respecto a la seguridad de la información?', requisito: '4.2 Partes interesadas', escalaEvaluacion: ['0 - No identificadas.', '1 - Identificadas informalmente.', '2 - Parcialmente documentadas.', '3 - Documentadas y consideradas.', '4 - Revisadas y actualizadas periódicamente.'] },
      { id: '4.3', pregunta: '¿La organización tiene definido qué procesos, áreas, sistemas o información deben protegerse dentro del alcance del SGSI?', requisito: '4.3 Alcance del SGSI', escalaEvaluacion: ['0 - No definido.', '1 - Definido informalmente.', '2 - Parcialmente documentado.', '3 - Documentado y aplicado.', '4 - Revisado y mejorado periódicamente.'] },
    ],
    'Cláusula 5: Liderazgo': [
      { id: '5.1', pregunta: '¿La alta dirección reconoce los riesgos de seguridad de la información y participa en su gestión?', requisito: '5.1 Compromiso de la alta dirección', escalaEvaluacion: ['0 - Sin involucramiento.', '1 - Involucramiento informal.', '2 - Participación parcial.', '3 - Participación documentada.', '4 - Liderazgo activo y medido.'] },
      { id: '5.2', pregunta: '¿La organización cuenta con una política de seguridad de la información aprobada, vigente y respaldada por la dirección?', requisito: '5.2 Política de seguridad', escalaEvaluacion: ['0 - No existe política.', '1 - Política informal.', '2 - Política parcialmente documentada.', '3 - Política aprobada y comunicada.', '4 - Política revisada y mejorada.'] },
      { id: '5.3', pregunta: '¿Existen responsables definidos para tomar decisiones y gestionar temas de seguridad de la información?', requisito: '5.3 Roles y responsabilidades', escalaEvaluacion: ['0 - Sin responsables.', '1 - Responsables informales.', '2 - Responsabilidades parciales.', '3 - Responsables definidos y aplicados.', '4 - Responsabilidades revisadas y mejoradas.'] },
    ],
    'Cláusula 6: Planificación': [
      { id: '6.1', pregunta: '¿La organización identifica, evalúa y atiende riesgos que puedan afectar la confidencialidad, integridad o disponibilidad de la información?', requisito: '6.1 Gestión de riesgos', escalaEvaluacion: ['0 - No gestiona riesgos.', '1 - Gestión informal.', '2 - Gestión parcial.', '3 - Riesgos documentados y tratados.', '4 - Riesgos monitoreados y actualizados.'] },
      { id: '6.2', pregunta: '¿La organización ha definido objetivos de seguridad de la información y mecanismos para medir su avance?', requisito: '6.2 Objetivos de seguridad', escalaEvaluacion: ['0 - Sin objetivos.', '1 - Objetivos informales.', '2 - Objetivos parciales.', '3 - Objetivos definidos y medidos.', '4 - Objetivos revisados y mejorados.'] },
    ],
    'Cláusula 7: Apoyo': [
      { id: '7.1', pregunta: '¿La organización cuenta con recursos humanos, tecnológicos o financieros asignados para gestionar la seguridad de la información?', requisito: '7.1 Recursos', escalaEvaluacion: ['0 - Sin recursos.', '1 - Recursos informales.', '2 - Recursos parciales.', '3 - Recursos asignados y evidenciados.', '4 - Recursos evaluados y optimizados.'] },
      { id: '7.2', pregunta: '¿El personal recibe capacitación periódica en seguridad de la información, incluyendo concientización y pruebas de phishing cuando aplique?', requisito: '7.2 Competencia y concientización', escalaEvaluacion: ['0 - Sin capacitación.', '1 - Capacitación informal.', '2 - Capacitación parcial.', '3 - Capacitación periódica con evidencia.', '4 - Capacitación medida y mejorada.'] },
      { id: '7.3', pregunta: '¿La organización comunica y documenta adecuadamente las políticas, procedimientos o lineamientos de seguridad de la información?', requisito: '7.3 Comunicación y documentación', escalaEvaluacion: ['0 - No se documenta ni comunica.', '1 - Comunicación informal.', '2 - Documentación parcial.', '3 - Documentado y comunicado.', '4 - Documentación controlada y actualizada.'] },
    ],
    'Cláusula 8: Operación': [
      { id: '8.1', pregunta: '¿Existen procesos definidos para operar y controlar la seguridad de la información en las actividades diarias?', requisito: '8.1 Procesos operativos del SGSI', escalaEvaluacion: ['0 - Sin procesos.', '1 - Procesos informales.', '2 - Procesos parciales.', '3 - Procesos documentados y aplicados.', '4 - Procesos monitoreados y mejorados.'] },
    ],
    'Cláusula 9: Evaluación del desempeño': [
      { id: '9.1', pregunta: '¿La organización mide o da seguimiento al desempeño de sus prácticas y controles de seguridad?', requisito: '9.1 Seguimiento y medición', escalaEvaluacion: ['0 - Sin seguimiento.', '1 - Seguimiento informal.', '2 - Seguimiento parcial.', '3 - Seguimiento documentado.', '4 - Indicadores revisados y mejorados.'] },
      { id: '9.2', pregunta: '¿La organización realiza auditorías o revisiones periódicas sobre la gestión de seguridad de la información?', requisito: '9.2 Auditorías o revisiones', escalaEvaluacion: ['0 - Sin auditorías.', '1 - Revisiones informales.', '2 - Revisiones parciales.', '3 - Auditorías periódicas con evidencia.', '4 - Auditorías con seguimiento y mejora.'] },
      { id: '9.3', pregunta: '¿La dirección revisa periódicamente los resultados, riesgos y necesidades de mejora en seguridad de la información?', requisito: '9.3 Revisión por la dirección', escalaEvaluacion: ['0 - Sin revisión directiva.', '1 - Revisión informal.', '2 - Revisión parcial.', '3 - Revisión documentada por dirección.', '4 - Revisión con decisiones y mejoras.'] },
    ],
    'Cláusula 10: Mejora': [
      { id: '10.1', pregunta: '¿La organización analiza incidentes, fallos o desviaciones de seguridad y aplica acciones correctivas para evitar su repetición?', requisito: '10.1 Acciones correctivas', escalaEvaluacion: ['0 - Sin acciones correctivas.', '1 - Acciones reactivas.', '2 - Acciones parciales.', '3 - Acciones documentadas y aplicadas.', '4 - Acciones verificadas y mejoradas.'] },
      { id: '10.2', pregunta: '¿La organización cuenta con iniciativas o acciones para mejorar continuamente la seguridad de la información?', requisito: '10.2 Mejora continua', escalaEvaluacion: ['0 - Sin mejora.', '1 - Mejoras informales.', '2 - Mejoras parciales.', '3 - Mejoras documentadas.', '4 - Mejora continua implementada.'] },
    ],
    'Seguridad de la Información: Controles técnicos y operativos': [
      { id: 1, pregunta: '¿El control de accesos contempla alta, modificación y baja de usuarios, MFA, política de contraseñas, privilegios mínimos y aceptación de confidencialidad?', requisito: '1. Control de accesos y privilegios', escalaEvaluacion: ['0 - Sin control de accesos.', '1 - Accesos informales.', '2 - Controles parciales.', '3 - Accesos controlados y documentados.', '4 - Accesos revisados y mejorados.'] },
      { id: 2, pregunta: '¿Se mantiene un inventario actualizado de los activos tecnológicos relevantes para la operación?', requisito: '2. Inventario de activos tecnológicos', escalaEvaluacion: ['0 - No existe inventario.', '1 - Inventario informal.', '2 - Inventario parcial.', '3 - Inventario actualizado y documentado.', '4 - Inventario revisado y controlado.'] },
      { id: 3, pregunta: '¿Existe un Plan de Respuesta a Incidentes de seguridad, documentado y probado periódicamente?', requisito: '3. Respuesta a incidentes', escalaEvaluacion: ['0 - No existe plan.', '1 - Respuesta informal.', '2 - Plan parcial o sin pruebas.', '3 - Plan documentado y probado.', '4 - Plan actualizado y mejorado.'] },
      { id: 4, pregunta: '¿Se aplican controles para proteger datos sensibles, como clasificación, cifrado, DLP o separación de información crítica?', requisito: '4. Protección de datos sensibles', escalaEvaluacion: ['0 - Sin protección de datos.', '1 - Protección informal.', '2 - Controles parciales.', '3 - Controles documentados y aplicados.', '4 - Controles monitoreados y mejorados.'] },
      { id: 5, pregunta: '¿Se gestionan parches y actualizaciones de seguridad de forma oportuna y controlada?', requisito: '5. Gestión de parches y actualizaciones', escalaEvaluacion: ['0 - Sin gestión de parches.', '1 - Actualizaciones reactivas.', '2 - Gestión parcial.', '3 - Parches gestionados con evidencia.', '4 - Gestión monitoreada y optimizada.'] },
      { id: 6, pregunta: '¿Existen mecanismos de monitoreo y detección de amenazas, como SIEM, EDR, XDR, SOC o servicios administrados de seguridad?', requisito: '6. Monitoreo y detección de amenazas', escalaEvaluacion: ['0 - Sin monitoreo.', '1 - Monitoreo básico.', '2 - Monitoreo parcial.', '3 - Monitoreo implementado y gestionado.', '4 - Monitoreo continuo y optimizado.'] },
      { id: 7, pregunta: '¿Los equipos corporativos cuentan con protección contra malware o EDR, instalada, actualizada y administrada centralizadamente?', requisito: '7. Protección de equipos corporativos', escalaEvaluacion: ['0 - Equipos sin protección.', '1 - Protección básica.', '2 - Protección parcial.', '3 - Protección actualizada y administrada.', '4 - Protección monitoreada y optimizada.'] },
      { id: 8, pregunta: '¿Existen controles para proteger la red, el acceso remoto y los servicios expuestos, incluyendo segmentación WiFi, BYOD, VPN, revisión de puertos y reglas autorizadas?', requisito: '8. Seguridad de red, acceso remoto y servicios expuestos', escalaEvaluacion: ['0 - Sin controles de red.', '1 - Controles básicos.', '2 - Controles parciales.', '3 - Controles documentados y aplicados.', '4 - Controles revisados y mejorados.'] },
      { id: 9, pregunta: '¿Los proveedores que tratan información de la empresa cuentan con contratos, cláusulas de seguridad, SLA y evaluaciones periódicas?', requisito: '9. Gestión de proveedores', escalaEvaluacion: ['0 - Sin control de proveedores.', '1 - Gestión informal.', '2 - Control parcial.', '3 - Proveedores controlados contractualmente.', '4 - Proveedores evaluados y monitoreados.'] },
    ],
    'Inteligencia Artificial y LFPDPPP': [
      { id: 'IA-1', pregunta: 'IA: ¿La organización utiliza o planea utilizar inteligencia artificial y con qué objetivo principal?', evidencia: 'Áreas impactadas, Casos de uso actuales o planeados (ej. Copilot, chatbots, automatización)', nota: 'Cubre: Uso actual de IA, Objetivo de IA, Áreas impactadas, Necesidad inmediata vs mediano plazo' },
      { id: 'IA-2', pregunta: 'IA: ¿Qué nivel de automatización con IA se tiene o se planea implementar y qué riesgos o inquietudes se han identificado?', evidencia: 'Nivel: Automatización básica / Asistente con IA / Integración con sistemas internos. Riesgos percibidos (privacidad, control, errores, impacto laboral)', nota: 'Cubre: Chatbot completo, Inquietudes y temores, Nivel de autonomía, Integración con sistemas' },
      { id: 'DP-1', pregunta: '🔐 LFPDPPP: ¿La organización cumple con los requisitos básicos de la LFPDPPP (aviso de privacidad vigente, finalidades claras y consentimiento adecuado)?', evidencia: 'Aviso de privacidad, Fecha de actualización, Diferenciación de tipos de datos', nota: 'Cubre: Aviso de privacidad, Finalidades, Consentimiento expreso/tácito' },
      { id: 'DP-2', pregunta: '🔐 LFPDPPP: ¿La organización cuenta con medidas y procedimientos formales para la protección de datos personales (seguridad, ARCO, responsables y transferencias)?', evidencia: 'Procedimiento ARCO, Responsable designado, Medidas administrativas/técnicas/físicas, Contratos/cláusulas de transferencia', nota: 'Cubre: Procedimiento ARCO, Responsable de datos, Medidas de seguridad, Transferencias nacionales/internacionales' }
    ]
  };

  const pendingQuestions = React.useMemo(() => {
    const list = [];
    Object.entries(sections).forEach(([section, questions]) => {
      questions.forEach(q => {
        const key = `${section}-${q.id}`;
        if (responses[key]?.evaluacion === undefined) {
          list.push({ ...q, section });
        }
      });
    });
    return list;
  }, [responses]);

  const handleSuggestionClick = (section, id) => {
    setActiveSection(section);

    setTimeout(() => {
      const el = document.getElementById(`question-${section}-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-cyan-50/50', 'transition-colors', 'duration-500');
        setTimeout(() => el.classList.remove('bg-cyan-50/50'), 2000);
      }
    }, 100);
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
      'Cláusulas ISO 27001': [
        'Cláusula 4: Contexto de la organización',
        'Cláusula 5: Liderazgo',
        'Cláusula 6: Planificación',
        'Cláusula 7: Apoyo',
        'Cláusula 8: Operación',
        'Cláusula 9: Evaluación del desempeño',
        'Cláusula 10: Mejora',
      ],
      'Seguridad de la Información': ['Seguridad de la Información: Controles técnicos y operativos'],
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

  const getTotalQuestions = () =>
    Object.keys(sections).reduce((sum, section) => sum + (sections[section]?.length || 0), 0);

  const getAnsweredQuestions = () => {
    let answered = 0;
    Object.keys(sections).forEach((section) => {
      sections[section].forEach((q) => {
        const key = `${section}-${q.id}`;
        if (responses[key]?.evaluacion !== undefined) answered++;
      });
    });
    return answered;
  };

  const getScoreLevel = (score) => {
    // Mantiene los mismos niveles, pero normalizados por promedio (0-4),
    // para que sigan siendo consistentes al reducir o aumentar preguntas.
    if (score <= (55 / 46)) return { nivel: 'Crítico', descripcion: 'Urgente mejora en la postura de seguridad.', color: 'from-rose-950 to-slate-900' };
    if (score <= (85 / 46)) return { nivel: 'Básico', descripcion: 'Existen medidas iniciales, pero faltan controles clave.', color: 'from-amber-950 to-slate-900' };
    if (score <= (110 / 46)) return { nivel: 'Intermedio', descripcion: 'Buen nivel, requiere fortalecimiento y formalización.', color: 'from-sky-950 to-slate-900' };
    if (score <= (130 / 46)) return { nivel: 'Avanzado', descripcion: 'Seguridad sólida, enfocarse en optimización.', color: 'from-indigo-950 to-slate-900' };
    return { nivel: 'Óptimo', descripcion: 'Seguridad madura, alineada con mejores prácticas.', color: 'from-emerald-950 to-slate-900' };
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
    const totalQuestions = getTotalQuestions();
    const answeredCount = getAnsweredQuestions();

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









  const exportToExcel = async () => {
    try {
      const avgScore = calculateTotalScore();
      const totalScore = avgScore * getTotalQuestions();
      const scoreLevel = getScoreLevel(avgScore);
      const areaScores = calculateAreaScores();

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Auditoría de TI';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Reporte de Auditoría');

      // Helper to add a styled title
      const addHeader = (title) => {
        const row = sheet.addRow([title]);
        row.getCell(1).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
        sheet.mergeCells(row.number, 1, row.number, 6);
        return row;
      };

      // 1. Información General
      addHeader('INFORMACIÓN GENERAL');
      sheet.addRow(['Empresa', introData.nombreEmpresa || 'N/A']);
      sheet.addRow(['Nombre', introData.nombre || 'N/A']);
      sheet.addRow(['Puesto', introData.puesto || 'N/A']);
      sheet.addRow(['Contacto', introData.contacto || 'N/A']);
      sheet.addRow(['Giro de la empresa', introData.giro || 'N/A']);
      sheet.addRow(['Colaboradores', introData.colaboradores || 'N/A']);
      sheet.addRow(['Modalidad', introData.modalidad || 'N/A']);
      sheet.addRow(['Proporciona equipos', introData.proporcionaEquipos || 'N/A']);
      sheet.addRow(['Tipo de equipos', introData.tipoEquipos || 'N/A']);
      sheet.addRow(['Estructura TI', introData.estructuraTI || 'N/A']);
      sheet.addRow(['Dependencia de red', introData.dependenciaRed || 'N/A']);
      sheet.addRow(['Incidencias recientes', introData.incidenciasRecientes || 'N/A']);
      sheet.addRow([]);

      // 2. Puntuación General
      addHeader('PUNTUACIÓN GENERAL');
      sheet.addRow(['Puntuación Total', totalScore.toFixed(0)]);
      sheet.addRow(['Promedio', avgScore.toFixed(2)]);
      sheet.addRow(['Nivel', scoreLevel.nivel]);
      sheet.addRow(['Descripción', scoreLevel.descripcion]);
      sheet.addRow([]);

      // 3. Puntuación por Áreas
      addHeader('PUNTUACIÓN POR ÁREAS');
      const areaHeader = sheet.addRow(['Área', 'Porcentaje', 'Promedio', 'Respondidas', 'Total']);
      areaHeader.eachCell(c => { 
        c.font = { bold: true }; 
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; 
      });
      Object.entries(areaScores).forEach(([area, data]) => {
        sheet.addRow([area, `${data.percentage}%`, data.score, data.answered, data.total]);
      });
      sheet.addRow([]);

      // 4. Detalle
      addHeader('DETALLE DE EVALUACIÓN');
      const detailHeader = sheet.addRow(['Sección', 'ID', 'Pregunta', 'Evaluación', 'Evidencia', 'Observaciones']);
      detailHeader.eachCell(c => { 
        c.font = { bold: true }; 
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; 
      });

      Object.keys(sections).forEach(section => {
        sections[section].forEach(q => {
          const key = `${section}-${q.id}`;
          const r = responses[key] || {};
          const row = sheet.addRow([
            section,
            q.id,
            q.pregunta,
            r.evaluacion || 'Sin evaluar',
            r.evidencia || '',
            r.observaciones || ''
          ]);
          // Wrap text
          row.eachCell(c => { c.alignment = { wrapText: true, vertical: 'top' }; });
        });
      });

      // 5. Comentarios Generales
      if (generalComments) {
        sheet.addRow([]);
        addHeader('COMENTARIOS GENERALES (REPORTE FINAL)');
        const commentRow = sheet.addRow([generalComments]);
        sheet.mergeCells(commentRow.number, 1, commentRow.number, 6);
        commentRow.height = 100;
        commentRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      }

      // Format Columns
      sheet.getColumn(1).width = 25; // Sección / Área
      sheet.getColumn(2).width = 10; // ID / Porcentaje
      sheet.getColumn(3).width = 50; // Pregunta
      sheet.getColumn(4).width = 20; // Evaluación
      sheet.getColumn(5).width = 30; // Evidencia
      sheet.getColumn(6).width = 40; // Observaciones

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const nombreEmpresa = introData.nombreEmpresa ? introData.nombreEmpresa.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'empresa';
      saveAs(blob, `Auditoria_TI_${nombreEmpresa}.xlsx`);

    } catch (error) {
      console.error("Error al exportar Excel:", error);
      alert("Hubo un error al generar el archivo Excel.");
    }
  };

 



   if (step === 'gate') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-blue-900 p-4 md:p-8 flex flex-col items-center justify-center gap-6">
        
        {/* NUEVA AUDITORIA */}
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8 md:p-10 border-t-4 border-[#00d4ff]">
          <div className="flex flex-col items-center mb-8">
             <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                <Shield size={32} className="text-[#00d4ff]" />
             </div>
             <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 text-center">Auditoría de TI</h1>
             <p className="text-slate-500 mt-2 text-center text-sm font-medium">Configura tu nueva sesión de evaluación</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Nombre de la Empresa *</label>
              <input
                type="text"
                value={actor.nombreEmpresa}
                onChange={(e) => setActor(prev => ({ ...prev, nombreEmpresa: e.target.value }))}
                placeholder="Ej: ByteWise S.A. de C.V."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00d4ff] focus:border-transparent transition-all outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Nombre de quien audita *</label>
              <input
                type="text"
                value={actor.nombreAuditor}
                onChange={(e) => setActor(prev => ({ ...prev, nombreAuditor: e.target.value }))}
                placeholder="Ej: Oscar Pérez"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00d4ff] focus:border-transparent transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Rol en la evaluación *</label>
              <select
                value={actor.rol}
                onChange={(e) => setActor(prev => ({ ...prev, rol: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00d4ff] focus:border-transparent transition-all outline-none appearance-none"
              >
                <option value="">Selecciona tu rol...</option>
                <option value="Auditor">Auditor (Realiza la evaluación)</option>
                <option value="Cliente">Cliente (Contesta y aporta evidencia)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Contraseña de acceso (PIN) *</label>
              <input
                type="password"
                value={actor.contrasena}
                onChange={(e) => setActor(prev => ({ ...prev, contrasena: e.target.value }))}
                placeholder="Protege esta auditoría"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00d4ff] focus:border-transparent transition-all outline-none"
              />
            </div>

            <button
              onClick={async () => {
                if (!actor.nombreEmpresa.trim() || !actor.nombreAuditor.trim() || !actor.rol || !actor.contrasena.trim()) {
                  alert("Por favor llena todos los campos obligatorios, incluyendo la contraseña, para continuar.");
                  return;
                }
                const hashed = await hashPassword(actor.contrasena);
                setCurrentAuditId(Date.now().toString());
                setIntroData(prev => ({...prev, nombreEmpresa: actor.nombreEmpresa, nombre: actor.nombreAuditor}));
                setActor(prev => ({ ...prev, contrasenaHash: hashed, contrasena: '' }));
                setStep('form');
              }}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-xl hover:bg-slate-800 transition-all font-bold shadow-lg shadow-slate-900/20"
            >
              Comenzar Auditoría <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* AUDITORIAS GUARDADAS */}
        {savedAudits.length > 0 && (
          <div className="w-full max-w-xl bg-white/10 backdrop-blur rounded-2xl shadow-2xl p-6 md:p-8 border border-white/20">
             <h2 className="text-xl font-bold text-white mb-4">Auditorías Guardadas</h2>
             <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
               {savedAudits.map(audit => (
                 <div key={audit.id} className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm">
                   <div className="min-w-0 pr-2">
                     <div className="font-bold text-slate-800 text-base truncate">{audit.nombreEmpresa}</div>
                     <div className="text-xs text-slate-500 mt-1">
                        Modificado: {new Date(audit.lastModified).toLocaleDateString()} {new Date(audit.lastModified).toLocaleTimeString()} <br/>
                        Auditor: {audit.data?.actor?.nombreAuditor || 'N/A'}
                     </div>
                   </div>
                   <div className="flex gap-2 shrink-0">
                     <button
                       onClick={async () => {
                         const savedHash = audit.data?.actor?.contrasenaHash;
                         if (savedHash) {
                           const pin = window.prompt("Ingresa la contraseña de esta auditoría para acceder:");
                           if (pin === null) return; 
                           const enteredHash = await hashPassword(pin);
                           if (enteredHash !== savedHash) {
                             alert("Contraseña incorrecta. Acceso denegado.");
                             return;
                           }
                         }

                         setCurrentAuditId(audit.id);
                         setIntroData(audit.data.introData || {});
                         setResponses(audit.data.responses || {});
                         setGeneralComments(audit.data.generalComments || '');
                         setActor(audit.data.actor || { nombreAuditor:'', rol:'', contrasenaHash: savedHash || '' });
                         setStep('form');
                       }}
                       className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition shadow"
                     >
                       Cargar
                     </button>
                     <button
                       onClick={() => {
                         if(window.confirm(`¿Seguro que deseas borrar la auditoría de ${audit.nombreEmpresa}? Esta acción no se puede deshacer.`)) {
                           const newList = savedAudits.filter(a => a.id !== audit.id);
                           setSavedAudits(newList);
                           if (db) {
                             deleteDoc(doc(db, "auditorias", audit.id)).catch(e => console.error("Error borrando en Firebase:", e));
                           }
                         }
                       }}
                       className="px-3 py-2 bg-red-100 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-200 transition"
                     >
                       Borrar
                     </button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 p-4 md:p-8">
      <div className="absolute inset-0 pointer-events-none opacity-70 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22160%22%20height%3D%22160%22%3E%3Cdefs%3E%3Cpattern%20id%3D%22p%22%20width%3D%2232%22%20height%3D%2232%22%20patternUnits%3D%22userSpaceOnUse%22%3E%3Cpath%20d%3D%22M0%2032L32%200%22%20stroke%3D%22white%22%20stroke-opacity%3D%220.07%22%20stroke-width%3D%221%22/%3E%3Cpath%20d%3D%22M-8%2024L24%20-8%22%20stroke%3D%22white%22%20stroke-opacity%3D%220.05%22%20stroke-width%3D%221%22/%3E%3C/pattern%3E%3C/defs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23p)%22/%3E%3C/svg%3E')]"></div>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(900px_circle_at_25%_10%,rgba(0,212,255,0.18),transparent_55%)]"></div>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(900px_circle_at_80%_90%,rgba(255,255,255,0.06),transparent_55%)]"></div>
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-white/90 backdrop-blur shadow-xl border border-white/40 flex items-center justify-center hover:bg-white transition"
          aria-label="Subir al inicio"
          title="Subir al inicio"
        >
          <ChevronUp size={22} className="text-[#00d4ff]" />
        </button>
      )}
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Dashboard Compacto */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Columna 1: Resumen y Acciones */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-5 md:p-6 flex flex-col justify-between border border-gray-200">
            <div>
              <div className="flex items-start justify-between mb-1 gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-[#00d4ff] leading-tight">
                  Auditoría de TI
                </h1>
                <img
                  src={logoPng}
                  alt="ByteWise"
                  className="h-7 md:h-9 w-auto object-contain mt-1 shrink-0"
                />
              </div>
              <p className="text-xs text-gray-500 mb-6">Evaluación integral de infraestructura y seguridad</p>
              
              {/* Score Dashboard */}
              <div className="space-y-3">
                <div className={`bg-gradient-to-r ${getScoreLevel(calculateTotalScore()).color} rounded-md p-4 text-white shadow-sm border border-white/10`}>
                  <div className="text-xs opacity-90 mb-1">Puntuación Total</div>
                  <div className="text-3xl font-bold">{(calculateTotalScore() * getTotalQuestions()).toFixed(0)} pts</div>
                  <div className="text-xs mt-1 font-semibold">{getScoreLevel(calculateTotalScore()).nivel}</div>
                </div>
                
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-md p-4 text-white shadow-sm border border-white/10">
                  <div className="flex justify-between items-end mb-1">
                    <div className="text-xs opacity-90">Avance</div>
                    <div className="text-lg font-bold">{((getAnsweredQuestions() / getTotalQuestions()) * 100).toFixed(0)}%</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-1.5">
                    <div className="h-1.5 rounded-full bg-[#00d4ff] transition-all duration-500" style={{ width: `${(getAnsweredQuestions() / getTotalQuestions()) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-400 text-right">{getAnsweredQuestions()}/{getTotalQuestions()} respondidas</div>
                </div>
              </div>
            </div>

            {/* Acciones Rápidas */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={exportToDocxPro} className="flex-1 text-xs items-center justify-center gap-1.5 bg-slate-900 text-white px-3 py-2.5 rounded-md hover:bg-slate-800 transition-all flex shadow-sm">
                <FileText size={14} /> Word
              </button>
              <button onClick={exportToExcel} className="flex-1 text-xs items-center justify-center gap-1.5 bg-white text-slate-900 px-3 py-2.5 rounded-md hover:bg-slate-50 transition-all border border-slate-200 flex shadow-sm">
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={startNewEvaluation} className="w-full mt-1 text-xs items-center justify-center gap-1.5 bg-white text-red-600 px-3 py-2.5 rounded-md hover:bg-red-50 transition-all border border-red-200 flex shadow-sm">
                <RefreshCw size={14} /> Reiniciar
              </button>
            </div>
          </div>

          {/* Columna 2: Puntuación por Áreas */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-5 md:p-6 border border-gray-200 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Desglose por Áreas</h2>
              <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-1 rounded-full font-semibold">Tiempo Real</span>
            </div>
            
            {(() => {
              const getAreaIcon = (areaName) => {
                if (areaName === 'Infraestructura del Site') return <Building2 size={16} className="text-cyan-600" />;
                if (areaName === 'Seguridad de la Información') return <Shield size={16} className="text-cyan-600" />;
                if (areaName === 'Cláusulas ISO 27001') return <FileText size={16} className="text-cyan-600" />;
                if (areaName === 'IA y LFPDPPP') return <Brain size={16} className="text-cyan-600" />;
                return <Hash size={16} className="text-cyan-600" />;
              };

              const rows = Object.entries(calculateAreaScores());
              return (
                <div className="flex flex-col gap-4 h-full content-start mt-2">
                  {rows.map(([area, data]) => {
                    const answeredPct = data.total > 0 ? (data.answered / data.total) * 100 : 0;
                    return (
                      <div key={area} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center shrink-0">
                            {getAreaIcon(area)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-gray-800 truncate pr-2" title={area}>{area}</div>
                            <div className="flex items-center gap-2 mt-1">
                               <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-1 bg-[#00d4ff] rounded-full transition-all duration-500" style={{ width: `${answeredPct}%` }} />
                               </div>
                               <span className="text-[10px] text-gray-400">{data.answered}/{data.total}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <div className="font-bold text-sm text-slate-800">{data.percentage}%</div>
                          <div className="text-[10px] text-gray-500 font-medium">{data.score} / 4</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Secciones y Navegación Lateral */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Menú Lateral (Sidebar) */}
          <div className="w-full md:w-1/4 flex-shrink-0 space-y-2 sticky top-4 self-start max-h-[90vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">Navegación</h3>
            
            <button
              onClick={() => setActiveSection('Información General')}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-between ${
                activeSection === 'Información General' 
                ? 'bg-cyan-50 text-cyan-700 border-l-4 border-cyan-500 shadow-sm' 
                : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
              }`}
            >
              <span className="truncate">Información General</span>
            </button>

            {Object.keys(sections).map((section) => {
              const questions = sections[section];
              let answered = 0;
              questions.forEach(q => {
                if (responses[`${section}-${q.id}`]?.evaluacion !== undefined) answered++;
              });
              const isComplete = answered === questions.length && questions.length > 0;

              return (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-between ${
                    activeSection === section 
                    ? 'bg-purple-50 text-purple-700 border-l-4 border-purple-500 shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
                  }`}
                >
                  <span className="truncate mr-2" title={section}>{section}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {answered}/{questions.length}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setActiveSection('Reporte Final')}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-between mt-6 ${
                activeSection === 'Reporte Final' 
                ? 'bg-amber-50 text-amber-700 border-l-4 border-amber-500 shadow-sm' 
                : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
              }`}
            >
              <span className="truncate">Reporte Final</span>
            </button>
          </div>

          {/* Área de Contenido Principal */}
          <div className="w-full md:w-3/4 flex-grow">
            
            {/* Sección de Información General Activa */}
            {activeSection === 'Información General' && (
              <div className="mb-4 bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="p-6 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Información General</h2>
                    <p className="text-sm text-slate-600">Datos de identificación (no generan puntuación)</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
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
          </div>
        )}

            {/* Sección de Reporte Final */}
            {activeSection === 'Reporte Final' && (
              <div className="mb-4 bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="p-6 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Reporte Final</h2>
                    <p className="text-sm text-slate-600">Conclusiones, hallazgos principales y comentarios de cierre.</p>
                  </div>
                </div>
                
                <div className="p-6 relative">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Comentarios Generales para el Reporte
                  </label>

                  <textarea
                    value={generalComments}
                    onChange={(e) => setGeneralComments(e.target.value)}
                    rows={12}
                    placeholder="Escribe o dicta las conclusiones de la auditoría..."
                    className="w-full whitespace-pre-wrap px-4 py-3 border-2 border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />

                  <button
                    type="button"
                    onClick={rewriteCommentsWithAI}
                    disabled={!canRewrite}
                    title={!hasComments ? 'Escribe comentarios para habilitar' : (rewriting ? 'Mejorando...' : 'Mejorar con IA')}
                    className={[
                      "absolute top-9 right-9 w-9 h-9 rounded-full flex items-center justify-center",
                      "border border-gray-200 bg-white shadow-sm transition",
                      canRewrite ? "hover:shadow-md hover:scale-105" : "opacity-40 cursor-not-allowed",
                      rewriting ? "animate-pulse" : ""
                    ].join(" ")}
                  >
                    <Sparkles size={18} className={canRewrite ? "text-indigo-600" : "text-gray-400"} />
                  </button>
                </div>
              </div>
            )}

        {/* Secciones de evaluación activas */}
            {Object.keys(sections).map(section => {
              if (section !== activeSection) return null;
              return (
                <div key={section} className="mb-4 bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="p-6 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">{section}</h2>
                      <p className="text-sm text-gray-500">
                        {sections[section].length} preguntas • Promedio actual: <span className="font-bold text-cyan-600">{calculateSectionScore(section)}/4</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-6 space-y-8">
                {sections[section].map(item => {
                  const key = `${section}-${item.id}`;
                  const response = responses[key] || {};
                  
                  return (
                    <div key={item.id} id={`question-${section}-${item.id}`} className="border-l-4 border-purple-500 pl-4 py-2 transition-all duration-500 rounded-r-lg">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded text-sm font-semibold">
                          {item.id}
                        </span>
                        <p className="text-gray-700 flex-1">{item.pregunta}</p>
                      </div>

                      {item.requisito && (
                        <p className="text-xs text-gray-500 italic mb-3 flex items-center gap-1.5"><FileText size={14} className="shrink-0" /> {item.requisito}</p>
                      )}

                      {item.nota && (
                        <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded mb-3 flex items-center gap-1.5">
                          <CheckCircle size={14} className="shrink-0" /> {item.nota}
                        </p>
                      )}

                      {item.evidencia && (
                        <p className="text-xs text-blue-600 mb-3 flex items-center gap-1.5">
                          <Search size={14} className="shrink-0" /> Evidencia sugerida: {item.evidencia}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Evaluación (0-4)
                          </label>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-800">
                            <div className="font-bold mb-1">Escala de Evaluación:</div>
                            {(item.escalaEvaluacion || GENERIC_EVALUATION_SCALE).map((line, index) => (
                              <div key={`${item.id}-${index}`}>{line}</div>
                            ))}
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
                        <div className="flex justify-between items-end mb-2">
                          <label className="block text-sm font-semibold text-gray-700">
                            Observaciones
                          </label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startInlineDictation(section, item.id)}
                              className={`p-1.5 rounded-md transition-all shadow-sm flex items-center gap-1 text-xs font-semibold ${dictatingKey === key ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-gray-200 text-slate-600 hover:bg-slate-50'}`}
                              title={dictatingKey === key ? "Detener dictado" : "Dictar observación"}
                            >
                              <Mic size={14} /> {dictatingKey === key ? "Escuchando..." : "Dictar"}
                            </button>
                            <button
                              onClick={() => rewriteObservationWithAI(section, item)}
                              disabled={rewritingKey === key || !response.observaciones}
                              className={`p-1.5 rounded-md transition-all shadow-sm flex items-center gap-1 text-xs font-semibold ${rewritingKey === key ? 'bg-purple-100 text-purple-600 animate-pulse' : !response.observaciones ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-md hover:scale-105'}`}
                              title="Mejorar redacción con IA"
                            >
                              <Sparkles size={14} /> IA
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={response.observaciones || ''}
                          onChange={(e) => updateResponse(section, item.id, 'observaciones', e.target.value)}
                          placeholder="Dicta o escribe tus hallazgos, luego presiona el botón IA para estructurarlo..."
                          rows="3"
                          className={`w-full px-4 py-2 border-2 rounded-lg resize-y transition-colors ${dictatingKey === key ? 'border-red-400 bg-red-50/30' : 'border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-transparent'}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      </div>
      
      {step === 'form' && (
        <AudioAssistant 
          pendingQuestions={pendingQuestions} 
          onSuggestionClick={handleSuggestionClick} 
        />
      )}
    </div>
  );
};

export default AuditForm;
