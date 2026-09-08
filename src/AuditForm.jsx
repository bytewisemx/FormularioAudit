import { DEFAULT_SECTIONS } from "./defaultSections";

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Download, FileText, FileSpreadsheet, RefreshCw, Mic, Sparkles, Building2, Shield, Brain, Hash, CheckCircle, Search, Settings, Share2, KeyRound, Trash2, Home, Plus, X, Globe, Copy, Check, ExternalLink, Loader2, Upload, FileCode, Layers, ArrowLeft, Calendar, User, BarChart2 } from 'lucide-react';
import { downloadExcelTemplate, parseQuestionsFile } from './excelTemplateHelper';
import { db, auth } from "./firebase";
import { collection, doc, setDoc, getDoc, updateDoc, getDocs, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import LoginScreen from "./components/LoginScreen";
import AccessManagement from "./components/AccessManagement";
import GuestPinScreen from "./components/GuestPinScreen";

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
import EditQuestionsModal from "./components/EditQuestionsModal";
import { Edit2 } from "lucide-react";
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

const sortSections = (sections) => {
  if (!sections) return {};
  const defaultKeys = Object.keys(DEFAULT_SECTIONS);
  const sectionsKeys = Object.keys(sections);

  const sortedKeys = [...sectionsKeys].sort((a, b) => {
    const idxA = defaultKeys.indexOf(a);
    const idxB = defaultKeys.indexOf(b);
    
    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB;
    }
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    
    return a.localeCompare(b);
  });

  const sortedObj = {};
  sortedKeys.forEach(k => {
    sortedObj[k] = sections[k];
  });
  return sortedObj;
};

const INITIAL_INTRO_DATA = {
  nombreEmpresa: '',
  giro: '',
  contacto: '',
  fecha: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
  sitioWeb: '',
  preliminarEmpresa: ''
};

let clientId = '';
if (typeof window !== 'undefined') {
  clientId = sessionStorage.getItem('audit_client_id');
  if (!clientId) {
    clientId = 'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    sessionStorage.setItem('audit_client_id', clientId);
  }
}

// Auxiliar para extraer métricas detalladas de cada auditoría guardada
const getAuditSummary = (audit) => {
  const sections = audit.data?.customSections || {};
  const responses = audit.data?.responses || {};
  let totalQuestions = 0;
  let answeredQuestions = 0;
  let totalScore = 0;

  Object.entries(sections).forEach(([section, questions]) => {
    if (Array.isArray(questions)) {
      questions.forEach(q => {
        totalQuestions++;
        const key = `${section}-${q.id}`;
        const val = responses[key]?.evaluacion;
        if (val !== undefined && val !== null && val !== '') {
          answeredQuestions++;
          totalScore += parseInt(val, 10);
        }
      });
    }
  });

  const avgScore = answeredQuestions > 0 ? (totalScore / answeredQuestions).toFixed(1) : '0.0';
  const percentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const areasCount = Object.keys(sections).length;

  let level = { label: 'Sin evaluar', badgeClass: 'text-slate-600 bg-slate-100 border-slate-300' };
  if (answeredQuestions > 0) {
    const scoreNum = parseFloat(avgScore);
    if (scoreNum >= 3.5) level = { label: 'Nivel 4: Optimizado', badgeClass: 'text-emerald-800 bg-emerald-100 border-emerald-300' };
    else if (scoreNum >= 2.5) level = { label: 'Nivel 3: Gestionado', badgeClass: 'text-cyan-800 bg-cyan-100 border-cyan-300' };
    else if (scoreNum >= 1.5) level = { label: 'Nivel 2: Parcial', badgeClass: 'text-amber-800 bg-amber-100 border-amber-300' };
    else level = { label: 'Nivel 1: Inicial / Crítico', badgeClass: 'text-rose-800 bg-rose-100 border-rose-300' };
  }

  return {
    totalQuestions,
    answeredQuestions,
    percentage,
    avgScore,
    areasCount,
    level
  };
};

const getDefaultSections = () => JSON.parse(JSON.stringify(DEFAULT_SECTIONS));

const AuditForm = () => {


  const [customSections, setCustomSections] = useState(() => getDefaultSections());
  const [blockedBy, setBlockedBy] = useState(null);
  const [blockedAuditToLoad, setBlockedAuditToLoad] = useState(null);
  const [expandedSections, setExpandedSections] = useState({ 'Información General': true });
  const [showEditModal, setShowEditModal] = useState(false);
  const [responses, setResponses] = useState({});
  const [generalComments, setGeneralComments] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [introData, setIntroData] = useState(INITIAL_INTRO_DATA);
  const [rewriting, setRewriting] = useState(false);
  const [dictatingKey, setDictatingKey] = useState(null);
  const [rewritingKey, setRewritingKey] = useState(null);
  const [activeSection, setActiveSection] = useState('Información General');
  
  const [savedAudits, setSavedAudits] = useState([]);
  const [currentAuditId, setCurrentAuditId] = useState(null);
  const [step, setStep] = useState('dashboard'); // 'dashboard' | 'gate' | 'form' | 'access_management' | 'blocked'
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [actor, setActor] = useState({ nombreEmpresa: '', nombreAuditor: '', rol: '', contrasena: '', contrasenaHash: '' });
  const [isGuestMode, setIsGuestMode] = useState(() => {
    return !!new URLSearchParams(window.location.search).get('id');
  });
  const [guestAuditToLoad, setGuestAuditToLoad] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [addingSubFor, setAddingSubFor] = useState(null);
  const [subpromptText, setSubpromptText] = useState('');
  const [isGeneratingSub, setIsGeneratingSub] = useState(false);
  const [isInvestigatingCompany, setIsInvestigatingCompany] = useState(false);
  const [copiedPreliminar, setCopiedPreliminar] = useState(false);
  
  const [creationMode, setCreationMode] = useState('base'); // 'base' | 'blank' | 'import'
  const [importedSections, setImportedSections] = useState(null);
  const [importedFileName, setImportedFileName] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');

  const handleGateFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const result = await parseQuestionsFile(file);
      setImportedSections(result.parsed);
      setImportFileName(file.name);
      setImportSummary({
        areasCount: result.areasCount,
        questionsCount: result.questionsCount
      });
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Error al leer el archivo. Asegúrate de que sea un archivo de Excel (.xlsx) o .json válido.");
      setImportedSections(null);
      setImportFileName('');
      setImportSummary(null);
    } finally {
      e.target.value = '';
    }
  };

  const resetToInitialState = () => {
    setCurrentAuditId(null);
    setActor({ nombreEmpresa: '', nombreAuditor: '', rol: '', contrasena: '', contrasenaHash: '' });
    setIntroData(INITIAL_INTRO_DATA);
    setResponses({});
    setGeneralComments('');
    setCustomSections(getDefaultSections());
    setExpandedSections({ 'Información General': true });
    setActiveSection('Información General');
    setShowSettings(false);
    setShowExportMenu(false);
    setAddingSubFor(null);
    setSubpromptText('');
    setCreationMode('base');
    setImportedSections(null);
    setImportFileName('');
    setImportSummary(null);
    setImportError('');
  };

  const handleLoadAudit = async (audit) => {
    const savedHash = audit.data?.actor?.contrasenaHash;
    if (savedHash) {
      const pin = window.prompt("Ingresa la contraseña o PIN de esta auditoría para acceder:");
      if (pin === null) return; 
      const enteredHash = await hashPassword(pin);
      if (enteredHash !== savedHash) {
        alert("Contraseña incorrecta. Acceso denegado.");
        return;
      }
    }

    const lockAcquired = await acquireLock(audit.id, audit);
    if (lockAcquired) {
      setCurrentAuditId(audit.id);
      setIntroData(audit.data?.introData || INITIAL_INTRO_DATA);
      setResponses(audit.data?.responses || {});
      setCustomSections(sortSections(audit.data?.customSections || getDefaultSections()));
      setGeneralComments(audit.data?.generalComments || '');
      setActor(audit.data?.actor || { nombreAuditor: '', rol: '', contrasenaHash: savedHash || '' });
      setStep('form');
    }
  };

  const handleDeleteAudit = async (audit, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const nombre = audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || 'esta auditoría';
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la auditoría de "${nombre}"?\nEsta acción no se puede deshacer.`)) {
      return;
    }

    const savedHash = audit.data?.actor?.contrasenaHash;
    if (savedHash) {
      const pin = window.prompt("Esta auditoría está protegida con PIN. Ingresa el PIN para autorizar la eliminación:");
      if (pin === null) return;
      const enteredHash = await hashPassword(pin);
      if (enteredHash !== savedHash) {
        alert("PIN incorrecto. No se pudo eliminar la auditoría.");
        return;
      }
    }

    try {
      if (db) {
        await deleteDoc(doc(db, "auditorias", audit.id));
      }
      setSavedAudits(prev => prev.filter(a => a.id !== audit.id));
    } catch (err) {
      console.error("Error al eliminar la auditoría:", err);
      alert("Ocurrió un error al eliminar la auditoría en la base de datos.");
    }
  };

  useEffect(() => {
    if (!auth) {
      setAuthChecking(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadAudits = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const auditId = urlParams.get('id');
      if (!user && !auditId) {
        setAuditsLoading(false);
        return;
      }
      try {
        if (!db) return;
        const querySnapshot = await getDocs(collection(db, "auditorias"));
        const audits = [];
        querySnapshot.forEach((docSnap) => {
          audits.push(docSnap.data());
        });
        audits.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        setSavedAudits(audits);

        if (auditId) {
          setIsGuestMode(true);
          const targetAudit = audits.find(a => a.id === auditId);
          if (targetAudit) {
            const savedHash = targetAudit.data?.actor?.contrasenaHash;
            const alreadyGranted = sessionStorage.getItem(`guest_granted_${targetAudit.id}`) === 'true';

            if (savedHash && !alreadyGranted) {
              setGuestAuditToLoad(targetAudit);
              return;
            } else {
              acquireLock(targetAudit.id, targetAudit).then((success) => {
                if (success) {
                  setCurrentAuditId(targetAudit.id);
                  setIntroData(targetAudit.data.introData || {});
                  setResponses(targetAudit.data.responses || {});
                  setCustomSections(sortSections(targetAudit.data.customSections || getDefaultSections()));
                  setGeneralComments(targetAudit.data.generalComments || '');
                  setActor(targetAudit.data.actor || { nombreAuditor:'', rol:'', contrasenaHash: savedHash || '' });
                  setStep('form');
                }
              });
            }
          }
        }

      } catch (e) {
        console.error("Error cargando auditorías desde Firebase:", e);
      } finally {
        setAuditsLoading(false);
      }
    };
    loadAudits();
  }, [user]);

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
         data: { introData, responses, generalComments, actor, customSections }
       };
       if (index >= 0) {
         newList[index] = auditData;
       } else {
         newList.push(auditData);
       }
       setSavedAudits(newList);
       
       let timer;
       if (db) {
         timer = setTimeout(() => {
           try {
             const docRef = doc(db, "auditorias", currentAuditId);
             setDoc(docRef, auditData)
               .then(() => console.log("Auditoría guardada exitosamente en Firebase (debounced)."))
               .catch(e => console.error("Error al guardar en Firebase:", e));
           } catch(e) {}
         }, 1500);
       }

       return () => {
         if (timer) clearTimeout(timer);
       };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introData, responses, generalComments, actor, customSections, currentAuditId, step]);

  useEffect(() => {
    if (step !== 'form' || !currentAuditId || !db) return;

    const interval = setInterval(async () => {
      try {
        const docRef = doc(db, "auditorias", currentAuditId);
        await setDoc(docRef, {
          editingStatus: {
            isBeingEdited: true,
            clientId: clientId,
            userIdent: auth.currentUser?.email || actor.nombreAuditor || 'Invitado',
            lastActive: new Date().toISOString()
          }
        }, { merge: true });
        console.log("Bloqueo de edición extendido (heartbeat).");
      } catch (e) {
        console.error("Error en heartbeat de Firebase:", e);
      }
    }, 25000);

    return () => {
      clearInterval(interval);
    };
  }, [step, currentAuditId, actor.nombreAuditor, user]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (db && currentAuditId && step === 'form') {
        const docRef = doc(db, "auditorias", currentAuditId);
        setDoc(docRef, {
          editingStatus: {
            isBeingEdited: false,
            clientId: "",
            userIdent: "",
            lastActive: ""
          }
        }, { merge: true }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentAuditId, step]);

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
      "https://n8n-n8n.bg5sbc.easypanel.host/webhook/cd537a01-7f79-4b98-b05b-0c681e507dbe",
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
     * - Toma SOLO el resultado reescrito (soporta rewritten, output y text)
     * - Convierte \n visibles en saltos reales
     * - Elimina llaves o wrappers si llegan por error
     */
    let cleanText = String(data.rewritten || data.output || data.text || (typeof data === 'string' ? data : JSON.stringify(data)))
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
      "https://n8n-n8n.bg5sbc.easypanel.host/webhook/cd537a01-7f79-4b98-b05b-0c681e507dbe",
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
    let cleanText = String(data.rewritten || data.output || data.text || (typeof data === 'string' ? data : JSON.stringify(data)))
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

const generateSubquestionWithAI = async (itemQuestionText) => {
  if (!subpromptText.trim()) return alert("Escribe de qué se trata la subpregunta primero.");
  
  setIsGeneratingSub(true);
  try {
    const res = await fetch(
      "https://n8n-n8n.bg5sbc.easypanel.host/webhook/cd537a01-7f79-4b98-b05b-0c681e507dbe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "bw_ai_comments_9F3xL8Qp_2026",
        },
        body: JSON.stringify({
          text: `[INSTRUCCIÓN: Actúa como un redactor técnico de auditorías de TI. Genera una sola PREGUNTA GUÍA O SUBPREGUNTA sugerida para profundizar y obtener más información del auditado. Esta subpregunta se colgará de una pregunta principal. No redactes respuestas ni observaciones, debe ser estrictamente una pregunta interrogativa. El tema o contexto que debe indagar la subpregunta es: "${subpromptText}". La pregunta principal relacionada es: "${itemQuestionText}"].\n\nDevuelve únicamente la pregunta generada en formato de pregunta profesional (utilizando signos de interrogación).`,
          context: {
            tipo: "pregunta_auditoria_sugerida",
            pregunta_padre: itemQuestionText
          }
        }),
      }
    );

    if (!res.ok) throw new Error("Error en webhook de IA");
    const data = await res.json();
    let cleanText = String(data.rewritten || data.output || data.text || (typeof data === 'string' ? data : JSON.stringify(data)))
      .replace(/^({\s*)?"?rewritten"?\s*:\s*"?/i, "") 
      .replace(/"}\s*$/, "")                          
      .replace(/\\n/g, "\n")                           
      .replace(/\\r/g, "")
      .replace(/"\s*$/, "")  
      .replace(/\s*}\s*$/, "") 
      .trim();

    setSubpromptText(cleanText);
  } catch (e) {
    console.error(e);
    alert("Error al generar la subpregunta sugerida.");
  } finally {
    setIsGeneratingSub(false);
  }
};

const investigateCompanyWithAI = async (overrideUrl = null) => {
  let rawUrl = (overrideUrl !== null ? overrideUrl : (introData.sitioWeb || '')).trim();
  if (!rawUrl) {
    alert("Por favor ingresa la URL o página web de la empresa (ej: https://empresa.com)");
    return;
  }

  if (!/^https?:\/\//i.test(rawUrl)) {
    rawUrl = 'https://' + rawUrl;
    updateIntroData('sitioWeb', rawUrl);
  }

  setIsInvestigatingCompany(true);

  try {
    let siteContent = '';
    let fetchSuccess = false;

    // 1. Intentar obtener contenido público con Jina Reader (timeout seguro)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8500);
      const jinaRes = await fetch(`https://r.jina.ai/${rawUrl}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (jinaRes.ok) {
        const rawText = await jinaRes.text();
        if (rawText && rawText.length > 80) {
          siteContent = rawText.slice(0, 3800);
          fetchSuccess = true;
        }
      }
    } catch (fetchErr) {
      console.warn("Jina Reader no pudo extraer directamente (continuando con análisis de dominio/contexto):", fetchErr);
    }

    // 2. Construir prompt estructurado para el webhook
    const companyName = introData.nombreEmpresa || 'la empresa';
    const promptInstruction = `[INSTRUCCIÓN: Actúa como Auditor Líder Senior en Ciberseguridad y Auditoría de TI (ISO 27001, NIST CSF, CIS Controls).
Realiza una investigación preliminar ejecutiva y de inteligencia para orientar la auditoría de TI de la empresa "${companyName}" a partir de su página web: ${rawUrl}.

${fetchSuccess ? `Contenido público extraído del sitio web:\n${siteContent}\n` : `(Nota: No se pudo scrapear en vivo por restricciones de red del servidor, analiza con base en el dominio ${rawUrl}, nombre de la empresa "${companyName}" y patrones de la industria correspondiente).`}

Debes estructurar el resultado estrictamente en estas 3 secciones con formato Markdown profesional y títulos legibles:

### 1. Giro Comercial y Modelo Operativo
(Describe cómo se manejan, a qué se dedican, sus principales productos o servicios y el mercado o clientes a los que atienden).

### 2. Estructura Organizacional y Perfil Tecnológico Probable
(Describe su estructura organizativa estimada, áreas operativas clave y las tecnologías, plataformas cloud o infraestructura que probablemente utilizan para operar).

### 3. Estimación de Seguridad de la Información y Riesgos Potenciales
(Evalúa cómo se prevé su situación y madurez de seguridad, posibles brechas o puntos ciegos comunes para este perfil, normativas aplicables y qué aspectos críticos debe vigilar con prioridad el auditor durante esta evaluación).

Aporta valor concreto, análisis certero y profesionalismo técnico.]`;

    // 3. Llamar al webhook de IA
    const res = await fetch(
      "https://n8n-n8n.bg5sbc.easypanel.host/webhook/cd537a01-7f79-4b98-b05b-0c681e507dbe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "bw_ai_comments_9F3xL8Qp_2026",
        },
        body: JSON.stringify({
          text: promptInstruction,
          context: {
            tipo: "investigacion_preliminar_empresa",
            url: rawUrl,
            empresa: companyName,
            fetchSuccess: fetchSuccess
          }
        })
      }
    );

    if (!res.ok) throw new Error("Error en webhook de IA");
    const data = await res.json();
    let cleanText = String(data.output || data.rewritten || data.text || (typeof data === 'string' ? data : JSON.stringify(data)))
      .replace(/^({\s*)?"?rewritten"?\s*:\s*"?/i, "")
      .replace(/^({\s*)?"?output"?\s*:\s*"?/i, "")
      .replace(/"}\s*$/, "")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/"\s*$/, "")
      .replace(/\s*}\s*$/, "")
      .trim();

    updateIntroData('preliminarEmpresa', cleanText);
  } catch (err) {
    console.error(err);
    alert("Ocurrió un error al realizar la investigación preliminar con IA. Por favor verifica la URL e inténtalo nuevamente.");
  } finally {
    setIsInvestigatingCompany(false);
  }
};

const saveSubquestion = (section, itemId) => {
  if (!subpromptText.trim()) return alert("La subpregunta no puede estar vacía.");
  
  setCustomSections(prev => {
    const newSections = { ...prev };
    const questions = [...(newSections[section] || [])];
    const qIndex = questions.findIndex(q => q.id === itemId);
    if (qIndex !== -1) {
      const q = { ...questions[qIndex] };
      const subs = [...(q.subquestions || [])];
      subs.push({
        id: 'sub_' + Date.now(),
        texto: subpromptText.trim()
      });
      q.subquestions = subs;
      questions[qIndex] = q;
      newSections[section] = questions;
    }
    return newSections;
  });
  
  setAddingSubFor(null);
  setSubpromptText('');
};

const deleteSubquestion = (section, itemId, subId) => {
  if (!window.confirm("¿Seguro que deseas eliminar esta pregunta sugerida?")) return;
  setCustomSections(prev => {
    const newSections = { ...prev };
    const questions = [...(newSections[section] || [])];
    const qIndex = questions.findIndex(q => q.id === itemId);
    if (qIndex !== -1) {
      const q = { ...questions[qIndex] };
      q.subquestions = (q.subquestions || []).filter(sub => sub.id !== subId);
      questions[qIndex] = q;
      newSections[section] = questions;
    }
    return newSections;
  });
};

const updateSubquestionResponse = (section, itemId, subId, respuestaVal) => {
  setCustomSections(prev => {
    const newSections = { ...prev };
    const questions = [...(newSections[section] || [])];
    const qIndex = questions.findIndex(q => q.id === itemId);
    if (qIndex !== -1) {
      const q = { ...questions[qIndex] };
      const subs = (q.subquestions || []).map(sub => {
        if (sub.id === subId) {
          return { ...sub, respuesta: respuestaVal };
        }
        return sub;
      });
      q.subquestions = subs;
      questions[qIndex] = q;
      newSections[section] = questions;
    }
    return newSections;
  });
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
  // (State moved to top for auto-save logic)


  const acquireLock = async (auditId, targetAuditData = null) => {
    if (!db) return true;
    try {
      let audit = targetAuditData;
      const docRef = doc(db, "auditorias", auditId);
      if (!audit) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          audit = docSnap.data();
        }
      }

      if (audit && audit.editingStatus) {
        const status = audit.editingStatus;
        const now = Date.now();
        const lastActiveTime = status.lastActive ? new Date(status.lastActive).getTime() : 0;
        if (status.isBeingEdited && status.clientId !== clientId && (now - lastActiveTime < 60000)) {
          setBlockedBy(status.userIdent || "Otro auditor");
          setBlockedAuditToLoad(audit);
          setStep('blocked');
          return false;
        }
      }

      await setDoc(docRef, {
        editingStatus: {
          isBeingEdited: true,
          clientId: clientId,
          userIdent: auth.currentUser?.email || actor.nombreAuditor || 'Invitado',
          lastActive: new Date().toISOString()
        }
      }, { merge: true });
      
      console.log("Bloqueo de edición adquirido.");
      return true;
    } catch (e) {
      console.error("Error al intentar adquirir el bloqueo:", e);
      return true;
    }
  };

  const releaseLock = async (auditIdToRelease = null) => {
    const targetId = auditIdToRelease || currentAuditId;
    if (db && targetId) {
      try {
        const docRef = doc(db, "auditorias", targetId);
        await setDoc(docRef, {
          editingStatus: {
            isBeingEdited: false,
            clientId: "",
            userIdent: "",
            lastActive: ""
          }
        }, { merge: true });
        console.log("Bloqueo de edición liberado.");
      } catch (e) {
        console.error("Error al liberar el bloqueo:", e);
      }
    }
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
      setIntroData(INITIAL_INTRO_DATA);
      setCustomSections(getDefaultSections());
      setExpandedSections({ 'Información General': true });
      setActiveSection('Información General');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const pendingQuestions = React.useMemo(() => {
    const list = [];
    Object.entries(customSections).forEach(([section, questions]) => {
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
    const questions = customSections[section];
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
        if (customSections[section]) {
          customSections[section].forEach(q => {
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
    
    Object.keys(customSections).forEach(section => {
      customSections[section].forEach(q => {
        const key = `${section}-${q.id}`;
        if (responses[key]?.evaluacion !== undefined) {
          total += parseInt(responses[key].evaluacion);
          count++;
        }
      });
    });
    
    return count > 0 ? (total / count) : 0;
  };

  const calculateTotalRealScore = () => {
    let total = 0;
    Object.keys(customSections).forEach(section => {
      customSections[section].forEach(q => {
        const key = `${section}-${q.id}`;
        if (responses[key]?.evaluacion !== undefined) {
          total += parseInt(responses[key].evaluacion);
        }
      });
    });
    return total;
  };

  const getTotalQuestions = () =>
    Object.keys(customSections).reduce((sum, section) => sum + (customSections[section]?.length || 0), 0);

  const getAnsweredQuestions = () => {
    let answered = 0;
    Object.keys(customSections).forEach((section) => {
      customSections[section].forEach((q) => {
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

    const realPoints = calculateTotalRealScore();
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
    if (introData.sitioWeb) {
      children.push(KV("Página web oficial", introData.sitioWeb));
    }

    if ((introData.preliminarEmpresa || "").trim()) {
      children.push(H2("Investigación preliminar de la empresa"));
      clean(introData.preliminarEmpresa)
        .split("\n")
        .filter((l) => l.trim())
        .forEach((line) => children.push(P(line)));
    }

    children.push(H2("Persona que auditó"));
    children.push(KV("Auditor", actor?.nombreAuditor));
    children.push(KV("Rol", actor?.rol));

    children.push(H2("Resumen general de la encuesta"));
    children.push(KV("Preguntas respondidas", `${answeredCount}/${totalQuestions}`));
    children.push(KV("Promedio (respondidas)", `${avgScore.toFixed(2)}/4`));
    children.push(KV("Puntuación real obtenida", `${realPoints.toFixed(0)} pts`));
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
      const totalScore = calculateTotalRealScore();
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
      sheet.addRow(['Sitio web', introData.sitioWeb || 'N/A']);
      if ((introData.preliminarEmpresa || '').trim()) {
        sheet.addRow(['Investigación preliminar (IA)', introData.preliminarEmpresa]);
      }
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
      sheet.addRow(['Puntuación Real Obtenida', totalScore.toFixed(0)]);
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

      Object.keys(customSections).forEach(section => {
        customSections[section].forEach(q => {
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

 


  if (authChecking || (isGuestMode && auditsLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="loader"></div>
      </div>
    );
  }

  if (!isGuestMode && !user) {
    return <LoginScreen onLoginSuccess={setUser} />;
  }

  if (guestAuditToLoad) {
    return (
      <GuestPinScreen 
        targetAudit={guestAuditToLoad}
        onAccessGranted={(audit) => {
          sessionStorage.setItem(`guest_granted_${audit.id}`, 'true');
          acquireLock(audit.id, audit).then((success) => {
            if (success) {
              setCurrentAuditId(audit.id);
              setIntroData(audit.data.introData || {});
              setResponses(audit.data.responses || {});
              setCustomSections(sortSections(audit.data.customSections || getDefaultSections()));
              setGeneralComments(audit.data.generalComments || '');
              setActor(audit.data.actor || { nombreAuditor:'', rol:'', contrasenaHash: audit.data?.actor?.contrasenaHash || '' });
              setGuestAuditToLoad(null);
              setStep('form');
            }
          });
        }}
      />
    );
  }

  if (step === 'blocked') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="max-w-md w-full bg-white p-8 border border-slate-200 border-t-4 border-t-amber-500 shadow-sm text-center">
           <div className="w-16 h-16 bg-slate-900 rounded-none flex items-center justify-center mx-auto mb-6">
              <KeyRound size={32} className="text-amber-500" />
           </div>
           <h1 className="text-2xl font-extrabold text-slate-800">Auditoría en Edición</h1>
           <p className="text-slate-600 mt-4 text-sm leading-relaxed">
             Esta auditoría está siendo editada actualmente por: <br/>
             <strong className="text-slate-900 break-all">{blockedBy || 'Otro usuario/auditor'}</strong>.
           </p>
           <p className="text-slate-500 mt-2 text-xs font-medium">
             Por seguridad y para evitar pérdida de datos, por favor espera un momento o regresa al panel principal.
           </p>
           
           <div className="mt-8 space-y-3">
             <button
               onClick={async () => {
                 if (blockedAuditToLoad) {
                   const docRef = doc(db, "auditorias", blockedAuditToLoad.id);
                   const docSnap = await getDoc(docRef);
                   if (docSnap.exists()) {
                     const freshAudit = docSnap.data();
                     const success = await acquireLock(freshAudit.id, freshAudit);
                     if (success) {
                       setCurrentAuditId(freshAudit.id);
                       setIntroData(freshAudit.data.introData || {});
                       setResponses(freshAudit.data.responses || {});
                       setCustomSections(sortSections(freshAudit.data.customSections || getDefaultSections()));
                       setGeneralComments(freshAudit.data.generalComments || '');
                       setActor(freshAudit.data.actor || { nombreAuditor:'', rol:'', contrasenaHash: freshAudit.data?.actor?.contrasenaHash || '' });
                       setStep('form');
                     }
                   } else {
                     alert("La auditoría ya no existe.");
                     if (isGuestMode) {
                       window.location.href = window.location.origin + window.location.pathname;
                     } else {
                       setStep('dashboard');
                     }
                   }
                 }
               }}
               className="w-full bg-slate-900 text-white font-semibold border border-slate-900 hover:bg-slate-800 px-6 py-3 rounded-none transition-all cursor-pointer"
             >
               Intentar de nuevo
             </button>
             
             {!isGuestMode && (
               <button
                 onClick={() => {
                   resetToInitialState();
                   setStep('dashboard');
                   setBlockedBy(null);
                   setBlockedAuditToLoad(null);
                 }}
                 className="w-full bg-white text-slate-700 font-semibold border border-slate-300 hover:bg-slate-50 px-6 py-3 rounded-none transition-all cursor-pointer"
               >
                 Volver al Panel
               </button>
             )}
           </div>
        </div>
      </div>
    );
  }

  if (step === 'access_management') {
    return <AccessManagement onBack={() => setStep('dashboard')} />;
  }

  // ==========================================
  // PANTALLA INICIAL: DASHBOARD DE AUDITORÍAS
  // ==========================================
  if (step === 'dashboard') {
    const filteredAudits = savedAudits.filter(audit => {
      if (!dashboardSearch.trim()) return true;
      const term = dashboardSearch.toLowerCase();
      const empresa = (audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || '').toLowerCase();
      const auditor = (audit.data?.actor?.nombreAuditor || '').toLowerCase();
      const giro = (audit.data?.introData?.giro || '').toLowerCase();
      return empresa.includes(term) || auditor.includes(term) || giro.includes(term);
    });

    return (
      <div className="min-h-screen bg-slate-100/70 border-t-8 border-slate-900 flex flex-col font-sans">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3.5 sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoPng} alt="ByteWise" className="h-8 md:h-10 w-auto object-contain brightness-0 invert" />
              <div className="hidden sm:block border-l border-slate-200 pl-3">
                <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Auditoría y Gestión de TI</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {user && (
                <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 border border-slate-200">
                  <User size={14} className="text-slate-500" />
                  <span className="max-w-[180px] truncate">{user.email || 'Auditor Conectado'}</span>
                </div>
              )}
              <button 
                onClick={() => setStep('access_management')} 
                className="text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 px-3 py-2 transition flex items-center gap-1.5 cursor-pointer"
                title="Gestión de accesos y roles"
              >
                <Shield size={14} className="text-cyan-600" />
                <span>Accesos</span>
              </button>
              <button 
                onClick={() => { signOut(auth); resetToInitialState(); setStep('dashboard'); }} 
                className="text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 px-3 py-2 transition flex items-center gap-1.5 cursor-pointer"
                title="Cerrar sesión"
              >
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </header>

        {/* Hero Banner & Action Header */}
        <div className="bg-white border-b border-slate-200 py-8 px-4 md:px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                <Shield size={13} className="text-[#00d4ff]" /> Control de Evaluaciones
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Auditorías Guardadas
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                Revisa el avance, madurez y resultados de cada empresa evaluada, o inicia una nueva sesión de auditoría.
              </p>
            </div>

            <button
              onClick={() => {
                resetToInitialState();
                setStep('gate');
              }}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3.5 border-b-4 border-[#00d4ff] shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
            >
              <Plus size={18} className="text-[#00d4ff]" />
              <span>+ Nueva Auditoría</span>
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <main className="max-w-7xl mx-auto w-full p-4 md:p-8 flex-1">
          {/* Barra de Filtro y Resumen */}
          <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
                placeholder="Buscar por empresa, auditor o giro..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-800 focus:outline-none transition"
              />
              {dashboardSearch && (
                <button
                  onClick={() => setDashboardSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-500 flex items-center justify-between sm:justify-end gap-2 px-1">
              <span>
                {filteredAudits.length} {filteredAudits.length === 1 ? 'auditoría encontrada' : 'auditorías registradas'}
              </span>
              {savedAudits.length > 0 && filteredAudits.length !== savedAudits.length && (
                <span className="text-slate-400">(filtradas de {savedAudits.length})</span>
              )}
            </div>
          </div>

          {/* Grid de Auditorías */}
          {filteredAudits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredAudits.map((audit) => {
                const summary = getAuditSummary(audit);
                const nombreEmpresa = audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || 'Empresa sin nombre';
                const giro = audit.data?.introData?.giro;
                const sitioWeb = audit.data?.introData?.sitioWeb;
                const auditorNombre = audit.data?.actor?.nombreAuditor || 'Sin asignar';
                const auditorRol = audit.data?.actor?.rol || 'Auditor';
                const tienePin = !!audit.data?.actor?.contrasenaHash;
                const fechaMod = audit.lastModified ? new Date(audit.lastModified) : new Date();

                return (
                  <div
                    key={audit.id}
                    className="bg-white border border-slate-200 hover:border-slate-300 border-t-4 border-t-[#00d4ff] shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    {/* Tarjeta Cabecera */}
                    <div className="p-5 md:p-6 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 bg-slate-900 text-[#00d4ff] flex items-center justify-center shrink-0">
                            <Building2 size={20} />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-900 truncate leading-snug" title={nombreEmpresa}>
                              {nombreEmpresa}
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                              {giro ? (
                                <span className="font-medium text-slate-600">{giro}</span>
                              ) : (
                                <span className="italic text-slate-400">Giro no especificado</span>
                              )}
                              {sitioWeb && (
                                <span className="inline-flex items-center gap-1 text-cyan-700 bg-cyan-50 px-1.5 py-0.5 text-[11px] font-medium truncate max-w-[180px]">
                                  <Globe size={11} /> {sitioWeb.replace(/^https?:\/\//, '')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {tienePin && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold"
                              title="Esta auditoría está protegida con contraseña / PIN"
                            >
                              <KeyRound size={12} className="text-amber-600" />
                              <span>PIN</span>
                            </span>
                          )}
                          <button
                            onClick={(e) => handleDeleteAudit(audit, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                            title="Eliminar esta auditoría"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Métricas y Madurez */}
                      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
                        <span className={`text-xs font-bold px-2.5 py-1 border ${summary.level.badgeClass}`}>
                          {summary.level.label}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-800">{summary.avgScore}</span>
                          <span className="text-[11px] text-slate-500"> / 4.0 pts</span>
                        </div>
                      </div>

                      {/* Barra de Progreso */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                          <span>Preguntas completadas</span>
                          <span className="text-cyan-700 font-bold">{summary.percentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 overflow-hidden">
                          <div
                            className="bg-[#00d4ff] h-full transition-all duration-300"
                            style={{ width: `${summary.percentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
                          <span>{summary.answeredQuestions} de {summary.totalQuestions} respondidas</span>
                          <span>{summary.areasCount} áreas evaluadas</span>
                        </div>
                      </div>
                    </div>

                    {/* Metadatos y Botón de Apertura */}
                    <div className="bg-slate-50 p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800">{auditorNombre}</span>
                          <span className="text-slate-400">({auditorRol})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>Modificado: {fechaMod.toLocaleDateString()} {fechaMod.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleLoadAudit(audit)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer shrink-0"
                      >
                        <span>Abrir Auditoría</span>
                        <ChevronRight size={14} className="text-[#00d4ff]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <Shield size={32} className="text-cyan-600" />
              </div>
              {savedAudits.length === 0 ? (
                <>
                  <h3 className="text-lg font-bold text-slate-800">No hay auditorías registradas todavía</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Comienza tu primera evaluación de seguridad y TI. Podrás utilizar la plantilla base oficial de ByteWise, comenzar desde cero o importar preguntas desde Excel.
                  </p>
                  <button
                    onClick={() => {
                      resetToInitialState();
                      setStep('gate');
                    }}
                    className="mt-6 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-3 border-b-2 border-[#00d4ff] shadow-sm transition cursor-pointer"
                  >
                    <Plus size={16} className="text-[#00d4ff]" />
                    <span>+ Crear Primera Auditoría</span>
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-slate-800">Sin coincidencias para "{dashboardSearch}"</h3>
                  <p className="text-xs text-slate-500 mt-2">
                    No se encontró ninguna auditoría con ese término. Intenta con otro nombre de empresa, auditor o giro.
                  </p>
                  <button
                    onClick={() => setDashboardSearch('')}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                  >
                    Limpiar Búsqueda
                  </button>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ==========================================
  // PANTALLA DE CONFIGURACIÓN DE NUEVA AUDITORÍA
  // ==========================================
  if (step === 'gate') {
     return (
       <div className="min-h-screen bg-slate-50 p-4 md:p-12 flex flex-col items-center justify-start gap-6 border-t-8 border-slate-900 relative">
         
         <div className="w-full max-w-3xl flex items-center justify-between">
            <button 
              onClick={() => setStep('dashboard')} 
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-3 py-2 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <ArrowLeft size={16} />
              <span>Volver al Panel</span>
            </button>

            <div className="flex items-center gap-3">
              <button onClick={() => setStep('access_management')} className="text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center gap-1.5">
                <Shield size={14} /> Accesos
              </button>
              <button onClick={() => { signOut(auth); resetToInitialState(); setStep('dashboard'); }} className="text-xs font-bold text-slate-500 hover:text-red-600 transition flex items-center gap-1.5">
                Cerrar Sesión
              </button>
            </div>
         </div>

         <img src={logoPng} alt="ByteWise" className="h-10 md:h-14 w-auto object-contain drop-shadow-none brightness-0 invert" />

         {/* NUEVA AUDITORIA */}
        <div className="w-full max-w-3xl bg-white p-8 md:p-12 border border-slate-200 border-t-4 border-t-[#00d4ff] shadow-sm">
          <div className="flex flex-col items-center mb-8">
             <div className="w-14 h-14 bg-slate-900 rounded-none flex items-center justify-center shadow-none mb-3">
                <Shield size={28} className="text-[#00d4ff]" />
             </div>
             <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 text-center">Nueva Auditoría de TI</h1>
             <p className="text-slate-500 mt-1.5 text-center text-sm font-medium">Configura los datos de la empresa y estructura de evaluación</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Nombre de la Empresa *</label>
              <input
                type="text"
                value={actor.nombreEmpresa}
                onChange={(e) => setActor(prev => ({ ...prev, nombreEmpresa: e.target.value }))}
                placeholder="Ej: ByteWise S.A. de C.V."
                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Nombre de quien audita *</label>
              <input
                type="text"
                value={actor.nombreAuditor}
                onChange={(e) => setActor(prev => ({ ...prev, nombreAuditor: e.target.value }))}
                placeholder="Ej: Oscar Pérez"
                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Rol en la evaluación *</label>
              <select
                value={actor.rol}
                onChange={(e) => setActor(prev => ({ ...prev, rol: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none appearance-none"
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
                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none"
              />
            </div>

            {/* Modalidad de Cuestionario Inicial */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Estructura del Cuestionario</span>
                <span className="text-xs text-slate-400 font-normal">Elige cómo iniciar</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Opción 1: Base */}
                <button
                  type="button"
                  onClick={() => setCreationMode('base')}
                  className={`p-3 text-left border transition-all cursor-pointer flex flex-col justify-between rounded-none relative ${
                    creationMode === 'base'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Shield size={18} className={creationMode === 'base' ? 'text-[#00d4ff]' : 'text-slate-600'} />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 ${
                        creationMode === 'base' ? 'bg-[#00d4ff] text-slate-950' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Recomendado
                      </span>
                    </div>
                    <div className="font-bold text-xs">Auditoría Base</div>
                    <p className={`text-[11px] mt-1 leading-snug ${
                      creationMode === 'base' ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      Carga la plantilla estándar de ByteWise (ISO 27001 e infraestructura).
                    </p>
                  </div>
                </button>

                {/* Opción 2: Desde Cero */}
                <button
                  type="button"
                  onClick={() => setCreationMode('blank')}
                  className={`p-3 text-left border transition-all cursor-pointer flex flex-col justify-between rounded-none relative ${
                    creationMode === 'blank'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Layers size={18} className={creationMode === 'blank' ? 'text-[#00d4ff]' : 'text-slate-600'} />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 ${
                        creationMode === 'blank' ? 'bg-[#00d4ff] text-slate-950' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Limpio
                      </span>
                    </div>
                    <div className="font-bold text-xs">Desde Cero</div>
                    <p className={`text-[11px] mt-1 leading-snug ${
                      creationMode === 'blank' ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      Inicia en blanco para crear tus propias áreas y preguntas personalizadas.
                    </p>
                  </div>
                </button>

                {/* Opción 3: Importar Cuestionario */}
                <button
                  type="button"
                  onClick={() => setCreationMode('import')}
                  className={`p-3 text-left border transition-all cursor-pointer flex flex-col justify-between rounded-none relative ${
                    creationMode === 'import'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <FileSpreadsheet size={18} className={creationMode === 'import' ? 'text-[#00d4ff]' : 'text-slate-600'} />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 ${
                        creationMode === 'import' ? 'bg-[#00d4ff] text-slate-950' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Excel / JSON
                      </span>
                    </div>
                    <div className="font-bold text-xs">Importar Excel</div>
                    <p className={`text-[11px] mt-1 leading-snug ${
                      creationMode === 'import' ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      Carga tus preguntas desde un archivo Excel (.xlsx) o JSON.
                    </p>
                  </div>
                </button>
              </div>

              {/* Subida de archivo si seleccionó Importar */}
              {creationMode === 'import' && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-300 animate-in fade-in duration-200 space-y-3">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        Plantilla oficial en Excel (.xlsx)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Descarga la plantilla con las preguntas base como ejemplo, modifícala en Excel y súbela aquí.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => downloadExcelTemplate()}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer transition shrink-0 flex items-center gap-1.5 shadow-none"
                    >
                      <Download size={14} />
                      <span>Descargar Plantilla Excel</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Upload size={16} className="text-cyan-600" />
                        Subir cuestionario diligenciado
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Formatos soportados: <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.json</strong>.
                      </p>
                    </div>

                    <label className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition shrink-0 flex items-center gap-1.5 shadow-none">
                      <Upload size={14} className="text-[#00d4ff]" />
                      <span>{importedFileName ? 'Cambiar Archivo' : 'Seleccionar Archivo Excel'}</span>
                      <input type="file" accept=".xlsx,.xls,.json" onChange={handleGateFileImport} className="hidden" />
                    </label>
                  </div>

                  {importedFileName && importSummary && (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                        <span className="font-semibold truncate">{importedFileName}</span>
                      </div>
                      <span className="text-[11px] font-bold bg-emerald-200 text-emerald-950 px-2.5 py-1 shrink-0 ml-2">
                        {importSummary.areasCount} áreas / {importSummary.questionsCount} preguntas detectadas
                      </span>
                    </div>
                  )}

                  {importError && (
                    <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <X size={16} className="shrink-0" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                if (!actor.nombreEmpresa.trim() || !actor.nombreAuditor.trim() || !actor.rol || !actor.contrasena.trim()) {
                  alert("Por favor llena todos los campos obligatorios, incluyendo la contraseña, para continuar.");
                  return;
                }

                let initialSecs = getDefaultSections();
                if (creationMode === 'blank') {
                  initialSecs = { 'Área Inicial': [] };
                } else if (creationMode === 'import') {
                  if (!importedSections || Object.keys(importedSections).length === 0) {
                    alert("Por favor sube un archivo Excel (.xlsx) o JSON válido para importar el cuestionario.");
                    return;
                  }
                  initialSecs = sortSections(importedSections);
                }

                const hashed = await hashPassword(actor.contrasena);
                const newId = Date.now().toString();
                const lockAcquired = await acquireLock(newId);
                if (lockAcquired) {
                  setCurrentAuditId(newId);
                  setIntroData({
                    ...INITIAL_INTRO_DATA,
                    nombreEmpresa: actor.nombreEmpresa.trim(),
                    nombre: actor.nombreAuditor.trim()
                  });
                  setResponses({});
                  setGeneralComments('');
                  setCustomSections(initialSecs);
                  setExpandedSections({ 'Información General': true });
                  setActiveSection(creationMode === 'blank' ? 'Área Inicial' : 'Información General');
                  setActor(prev => ({ ...prev, contrasenaHash: hashed, contrasena: '' }));
                  setStep('form');
                }
              }}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold border border-slate-900 hover:bg-slate-800 px-6 py-4 rounded-none hover:bg-slate-800 transition-all font-bold shadow-none cursor-pointer"
            >
              Comenzar Auditoría <ChevronRight size={18} />
            </button>
          </div>
        </div>

       </div>
     );
  }

  return (
    <div className="min-h-screen relative bg-slate-50 p-4 md:p-8 text-slate-900">
      
      
      
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-none bg-white/90 backdrop-blur shadow-none border border-white/40 flex items-center justify-center hover:bg-white transition"
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
          <div className="lg:col-span-1 bg-white border border-slate-200 border-t-2 border-t-[#00d4ff] p-6 flex flex-col justify-between shadow-sm">
            <div>
              <img
                src={logoPng}
                alt="ByteWise"
                className="h-10 md:h-12 w-auto object-contain mb-4"
              />
              <div className="flex items-start justify-between mb-1 gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Auditoría de TI
                </h1>
                <div className="flex items-center gap-2">
                  {step === 'form' && !isGuestMode && (
                    <button onClick={async () => { await releaseLock(); resetToInitialState(); setStep('dashboard'); }} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-none transition cursor-pointer" title="Volver al Panel de Auditorías">
                      <Home size={20} />
                    </button>
                  )}
                  <div className="relative">
                    <button onClick={() => { setShowExportMenu(!showExportMenu); setShowSettings(false); }} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-none transition" title="Exportar">
                      <Download size={20} />
                    </button>
                    {showExportMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)}></div>
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-none shadow-none border border-slate-100 py-2 z-50">
                        <button onClick={() => { exportToDocxPro(); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <FileText size={16} /> Descargar en Word
                        </button>
                        <button onClick={() => { exportToExcel(); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <FileSpreadsheet size={16} /> Descargar en Excel
                        </button>
                      </div>
                      </>
                    )}
                  </div>
                  {!isGuestMode && (
                  <div className="relative">
                    <button onClick={() => { setShowSettings(!showSettings); setShowExportMenu(false); }} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-none transition" title="Configuración">
                      <Settings size={20} />
                    </button>
                    {showSettings && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)}></div>
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-none shadow-none border border-slate-100 py-2 z-50">
                        <button onClick={() => {
                          const url = window.location.origin + window.location.pathname + "?id=" + currentAuditId;
                          navigator.clipboard.writeText(url);
                          alert("Enlace copiado al portapapeles.");
                          setShowSettings(false);
                        }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <Share2 size={16} /> Compartir Enlace
                        </button>
                        <button onClick={async () => {
                          const oldPin = prompt("Ingresa el PIN actual:");
                          if (oldPin === null) return;
                          const oldHash = await hashPassword(oldPin);
                          if (oldHash !== actor.contrasenaHash) {
                            alert("PIN incorrecto.");
                            return;
                          }
                          const newPin = prompt("Ingresa el nuevo PIN:");
                          if (newPin) {
                            const newHash = await hashPassword(newPin);
                            setActor(prev => ({...prev, contrasenaHash: newHash}));
                            alert("PIN actualizado correctamente.");
                          }
                          setShowSettings(false);
                        }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <KeyRound size={16} /> Cambiar PIN
                        </button>
                        <button onClick={() => { setShowEditModal(true); setShowSettings(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <Edit2 size={16} /> Editar Preguntas
                        </button>
                        <hr className="my-1 border-slate-100" />
                        <button onClick={async () => {
                          if (window.confirm("¿Seguro que deseas eliminar esta auditoría permanentemente?")) {
                            if (db) {
                              try {
                                await deleteDoc(doc(db, "auditorias", currentAuditId));
                              } catch(e) { console.error(e) }
                            }
                            setSavedAudits(prev => prev.filter(a => a.id !== currentAuditId));
                            resetToInitialState();
                            setStep('gate');
                          }
                        }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
                          <Trash2 size={16} /> Eliminar Auditoría
                        </button>
                      </div>
                      </>
                    )}
                  </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-6">Evaluación integral de infraestructura y seguridad</p>
              
              {/* Score Dashboard */}
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-[#00d4ff] p-5 shadow-sm">
                  <div className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Puntuación Real Obtenida</div>
                  <div className="text-3xl font-bold text-slate-900 tracking-tight">{calculateTotalRealScore()} pts</div>
                  <div className="text-xs mt-1 font-semibold text-slate-700">{getScoreLevel(calculateTotalScore()).nivel}</div>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-cyan-600 p-5 shadow-sm mt-3">
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Avance</div>
                    <div className="text-2xl font-bold text-slate-900 tracking-tight">{((getAnsweredQuestions() / getTotalQuestions()) * 100).toFixed(0)}%</div>
                  </div>
                  <div className="h-2 bg-slate-200 overflow-hidden mb-1.5 rounded-none">
                    <div className="h-2 bg-cyan-600 transition-all duration-500" style={{ width: `${(getAnsweredQuestions() / getTotalQuestions()) * 100}%` }} />
                  </div>
                  <div className="text-xs text-slate-500 font-medium text-right mt-1">{getAnsweredQuestions()} de {getTotalQuestions()} completadas</div>
                </div>
              </div>
            </div>

          </div>

          {/* Columna 2: Puntuación por Áreas */}
          <div className="lg:col-span-2 bg-white border border-slate-200 border-t-2 border-t-[#00d4ff] p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Desglose por Áreas</h2>
              <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-1 rounded-none font-semibold">Tiempo Real</span>
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
                               <div className="w-20 h-1 bg-gray-100 rounded-none overflow-hidden">
                                  <div className="h-1 bg-[#00d4ff] rounded-none transition-all duration-500" style={{ width: `${answeredPct}%` }} />
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
          <div className="w-full md:w-1/4 flex-shrink-0 space-y-2 md:sticky md:top-4 md:self-start max-h-[200px] md:max-h-[90vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">Navegación</h3>
            
            <button
              onClick={() => setActiveSection('Información General')}
              className={`w-full text-left px-4 py-3 rounded-none text-sm font-semibold transition-all flex items-center justify-between ${
                activeSection === 'Información General' 
                ? 'bg-cyan-50 text-cyan-700 border-l-4 border-slate-800 shadow-none' 
                : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
              }`}
            >
              <span className="truncate">Información General</span>
            </button>

            <button
              onClick={() => setActiveSection('Preliminar de la Empresa')}
              className={`w-full text-left px-4 py-3 rounded-none text-sm font-semibold transition-all flex items-center justify-between ${
                activeSection === 'Preliminar de la Empresa' 
                ? 'bg-cyan-50 text-cyan-700 border-l-4 border-slate-800 shadow-none' 
                : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Sparkles size={16} className={introData.preliminarEmpresa ? "text-[#00d4ff]" : "text-gray-400"} />
                <span className="truncate">Preliminar de la Empresa</span>
              </div>
              {introData.preliminarEmpresa ? (
                <span className="text-[10px] px-2 py-0.5 rounded-none bg-emerald-100 text-emerald-700 font-bold">
                  Listo
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-none bg-cyan-100 text-cyan-700 font-bold">
                  IA
                </span>
              )}
            </button>

            {Object.keys(customSections).map((section) => {
              const questions = customSections[section];
              let answered = 0;
              questions.forEach(q => {
                if (responses[`${section}-${q.id}`]?.evaluacion !== undefined) answered++;
              });
              const isComplete = answered === questions.length && questions.length > 0;

              return (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`w-full text-left px-4 py-3 rounded-none text-sm font-semibold transition-all flex items-center justify-between ${
                    activeSection === section 
                    ? 'bg-cyan-50 text-cyan-700 border-l-4 border-[#00d4ff] shadow-none' 
                    : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
                  }`}
                >
                  <span className="truncate mr-2" title={section}>{section}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-none ${
                    isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {answered}/{questions.length}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setActiveSection('Reporte Final')}
              className={`w-full text-left px-4 py-3 rounded-none text-sm font-semibold transition-all flex items-center justify-between mt-6 ${
                activeSection === 'Reporte Final' 
                ? 'bg-amber-50 text-amber-700 border-l-4 border-amber-500 shadow-none' 
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
              <div className="mb-8 bg-white rounded-none shadow-sm overflow-hidden border border-slate-200 border-t-2 border-t-[#00d4ff] animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Información General</h2>
                    <p className="text-sm text-slate-600">Datos de identificación (no generan puntuación)</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre de la empresa *
                  </label>
                  <input
                    type="text"
                    value={introData.nombreEmpresa}
                    onChange={(e) => updateIntroData('nombreEmpresa', e.target.value)}
                    placeholder="Razón social o nombre comercial"
                    className="w-full px-4 py-2 border-2 border-cyan-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-semibold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Página web oficial de la empresa
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveSection('Preliminar de la Empresa')}
                      className="text-xs text-cyan-700 hover:text-cyan-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={13} className="text-[#00d4ff]" /> Ver Preliminar
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      value={introData.sitioWeb || ''}
                      onChange={(e) => updateIntroData('sitioWeb', e.target.value)}
                      placeholder="https://empresa.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                </div>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ¿Cuál es la modalidad predominante?
                  </label>
                  <select
                    value={introData.modalidad}
                    onChange={(e) => updateIntroData('modalidad', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ¿Qué tan dependientes son de la red/internet para realizar su trabajo?
                </label>
                <select
                  value={introData.dependenciaRed}
                  onChange={(e) => updateIntroData('dependenciaRed', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        )}

            {/* Sección de Preliminar de la Empresa Activa */}
            {activeSection === 'Preliminar de la Empresa' && (
              <div className="mb-8 bg-white rounded-none shadow-sm overflow-hidden border border-slate-200 border-t-2 border-t-[#00d4ff] animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="px-6 py-5 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-cyan-50 border border-cyan-200 text-cyan-600">
                        <Sparkles size={20} className="text-[#00d4ff]" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900">Preliminar e Inteligencia de la Empresa</h2>
                    </div>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">
                      Investigación automatizada con IA a partir del sitio web oficial: cómo se manejan, estructura organizacional y perfil de seguridad.
                    </p>
                  </div>
                  {introData.preliminarEmpresa && (
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                        <CheckCircle size={14} /> Análisis Generado
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-6">
                  {/* Buscador / URL Input Card */}
                  <div className="bg-slate-50 p-5 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Página web oficial de la empresa
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Globe size={18} />
                        </div>
                        <input
                          type="url"
                          value={introData.sitioWeb || ''}
                          onChange={(e) => updateIntroData('sitioWeb', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isInvestigatingCompany) {
                              investigateCompanyWithAI();
                            }
                          }}
                          placeholder="Ej: https://bytewise.mx o empresa.com"
                          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none text-sm transition font-medium"
                          disabled={isInvestigatingCompany}
                        />
                        {introData.sitioWeb && (
                          <a
                            href={introData.sitioWeb.startsWith('http') ? introData.sitioWeb : `https://${introData.sitioWeb}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-600 transition"
                            title="Abrir página en nueva pestaña"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => investigateCompanyWithAI()}
                        disabled={isInvestigatingCompany}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm shrink-0"
                      >
                        {isInvestigatingCompany ? (
                          <>
                            <Loader2 size={16} className="animate-spin text-[#00d4ff]" />
                            <span>Investigando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} className="text-[#00d4ff]" />
                            <span>{introData.preliminarEmpresa ? "Re-analizar Empresa" : "Investigar con IA"}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 mt-2 gap-2">
                      <span>Empresa auditada: <strong className="text-slate-800">{introData.nombreEmpresa || 'Sin especificar'}</strong></span>
                      <span className="text-[11px] text-slate-400">Extrae contenido público y analiza riesgos bajo estándares ISO 27001 / NIST</span>
                    </div>
                  </div>

                  {/* Estado de Carga con Animación */}
                  {isInvestigatingCompany && (
                    <div className="p-8 border border-cyan-200 bg-cyan-50/40 flex flex-col items-center justify-center text-center animate-pulse">
                      <div className="w-12 h-12 rounded-none bg-slate-900 flex items-center justify-center mb-3 shadow-sm">
                        <Loader2 size={24} className="animate-spin text-[#00d4ff]" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-base">Investigando empresa en tiempo real...</h4>
                      <p className="text-xs text-slate-600 max-w-md mt-1">
                        Consultando la estructura de la página, productos, modelo operativo y evaluando la superficie potencial de riesgos de seguridad de la información.
                      </p>
                    </div>
                  )}

                  {/* Resultados del Análisis Preliminar */}
                  {!isInvestigatingCompany && introData.preliminarEmpresa && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <FileText size={16} className="text-cyan-600" />
                          Resultado de la Investigación Preliminar
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(introData.preliminarEmpresa);
                              setCopiedPreliminar(true);
                              setTimeout(() => setCopiedPreliminar(false), 2000);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                            title="Copiar texto del análisis"
                          >
                            {copiedPreliminar ? (
                              <>
                                <Check size={14} className="text-emerald-600" />
                                <span className="text-emerald-600 font-bold">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Editor / Visualizador del Preliminar */}
                      <div className="relative">
                        <textarea
                          value={introData.preliminarEmpresa}
                          onChange={(e) => updateIntroData('preliminarEmpresa', e.target.value)}
                          rows={14}
                          placeholder="Aquí aparecerá el análisis preliminar generado con IA o puedes redactarlo manualmente..."
                          className="w-full px-4 py-3 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none text-sm text-slate-800 leading-relaxed font-mono transition resize-y"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                        <Shield size={16} className="text-[#00d4ff] shrink-0 mt-0.5" />
                        <div>
                          <strong>Nota para el Auditor:</strong> Este informe preliminar es editable. Puedes ajustar detalles conforme obtengas mayor evidencia durante las entrevistas. Se incorporará automáticamente en las exportaciones de Word y Excel.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Estado vacío cuando aún no hay investigación */}
                  {!isInvestigatingCompany && !introData.preliminarEmpresa && (
                    <div className="p-12 border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-none flex items-center justify-center text-slate-400 mb-3">
                        <Globe size={28} />
                      </div>
                      <h4 className="font-bold text-slate-700 text-base">Aún no se ha realizado la investigación preliminar</h4>
                      <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                        Ingresa la dirección web de la empresa en la parte superior y haz clic en <strong>Investigar con IA</strong> para generar automáticamente el perfil comercial, operativo y de seguridad.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sección de Reporte Final */}
            {activeSection === 'Reporte Final' && (
              <div className="mb-4 bg-white rounded-none shadow-none overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                    className="w-full whitespace-pre-wrap px-4 py-3 border-2 border-gray-300 rounded-none resize-y focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />

                  <button
                    type="button"
                    onClick={rewriteCommentsWithAI}
                    disabled={!canRewrite}
                    title={!hasComments ? 'Escribe comentarios para habilitar' : (rewriting ? 'Mejorando...' : 'Mejorar con IA')}
                    className={[
                      "absolute top-9 right-9 w-9 h-9 rounded-none flex items-center justify-center",
                      "border border-gray-200 bg-white shadow-none transition",
                      canRewrite ? "hover:shadow-none hover:scale-105" : "opacity-40 cursor-not-allowed",
                      rewriting ? "animate-pulse" : ""
                    ].join(" ")}
                  >
                    <Sparkles size={18} className={canRewrite ? "text-indigo-600" : "text-gray-400"} />
                  </button>
                </div>
              </div>
            )}

        {/* Secciones de evaluación activas */}
            {Object.keys(customSections).map(section => {
              if (section !== activeSection) return null;
              return (
                <div key={section} className="mb-4 bg-white rounded-none shadow-none overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="p-6 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">{section}</h2>
                      <p className="text-sm text-gray-500">
                        {customSections[section].length} preguntas • Promedio actual: <span className="font-bold text-cyan-600">{calculateSectionScore(section)}/4</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-6 space-y-8">
                    {(!customSections[section] || customSections[section].length === 0) ? (
                      <div className="p-10 border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <Plus size={28} />
                        </div>
                        <h4 className="font-bold text-slate-800 text-base">Esta área no tiene preguntas aún</h4>
                        <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                          Iniciaste este cuestionario en blanco o esta área es nueva. Haz clic en el botón inferior para abrir el editor y redactar preguntas personalizadas.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowEditModal(true)}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-none"
                        >
                          <Edit2 size={15} className="text-[#00d4ff]" /> Abrir Editor de Preguntas
                        </button>
                      </div>
                    ) : (
                      customSections[section].map(item => {
                  const key = `${section}-${item.id}`;
                  const response = responses[key] || {};
                  
                  return (
                    <div key={item.id} id={`question-${section}-${item.id}`} className="border-l-4 border-slate-800 pl-4 py-2 transition-all duration-500 rounded-none">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded-none text-sm font-semibold">
                          {item.id}
                        </span>
                        <p className="text-gray-700 flex-1">{item.pregunta}</p>
                      </div>



                      {item.requisito && (
                        <p className="text-xs text-gray-500 italic mb-3 flex items-center gap-1.5"><FileText size={14} className="shrink-0" /> {item.requisito}</p>
                      )}

                      {item.nota && (
                        <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-none mb-3 flex items-center gap-1.5">
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
                          <div className="bg-blue-50 border border-blue-200 rounded-none p-3 mb-3 text-xs text-blue-800">
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
                                className={`w-12 h-12 rounded-none font-bold transition-all ${
                                  response.evaluacion === score
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-100 shadow-none scale-110'
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
                            className="w-full px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                              className={`p-1.5 rounded-none transition-all shadow-none flex items-center gap-1 text-xs font-semibold ${dictatingKey === key ? 'bg-red-500 text-slate-100 animate-pulse' : 'bg-white border border-gray-200 text-slate-600 hover:bg-slate-50'}`}
                              title={dictatingKey === key ? "Detener dictado" : "Dictar observación"}
                            >
                              <Mic size={14} /> {dictatingKey === key ? "Escuchando..." : "Dictar"}
                            </button>
                            <button
                              onClick={() => rewriteObservationWithAI(section, item)}
                              disabled={rewritingKey === key || !response.observaciones}
                              className={`p-1.5 rounded-none transition-all shadow-none flex items-center gap-1 text-xs font-semibold ${rewritingKey === key ? 'bg-cyan-100 text-cyan-700 animate-pulse' : !response.observaciones ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-slate-800 text-white font-medium border border-slate-800 hover:bg-slate-700 hover:shadow-none hover:scale-105'}`}
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
                          className={`w-full px-3 py-2 border border-slate-300 resize-y transition-colors focus:border-slate-800 focus:outline-none rounded-none ${dictatingKey === key ? 'border-red-400 bg-red-50/30' : 'border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-transparent'}`}
                        />
                      </div>

                      {/* Renderizar Subpreguntas/Preguntas Guía Guardadas al final de las observaciones */}
                      {item.subquestions && item.subquestions.length > 0 && (
                        <div className="mt-4 mb-3 bg-slate-50 border border-slate-200 p-3 space-y-2 animate-in fade-in duration-200">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                            Preguntas Guía Sugeridas (Para obtener más información):
                          </span>
                          {item.subquestions.map(sub => (
                            <div key={sub.id} className="text-xs text-slate-700 space-y-1.5 pl-2 border-l-2 border-slate-300 pb-2 border-b border-slate-200/50 last:border-b-0 last:pb-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className="italic font-medium flex-1">
                                  • {sub.texto}
                                </span>
                                {!isGuestMode && (
                                  <button
                                    type="button"
                                    onClick={() => deleteSubquestion(section, item.id, sub.id)}
                                    className="text-gray-400 hover:text-red-600 transition shrink-0 bg-transparent border-0 cursor-pointer"
                                    title="Eliminar pregunta guía"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                value={sub.respuesta || ''}
                                onChange={(e) => updateSubquestionResponse(section, item.id, sub.id, e.target.value)}
                                placeholder="Escribe aquí la respuesta a esta pregunta sugerida..."
                                className="w-full px-2.5 py-1 bg-white border border-slate-200 text-xs focus:border-slate-800 focus:outline-none transition-colors rounded-none font-normal"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botón para Añadir Pregunta Guía al final del bloque de observaciones */}
                      {!isGuestMode && addingSubFor !== key && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingSubFor(key);
                            setSubpromptText('');
                          }}
                          className="mt-2 mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                          title="Añadir pregunta sugerida"
                        >
                          <Plus size={14} /> Añadir pregunta guía
                        </button>
                      )}

                      {/* Formulario Inline para Añadir Subpregunta */}
                      {addingSubFor === key && (
                        <div className="mt-3 mb-2 bg-slate-50 border border-slate-200 p-4 animate-in fade-in duration-200">
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
                            ¿De qué se trata la pregunta guía sugerida?
                          </label>
                          <textarea
                            value={subpromptText}
                            onChange={(e) => setSubpromptText(e.target.value)}
                            placeholder="Escribe el tema (ej: 'mfa en correos corporativos') o ingresa la pregunta directamente..."
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none mb-3 resize-y"
                            rows={2}
                          />
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setAddingSubFor(null)}
                              className="bg-white text-slate-700 text-xs font-semibold border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-none transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => generateSubquestionWithAI(item.pregunta)}
                              disabled={isGeneratingSub}
                              className="bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-none transition cursor-pointer flex items-center gap-1"
                            >
                              <Sparkles size={12} className={isGeneratingSub ? "animate-pulse" : ""} />
                              {isGeneratingSub ? 'Generando...' : 'Mejorar con IA'}
                            </button>
                            <button
                              type="button"
                              onClick={() => saveSubquestion(section, item.id)}
                              className="bg-slate-900 text-white text-xs font-semibold border border-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-none transition cursor-pointer"
                            >
                              Guardar Sugerencia
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
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

      <EditQuestionsModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialSections={customSections}
        onSave={(newSections) => {
          setCustomSections(newSections);
        }}
      />
    </div>
  );
};

export default AuditForm;
