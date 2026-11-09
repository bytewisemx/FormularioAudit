import { DEFAULT_SECTIONS } from "./defaultSections";

import React, { useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Download, FileText, FileSpreadsheet, RefreshCw, Mic, Sparkles, Building2, Shield, Brain, Hash, CheckCircle, Search, Settings, Share2, KeyRound, Trash2, Home, Plus, X, Globe, Copy, Check, ExternalLink, Loader2, Upload, FileCode, Layers, ArrowLeft, Calendar, User, Users, BarChart2, ThumbsUp, ThumbsDown, AlertTriangle, Lightbulb, LayoutGrid, List, CheckCircle2, Maximize2, Minimize2, LogOut, Pin, Lock, Unlock, Archive, History, RotateCcw, Eye, EyeOff, GitMerge, Edit3, ShieldCheck } from 'lucide-react';
import { downloadExcelTemplate, parseQuestionsFile, exportAuditToProfessionalExcel } from './excelTemplateHelper';
import { db, auth } from "./firebase";
import { collection, doc, setDoc, getDoc, updateDoc, getDocs, deleteDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut, signInAnonymously } from "firebase/auth";
import LoginScreen from "./components/LoginScreen";
import AccessManagement from "./components/AccessManagement";
import GuestPinScreen from "./components/GuestPinScreen";
import AuditEvaluationManager from "./components/AuditEvaluationManager";
import AuditMergeModal from "./components/AuditMergeModal";
import { generateExecutiveDocx } from "./utils/docxReportGenerator";

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
import CustomDialogModal from "./components/CustomDialogModal";
import CubeLoader from "./components/CubeLoader";
import { filterAiResponse } from "./utils/aiResponseFilter";

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

// Auxiliares para avatar visual de la empresa
const getCompanyInitials = (name) => {
  if (!name || name.trim() === '' || name === 'Empresa sin nombre') return 'EM';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
};

// Estilo neutro, sobrio y minimalista para avatares de empresa
const getCompanyAvatarBadgeClass = (_name) => {
  return "w-9 h-9 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0 tracking-wider transition-colors";
};
const getCompanyAvatarGradient = getCompanyAvatarBadgeClass;

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

  let level = { label: 'Sin evaluar', badgeClass: 'text-slate-600 bg-slate-100 border border-slate-200/80' };
  if (answeredQuestions > 0) {
    const scoreNum = parseFloat(avgScore);
    if (scoreNum >= 3.5) level = { label: 'Nivel 4: Optimizado', badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200/80' };
    else if (scoreNum >= 2.5) level = { label: 'Nivel 3: Gestionado', badgeClass: 'text-blue-700 bg-blue-50 border border-blue-200/80' };
    else if (scoreNum >= 1.5) level = { label: 'Nivel 2: Parcial', badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200/80' };
    else level = { label: 'Nivel 1: Inicial / Crítico', badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200/80' };
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
  const [deletedQuestions, setDeletedQuestions] = useState([]);
  // Sistema de Evaluaciones Paralelas y Fusión (Fork & Merge)
  const [evaluations, setEvaluations] = useState({});
  const [finalAudit, setFinalAudit] = useState({ status: 'draft', answers: {} });
  const [activeEvaluationView, setActiveEvaluationView] = useState('my_draft'); // 'my_draft' | 'official' | other_uid
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [blockedBy, setBlockedBy] = useState(null);
  const [blockedAuditToLoad, setBlockedAuditToLoad] = useState(null);
  const [expandedSections, setExpandedSections] = useState({ 'Información General': true });
  const [showEditModal, setShowEditModal] = useState(false);
  const [responses, setResponses] = useState({});
  const [generalComments, setGeneralComments] = useState('');
  const [positiveComments, setPositiveComments] = useState('');
  const [negativeComments, setNegativeComments] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [rewritingField, setRewritingField] = useState(null); // 'positive' | 'negative' | 'recommendations' | 'general' | null
  const [reportLayout, setReportLayout] = useState('grid'); // 'grid' | 'stack' | 'tabs'
  const [activeReportTab, setActiveReportTab] = useState('positive'); // 'positive' | 'negative' | 'recommendations'
  const [commentHeightMode, setCommentHeightMode] = useState('normal'); // 'compact' | 'normal' | 'tall'
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [introData, setIntroData] = useState(INITIAL_INTRO_DATA);
  const [rewriting, setRewriting] = useState(false);
  const [dictatingKey, setDictatingKey] = useState(null);
  const [rewritingKey, setRewritingKey] = useState(null);
  const [activeSection, setActiveSection] = useState('Información General');
  
  const [savedAudits, setSavedAudits] = useState([]);
  const [pinnedAuditIds, setPinnedAuditIds] = useState(() => {
    try {
      const saved = localStorage.getItem('bytewise_pinned_audits');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const togglePinAudit = (auditId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setPinnedAuditIds(prev => {
      const next = prev.includes(auditId)
        ? prev.filter(id => id !== auditId)
        : [...prev, auditId];
      try {
        localStorage.setItem('bytewise_pinned_audits', JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };
  const [currentAuditId, setCurrentAuditId] = useState(null);
  const [step, setStep] = useState('dashboard'); // 'dashboard' | 'gate' | 'form' | 'access_management' | 'blocked'
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showPinGate, setShowPinGate] = useState(false);
  const settingsMenuRef = React.useRef(null);

  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      const local = localStorage.getItem('bytewise_audit_logs');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      return [];
    }
  });

  const logAuditEvent = async (action, description, entityName = '', auditId = '') => {
    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      action, // 'create' | 'edit' | 'archive' | 'restore' | 'delete'
      description,
      entityName,
      auditId,
      userName: user?.email || 'Auditor',
      timestamp: new Date().toISOString()
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 300);
      try {
        localStorage.setItem('bytewise_audit_logs', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });

    if (db) {
      try {
        await setDoc(doc(db, "audit_logs", newLog.id), newLog);
      } catch (err) {
        console.warn("No se pudo registrar log en Firestore:", err);
      }
    }
  };

  useEffect(() => {
    const handleClickOutsideSettings = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setShowSettingsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideSettings);
    return () => document.removeEventListener('mousedown', handleClickOutsideSettings);
  }, []);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [actor, setActor] = useState({ nombreEmpresa: '', nombreAuditor: '', rol: '', contrasena: '', contrasenaHash: '' });
  const [isGuestMode, setIsGuestMode] = useState(() => {
    return !!new URLSearchParams(window.location.search).get('id');
  });
  const [guestAuditToLoad, setGuestAuditToLoad] = useState(null);
  const [user, setUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null); // 'admin' | 'auditor' | 'viewer' | 'guest'
  const [currentUserBypassPin, setCurrentUserBypassPin] = useState(false);
  const [globalPinBypass, setGlobalPinBypass] = useState(false);

  // Identificador único y metadatos del auditor para el modelo Fork & Merge
  const currentAuditorUid = React.useMemo(() => {
    if (user?.uid) return user.uid;
    let localId = sessionStorage.getItem('bytewise_auditor_uid');
    if (!localId) {
      localId = `auditor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('bytewise_auditor_uid', localId);
    }
    return localId;
  }, [user]);

  const currentAuditorName = (actor?.nombreAuditor || user?.displayName || user?.email?.split('@')[0] || 'Auditor').trim();
  const currentAuditorRole = actor?.rol || (currentUserRole === 'admin' ? 'Auditor Principal' : 'Auditor');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [activeCollaborators, setActiveCollaborators] = useState([]);
  const [accessModalAudit, setAccessModalAudit] = useState(null);
  const [accessPinInput, setAccessPinInput] = useState('');
  const [accessPinError, setAccessPinError] = useState('');
  const [openDropdownAuditId, setOpenDropdownAuditId] = useState(null);
  const [pendingAccessTargetView, setPendingAccessTargetView] = useState('my_draft');
  const [shareModalAudit, setShareModalAudit] = useState(null);
  const [shareLinkMode, setShareLinkMode] = useState('view'); // 'view' | 'collab'
  const [copiedLink, setCopiedLink] = useState(false);
  const [editingQuestionData, setEditingQuestionData] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState(null);
  const [addingSubFor, setAddingSubFor] = useState(null);
  const [subpromptText, setSubpromptText] = useState('');
  const [isGeneratingSub, setIsGeneratingSub] = useState(false);
  const [isInvestigatingCompany, setIsInvestigatingCompany] = useState(false);
  const [copiedPreliminar, setCopiedPreliminar] = useState(false);
  
  const [creationMode, setCreationMode] = useState('base'); // 'base' | 'blank' | 'import'
  const [importedSections, setImportedSections] = useState(null);
  const [importedFileName, setImportedFileName] = useState('');
  const setImportFileName = setImportedFileName;
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');

  // Control seguro de navegación al inicio y persistencia inmediata
  const isNavigatingToHomeRef = React.useRef(false);
  const currentAuditStateRef = React.useRef({
    currentAuditId,
    introData,
    responses,
    generalComments,
    positiveComments,
    negativeComments,
    recommendations,
    actor,
    customSections,
    deletedQuestions,
    evaluations,
    finalAudit
  });

  useEffect(() => {
    currentAuditStateRef.current = {
      currentAuditId,
      introData,
      responses,
      generalComments,
      positiveComments,
      negativeComments,
      recommendations,
      actor,
      customSections,
      deletedQuestions,
      evaluations,
      finalAudit
    };
  }, [currentAuditId, introData, responses, generalComments, positiveComments, negativeComments, recommendations, actor, customSections, deletedQuestions, evaluations, finalAudit]);

  // Sistema de Diálogos Modales Personalizados (ByteWise Modal Dialogs)
  const [modalConfig, setModalConfig] = useState(null);

  const showConfirm = ({ title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', isDanger = false, type }) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: type || (isDanger ? 'danger' : 'confirm'),
        title: title || 'Confirmación',
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          setModalConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setModalConfig(null);
          resolve(false);
        }
      });
    });
  };

  const showPrompt = ({ title, message, placeholder = '', defaultValue = '', inputType = 'text', confirmText = 'Aceptar', cancelText = 'Cancelar' }) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'prompt',
        title: title || 'Ingreso de datos',
        message,
        placeholder,
        defaultValue,
        inputType,
        confirmText,
        cancelText,
        onConfirm: (val) => {
          setModalConfig(null);
          resolve(val);
        },
        onCancel: () => {
          setModalConfig(null);
          resolve(null);
        }
      });
    });
  };

  const showAlert = ({ title, message, type = 'alert', confirmText = 'Entendido' }) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: type, // 'alert' | 'error' | 'success' | 'warning'
        title: title || (type === 'error' ? 'Atención' : (type === 'success' ? 'Éxito' : 'Aviso')),
        message,
        confirmText,
        onConfirm: () => {
          setModalConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setModalConfig(null);
          resolve(true);
        }
      });
    });
  };

  const handleGateFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const result = await parseQuestionsFile(file);
      setImportedSections(result.parsed);
      setImportedFileName(file.name);
      setImportSummary({
        areasCount: result.areasCount,
        questionsCount: result.questionsCount
      });
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Error al leer el archivo. Asegúrate de que sea un archivo de Excel (.xlsx) o .json válido.");
      setImportedSections(null);
      setImportedFileName('');
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
    setPositiveComments('');
    setNegativeComments('');
    setRecommendations('');
    setCustomSections(getDefaultSections());
    setDeletedQuestions([]);
    setEvaluations({});
    setFinalAudit({ status: 'draft', answers: {} });
    setActiveEvaluationView('my_draft');
    setExpandedSections({ 'Información General': true });
    setActiveSection('Información General');
    setShowSettings(false);
    setShowExportMenu(false);
    setAddingSubFor(null);
    setSubpromptText('');
    setCreationMode('base');
    setImportedSections(null);
    setImportedFileName('');
    setImportSummary(null);
    setImportError('');
  };

  const handleProceedLoad = (audit, readOnlyMode = false, targetView = 'my_draft', autoOpenMerge = false) => {
    setGlobalLoadingMessage('Cargando auditoría...');
    setIsReadOnly(readOnlyMode);
    setCurrentAuditId(audit.id);
    const data = audit.data || audit;
    setIntroData(data.introData || audit.introData || INITIAL_INTRO_DATA);
    
    // Cargar Evaluaciones Paralelas (Fork & Merge) y Respuestas
    const evals = data.evaluations || audit.evaluations || {};
    const finalA = data.finalAudit || audit.finalAudit || { status: 'draft', answers: {} };
    const initialResponses = data.responses || audit.responses || {};

    setEvaluations(evals);
    setFinalAudit(finalA);

    // Ajustar vista activa y respuestas correspondientes
    setActiveEvaluationView(targetView);
    if (targetView === 'official') {
      setResponses(finalA.answers && Object.keys(finalA.answers).length > 0 ? finalA.answers : initialResponses);
    } else if (targetView !== 'my_draft' && evals[targetView]?.answers) {
      setResponses(evals[targetView].answers);
    } else {
      // my_draft
      const myAnswers = evals[currentAuditorUid]?.answers;
      setResponses(myAnswers && Object.keys(myAnswers).length > 0 ? myAnswers : initialResponses);
    }

    // Compatibilidad retroactiva: si la auditoría no tenía evaluations pero ya tenía responses
    if (Object.keys(evals).length === 0 && Object.keys(initialResponses).length > 0) {
      const fallbackUid = (data.actor?.nombreAuditor || 'auditor_base').replace(/\s+/g, '_');
      setEvaluations({
        [fallbackUid]: {
          auditorName: data.actor?.nombreAuditor || 'Auditor Inicial',
          role: data.actor?.rol || 'Auditor',
          updatedAt: audit.lastModified || new Date().toISOString(),
          answers: initialResponses
        }
      });
    }

    setCustomSections(sortSections(data.customSections || audit.customSections || getDefaultSections()));
    setDeletedQuestions(data.deletedQuestions || audit.deletedQuestions || []);
    setGeneralComments(data.generalComments || audit.generalComments || '');
    setPositiveComments(data.positiveComments || audit.positiveComments || '');
    setNegativeComments(data.negativeComments || audit.negativeComments || '');
    setRecommendations(data.recommendations || audit.recommendations || '');
    const actorData = data.actor || audit.actor || {};
    setActor({
      nombreEmpresa: actorData.nombreEmpresa || data.introData?.nombreEmpresa || audit.nombreEmpresa || '',
      nombreAuditor: actorData.nombreAuditor || '',
      rol: actorData.rol || '',
      contrasena: '',
      contrasenaHash: actorData.contrasenaHash || audit.contrasenaHash || ''
    });
    setActiveSection('Información General');
    setShowSettings(false);
    setShowExportMenu(false);
    setAddingSubFor(null);
    setStep('form');
    if (autoOpenMerge) {
      setTimeout(() => setShowMergeModal(true), 400);
    }
    setTimeout(() => {
      setGlobalLoadingMessage(null);
    }, 350);
  };

  // Identificar colega registrado en la auditoría
  const getColleagueFromAudit = (audit) => {
    const evals = audit.data?.evaluations || audit.evaluations || {};
    const entries = Object.entries(evals);
    
    // Buscar un auditor con UID distinto al actual o nombre diferente
    const other = entries.find(([uid, ev]) => {
      if (uid !== currentAuditorUid) return true;
      const name = ev.auditorName || '';
      return name && currentAuditorName && name.toLowerCase() !== currentAuditorName.toLowerCase();
    });

    if (other) {
      return {
        uid: other[0],
        auditorName: other[1]?.auditorName || 'Auditor Colega',
        role: other[1]?.role || 'Auditor',
        answers: other[1]?.answers || {}
      };
    }

    // Si no está en evaluations pero la auditoría tiene un actor diferente registrado
    const ownerName = audit.data?.actor?.nombreAuditor || audit.actor?.nombreAuditor || '';
    if (ownerName && currentAuditorName && ownerName.toLowerCase() !== currentAuditorName.toLowerCase()) {
      return {
        uid: 'owner_' + ownerName.replace(/\s+/g, '_'),
        auditorName: ownerName,
        role: audit.data?.actor?.rol || audit.actor?.rol || 'Auditor',
        answers: audit.data?.responses || audit.responses || {}
      };
    }

    return null;
  };

  // Apertura contextual desde el menú del botón "Abrir"
  const handleOpenAuditWithOptions = async (audit, mode, colleagueUid = null) => {
    const isAdmin = currentUserRole === 'admin' || user?.email?.toLowerCase() === 'thomason.mx@gmail.com';
    const canBypassPin = isAdmin || globalPinBypass || currentUserBypassPin;
    const savedHash = audit.data?.actor?.contrasenaHash || audit.actor?.contrasenaHash || audit.contrasenaHash;

    if (mode === 'my_draft') {
      // "Mi Borrador": requiere validar PIN si está configurado y el usuario no tiene bypass
      if (canBypassPin || !savedHash) {
        handleProceedLoad(audit, false, 'my_draft');
      } else {
        setAccessPinInput('');
        setAccessPinError('');
        setPendingAccessTargetView('my_draft');
        setAccessModalAudit(audit);
      }
    } else if (mode === 'colleague') {
      // "Borrador de Colega": modo solo lectura. No requiere PIN si está autenticado en la plataforma
      handleProceedLoad(audit, true, colleagueUid || 'colleague');
    } else if (mode === 'official') {
      // "Versión Oficial": modo solo lectura para consulta general
      handleProceedLoad(audit, true, 'official');
    } else if (mode === 'merge') {
      // "Comparar y Fusionar (Merge)": enlace directo a herramienta de consolidación
      if (canBypassPin || !savedHash) {
        handleProceedLoad(audit, false, 'official', true);
      } else {
        setAccessPinInput('');
        setAccessPinError('');
        setPendingAccessTargetView('merge');
        setAccessModalAudit(audit);
      }
    }
  };

  const handleLoadAudit = async (audit) => {
    handleOpenAuditWithOptions(audit, 'my_draft');
  };

  const handleConfirmAccessPin = async (e) => {
    if (e) e.preventDefault();
    if (!accessModalAudit) return;
    const savedHash = accessModalAudit.data?.actor?.contrasenaHash || accessModalAudit.actor?.contrasenaHash || accessModalAudit.contrasenaHash;
    const enteredHash = await hashPassword(accessPinInput);
    if (enteredHash !== savedHash) {
      setAccessPinError('El PIN ingresado es incorrecto. Inténtalo de nuevo o accede en Modo Solo Lectura.');
      return;
    }
    const auditToLoad = accessModalAudit;
    const targetMode = pendingAccessTargetView || 'my_draft';
    setAccessModalAudit(null);
    if (targetMode === 'merge') {
      handleProceedLoad(auditToLoad, false, 'official', true);
    } else {
      handleProceedLoad(auditToLoad, false, targetMode);
    }
  };

  const handleEnterReadOnly = () => {
    const auditToLoad = accessModalAudit;
    setAccessModalAudit(null);
    handleProceedLoad(auditToLoad, true);
  };

  const handleUnlockWithPin = async () => {
    const isAdmin = currentUserRole === 'admin' || user?.email?.toLowerCase() === 'thomason.mx@gmail.com';
    const canBypassPin = isAdmin || globalPinBypass || currentUserBypassPin;
    if (canBypassPin) {
      setIsReadOnly(false);
      await showAlert({
        type: 'success',
        title: 'Modo Edición Habilitado',
        message: 'Tienes permiso de acceso a auditorías sin PIN. Se ha habilitado la edición completa.'
      });
      return;
    }

    const targetAudit = savedAudits.find(a => a.id === currentAuditId);
    const savedHash = actor.contrasenaHash || targetAudit?.data?.actor?.contrasenaHash;
    if (!savedHash) {
      setIsReadOnly(false);
      await showAlert({
        type: 'success',
        title: 'Modo Edición Habilitado',
        message: 'Esta auditoría no tiene PIN configurado. Se ha habilitado la edición completa.'
      });
      return;
    }

    const pin = await showPrompt({
      title: 'Desbloquear Modo Edición',
      message: 'Ingresa el PIN de seguridad de esta auditoría para autorizar la edición de respuestas y notas:',
      inputType: 'password',
      placeholder: 'PIN de acceso...',
      confirmText: 'Desbloquear Edición',
      cancelText: 'Cancelar'
    });
    if (pin === null) return;

    const enteredHash = await hashPassword(pin);
    if (enteredHash !== savedHash) {
      await showAlert({
        type: 'error',
        title: 'PIN Incorrecto',
        message: 'El PIN ingresado es incorrecto. Continuarás en Modo Solo Lectura.'
      });
      return;
    }

    setIsReadOnly(false);
    await showAlert({
      type: 'success',
      title: '¡Modo Edición Habilitado!',
      message: 'Ahora puedes modificar respuestas, notas y evaluaciones en tiempo real.'
    });
  };

  const handleOpenShareModal = async (audit, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    let token = audit.shareToken;
    if (!token) {
      token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      audit.shareToken = token;
      if (db) {
        updateDoc(doc(db, "auditorias", audit.id), { shareToken: token }).catch(() => {});
      }
    }
    setShareModalAudit({ ...audit, shareToken: token });
    setShareLinkMode('view');
    setCopiedLink(false);
  };

  const handleArchiveAudit = async (audit, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const nombre = audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || 'esta auditoría';
    const confirmed = await showConfirm({
      title: 'Archivar Auditoría',
      message: `¿Deseas mover la auditoría de "${nombre}" a la sección de Auditorías Archivadas?\n\nPodrás consultarla o restaurarla a la lista activa en cualquier momento desde Ajustes.`,
      confirmText: 'Archivar',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    setGlobalLoadingMessage('Archivando auditoría en Firebase...');
    try {
      const updatedAudit = { ...audit, archived: true, lastModified: new Date().toISOString() };
      if (db) {
        await setDoc(doc(db, "auditorias", audit.id), updatedAudit);
      }
      setSavedAudits(prev => prev.map(a => a.id === audit.id ? updatedAudit : a));
      await logAuditEvent('archive', `Auditoría archivada: "${nombre}"`, nombre, audit.id);

      await showAlert({
        type: 'success',
        title: 'Auditoría Archivada',
        message: `La auditoría de "${nombre}" ha sido enviada a Auditorías Archivadas.`
      });
    } catch (err) {
      console.error("Error al archivar la auditoría:", err);
      await showAlert({
        type: 'error',
        title: 'Error al Archivar',
        message: 'Ocurrió un error al intentar archivar la auditoría en la base de datos.'
      });
    } finally {
      setGlobalLoadingMessage(null);
    }
  };

  const handleDeleteAudit = handleArchiveAudit;

  const handleRestoreAudit = async (audit) => {
    const nombre = audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || 'esta auditoría';
    setGlobalLoadingMessage('Restaurando auditoría en Firebase...');
    try {
      const updatedAudit = { ...audit, archived: false, lastModified: new Date().toISOString() };
      if (db) {
        await setDoc(doc(db, "auditorias", audit.id), updatedAudit);
      }
      setSavedAudits(prev => prev.map(a => a.id === audit.id ? updatedAudit : a));
      await logAuditEvent('restore', `Auditoría restaurada a la lista activa: "${nombre}"`, nombre, audit.id);

      await showAlert({
        type: 'success',
        title: 'Auditoría Restaurada',
        message: `La auditoría de "${nombre}" ha sido devuelta con éxito a la lista principal.`
      });
    } catch (err) {
      console.error("Error al restaurar la auditoría:", err);
      await showAlert({
        type: 'error',
        title: 'Error al Restaurar',
        message: 'No se pudo restaurar la auditoría en la base de datos.'
      });
    } finally {
      setGlobalLoadingMessage(null);
    }
  };

  const handlePermanentDeleteAudit = async (audit) => {
    const nombre = audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || 'esta auditoría';
    const isAdmin = currentUserRole === 'admin' || user?.email?.toLowerCase() === 'thomason.mx@gmail.com';
    const canBypassPin = isAdmin || globalPinBypass || currentUserBypassPin;

    const confirmed = await showConfirm({
      title: 'Eliminación Definitiva',
      message: `¿Estás seguro de que deseas eliminar permanentemente la auditoría de "${nombre}"?\n\nEsta acción es irreversible y eliminará todos sus datos de evaluación de la base de datos.`,
      isDanger: true,
      confirmText: 'Eliminar Definitivamente',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    const savedHash = audit.data?.actor?.contrasenaHash;
    // Si NO cuenta con privilegio de bypass de PIN y la auditoría tiene PIN, se solicita verificación
    if (!canBypassPin && savedHash) {
      const pin = await showPrompt({
        title: 'Verificación de Seguridad',
        message: `Esta auditoría está protegida con PIN. Ingresa el PIN para autorizar la eliminación definitiva de "${nombre}":`,
        inputType: 'password',
        placeholder: 'Ingresa el PIN para confirmar...',
        confirmText: 'Confirmar Eliminación',
        cancelText: 'Cancelar'
      });
      if (pin === null) return;
      const enteredHash = await hashPassword(pin);
      if (enteredHash !== savedHash) {
        await showAlert({
          type: 'error',
          title: 'PIN Incorrecto',
          message: 'El PIN ingresado es incorrecto. No se autorizó la eliminación definitiva.'
        });
        return;
      }
    }

    setGlobalLoadingMessage('Eliminando auditoría permanentemente...');
    try {
      if (db) {
        await deleteDoc(doc(db, "auditorias", audit.id));
      }
      setSavedAudits(prev => prev.filter(a => a.id !== audit.id));
      await logAuditEvent('delete', `Auditoría eliminada permanentemente: "${nombre}" (por ${isAdmin ? 'Administrador' : 'Auditor'})`, nombre, audit.id);

      await showAlert({
        type: 'success',
        title: 'Auditoría Eliminada',
        message: `La auditoría de "${nombre}" ha sido eliminada permanentemente con éxito.`
      });
    } catch (err) {
      console.error("Error al eliminar la auditoría:", err);
      await showAlert({
        type: 'error',
        title: 'Error al Eliminar',
        message: 'Ocurrió un error al intentar eliminar la auditoría en la base de datos.'
      });
    } finally {
      setGlobalLoadingMessage(null);
    }
  };

  // Manejo de autenticación y detección de privilegios de rol (Admin vs Auditor vs Invitado)
  useEffect(() => {
    if (!auth) {
      setAuthChecking(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.isAnonymous) {
          setCurrentUserRole('guest');
          setCurrentUserBypassPin(false);
        } else if (currentUser.email?.toLowerCase() === 'thomason.mx@gmail.com') {
          setCurrentUserRole('admin');
          setCurrentUserBypassPin(true);
        } else {
          try {
            if (db && currentUser.email) {
              const emailDocRef = doc(db, 'allowed_emails', currentUser.email.toLowerCase());
              const emailDoc = await getDoc(emailDocRef);
              if (emailDoc.exists()) {
                const data = emailDoc.data();
                const r = (data.role || '').toLowerCase();
                setCurrentUserBypassPin(data.bypassPin === true);
                if (r === 'admin' || r === 'administrador') {
                  setCurrentUserRole('admin');
                } else if (r === 'viewer' || r === 'solo lectura') {
                  setCurrentUserRole('viewer');
                } else {
                  setCurrentUserRole('auditor');
                }
              } else {
                setCurrentUserRole('auditor');
                setCurrentUserBypassPin(false);
              }
            } else {
              setCurrentUserRole('auditor');
              setCurrentUserBypassPin(false);
            }
          } catch (e) {
            console.warn("Error consultando rol del usuario en Firestore:", e);
            setCurrentUserRole('auditor');
            setCurrentUserBypassPin(false);
          }
        }
      } else {
        setCurrentUserRole(null);
        setCurrentUserBypassPin(false);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Escucha en tiempo real de la política global de acceso sin PIN
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system_settings', 'access_policy'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalPinBypass(data.globalPinBypass === true);
      }
    }, (err) => {
      console.warn("Error en listener de política de PIN:", err);
    });
    return () => unsub();
  }, []);

  // Soporte para acceso directo con sesión anónima en enlaces compartidos
  useEffect(() => {
    const handleUrlSharedAccess = async () => {
      if (!auth) return;
      const urlParams = new URLSearchParams(window.location.search);
      const auditId = urlParams.get('id');
      const token = urlParams.get('token');
      const mode = urlParams.get('mode');

      if (!auditId) return;

      if (!auth.currentUser) {
        try {
          console.log("Iniciando sesión anónima en Firebase Auth para enlace compartido...");
          await signInAnonymously(auth);
          console.log("Sesión anónima iniciada con éxito.");
        } catch (anonErr) {
          console.error("Error al iniciar sesión anónima:", anonErr);
        }
      }

      if (mode === 'view') {
        setIsReadOnly(true);
      } else if (mode === 'collab') {
        setIsReadOnly(false);
      }
    };

    handleUrlSharedAccess();
  }, []);

  // Carga centralizada de auditorías (visibles para todos los usuarios autorizados)
  useEffect(() => {
    // Si la verificación de autenticación inicial sigue en curso, esperar antes de determinar el estado
    if (authChecking) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const auditId = urlParams.get('id');

    // Si terminó la autenticación y no hay usuario ni ID de auditoría invitada, detener carga
    if (!user && !auditId) {
      setAuditsLoading(false);
      return;
    }

    const loadAudits = async () => {
      setAuditsLoading(true);
      try {
        if (!db) {
          setAuditsLoading(false);
          return;
        }
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
            const token = urlParams.get('token');
            const mode = urlParams.get('mode') || (token ? 'view' : null);
            const savedHash = targetAudit.data?.actor?.contrasenaHash;
            const tokenValid = token && targetAudit.shareToken && token === targetAudit.shareToken;

            if (mode === 'view') {
              handleProceedLoad(targetAudit, true);
            } else if (mode === 'collab') {
              if (tokenValid || !savedHash) {
                handleProceedLoad(targetAudit, false);
              } else {
                setAccessPinInput('');
                setAccessPinError('');
                setAccessModalAudit(targetAudit);
              }
            } else {
              if (tokenValid) {
                handleProceedLoad(targetAudit, true);
              } else if (savedHash) {
                setAccessPinInput('');
                setAccessPinError('');
                setAccessModalAudit(targetAudit);
              } else {
                handleProceedLoad(targetAudit, false);
              }
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

    const fetchLogs = async () => {
      if (!db || !user) return;
      try {
        const snap = await getDocs(collection(db, "audit_logs"));
        const logs = [];
        snap.forEach(d => logs.push(d.data()));
        logs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        if (logs.length > 0) {
          setAuditLogs(logs);
          localStorage.setItem('bytewise_audit_logs', JSON.stringify(logs.slice(0, 300)));
        }
      } catch (err) {
        console.warn("No se pudieron cargar logs de auditoría:", err);
      }
    };
    fetchLogs();
  }, [user, authChecking]);

  const savedAuditsRef = React.useRef(savedAudits);
  useEffect(() => { savedAuditsRef.current = savedAudits; }, [savedAudits]);

  // Guardado debounced en Firestore (protegido si isReadOnly === true)
  useEffect(() => {
    // Si estamos navegando hacia el panel o no estamos en form o no hay ID o estamos en MODO SOLO LECTURA, no guardar en Firestore
    if (isNavigatingToHomeRef.current || step !== 'form' || !currentAuditId || isReadOnly) {
      return;
    }

    const companyName = (introData?.nombreEmpresa || actor?.nombreEmpresa || '').trim();
    const hasResponses = responses && Object.keys(responses).length > 0;

    // Protección contra sobreescritura accidental si el estado fue reseteado a vacío
    if (!companyName && !hasResponses && !introData?.sitioWeb) {
      return;
    }

    const prevList = savedAuditsRef.current;
    const index = prevList.findIndex(a => a.id === currentAuditId);
    let newList = [...prevList];
    const auditData = {
      id: currentAuditId,
      lastModified: new Date().toISOString(),
      nombreEmpresa: companyName || 'Empresa sin nombre',
      data: { introData, responses, generalComments, positiveComments, negativeComments, recommendations, actor, customSections, deletedQuestions, evaluations, finalAudit }
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
        if (isNavigatingToHomeRef.current || isReadOnly) return;
        try {
          const docRef = doc(db, "auditorias", currentAuditId);
          setDoc(docRef, auditData, { merge: true })
            .then(() => console.log("Auditoría guardada exitosamente en Firebase (debounced)."))
            .catch(e => console.error("Error al guardar en Firebase:", e));
        } catch(e) {}
      }, 1500);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introData, responses, generalComments, positiveComments, negativeComments, recommendations, actor, customSections, deletedQuestions, evaluations, finalAudit, currentAuditId, step, isReadOnly]);

  // Sincronización en tiempo real con onSnapshot y presencia activa
  useEffect(() => {
    if (step !== 'form' || !currentAuditId || !db) return;

    const docRef = doc(db, "auditorias", currentAuditId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const remoteData = docSnap.data();

      // Sincronizar sesiones activas para presencia en vivo
      const sessions = remoteData.activeSessions || {};
      const now = Date.now();
      const activeList = Object.values(sessions).filter(s => {
        if (!s || !s.lastActive) return false;
        return (now - new Date(s.lastActive).getTime()) < 45000;
      });
      setActiveCollaborators(activeList);

      const freshData = remoteData.data;
      if (freshData) {
        // Sincronizar evaluaciones paralelas y finalAudit de forma continua
        if (freshData.evaluations) setEvaluations(freshData.evaluations);
        if (freshData.finalAudit) setFinalAudit(freshData.finalAudit);

        // Si el usuario actual está en modo solo lectura, sincronizar datos en vivo desde el auditor editor
        if (isReadOnly) {
          if (freshData.responses) setResponses(freshData.responses);
          if (freshData.introData) setIntroData(freshData.introData);
          if (freshData.generalComments !== undefined) setGeneralComments(freshData.generalComments);
          if (freshData.positiveComments !== undefined) setPositiveComments(freshData.positiveComments);
          if (freshData.negativeComments !== undefined) setNegativeComments(freshData.negativeComments);
          if (freshData.recommendations !== undefined) setRecommendations(freshData.recommendations);
          if (freshData.customSections) setCustomSections(sortSections(freshData.customSections));
          if (freshData.deletedQuestions !== undefined) setDeletedQuestions(freshData.deletedQuestions);
        }
      }
    }, (error) => {
      console.warn("Error en suscripción en vivo onSnapshot:", error);
    });

    return () => unsubscribe();
  }, [step, currentAuditId, isReadOnly]);

  // Heartbeat de presencia activa en Firestore
  useEffect(() => {
    if (step !== 'form' || !currentAuditId || !db) return;

    const mySessionData = {
      clientId,
      userIdent: user?.email || actor.nombreAuditor || 'Invitado',
      displayName: user?.displayName || (user?.email ? user.email.split('@')[0] : (actor.nombreAuditor || 'Invitado')),
      mode: isReadOnly ? 'viewer' : 'editor',
      lastActive: new Date().toISOString()
    };

    const updatePresence = async () => {
      try {
        const docRef = doc(db, "auditorias", currentAuditId);
        await updateDoc(docRef, {
          [`activeSessions.${clientId}`]: mySessionData
        });
      } catch (err) {
        try {
          const docRef = doc(db, "auditorias", currentAuditId);
          await setDoc(docRef, {
            activeSessions: {
              [clientId]: mySessionData
            }
          }, { merge: true });
        } catch (e) {}
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 15000);

    return () => {
      clearInterval(interval);
      try {
        const docRef = doc(db, "auditorias", currentAuditId);
        updateDoc(docRef, {
          [`activeSessions.${clientId}`]: null
        }).catch(() => {});
      } catch (e) {}
    };
  }, [step, currentAuditId, isReadOnly, user, actor.nombreAuditor]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (db && currentAuditId && step === 'form') {
        const docRef = doc(db, "auditorias", currentAuditId);
        updateDoc(docRef, {
          [`activeSessions.${clientId}`]: null
        }).catch(() => {});
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

  const rewriteReportCommentWithAI = async (fieldKey) => {
    let userText = '';
    let fieldTitle = '';
    let fieldInstruction = '';
    let setter = null;

    if (fieldKey === 'positive') {
      userText = (positiveComments || '').trim();
      fieldTitle = 'Comentarios Positivos y Fortalezas';
      fieldInstruction = 'Perfecciona y redacta de manera técnica y ejecutiva las fortalezas, controles maduros y aspectos positivos de TI y seguridad encontrados en la empresa evaluada.';
      setter = setPositiveComments;
    } else if (fieldKey === 'negative') {
      userText = (negativeComments || '').trim();
      fieldTitle = 'Comentarios Negativos y Hallazgos';
      fieldInstruction = 'Perfecciona y redacta con claridad y rigor técnico los hallazgos críticos, deficiencias, vulnerabilidades, brechas y riesgos detectados en la auditoría.';
      setter = setNegativeComments;
    } else if (fieldKey === 'recommendations') {
      userText = (recommendations || '').trim();
      fieldTitle = 'Recomendaciones y Plan de Acción';
      fieldInstruction = 'Redacta recomendaciones estratégicas priorizadas y un plan de acción concreto para mitigar los riesgos y elevar la madurez de seguridad de la empresa.';
      setter = setRecommendations;
    } else {
      userText = (generalComments || '').trim();
      fieldTitle = 'Comentarios Generales';
      fieldInstruction = 'Conclusiones y reporte general de auditoría de TI.';
      setter = setGeneralComments;
    }

    if (!userText) {
      const shouldGenerate = await showConfirm({
        title: `Generar ${fieldTitle}`,
        message: `No has ingresado texto aún en este apartado.\n¿Deseas que la Inteligencia Artificial redacte una propuesta profesional considerando los puntajes y áreas de la auditoría?`,
        confirmText: 'Generar con IA',
        cancelText: 'Cancelar'
      });
      if (!shouldGenerate) return;
      userText = `Genera un análisis profesional y detallado de ${fieldTitle} para la empresa ${introData.nombreEmpresa || 'evaluada'} basado en los resultados de la auditoría.`;
    }

    try {
      setRewritingField(fieldKey);
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
            tipoComentario: fieldKey,
            categoria: fieldTitle,
            instruccion: fieldInstruction,
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
      let cleanText = filterAiResponse(data);

      cleanText = cleanText
        .replace(/OBSERVACIÓN:\s*/gi, "OBSERVACIÓN:\n")
        .replace(/\s*IMPACTO:\s*/gi, "\n\nIMPACTO:\n")
        .replace(/\s*RECOMENDACIÓN:\s*/gi, "\n\nRECOMENDACIÓN:\n")
        .trim();

      if (setter) {
        setter(cleanText);
      }
    } catch (err) {
      console.error(err);
      await showAlert({
        type: 'error',
        title: 'Error al optimizar',
        message: 'No fue posible completar la solicitud con el asistente de IA. Por favor intenta de nuevo.'
      });
    } finally {
      setRewritingField(null);
    }
  };

  const rewriteCommentsWithAI = () => rewriteReportCommentWithAI('general');


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
          instruccion: "Redacta de forma profesional y clara la observación y hallazgo para esta pregunta de auditoría de TI. Omite cualquier estructura o metadato JSON y devuelve únicamente el texto redactado.",
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
    const cleanText = filterAiResponse(data);

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
    const cleanText = filterAiResponse(data);

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
    const cleanText = filterAiResponse(data);

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

const handleSaveQuickEditQuestion = (e) => {
  if (e) e.preventDefault();
  if (!editingQuestionData) return;
  const { section, id, pregunta, requisito, evidencia, nota, escalaEvaluacion } = editingQuestionData;
  setCustomSections(prev => {
    const updated = { ...prev };
    const list = [...(updated[section] || [])];
    const idx = list.findIndex(q => q.id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        pregunta: (pregunta || '').trim(),
        requisito: (requisito || '').trim(),
        evidencia: (evidencia || '').trim(),
        nota: (nota || '').trim(),
        escalaEvaluacion: Array.isArray(escalaEvaluacion)
          ? escalaEvaluacion.map(s => (s || '').trim())
          : list[idx].escalaEvaluacion
      };
      updated[section] = list;
    }
    return updated;
  });
  setEditingQuestionData(null);
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

  const saveCurrentAuditImmediate = async (auditIdToSave = null) => {
    const currentState = currentAuditStateRef.current;
    const targetId = auditIdToSave || currentState.currentAuditId || currentAuditId;
    if (!targetId) return;

    const companyName = (currentState.introData?.nombreEmpresa || currentState.actor?.nombreEmpresa || introData?.nombreEmpresa || actor?.nombreEmpresa || '').trim();

    const auditData = {
      id: targetId,
      lastModified: new Date().toISOString(),
      nombreEmpresa: companyName || 'Empresa sin nombre',
      data: {
        introData: currentState.introData || introData,
        responses: currentState.responses || responses,
        generalComments: currentState.generalComments || generalComments,
        positiveComments: currentState.positiveComments || positiveComments,
        negativeComments: currentState.negativeComments || negativeComments,
        recommendations: currentState.recommendations || recommendations,
        actor: currentState.actor || actor,
        customSections: currentState.customSections || customSections,
        deletedQuestions: currentState.deletedQuestions || deletedQuestions || [],
        evaluations: currentState.evaluations || evaluations || {},
        finalAudit: currentState.finalAudit || finalAudit || { status: 'draft', answers: {} }
      }
    };

    // Actualizar inmediatamente la lista de auditorías en el estado local
    setSavedAudits(prevList => {
      const index = prevList.findIndex(a => a.id === targetId);
      let newList = [...prevList];
      if (index >= 0) {
        newList[index] = auditData;
      } else {
        newList.push(auditData);
      }
      return newList.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    });

    // Guardar inmediatamente en Firebase Firestore
    if (db) {
      try {
        const docRef = doc(db, "auditorias", targetId);
        await setDoc(docRef, auditData, { merge: true });
        console.log("Auditoría guardada exitosamente de forma inmediata al volver al panel.");
      } catch (e) {
        console.error("Error al guardar de forma inmediata en Firebase:", e);
      }
    }
  };

  const handleReturnToDashboard = async () => {
    try {
      setGlobalLoadingMessage('Guardando y sincronizando auditoría...');
      // 1. Activar bandera de navegación para neutralizar el auto-guardado debounced
      isNavigatingToHomeRef.current = true;

      const targetId = currentAuditId;

      // 2. Limpiar presencia de sesión activa en Firebase
      if (db && targetId) {
        try {
          const docRef = doc(db, "auditorias", targetId);
          await updateDoc(docRef, {
            [`activeSessions.${clientId}`]: null
          });
        } catch (e) {}
      }

      // 3. Guardar inmediatamente la auditoría activa antes de salir (únicamente si está en modo editor)
      if (targetId && !isReadOnly) {
        await saveCurrentAuditImmediate(targetId);
        await releaseLock(targetId);
      }

      // 4. Limpiar cualquier parámetro "?id=" o tokens de la URL sin recargar
      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      }

      // 5. Cambiar a la vista del panel/dashboard
      setStep('dashboard');

      // 6. Resetear de forma segura los estados de edición
      setCurrentAuditId(null);
      setIsReadOnly(false);
      setIntroData(INITIAL_INTRO_DATA);
      setResponses({});
      setGeneralComments('');
      setPositiveComments('');
      setNegativeComments('');
      setRecommendations('');
      setCustomSections(getDefaultSections());
      setDeletedQuestions([]);
      setEvaluations({});
      setFinalAudit({ status: 'draft', answers: {} });
      setActiveEvaluationView('my_draft');
      setActor({ nombreEmpresa: '', nombreAuditor: '', rol: '', contrasena: '', contrasenaHash: '' });
      setExpandedSections({ 'Información General': true });
      setActiveSection('Información General');
      setShowSettings(false);
      setShowExportMenu(false);
      setAddingSubFor(null);
      setSubpromptText('');
      setCreationMode('base');
      setImportedSections(null);
      setImportedFileName('');
      setImportSummary(null);
      setImportError('');
    } catch (err) {
      console.error("Error al regresar al panel de auditorías:", err);
      setStep('dashboard');
    } finally {
      setGlobalLoadingMessage(null);
      setTimeout(() => {
        isNavigatingToHomeRef.current = false;
      }, 400);
    }
  };

  const updateIntroData = (field, value) => {
    if (isReadOnly) return;
    setIntroData(prev => ({
      ...prev,
      [field]: value
    }));
  };



  const startNewEvaluation = async () => {
    if (isReadOnly) return;
    const confirmed = await showConfirm({
      title: 'Iniciar Nueva Evaluación',
      message: '¿Estás seguro de que deseas reiniciar la evaluación?\nSe perderán las respuestas y cambios no guardados en esta sesión.',
      isDanger: true,
      confirmText: 'Reiniciar Formulario',
      cancelText: 'Cancelar'
    });
    if (confirmed) {
      setResponses({});
      setGeneralComments('');
      setIntroData(INITIAL_INTRO_DATA);
      setCustomSections(getDefaultSections());
      setDeletedQuestions([]);
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
  }, [responses, customSections]);

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
    if (isReadOnly || activeEvaluationView !== 'my_draft') return;
    const key = `${section}-${id}`;

    // 1. Actualizar estado local inmediato de respuestas para cálculos y UI
    setResponses(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));

    // 2. Almacenar por separado en el borrador personal del auditor actual (Fork & Merge)
    setEvaluations(prev => {
      const myEval = prev[currentAuditorUid] || {
        auditorName: currentAuditorName,
        role: currentAuditorRole,
        updatedAt: new Date().toISOString(),
        answers: {}
      };
      const currentAns = myEval.answers?.[key] || {};
      const scoreVal = field === 'evaluacion' ? value : (currentAns.score ?? currentAns.evaluacion);
      const commentVal = field === 'observaciones' ? value : (currentAns.comment ?? currentAns.observaciones);
      const evidenceVal = field === 'evidencia' ? value : (currentAns.evidence ?? currentAns.evidencia);

      const updatedAns = {
        ...currentAns,
        [field]: value,
        score: scoreVal,
        evaluacion: scoreVal,
        comment: commentVal,
        observaciones: commentVal,
        evidence: evidenceVal,
        evidencia: evidenceVal,
      };

      return {
        ...prev,
        [currentAuditorUid]: {
          ...myEval,
          auditorName: currentAuditorName,
          role: currentAuditorRole,
          updatedAt: new Date().toISOString(),
          answers: {
            ...myEval.answers,
            [key]: updatedAns
          }
        }
      };
    });
  };

  // Alternar vista de evaluación entre Mi Borrador, Borrador de colega o Versión Oficial
  const handleChangeEvaluationView = (viewKey) => {
    setActiveEvaluationView(viewKey);
    if (viewKey === 'my_draft') {
      const myAnswers = evaluations[currentAuditorUid]?.answers;
      if (myAnswers && Object.keys(myAnswers).length > 0) {
        setResponses(myAnswers);
      }
    } else if (viewKey === 'official') {
      setResponses(finalAudit.answers || {});
    } else {
      // Borrador de un colega
      const otherAnswers = evaluations[viewKey]?.answers || {};
      setResponses(otherAnswers);
    }
  };

  // Consolidar respuestas y generar Versión Oficial de Auditoría
  const handleConsolidate = (consolidatedAnswers, auditorAId, auditorBId) => {
    const updatedFinalAudit = {
      status: 'consolidated',
      consolidatedAt: new Date().toISOString(),
      consolidatedBy: currentAuditorName,
      auditorAId,
      auditorBId,
      answers: consolidatedAnswers
    };

    setFinalAudit(updatedFinalAudit);
    setResponses(consolidatedAnswers);
    setActiveEvaluationView('official');
    setShowMergeModal(false);

    // Guardar inmediatamente en Firestore
    saveCurrentAuditImmediate();

    showAlert({
      type: 'success',
      title: 'Auditoría Oficial Consolidada',
      message: 'Se ha generado exitosamente la Versión Oficial de la auditoría. Todos los reportes ejecutivos (Word y Excel) utilizarán ahora estas respuestas consolidadas.'
    });
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
      setGlobalLoadingMessage('Generando reporte Word ejecutivo y detallado...');
      const avgScore = calculateTotalScore();
      const totalScore = calculateTotalRealScore();
      const totalQuestions = getTotalQuestions();
      const answeredCount = getAnsweredQuestions();
      const scoreLevel = getScoreLevel(avgScore);
      const areaScores = calculateAreaScores();
      const evaluatorsList = Object.values(evaluations);

      await generateExecutiveDocx({
        introData,
        actor,
        customSections,
        responses,
        areaScores,
        avgScore,
        totalScore,
        totalQuestions,
        answeredCount,
        scoreLevel,
        positiveComments,
        negativeComments,
        recommendations,
        generalComments,
        evaluatorsList,
        logoUrl: logoPng,
      });
    } catch (err) {
      console.error("Error al exportar reporte Word:", err);
      alert("Error al exportar Word. Revisa la consola para más detalles.");
    } finally {
      setGlobalLoadingMessage(null);
    }
  };









  const exportToExcel = async () => {
    try {
      setGlobalLoadingMessage('Generando reporte Excel profesional multi-pestaña...');
      const avgScore = calculateTotalScore();
      const totalScore = calculateTotalRealScore();
      const scoreLevel = getScoreLevel(avgScore);
      const areaScores = calculateAreaScores();

      await exportAuditToProfessionalExcel({
        introData,
        actor,
        customSections,
        responses,
        areaScores,
        avgScore,
        totalScore,
        scoreLevel,
        positiveComments,
        negativeComments,
        recommendations,
        generalComments,
      });
    } catch (error) {
      console.error("Error al exportar Excel:", error);
      alert("Hubo un error al generar el archivo Excel profesional.");
    } finally {
      setGlobalLoadingMessage(null);
    }
  };

 


  if (authChecking || (isGuestMode && auditsLoading)) {
    return <CubeLoader message={authChecking ? "Verificando sesión segura..." : "Cargando auditoría..."} />;
  }

  if (!isGuestMode && user && auditsLoading) {
    return <CubeLoader message="Cargando auditorías desde la nube..." />;
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
              setDeletedQuestions(audit.data.deletedQuestions || []);
              setEvaluations(audit.data.evaluations || {});
              setFinalAudit(audit.data.finalAudit || { status: 'draft', answers: {} });
              setActiveEvaluationView('my_draft');
              setGeneralComments(audit.data.generalComments || '');
              setPositiveComments(audit.data.positiveComments || '');
              setNegativeComments(audit.data.negativeComments || '');
              setRecommendations(audit.data.recommendations || '');
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
                       setDeletedQuestions(freshAudit.data?.deletedQuestions || []);
                       setEvaluations(freshAudit.data?.evaluations || {});
                       setFinalAudit(freshAudit.data?.finalAudit || { status: 'draft', answers: {} });
                       setActiveEvaluationView('my_draft');
                       setGeneralComments(freshAudit.data.generalComments || '');
                       setPositiveComments(freshAudit.data.positiveComments || '');
                       setNegativeComments(freshAudit.data.negativeComments || '');
                       setRecommendations(freshAudit.data.recommendations || '');
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

  const renderAccessModal = () => {
    if (!accessModalAudit) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Lock size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">Auditoría Protegida</h3>
                  <p className="text-xs text-slate-500 truncate">
                    {accessModalAudit.nombreEmpresa || accessModalAudit.data?.introData?.nombreEmpresa || 'Empresa'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccessModalAudit(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Esta evaluación está protegida por su autor. Selecciona tu modalidad de ingreso:
            </p>

            {/* Opción 1: Modo Edición con PIN */}
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <KeyRound size={15} className="text-blue-600" /> Modo Edición Completa
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                  Requiere PIN
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Podrás responder preguntas, editar notas y guardar cambios en tiempo real.
              </p>
              <form onSubmit={handleConfirmAccessPin} className="space-y-2 pt-1">
                <input
                  type="password"
                  value={accessPinInput}
                  onChange={(e) => {
                    setAccessPinInput(e.target.value);
                    setAccessPinError('');
                  }}
                  placeholder="Ingresa el PIN de seguridad..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                  autoFocus
                />
                {accessPinError && (
                  <p className="text-[11px] text-red-600 font-medium">{accessPinError}</p>
                )}
                <button
                  type="submit"
                  disabled={!accessPinInput.trim()}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Desbloquear en Modo Edición
                </button>
              </form>
            </div>

            {/* Separador */}
            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-2.5 text-[11px] text-slate-400 font-medium uppercase tracking-wider absolute">o continuar como</span>
            </div>

            {/* Opción 2: Solo Lectura */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye size={15} className="text-slate-600" /> Modo Solo Lectura (Observador)
                </span>
                <p className="text-[11px] text-slate-500">
                  Visualiza respuestas y métricas en vivo sin alterar los datos guardados.
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnterReadOnly}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
              >
                Entrar como Observador
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setAccessModalAudit(null)}
              className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderShareModal = () => {
    if (!shareModalAudit) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Share2 size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">Compartir Auditoría</h3>
                  <p className="text-xs text-slate-500 truncate">
                    {shareModalAudit.nombreEmpresa || shareModalAudit.data?.introData?.nombreEmpresa || 'Empresa'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareModalAudit(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Genera un enlace seguro para que clientes, observadores o auditores externos accedan al instante sin necesidad de registrarse previamente.
            </p>

            {/* Selector de Modo */}
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setShareLinkMode('view'); setCopiedLink(false); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  shareLinkMode === 'view'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={14} />
                <span>Solo Lectura (Observador)</span>
              </button>
              <button
                type="button"
                onClick={() => { setShareLinkMode('collab'); setCopiedLink(false); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  shareLinkMode === 'collab'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit2 size={14} />
                <span>Colaborador (Edición)</span>
              </button>
            </div>

            {/* Descripción del modo */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed">
              {shareLinkMode === 'view' ? (
                <p>
                  <strong>Modo Observador:</strong> El destinatario podrá consultar en tiempo real las respuestas, avances y comentarios sin posibilidad de modificar ningún dato.
                </p>
              ) : (
                <p>
                  <strong>Modo Colaborador:</strong> El invitado podrá responder preguntas, redactar observaciones y trabajar concurrentemente en la auditoría.
                </p>
              )}
            </div>

            {/* Campo de Enlace y Botón de Copiar */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Enlace de Acceso Directo</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}${window.location.pathname}?id=${shareModalAudit.id}&token=${shareModalAudit.shareToken || ''}&mode=${shareLinkMode}`}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 select-all focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const url = `${window.location.origin}${window.location.pathname}?id=${shareModalAudit.id}&token=${shareModalAudit.shareToken || ''}&mode=${shareLinkMode}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    } catch (err) {
                      console.error("Error al copiar enlace:", err);
                    }
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              {copiedLink && (
                <p className="text-[11px] text-emerald-600 font-medium">
                  ✓ Enlace copiado al portapapeles. Listo para compartir.
                </p>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setShareModalAudit(null)}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // PANTALLA INICIAL: DASHBOARD DE AUDITORÍAS
  // ==========================================
  if (step === 'dashboard') {
    const canBypassPin = currentUserRole === 'admin' || user?.email?.toLowerCase() === 'thomason.mx@gmail.com' || globalPinBypass || currentUserBypassPin;
    const isAuditPinned = (audit) => pinnedAuditIds.includes(audit.id) || !!audit.isPinned;
    const archivedAudits = savedAudits.filter(audit => !!audit.archived);
    const activeAudits = savedAudits.filter(audit => !audit.archived);

    const filteredAudits = activeAudits.filter(audit => {
      if (!dashboardSearch.trim()) return true;
      const term = dashboardSearch.toLowerCase();
      const empresa = (audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || '').toLowerCase();
      const auditor = (audit.data?.actor?.nombreAuditor || '').toLowerCase();
      const giro = (audit.data?.introData?.giro || '').toLowerCase();
      return empresa.includes(term) || auditor.includes(term) || giro.includes(term);
    });

    // Ordenar: primero las fijadas con chincheta, luego por fecha de última modificación
    const sortedAudits = [...filteredAudits].sort((a, b) => {
      const pinA = isAuditPinned(a) ? 1 : 0;
      const pinB = isAuditPinned(b) ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
    });

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
        {/* Top Navbar */}
        <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/70 px-4 md:px-8 py-3.5 sticky top-0 z-30 shadow-2xs">
          <div className="w-full max-w-[1700px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoPng} alt="ByteWise" className="h-8 md:h-10 w-auto object-contain brightness-0 invert" />
              <div className="hidden sm:block border-l border-slate-200/80 pl-3">
                <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Auditoría y Gestión de TI</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user && (
                <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/70 px-3 py-1.5 rounded-full border border-slate-200/60">
                  <User size={13} className="text-slate-500" />
                  <span className="max-w-[180px] truncate">{user.email || 'Auditor Conectado'}</span>
                </div>
              )}

              {/* Botón de Ajustes con Dropdown */}
              <div className="relative" ref={settingsMenuRef}>
                <button 
                  onClick={() => setShowSettingsDropdown(prev => !prev)}
                  className={`w-9 h-9 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                    showSettingsDropdown 
                      ? 'border-blue-400 text-blue-600 bg-blue-50/70 shadow-2xs' 
                      : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Configuración y herramientas"
                  aria-label="Configuración"
                >
                  <Settings size={18} strokeWidth={1.8} className={`transition-transform duration-200 ${showSettingsDropdown ? 'rotate-45 text-blue-600' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showSettingsDropdown && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-40 text-sm animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Opciones del Sistema
                    </div>
                    <button
                      onClick={() => {
                        setShowSettingsDropdown(false);
                        setStep('access_management');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left cursor-pointer group"
                    >
                      <KeyRound size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                      <span className="font-medium text-xs">Gestión de Accesos</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowSettingsDropdown(false);
                        setShowArchivedModal(true);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Archive size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                        <span className="font-medium text-xs">Auditorías Archivadas</span>
                      </div>
                      {archivedAudits.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                          {archivedAudits.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowSettingsDropdown(false);
                        setShowLogsModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left cursor-pointer group"
                    >
                      <History size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                      <span className="font-medium text-xs">Historial de Cambios</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Botón de Logout */}
              <button 
                onClick={() => { signOut(auth); resetToInitialState(); setStep('dashboard'); }} 
                className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </header>

        {/* Cabecera de Página */}
        <div className="bg-white border-b border-slate-200/70 py-6 px-4 md:px-8">
          <div className="w-full max-w-[1700px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Gestión de Auditorías
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Supervisión de madurez tecnológica, cumplimiento y evaluaciones activas.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  resetToInitialState();
                  setStep('gate');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={16} strokeWidth={2.2} />
                <span>Nueva Auditoría</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <main className="w-full max-w-[1700px] mx-auto p-4 md:p-8 flex-1">
          {/* Barra de Filtro y Resumen */}
          <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative flex-1 max-w-lg">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
                placeholder="Buscar por empresa, auditor o giro..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
              />
              {dashboardSearch && (
                <button
                  onClick={() => setDashboardSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-500 flex items-center justify-between sm:justify-end gap-2 px-2">
              <span>
                {sortedAudits.length} {sortedAudits.length === 1 ? 'auditoría encontrada' : 'auditorías registradas'}
              </span>
              {savedAudits.length > 0 && sortedAudits.length !== savedAudits.length && (
                <span className="text-slate-400">(filtradas de {savedAudits.length})</span>
              )}
            </div>
          </div>

          {/* Tabla de Auditorías */}
          {auditsLoading ? (
            <div className="w-full bg-white rounded-xl shadow-xs border border-slate-100 p-16 flex flex-col items-center justify-center min-h-[320px]">
              <CubeLoader message="Cargando auditorías desde la nube..." />
            </div>
          ) : sortedAudits.length > 0 ? (
            <div className="w-full bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full table-auto text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75">
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[30%] min-w-[260px]">
                        Empresa / Entidad
                      </th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[18%] min-w-[170px]">
                        Auditor a Cargo
                      </th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[18%] min-w-[160px]">
                        Progreso
                      </th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[14%] min-w-[130px]">
                        Madurez / Puntos
                      </th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[10%] min-w-[110px]">
                        Modificado
                      </th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right w-[10%] min-w-[140px] whitespace-nowrap">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedAudits.map((audit) => {
                      const summary = getAuditSummary(audit);
                      const nombreEmpresa = audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || 'Empresa sin nombre';
                      const giro = audit.data?.introData?.giro;
                      const sitioWeb = audit.data?.introData?.sitioWeb;
                      const auditorNombre = audit.data?.actor?.nombreAuditor || 'Sin asignar';
                      const auditorRol = audit.data?.actor?.rol || 'Auditor';
                      const tienePin = !!audit.data?.actor?.contrasenaHash;
                      const fechaMod = audit.lastModified ? new Date(audit.lastModified) : new Date();
                      const isPinned = isAuditPinned(audit);

                      return (
                        <tr 
                          key={audit.id} 
                          className={`transition-colors ${
                            isPinned 
                              ? 'bg-blue-50/25 hover:bg-blue-50/50' 
                              : 'hover:bg-slate-50/60'
                          }`}
                        >
                          {/* Empresa / Entidad */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={getCompanyAvatarBadgeClass(nombreEmpresa)}>
                                {getCompanyInitials(nombreEmpresa)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span 
                                    className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer truncate max-w-sm xl:max-w-md" 
                                    onClick={() => handleLoadAudit(audit)}
                                    title={nombreEmpresa}
                                  >
                                    {nombreEmpresa}
                                  </span>
                                  {tienePin && (
                                    <span 
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                                        canBypassPin
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                          : 'bg-slate-100 text-slate-600'
                                      }`} 
                                      title={canBypassPin ? "Auditoría protegida con PIN (Acceso directo sin PIN habilitado)" : "Auditoría protegida con PIN"}
                                    >
                                      {canBypassPin ? (
                                        <Unlock size={10} className="text-blue-600" />
                                      ) : (
                                        <Lock size={10} className="text-slate-500" />
                                      )}
                                      <span>{canBypassPin ? 'Sin PIN' : 'PIN'}</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-400 truncate max-w-sm xl:max-w-md">
                                  {giro || 'Giro no especificado'}
                                  {sitioWeb && (
                                    <>
                                      {' • '}
                                      <a
                                        href={sitioWeb.startsWith('http') ? sitioWeb : `https://${sitioWeb}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {sitioWeb.replace(/^https?:\/\//, '')}
                                      </a>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Auditor a Cargo */}
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
                                {getCompanyInitials(auditorNombre)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm text-slate-700 font-medium leading-tight">{auditorNombre}</span>
                                {auditorRol && (
                                  <span className="text-[11px] text-slate-400">{auditorRol}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Progreso */}
                          <td className="p-4">
                            <div className="w-full max-w-[200px]">
                              <div className="flex justify-between items-center mb-1 text-xs">
                                <span className="text-slate-500 font-medium">{summary.answeredQuestions} de {summary.totalQuestions}</span>
                                <span className="font-semibold text-blue-600">{summary.percentage}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                                  style={{ width: `${summary.percentage}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Madurez / Puntos */}
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`w-max px-2.5 py-0.5 rounded-full text-xs font-medium ${summary.level.badgeClass}`}>
                                {summary.level.label}
                              </span>
                              <span className="text-xs text-slate-500 font-semibold">{summary.avgScore} / 4.0 pts</span>
                            </div>
                          </td>

                          {/* Modificado */}
                          <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-600">{fechaMod.toLocaleDateString()}</span>
                              <span className="text-[11px] text-slate-400">{fechaMod.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Botón PIN */}
                              <button
                                onClick={(e) => togglePinAudit(audit.id, e)}
                                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                  isPinned 
                                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                                    : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
                                }`}
                                title={isPinned ? "Desanclar del inicio" : "Fijar auditoría al inicio"}
                                aria-label="Fijar auditoría"
                              >
                                <Pin size={16} className={isPinned ? "fill-blue-600 rotate-45" : ""} />
                              </button>
                              
                              {/* Botón Compartir */}
                              <button
                                onClick={(e) => handleOpenShareModal(audit, e)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Compartir enlace seguro de auditoría"
                                aria-label="Compartir auditoría"
                              >
                                <Share2 size={16} />
                              </button>

                              {/* Botón Eliminar / Archivar */}
                              <button
                                onClick={(e) => handleArchiveAudit(audit, e)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Archivar auditoría"
                                aria-label="Archivar auditoría"
                              >
                                <Trash2 size={16} />
                              </button>

                              {/* Botón Abrir con Dropdown contextual */}
                              <div className="relative inline-block text-left ml-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownAuditId(openDropdownAuditId === audit.id ? null : audit.id);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                                >
                                  <span>Abrir</span>
                                  <ChevronDown size={13} className={`transition-transform duration-200 ${openDropdownAuditId === audit.id ? 'rotate-180' : ''}`} />
                                </button>

                                {openDropdownAuditId === audit.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-30" 
                                      onClick={(e) => { e.stopPropagation(); setOpenDropdownAuditId(null); }}
                                    />
                                    <div 
                                      className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-100 p-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-150"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {/* Opción 1: Mi Borrador */}
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setOpenDropdownAuditId(null);
                                          handleOpenAuditWithOptions(audit, 'my_draft');
                                        }}
                                        className="w-full p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-3 cursor-pointer text-left"
                                      >
                                        <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                          <Edit3 size={15} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-800">Mi Borrador</span>
                                            <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">Editable</span>
                                          </div>
                                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                            Tu espacio de evaluación personal (requiere PIN).
                                          </p>
                                        </div>
                                      </button>

                                      {/* Opción 2: Borrador Colega */}
                                      {(() => {
                                        const colleagueEntry = getColleagueFromAudit(audit);
                                        const hasColleague = !!colleagueEntry;
                                        const colName = colleagueEntry ? colleagueEntry.auditorName : 'Colega';
                                        const colUid = colleagueEntry ? colleagueEntry.uid : null;

                                        return (
                                          <button 
                                            type="button"
                                            disabled={!hasColleague}
                                            onClick={() => {
                                              if (!hasColleague) return;
                                              setOpenDropdownAuditId(null);
                                              handleOpenAuditWithOptions(audit, 'colleague', colUid);
                                            }}
                                            className={`w-full p-2.5 rounded-lg transition-colors flex items-start gap-3 text-left ${
                                              hasColleague ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                                            }`}
                                          >
                                            <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                                              <Eye size={15} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-800 truncate max-w-[150px]">
                                                  {hasColleague ? `Borrador de ${colName}` : 'Borrador de Colega'}
                                                </span>
                                                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Solo lectura</span>
                                              </div>
                                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                                {hasColleague ? `Visualiza las respuestas de ${colName}.` : 'Sin evaluación de colega registrada.'}
                                              </p>
                                            </div>
                                          </button>
                                        );
                                      })()}

                                      {/* Opción 3: Versión Consolidada Oficial */}
                                      {(() => {
                                        const isConsolidated = audit.data?.finalAudit?.status === 'consolidated' || audit.finalAudit?.status === 'consolidated';

                                        return (
                                          <button 
                                            type="button"
                                            disabled={!isConsolidated}
                                            onClick={() => {
                                              if (!isConsolidated) return;
                                              setOpenDropdownAuditId(null);
                                              handleOpenAuditWithOptions(audit, 'official');
                                            }}
                                            className={`w-full p-2.5 rounded-lg transition-colors flex items-start gap-3 border-t border-slate-100 text-left ${
                                              isConsolidated ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                                            }`}
                                          >
                                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                                              isConsolidated ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                            }`}>
                                              <ShieldCheck size={15} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-800">Versión Oficial</span>
                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                                  isConsolidated ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                                }`}>
                                                  {isConsolidated ? 'Oficial' : 'Pendiente'}
                                                </span>
                                              </div>
                                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                                {isConsolidated ? 'Resultado final fusionado de la auditoría.' : 'Pendiente de consolidar por el equipo.'}
                                              </p>
                                            </div>
                                          </button>
                                        );
                                      })()}

                                      {/* Opción 4: Comparar y Fusionar (Merge) */}
                                      {(currentUserRole === 'admin' || currentUserRole === 'auditor') && (
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setOpenDropdownAuditId(null);
                                            handleOpenAuditWithOptions(audit, 'merge');
                                          }}
                                          className="w-full p-2.5 rounded-lg hover:bg-indigo-50/70 transition-colors flex items-start gap-3 border-t border-slate-100 text-left cursor-pointer"
                                        >
                                          <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                                            <GitMerge size={15} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-semibold text-indigo-950">Comparar y Fusionar</span>
                                              <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Merge</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                              Herramienta de consolidación lado a lado.
                                            </p>
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-xs">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield size={28} />
              </div>
              {activeAudits.length === 0 ? (
                <>
                  <h3 className="text-lg font-bold text-slate-900">No hay auditorías activas todavía</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Comienza tu primera evaluación de seguridad y TI. Podrás utilizar la plantilla base oficial de ByteWise, comenzar desde cero o importar preguntas desde Excel.
                  </p>
                  <button
                    onClick={() => {
                      resetToInitialState();
                      setStep('gate');
                    }}
                    className="mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Crear Primera Auditoría</span>
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-slate-900">Sin coincidencias para "{dashboardSearch}"</h3>
                  <p className="text-xs text-slate-500 mt-2">
                    No se encontró ninguna auditoría con ese término. Intenta con otro nombre de empresa, auditor o giro.
                  </p>
                  <button
                    onClick={() => setDashboardSearch('')}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Limpiar Búsqueda
                  </button>
                </>
              )}
            </div>
          )}
        </main>

        {/* Modal de Auditorías Archivadas */}
        {showArchivedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
              className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/50">
                    <Archive size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">Auditorías Archivadas</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Auditorías retiradas de la vista activa. Puedes restaurarlas a la lista principal o eliminarlas de forma definitiva.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowArchivedModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1">
                {archivedAudits.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Archive size={24} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">No hay auditorías archivadas</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Cuando archives una auditoría desde la tabla principal aparecerá aquí para su recuperación o eliminación permanente.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                    {archivedAudits.map((audit) => {
                      const nombre = audit.nombreEmpresa || audit.data?.introData?.nombreEmpresa || 'Empresa sin nombre';
                      const auditor = audit.data?.actor?.nombreAuditor || 'Sin asignar';
                      const fecha = audit.lastModified ? new Date(audit.lastModified).toLocaleDateString() : '';

                      return (
                        <div key={audit.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={getCompanyAvatarBadgeClass(nombre)}>
                              {getCompanyInitials(nombre)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold text-slate-800 truncate" title={nombre}>{nombre}</h4>
                              <p className="text-xs text-slate-400 truncate">
                                Auditor: <span className="text-slate-600">{auditor}</span> • Modificado: {fecha}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              onClick={() => handleRestoreAudit(audit)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/70 hover:bg-blue-100 border border-blue-200/60 rounded-lg transition-colors cursor-pointer"
                              title="Restaurar a la lista activa"
                            >
                              <RotateCcw size={13} />
                              <span>Restaurar</span>
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteAudit(audit)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50/70 hover:bg-red-100 border border-red-200/60 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar de la base de datos"
                            >
                              <Trash2 size={13} />
                              <span>Eliminar Definitiva</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
                <span>{archivedAudits.length} {archivedAudits.length === 1 ? 'auditoría archivada' : 'auditorías archivadas'}</span>
                <button
                  onClick={() => setShowArchivedModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Historial de Cambios */}
        {showLogsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
              className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/50">
                    <History size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">Historial de Cambios</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Registro cronológico de actividades, modificaciones, archivados y eliminaciones.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLogsModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <History size={24} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Sin eventos registrados</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Las acciones de creación, modificación, archivado y eliminación se registrarán automáticamente aquí.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-100 ml-4 pl-5 space-y-6">
                    {auditLogs.map((log) => {
                      const date = new Date(log.timestamp || 0);
                      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      
                      let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                      let dotColor = 'bg-slate-400';
                      let actionLabel = 'Modificación';

                      if (log.action === 'create') {
                        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
                        dotColor = 'bg-emerald-500';
                        actionLabel = 'Creación';
                      } else if (log.action === 'archive') {
                        badgeColor = 'bg-amber-50 text-amber-700 border-amber-200/60';
                        dotColor = 'bg-amber-500';
                        actionLabel = 'Archivado';
                      } else if (log.action === 'restore') {
                        badgeColor = 'bg-blue-50 text-blue-700 border-blue-200/60';
                        dotColor = 'bg-blue-500';
                        actionLabel = 'Restauración';
                      } else if (log.action === 'delete') {
                        badgeColor = 'bg-rose-50 text-rose-700 border-rose-200/60';
                        dotColor = 'bg-rose-500';
                        actionLabel = 'Eliminación';
                      }

                      return (
                        <div key={log.id} className="relative group">
                          <div className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full ${dotColor} ring-4 ring-white`} />
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-semibold text-slate-800">{log.description}</span>
                            <span className="text-[11px] text-slate-400 shrink-0">{formattedDate}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                              {actionLabel}
                            </span>
                            <span className="text-[11px] text-slate-400">Por: {log.userName || 'Auditor'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
                <span>{auditLogs.length} {auditLogs.length === 1 ? 'evento registrado' : 'eventos registrados'}</span>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modales de Acceso y Compartir en Dashboard */}
        {renderAccessModal()}
        {renderShareModal()}

        {globalLoadingMessage && <CubeLoader message={globalLoadingMessage} />}
        <CustomDialogModal config={modalConfig} onClose={() => setModalConfig(null)} />
      </div>
    );
  }

  // ==========================================
  // PANTALLA DE CONFIGURACIÓN DE NUEVA AUDITORÍA
  // ==========================================
  if (step === 'gate') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
        {/* Top Navbar Unificada */}
        <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/70 px-4 md:px-8 py-3.5 sticky top-0 z-30 shadow-2xs">
          <div className="w-full max-w-[1700px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoPng} alt="ByteWise" className="h-8 md:h-10 w-auto object-contain brightness-0 invert" />
              <div className="hidden sm:block border-l border-slate-200/80 pl-3">
                <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Auditoría y Gestión de TI</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user && (
                <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/70 px-3 py-1.5 rounded-full border border-slate-200/60">
                  <User size={13} className="text-slate-500" />
                  <span className="max-w-[180px] truncate">{user.email || 'Auditor Conectado'}</span>
                </div>
              )}

              {/* Botón de Ajustes con Dropdown */}
              <div className="relative" ref={settingsMenuRef}>
                <button 
                  onClick={() => setShowSettingsDropdown(prev => !prev)}
                  className={`w-9 h-9 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                    showSettingsDropdown 
                      ? 'border-blue-400 text-blue-600 bg-blue-50/70 shadow-2xs' 
                      : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Configuración y herramientas"
                >
                  <Settings size={18} strokeWidth={1.8} className={`transition-transform duration-200 ${showSettingsDropdown ? 'rotate-45 text-blue-600' : ''}`} />
                </button>

                {showSettingsDropdown && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-40 text-sm animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Opciones del Sistema
                    </div>
                    <button
                      onClick={() => { setShowSettingsDropdown(false); setStep('access_management'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left cursor-pointer"
                    >
                      <KeyRound size={16} className="text-slate-400" />
                      <span className="font-medium text-xs">Gestión de Accesos</span>
                    </button>
                    <button
                      onClick={() => { setShowSettingsDropdown(false); setShowArchivedModal(true); setStep('dashboard'); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Archive size={16} className="text-slate-400" />
                        <span className="font-medium text-xs">Auditorías Archivadas</span>
                      </div>
                      {savedAudits.filter(a => !!a.archived).length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                          {savedAudits.filter(a => !!a.archived).length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => { setShowSettingsDropdown(false); setShowLogsModal(true); setStep('dashboard'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left cursor-pointer"
                    >
                      <History size={16} className="text-slate-400" />
                      <span className="font-medium text-xs">Historial de Cambios</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Botón de Logout */}
              <button 
                onClick={() => { signOut(auth); resetToInitialState(); setStep('dashboard'); }} 
                className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="flex-1 py-10 px-4">
          {/* Botón Volver al Panel */}
          <div className="max-w-4xl mx-auto mb-6">
            <button 
              onClick={() => {
                resetToInitialState();
                setStep('dashboard');
              }} 
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Volver al panel principal</span>
            </button>
          </div>

          {/* Tarjeta del Formulario */}
          <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm p-8 md:p-10">
            {/* Encabezado */}
            <div className="border-b border-slate-100 pb-6 mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Nueva Auditoría de TI
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Configura los datos de la entidad y la metodología de evaluación.
              </p>
            </div>

            {/* Grid de 2 Columnas para Campos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Fila 1 - Columna 1: Empresa */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  value={actor.nombreEmpresa}
                  onChange={(e) => setActor(prev => ({ ...prev, nombreEmpresa: e.target.value }))}
                  placeholder="Ej. ByteWise S.A. de C.V."
                  className="w-full text-sm rounded-lg border border-slate-200 px-3.5 py-2.5 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Fila 1 - Columna 2: Contraseña/PIN con Toggle */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Contraseña de acceso (PIN) *
                </label>
                <div className="relative">
                  <input
                    type={showPinGate ? "text" : "password"}
                    value={actor.contrasena}
                    onChange={(e) => setActor(prev => ({ ...prev, contrasena: e.target.value }))}
                    placeholder="Código o clave de seguridad"
                    className="w-full text-sm rounded-lg border border-slate-200 pl-3.5 pr-10 py-2.5 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition text-slate-800 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinGate(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer transition-colors"
                    title={showPinGate ? "Ocultar PIN" : "Mostrar PIN"}
                  >
                    {showPinGate ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Fila 2 - Columna 1: Auditor Principal */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Auditor Principal *
                </label>
                <input
                  type="text"
                  value={actor.nombreAuditor}
                  onChange={(e) => setActor(prev => ({ ...prev, nombreAuditor: e.target.value }))}
                  placeholder="Ej. Oscar Thomason"
                  className="w-full text-sm rounded-lg border border-slate-200 px-3.5 py-2.5 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Fila 2 - Columna 2: Rol en la Evaluación */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Rol en la Evaluación *
                </label>
                <select
                  value={actor.rol}
                  onChange={(e) => setActor(prev => ({ ...prev, rol: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3.5 py-2.5 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition bg-white text-slate-700 cursor-pointer"
                >
                  <option value="">Selecciona tu rol...</option>
                  <option value="Auditor Líder">Auditor Líder</option>
                  <option value="Especialista Técnico de TI">Especialista Técnico de TI</option>
                  <option value="Oficial de Cumplimiento / CISO">Oficial de Cumplimiento / CISO</option>
                  <option value="Consultor Externo">Consultor Externo</option>
                  <option value="Auditor">Auditor General</option>
                </select>
              </div>
            </div>

            {/* Selector de Metodología / Estructura del Cuestionario */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Estructura del Cuestionario
                </label>
                <span className="text-xs text-slate-400">Selecciona el método de inicio</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Opción 1: Base */}
                <div
                  onClick={() => setCreationMode('base')}
                  className={`relative rounded-xl p-5 cursor-pointer transition-all ${
                    creationMode === 'base'
                      ? 'border-2 border-blue-600 bg-blue-50/20 ring-2 ring-blue-100 shadow-xs'
                      : 'border border-slate-200 hover:border-blue-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      <Shield size={18} />
                    </span>
                    <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">Auditoría Estándar</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Carga la plantilla completa ByteWise (ISO 27001, marcos NIST e infraestructura).
                  </p>
                </div>

                {/* Opción 2: Desde Cero */}
                <div
                  onClick={() => setCreationMode('blank')}
                  className={`relative rounded-xl p-5 cursor-pointer transition-all ${
                    creationMode === 'blank'
                      ? 'border-2 border-blue-600 bg-blue-50/20 ring-2 ring-blue-100 shadow-xs'
                      : 'border border-slate-200 hover:border-blue-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                      <Layers size={18} />
                    </span>
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      En blanco
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">Desde Cero</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Cuestionario vacío para crear dominios y controles personalizados manualmente.
                  </p>
                </div>

                {/* Opción 3: Importación */}
                <div
                  onClick={() => setCreationMode('import')}
                  className={`relative rounded-xl p-5 cursor-pointer transition-all ${
                    creationMode === 'import'
                      ? 'border-2 border-blue-600 bg-blue-50/20 ring-2 ring-blue-100 shadow-xs'
                      : 'border border-slate-200 hover:border-blue-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                      <FileSpreadsheet size={18} />
                    </span>
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      Excel / JSON
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">Importación</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Carga masiva de preguntas desde archivo estructurado (.xlsx o .json).
                  </p>
                </div>
              </div>

              {/* Panel de Importación cuando creationMode === 'import' */}
              {creationMode === 'import' && (
                <div className="mt-4 p-5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        <span>Plantilla oficial en Excel (.xlsx)</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Descarga la plantilla con las preguntas base como ejemplo, modifícala en Excel y súbela aquí.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => downloadExcelTemplate()}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Descargar Plantilla Excel</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Upload size={16} className="text-blue-600" />
                        <span>Subir cuestionario diligenciado</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Formatos admitidos: <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.json</strong>.
                      </p>
                    </div>

                    <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition shrink-0 flex items-center gap-1.5 shadow-2xs">
                      <Upload size={14} />
                      <span>{importedFileName ? 'Cambiar Archivo' : 'Seleccionar Archivo'}</span>
                      <input type="file" accept=".xlsx,.xls,.json" onChange={handleGateFileImport} className="hidden" />
                    </label>
                  </div>

                  {importedFileName && importSummary && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                        <span className="font-semibold truncate">{importedFileName}</span>
                      </div>
                      <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md shrink-0 ml-2">
                        {importSummary.areasCount} áreas / {importSummary.questionsCount} preguntas detectadas
                      </span>
                    </div>
                  )}

                  {importError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                      <X size={16} className="shrink-0" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botones de Acción al Pie */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  resetToInitialState();
                  setStep('dashboard');
                }}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!actor.nombreEmpresa.trim() || !actor.nombreAuditor.trim() || !actor.rol || !actor.contrasena.trim()) {
                    alert("Por favor llena todos los campos obligatorios, incluyendo la contraseña o PIN, para continuar.");
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

                  try {
                    setGlobalLoadingMessage('Configurando e inicializando auditoría...');
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
                      logAuditEvent('create', `Nueva auditoría creada para "${actor.nombreEmpresa.trim()}"`, actor.nombreEmpresa.trim(), newId);
                      setStep('form');
                    }
                  } finally {
                    setGlobalLoadingMessage(null);
                  }
                }}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Comenzar Auditoría</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </main>

        {/* Modales de Acceso y Compartir en Dashboard */}
        {renderAccessModal()}
        {renderShareModal()}

        {globalLoadingMessage && <CubeLoader message={globalLoadingMessage} />}
        <CustomDialogModal config={modalConfig} onClose={() => setModalConfig(null)} />
      </div>
    );
  }

  // Métricas duales para visualización en paralelo entre evaluadores (cálculo directo sin hooks condicionales)
  const calculateDualMetrics = () => {
    const totalQ = getTotalQuestions();
    const myAnswersMap = evaluations[currentAuditorUid]?.answers || responses || {};
    let myScoreSum = 0;
    let myAnsweredCount = 0;

    Object.keys(customSections).forEach(sec => {
      (customSections[sec] || []).forEach(q => {
        const k = `${sec}-${q.id}`;
        const val = myAnswersMap[k]?.evaluacion ?? myAnswersMap[k]?.score;
        if (val !== null && val !== undefined && val !== '') {
          myScoreSum += Number(val);
          myAnsweredCount++;
        }
      });
    });

    const myAvg = myAnsweredCount > 0 ? (myScoreSum / myAnsweredCount) : 0;
    const myProgress = totalQ > 0 ? Math.round((myAnsweredCount / totalQ) * 100) : 0;

    // Identificar colega evaluador secundario
    const otherEntries = Object.entries(evaluations).filter(([uid, ev]) => {
      if (uid !== currentAuditorUid) return true;
      const name = ev.auditorName || '';
      return name && currentAuditorName && name.toLowerCase() !== currentAuditorName.toLowerCase();
    });

    const hasColleague = otherEntries.length > 0;
    const colleagueEntry = hasColleague ? otherEntries[0] : null;
    const colleagueUid = colleagueEntry ? colleagueEntry[0] : null;
    const colleagueData = colleagueEntry ? colleagueEntry[1] : null;
    const colleagueName = colleagueData?.auditorName || (actor.nombreAuditor && actor.nombreAuditor !== currentAuditorName ? actor.nombreAuditor : null);
    const colleagueAnswersMap = colleagueData?.answers || {};

    let colleagueScoreSum = 0;
    let colleagueAnsweredCount = 0;
    if (colleagueName) {
      Object.keys(customSections).forEach(sec => {
        (customSections[sec] || []).forEach(q => {
          const k = `${sec}-${q.id}`;
          const val = colleagueAnswersMap[k]?.evaluacion ?? colleagueAnswersMap[k]?.score;
          if (val !== null && val !== undefined && val !== '') {
            colleagueScoreSum += Number(val);
            colleagueAnsweredCount++;
          }
        });
      });
    }

    const colleagueAvg = colleagueAnsweredCount > 0 ? (colleagueScoreSum / colleagueAnsweredCount) : 0;
    const colleagueProgress = totalQ > 0 ? Math.round((colleagueAnsweredCount / totalQ) * 100) : 0;
    const hasBothEvaluated = myAnsweredCount > 0 && colleagueAnsweredCount > 0;
    const delta = hasBothEvaluated ? Math.abs(myAvg - colleagueAvg).toFixed(1) : null;

    return {
      totalQ,
      hasColleague: !!colleagueName,
      colleagueUid,
      colleagueName: colleagueName || 'Auditor 2',
      my: {
        name: currentAuditorName || 'Mi Evaluación',
        avg: myAvg,
        answered: myAnsweredCount,
        progress: myProgress
      },
      colleague: {
        name: colleagueName || 'Auditor 2',
        avg: colleagueAvg,
        answered: colleagueAnsweredCount,
        progress: colleagueProgress
      },
      hasBothEvaluated,
      delta
    };
  };

  const dualMetrics = calculateDualMetrics();

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
        {/* Banner de Modo Solo Lectura (Observador) */}
        {isReadOnly && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-amber-900 text-xs md:text-sm shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Eye size={20} className="text-amber-600 shrink-0" />
              <span>
                <strong>Modo Solo Lectura (Observador):</strong> Estás viendo los avances de la auditoría en tiempo real. Los cambios no se guardarán en la base de datos.
              </span>
            </div>
            <button
              onClick={handleUnlockWithPin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <Lock size={13} />
              <span>Desbloquear Edición con PIN</span>
            </button>
          </div>
        )}

        {/* Header de la Auditoría Activa */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 md:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={logoPng}
                alt="ByteWise"
                className="h-9 w-auto object-contain"
              />
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                    {introData.nombreEmpresa || 'Auditoría de TI'}
                  </h1>
                  {activeCollaborators.length > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200/60 rounded-full text-[11px] text-emerald-700 font-medium">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span>{activeCollaborators.length} en línea</span>
                    </div>
                  )}
                </div>
                <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                  {introData.giro || 'Evaluación integral de infraestructura y seguridad'}
                </p>
              </div>
            </div>

            {/* Botones de Acción Rápida en la esquina superior derecha */}
            <div className="flex items-center gap-2 self-end sm:self-center">
                  {step === 'form' && !isGuestMode && (
                    <button
                      onClick={handleReturnToDashboard}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80 cursor-pointer"
                      title="Guardar y volver al panel"
                    >
                      <Home size={18} />
                    </button>
                  )}
                  {/* Botón Consolidar y Fusionar (Merge) */}
                  {(dualMetrics.hasColleague || Object.keys(evaluations).length > 1) && (
                    <button
                      onClick={() => setShowMergeModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 rounded-lg transition-colors cursor-pointer shadow-2xs"
                      title="Comparar respuestas de evaluadores y generar versión oficial"
                    >
                      <GitMerge size={14} className="text-indigo-600" />
                      <span className="hidden sm:inline">Fusionar</span>
                    </button>
                  )}
                  {/* Botón Compartir */}
                  <button
                    onClick={(e) => {
                      const currentObj = savedAudits.find(a => a.id === currentAuditId) || {
                        id: currentAuditId,
                        nombreEmpresa: introData.nombreEmpresa,
                        data: { actor, introData }
                      };
                      handleOpenShareModal(currentObj, e);
                    }}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80 cursor-pointer"
                    title="Compartir enlace seguro de auditoría"
                  >
                    <Share2 size={18} />
                  </button>
                  {/* Botón Descargar Informe */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowExportMenu(!showExportMenu); setShowSettings(false); }}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80 cursor-pointer"
                      title="Descargar informe"
                    >
                      <Download size={18} />
                    </button>
                    {showExportMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)}></div>
                        <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50 text-sm animate-in fade-in zoom-in-95 duration-150">
                          <button
                            onClick={() => { exportToDocxPro(); setShowExportMenu(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                          >
                            <FileText size={16} className="text-slate-400" />
                            <span>Descargar en Word (.docx)</span>
                          </button>
                          <button
                            onClick={() => { exportToExcel(); setShowExportMenu(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                          >
                            <FileSpreadsheet size={16} className="text-slate-400" />
                            <span>Descargar en Excel (.xlsx)</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Botón Ajustes de Auditoría */}
                  {!isGuestMode && (
                    <div className="relative inline-block text-left">
                      <button
                        onClick={() => { setShowSettings(!showSettings); setShowExportMenu(false); }}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80 cursor-pointer"
                        title="Ajustes de auditoría"
                      >
                        <Settings size={18} />
                      </button>
                      {showSettings && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)}></div>
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50 text-sm animate-in fade-in zoom-in-95 duration-150">
                            <button
                              onClick={async () => {
                                setShowSettings(false);
                                const currentObj = savedAudits.find(a => a.id === currentAuditId) || {
                                  id: currentAuditId,
                                  nombreEmpresa: introData.nombreEmpresa,
                                  data: { actor, introData }
                                };
                                handleOpenShareModal(currentObj);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                            >
                              <Share2 size={16} className="text-slate-400" />
                              <span>Compartir Enlace</span>
                            </button>
                            <button
                              onClick={async () => {
                                setShowSettings(false);
                                const oldPin = await showPrompt({
                                  title: 'Verificación de Seguridad',
                                  message: 'Ingresa tu PIN actual para autorizar el cambio:',
                                  inputType: 'password',
                                  placeholder: 'PIN actual...',
                                  confirmText: 'Verificar'
                                });
                                if (oldPin === null) return;
                                const oldHash = await hashPassword(oldPin);
                                if (oldHash !== actor.contrasenaHash) {
                                  await showAlert({
                                    type: 'error',
                                    title: 'PIN Incorrecto',
                                    message: 'El PIN actual ingresado no coincide. No se puede cambiar el PIN.'
                                  });
                                  return;
                                }
                                const newPin = await showPrompt({
                                  title: 'Nuevo PIN de Seguridad',
                                  message: 'Ingresa el nuevo PIN para proteger esta auditoría:',
                                  inputType: 'password',
                                  placeholder: 'Nuevo PIN...',
                                  confirmText: 'Guardar Nuevo PIN'
                                });
                                if (newPin) {
                                  const newHash = await hashPassword(newPin);
                                  setActor(prev => ({...prev, contrasenaHash: newHash}));
                                  await showAlert({
                                    type: 'success',
                                    title: 'PIN Actualizado',
                                    message: 'El PIN de seguridad ha sido actualizado exitosamente.'
                                  });
                                }
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                            >
                              <KeyRound size={16} className="text-slate-400" />
                              <span>Cambiar PIN</span>
                            </button>
                            <button
                              onClick={() => { setShowEditModal(true); setShowSettings(false); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                            >
                              <FileCode size={16} className="text-slate-400" />
                              <span>Editar Cuestionario</span>
                            </button>
                            <div className="border-t border-slate-100 my-1"></div>
                            <button
                              onClick={async () => {
                                setShowSettings(false);
                                const currentObj = savedAudits.find(a => a.id === currentAuditId) || {
                                  id: currentAuditId,
                                  nombreEmpresa: introData.nombreEmpresa,
                                  data: { actor, introData }
                                };
                                await handleArchiveAudit(currentObj);
                                handleReturnToDashboard();
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-left font-medium cursor-pointer"
                            >
                              <Trash2 size={16} className="text-red-500" />
                              <span>Eliminar Auditoría</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
          </div>
        </div>

        {/* Banner contextual de versión activa */}
        {step === 'form' && activeEvaluationView !== 'my_draft' && (
          <div className="mb-5 bg-slate-900 text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5 text-xs md:text-sm">
              <Eye size={18} className="text-blue-400 shrink-0" />
              <span>
                Estás visualizando {activeEvaluationView === 'official' ? (
                  <strong className="text-emerald-400">la Versión Oficial Consolidada</strong>
                ) : (
                  <>el <strong className="text-blue-300">Borrador de {dualMetrics.colleagueName}</strong></>
                )} en modo solo lectura. Tus respuestas no se verán alteradas.
              </span>
            </div>
            <button
              onClick={() => handleChangeEvaluationView('my_draft')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Volver a Mi Borrador</span>
            </button>
          </div>
        )}

        {/* Barra de Calificación Dual en Paralelo (Dashboard de Métricas) */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tarjeta 1: Calificación en Paralelo */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Calificación en Paralelo
              </span>
              {dualMetrics.hasBothEvaluated && dualMetrics.delta !== null && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  Number(dualMetrics.delta) >= 0.5 
                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                    : 'bg-blue-50 text-blue-700 border-blue-100'
                }`} title={`Diferencia de criterio de ${dualMetrics.delta} pts entre ambos evaluadores`}>
                  Δ {dualMetrics.delta} pts diff
                </span>
              )}
            </div>

            <div className="my-3 space-y-2.5">
              {/* Mi Puntuación */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/70">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800 truncate max-w-[120px]" title={dualMetrics.my.name}>
                      {dualMetrics.my.name} (Tú)
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {dualMetrics.my.answered}/{dualMetrics.totalQ} respondidas
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-blue-900 tracking-tight">
                    {dualMetrics.my.avg.toFixed(1)} <span className="text-xs font-normal text-slate-500">/ 4.0</span>
                  </div>
                  <div className="text-[10px] font-semibold text-blue-700">
                    {dualMetrics.my.progress}% completado
                  </div>
                </div>
              </div>

              {/* Puntuación de Auditor 2 / Colega */}
              {dualMetrics.hasColleague ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></div>
                    <div>
                      <div className="text-xs font-semibold text-slate-700 truncate max-w-[120px]" title={dualMetrics.colleague.name}>
                        {dualMetrics.colleague.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {dualMetrics.colleague.answered}/{dualMetrics.totalQ} respondidas
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-slate-800 tracking-tight">
                      {dualMetrics.colleague.avg.toFixed(1)} <span className="text-xs font-normal text-slate-500">/ 4.0</span>
                    </div>
                    <div className="text-[10px] font-semibold text-slate-600">
                      {dualMetrics.colleague.progress}% completado
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Sin segundo evaluador en paralelo
                  </span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-medium">
              Escala de madurez tecnológica de 0 a 4 puntos
            </div>
          </div>

          {/* Tarjeta 2: Avance y Barras Gemelas */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Avance de Evaluación
              </span>
              <span className="text-xs font-bold text-slate-700">
                {dualMetrics.my.progress}% mi avance
              </span>
            </div>

            <div className="my-3 space-y-3.5">
              {/* Barra 1: Usuario Activo */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="truncate max-w-[140px] text-blue-800 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    {dualMetrics.my.name}
                  </span>
                  <span className="text-slate-500">{dualMetrics.my.progress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${dualMetrics.my.progress}%` }}
                  />
                </div>
              </div>

              {/* Barra 2: Colega Evaluador */}
              {dualMetrics.hasColleague && (
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span className="truncate max-w-[140px] text-slate-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      {dualMetrics.colleague.name}
                    </span>
                    <span className="text-slate-500">{dualMetrics.colleague.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full transition-all duration-500"
                      style={{ width: `${dualMetrics.colleague.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              {dualMetrics.my.answered} de {dualMetrics.totalQ} preguntas respondidas por ti
            </div>
          </div>

          {/* Tarjeta 3: Desglose por Áreas y Consolidación */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Desglose por Áreas
              </span>
              {(dualMetrics.hasColleague || Object.keys(evaluations).length > 1) && (
                <button
                  type="button"
                  onClick={() => setShowMergeModal(true)}
                  className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-lg border border-indigo-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <GitMerge size={12} />
                  <span>Consolidar</span>
                </button>
              )}
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[95px] pr-1 custom-scrollbar">
              {(() => {
                const rows = Object.entries(calculateAreaScores());
                return rows.map(([area, data]) => {
                  const answeredPct = data.total > 0 ? (data.answered / data.total) * 100 : 0;
                  return (
                    <div key={area} className="flex items-center justify-between text-xs py-0.5">
                      <span className="truncate text-slate-700 font-medium max-w-[130px]" title={area}>
                        {area}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${answeredPct}%` }}
                          />
                        </div>
                        <span className="font-semibold text-slate-800 w-8 text-right">
                          {data.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              {Object.keys(customSections).length} dominios evaluados
            </div>
          </div>
        </div>

        {/* Secciones y Navegación Lateral */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Menú Lateral (Sidebar) */}
          <div className="w-full md:w-1/4 flex-shrink-0 space-y-1.5 md:sticky md:top-4 md:self-start max-h-[200px] md:max-h-[90vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 ml-1">Navegación</h3>
            
            <button
              onClick={() => setActiveSection('Información General')}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer ${
                activeSection === 'Información General' 
                ? 'bg-blue-50 text-blue-700 font-semibold' 
                : 'text-slate-600 hover:bg-slate-50 font-medium'
              }`}
            >
              <span className="truncate">Información General</span>
            </button>

            <button
              onClick={() => setActiveSection('Preliminar de la Empresa')}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer ${
                activeSection === 'Preliminar de la Empresa' 
                ? 'bg-blue-50 text-blue-700 font-semibold' 
                : 'text-slate-600 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Sparkles size={16} className={introData.preliminarEmpresa ? "text-blue-600" : "text-slate-400"} />
                <span className="truncate">Preliminar de la Empresa</span>
              </div>
              {introData.preliminarEmpresa ? (
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                  Listo
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
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
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer ${
                    activeSection === section 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="truncate mr-2" title={section}>{section}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                    isComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {answered}/{questions.length}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setActiveSection('Reporte Final')}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between mt-4 cursor-pointer ${
                activeSection === 'Reporte Final' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Sparkles size={16} className={activeSection === 'Reporte Final' ? 'text-blue-400' : 'text-slate-400'} />
                <span className="truncate">Reporte Final y Conclusiones</span>
              </div>
              {(positiveComments.trim() || negativeComments.trim() || recommendations.trim() || generalComments.trim()) && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Contiene conclusiones redactadas"></span>
              )}
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
              <div className="mb-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Cabecera Principal con Controles de Espacio */}
                <div className="bg-white border border-slate-200 border-t-4 border-t-slate-900 p-6 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold mb-2">
                        <Sparkles size={14} className="text-[#00d4ff]" /> Conclusiones Ejecutivas de Auditoría
                      </div>
                      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reporte Final y Dictamen</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Estructura tus conclusiones en fortalezas, hallazgos y recomendaciones accionables. Optimiza cada apartado con Inteligencia Artificial.
                      </p>
                    </div>

                    {/* Controles de Espacio y Visualización */}
                    <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
                      {/* Control de Distribución */}
                      <div className="bg-slate-100 p-1 flex items-center gap-1 border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 px-2">Vista:</span>
                        <button
                          type="button"
                          onClick={() => setReportLayout('grid')}
                          className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            reportLayout === 'grid'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                          title="Vista de 3 Columnas en paralelo"
                        >
                          <LayoutGrid size={14} />
                          <span className="hidden sm:inline">3 Columnas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportLayout('stack')}
                          className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            reportLayout === 'stack'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                          title="Vista apilada a todo lo ancho"
                        >
                          <List size={14} />
                          <span className="hidden sm:inline">Apilado</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportLayout('tabs')}
                          className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            reportLayout === 'tabs'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                          title="Vista en pestañas para enfocar un apartado a la vez"
                        >
                          <Layers size={14} />
                          <span className="hidden sm:inline">Pestañas</span>
                        </button>
                      </div>

                      {/* Control de Altura Rápida */}
                      <div className="bg-slate-100 p-1 flex items-center gap-1 border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 px-2">Altura:</span>
                        <button
                          type="button"
                          onClick={() => setCommentHeightMode('compact')}
                          className={`px-2 py-1 text-xs font-bold transition cursor-pointer ${
                            commentHeightMode === 'compact'
                              ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="Altura compacta (160px)"
                        >
                          S
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommentHeightMode('normal')}
                          className={`px-2 py-1 text-xs font-bold transition cursor-pointer ${
                            commentHeightMode === 'normal'
                              ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="Altura estándar (260px)"
                        >
                          M
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommentHeightMode('tall')}
                          className={`px-2 py-1 text-xs font-bold transition cursor-pointer ${
                            commentHeightMode === 'tall'
                              ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="Altura amplia (420px)"
                        >
                          L
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Barra de pestañas si está en modo tabs */}
                  {reportLayout === 'tabs' && (
                    <div className="mt-6 flex border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => setActiveReportTab('positive')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                          activeReportTab === 'positive'
                            ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <ThumbsUp size={15} className="text-emerald-600" />
                        <span>Comentarios Positivos</span>
                        {positiveComments.trim() && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveReportTab('negative')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                          activeReportTab === 'negative'
                            ? 'border-rose-600 text-rose-800 bg-rose-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <AlertTriangle size={15} className="text-rose-600" />
                        <span>Comentarios Negativos</span>
                        {negativeComments.trim() && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveReportTab('recommendations')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                          activeReportTab === 'recommendations'
                            ? 'border-[#00d4ff] text-cyan-950 bg-cyan-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Lightbulb size={15} className="text-cyan-600" />
                        <span>Recomendaciones</span>
                        {recommendations.trim() && <span className="w-2 h-2 rounded-full bg-cyan-500"></span>}
                      </button>
                    </div>
                  )}
                </div>

                {/* Contenedor de las 3 Cajas */}
                <div className={
                  reportLayout === 'grid'
                    ? "grid grid-cols-1 lg:grid-cols-3 gap-6"
                    : reportLayout === 'stack'
                    ? "space-y-6"
                    : "space-y-6"
                }>
                  {/* 1. COMENTARIOS POSITIVOS */}
                  {(reportLayout !== 'tabs' || activeReportTab === 'positive') && (
                    <div className="bg-white border border-slate-200 border-t-4 border-t-emerald-500 shadow-sm flex flex-col justify-between">
                      <div className="p-5 border-b border-slate-100 bg-emerald-50/30 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-none bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <ThumbsUp size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-slate-900">Comentarios Positivos</h3>
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5">Fortalezas</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Buenas prácticas, controles robustos y madurez detectada.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => rewriteReportCommentWithAI('positive')}
                          disabled={rewritingField === 'positive'}
                          title="Optimizar redacción o generar fortalezas con IA"
                          className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
                        >
                          {rewritingField === 'positive' ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-emerald-600" />
                              <span>Optimizando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} className="text-emerald-600" />
                              <span>Mejorar con IA</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <textarea
                          value={positiveComments}
                          onChange={(e) => setPositiveComments(e.target.value)}
                          placeholder="Describe las fortalezas técnicas, buenas prácticas, políticas aplicadas y controles que la empresa tiene bien implementados..."
                          style={{
                            height: commentHeightMode === 'compact' ? '160px' : commentHeightMode === 'tall' ? '420px' : '260px'
                          }}
                          className="w-full p-3 text-xs md:text-sm bg-white border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none rounded-none resize-y leading-relaxed text-slate-800 transition"
                        />
                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                          <span>↕ Puedes redimensionar arrastrando la esquina</span>
                          <span>{positiveComments.trim().split(/\s+/).filter(Boolean).length} palabras</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. COMENTARIOS NEGATIVOS */}
                  {(reportLayout !== 'tabs' || activeReportTab === 'negative') && (
                    <div className="bg-white border border-slate-200 border-t-4 border-t-rose-500 shadow-sm flex flex-col justify-between">
                      <div className="p-5 border-b border-slate-100 bg-rose-50/30 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-none bg-rose-600 text-white flex items-center justify-center shrink-0">
                            <AlertTriangle size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-slate-900">Comentarios Negativos</h3>
                              <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5">Hallazgos / Riesgos</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Vulnerabilidades, incumplimientos, brechas y riesgos.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => rewriteReportCommentWithAI('negative')}
                          disabled={rewritingField === 'negative'}
                          title="Optimizar redacción o generar hallazgos con IA"
                          className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
                        >
                          {rewritingField === 'negative' ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-rose-600" />
                              <span>Optimizando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} className="text-rose-600" />
                              <span>Mejorar con IA</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <textarea
                          value={negativeComments}
                          onChange={(e) => setNegativeComments(e.target.value)}
                          placeholder="Describe las deficiencias encontradas, riesgos críticos de seguridad, falta de documentación, fallas de respaldo o vulnerabilidades operativas..."
                          style={{
                            height: commentHeightMode === 'compact' ? '160px' : commentHeightMode === 'tall' ? '420px' : '260px'
                          }}
                          className="w-full p-3 text-xs md:text-sm bg-white border border-slate-300 focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none rounded-none resize-y leading-relaxed text-slate-800 transition"
                        />
                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                          <span>↕ Puedes redimensionar arrastrando la esquina</span>
                          <span>{negativeComments.trim().split(/\s+/).filter(Boolean).length} palabras</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. RECOMENDACIONES */}
                  {(reportLayout !== 'tabs' || activeReportTab === 'recommendations') && (
                    <div className="bg-white border border-slate-200 border-t-4 border-t-[#00d4ff] shadow-sm flex flex-col justify-between">
                      <div className="p-5 border-b border-slate-100 bg-cyan-50/30 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-none bg-slate-900 text-[#00d4ff] flex items-center justify-center shrink-0">
                            <Lightbulb size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-slate-900">Recomendaciones</h3>
                              <span className="text-[10px] font-bold bg-cyan-100 text-cyan-900 px-2 py-0.5">Plan de Acción</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Estrategias de remediación, hoja de ruta y prioridades.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => rewriteReportCommentWithAI('recommendations')}
                          disabled={rewritingField === 'recommendations'}
                          title="Optimizar redacción o generar recomendaciones con IA"
                          className="px-3 py-1.5 bg-white hover:bg-cyan-50 border border-cyan-300 text-cyan-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
                        >
                          {rewritingField === 'recommendations' ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-cyan-600" />
                              <span>Optimizando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} className="text-cyan-600" />
                              <span>Mejorar con IA</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <textarea
                          value={recommendations}
                          onChange={(e) => setRecommendations(e.target.value)}
                          placeholder="Propón las acciones correctivas sugeridas, medidas de mitigación a corto y mediano plazo, tecnologías recomendadas y mejores prácticas a adoptar..."
                          style={{
                            height: commentHeightMode === 'compact' ? '160px' : commentHeightMode === 'tall' ? '420px' : '260px'
                          }}
                          className="w-full p-3 text-xs md:text-sm bg-white border border-slate-300 focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] focus:outline-none rounded-none resize-y leading-relaxed text-slate-800 transition"
                        />
                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                          <span>↕ Puedes redimensionar arrastrando la esquina</span>
                          <span>{recommendations.trim().split(/\s+/).filter(Boolean).length} palabras</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Apartado Opcional: Comentarios Generales Adicionales */}
                <details className="bg-white border border-slate-200 p-5 rounded-none group transition shadow-2xs">
                  <summary className="flex items-center justify-between cursor-pointer font-bold text-xs text-slate-700 select-none">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-slate-400" />
                      <span>Comentarios Generales Adicionales (Opcional / Cierre)</span>
                      {generalComments.trim() && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 font-semibold">Con contenido</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>

                  <div className="mt-4 pt-3 border-t border-slate-100 relative">
                    <textarea
                      value={generalComments}
                      onChange={(e) => setGeneralComments(e.target.value)}
                      rows={4}
                      placeholder="Espacio adicional para observaciones de cierre, firmas, alcance específico o notas que desees incluir en el dictamen final..."
                      className="w-full p-3 text-xs bg-slate-50 border border-slate-300 focus:bg-white focus:border-slate-800 focus:outline-none resize-y"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => rewriteReportCommentWithAI('general')}
                        disabled={rewritingField === 'general'}
                        className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {rewritingField === 'general' ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-slate-600" />
                            <span>Optimizando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} className="text-slate-600" />
                            <span>Mejorar con IA</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            )}

        {/* Secciones de evaluación activas */}
            {Object.keys(customSections).map(section => {
              if (section !== activeSection) return null;
              return (
                <div key={section} className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="p-5 md:p-6 bg-slate-50/60 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">{section}</h2>
                      <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                        {customSections[section].length} preguntas configuradas • Promedio actual:{' '}
                        <span className="font-semibold text-blue-600">{calculateSectionScore(section)}/4</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-5 md:p-6 space-y-4">
                    {(!customSections[section] || customSections[section].length === 0) ? (
                      <div className="p-10 border-2 border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 mb-3">
                          <Plus size={28} />
                        </div>
                        <h4 className="font-bold text-slate-800 text-base">Esta área no tiene preguntas aún</h4>
                        <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                          Iniciaste este cuestionario en blanco o esta área es nueva. Haz clic en el botón inferior para abrir el editor y redactar preguntas personalizadas.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowEditModal(true)}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition shadow-xs"
                        >
                          <Edit2 size={15} className="text-blue-400" /> Abrir Editor de Preguntas
                        </button>
                      </div>
                    ) : (
                      customSections[section].map(item => {
                  const key = `${section}-${item.id}`;
                  const response = responses[key] || {};
                  
                  return (
                    <div
                      key={item.id}
                      id={`question-${section}-${item.id}`}
                      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:border-slate-200 transition-all duration-200 group/q"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-2.5 flex-1">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md text-xs font-semibold shrink-0 mt-0.5">
                            {item.id}
                          </span>
                          <p className="text-slate-900 font-medium text-sm sm:text-base leading-snug flex-1">
                            {item.pregunta}
                          </p>
                        </div>

                        {/* Botón de acción rápida: Editar Pregunta */}
                        {!isGuestMode && (
                          <button
                            type="button"
                            onClick={() => {
                              const currentScale = item.escalaEvaluacion && Array.isArray(item.escalaEvaluacion) && item.escalaEvaluacion.length > 0
                                ? [...item.escalaEvaluacion]
                                : [...GENERIC_EVALUATION_SCALE];
                              while (currentScale.length < 5) {
                                currentScale.push(GENERIC_EVALUATION_SCALE[currentScale.length] || '');
                              }
                              setEditingQuestionData({
                                section,
                                id: item.id,
                                pregunta: item.pregunta,
                                requisito: item.requisito || '',
                                evidencia: item.evidencia || '',
                                nota: item.nota || '',
                                escalaEvaluacion: currentScale
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-80 md:opacity-0 group-hover/q:opacity-100 cursor-pointer shrink-0"
                            title="Editar pregunta y criterios de evaluación"
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                      </div>

                      {item.requisito && (
                        <p className="text-xs text-slate-500 italic mb-2.5 flex items-center gap-1.5 pl-0.5">
                          <FileText size={14} className="shrink-0 text-slate-400" /> {item.requisito}
                        </p>
                      )}

                      {item.nota && (
                        <p className="text-xs text-emerald-800 bg-emerald-50/80 border border-emerald-100 px-3 py-2 rounded-lg mb-2.5 flex items-center gap-1.5">
                          <CheckCircle size={14} className="shrink-0 text-emerald-600" /> {item.nota}
                        </p>
                      )}

                      {item.evidencia && (
                        <p className="text-xs text-blue-700 bg-blue-50/50 border border-blue-100/70 px-3 py-1.5 rounded-lg mb-3 flex items-center gap-1.5">
                          <Search size={14} className="shrink-0 text-blue-500" /> <span className="font-medium">Evidencia sugerida:</span> {item.evidencia}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Evaluación (0-4)
                            </label>
                            {response.evaluacion !== undefined && (
                              <span className="text-xs font-semibold text-blue-600">
                                Seleccionado: {response.evaluacion}/4
                              </span>
                            )}
                          </div>
                          
                          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 mb-2.5 text-[11px] text-slate-600">
                            <div className="font-semibold text-slate-700 mb-0.5">Criterio de Evaluación:</div>
                            {(item.escalaEvaluacion || GENERIC_EVALUATION_SCALE).map((line, index) => (
                              <div key={`${item.id}-${index}`} className="leading-tight">{line}</div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            {[0, 1, 2, 3, 4].map(score => (
                              <button
                                key={score}
                                type="button"
                                disabled={isReadOnly || activeEvaluationView !== 'my_draft'}
                                onClick={() => updateResponse(section, item.id, 'evaluacion', score)}
                                className={`w-11 h-11 rounded-lg font-bold text-sm transition-all flex items-center justify-center ${
                                  isReadOnly || activeEvaluationView !== 'my_draft'
                                    ? 'opacity-80 cursor-not-allowed'
                                    : 'cursor-pointer'
                                } ${
                                  response.evaluacion === score
                                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-600 ring-offset-2'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                                }`}
                                title={item.escalaEvaluacion?.[score] || GENERIC_EVALUATION_SCALE[score]}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                            Evidencia Documental
                          </label>
                          <input
                            type="text"
                            disabled={isReadOnly || activeEvaluationView !== 'my_draft'}
                            value={response.evidencia || ''}
                            onChange={(e) => updateResponse(section, item.id, 'evidencia', e.target.value)}
                            placeholder="Documentos, capturas, políticas, tickets..."
                            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Observaciones y Hallazgos
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={isReadOnly || activeEvaluationView !== 'my_draft'}
                              onClick={() => startInlineDictation(section, item.id)}
                              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                                isReadOnly || activeEvaluationView !== 'my_draft' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                              } ${
                                dictatingKey === key 
                                  ? 'bg-red-500 text-white animate-pulse' 
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                              title={dictatingKey === key ? "Detener dictado" : "Dictar observación por voz"}
                            >
                              <Mic size={14} /> {dictatingKey === key ? "Escuchando..." : "Dictar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => rewriteObservationWithAI(section, item)}
                              disabled={isReadOnly || activeEvaluationView !== 'my_draft' || rewritingKey === key || !response.observaciones}
                              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                                isReadOnly || activeEvaluationView !== 'my_draft' || !response.observaciones
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                  : rewritingKey === key 
                                    ? 'bg-blue-100 text-blue-700 animate-pulse' 
                                    : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                              }`}
                              title="Mejorar redacción con IA"
                            >
                              <Sparkles size={14} /> {rewritingKey === key ? 'Optimizando...' : 'Mejorar con IA'}
                            </button>
                          </div>
                        </div>
                        <textarea
                          disabled={isReadOnly || activeEvaluationView !== 'my_draft'}
                          value={response.observaciones || ''}
                          onChange={(e) => updateResponse(section, item.id, 'observaciones', e.target.value)}
                          placeholder="Escribe o dicta los hallazgos observados..."
                          rows="3"
                          className={`w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg resize-y transition-colors focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
                            dictatingKey === key ? 'border-red-400 bg-red-50/20' : ''
                          }`}
                        />
                      </div>

                      {/* Renderizar Subpreguntas/Preguntas Guía Guardadas al final de las observaciones */}
                      {item.subquestions && item.subquestions.length > 0 && (
                        <div className="mt-4 mb-3 bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-2 animate-in fade-in duration-200">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                            Preguntas Guía Sugeridas (Para obtener más información):
                          </span>
                          {item.subquestions.map(sub => (
                            <div key={sub.id} className="text-xs text-slate-700 space-y-1.5 pl-2.5 border-l-2 border-blue-400 pb-2 border-b border-slate-200/60 last:border-b-0 last:pb-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className="italic font-medium flex-1">
                                  • {sub.texto}
                                </span>
                                {!isGuestMode && (
                                  <button
                                    type="button"
                                    onClick={() => deleteSubquestion(section, item.id, sub.id)}
                                    className="text-slate-400 hover:text-red-600 transition shrink-0 bg-transparent border-0 cursor-pointer"
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
                                className="w-full px-2.5 py-1 bg-white border border-slate-200 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 rounded-md font-normal transition"
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
                          className="mt-2.5 mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                          title="Añadir pregunta sugerida"
                        >
                          <Plus size={14} /> Añadir pregunta guía
                        </button>
                      )}

                      {/* Formulario Inline para Añadir Subpregunta */}
                      {addingSubFor === key && (
                        <div className="mt-3 mb-2 bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in fade-in duration-200">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">
                            ¿De qué se trata la pregunta guía sugerida?
                          </label>
                          <textarea
                            value={subpromptText}
                            onChange={(e) => setSubpromptText(e.target.value)}
                            placeholder="Escribe el tema (ej: 'mfa en correos corporativos') o ingresa la pregunta directamente..."
                            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition rounded-lg mb-3 resize-y"
                            rows={2}
                          />
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setAddingSubFor(null)}
                              className="bg-white text-slate-700 text-xs font-medium border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => generateSubquestionWithAI(item.pregunta)}
                              disabled={isGeneratingSub}
                              className="bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                            >
                              <Sparkles size={12} className={isGeneratingSub ? "animate-pulse" : ""} />
                              {isGeneratingSub ? 'Generando...' : 'Mejorar con IA'}
                            </button>
                            <button
                              type="button"
                              onClick={() => saveSubquestion(section, item.id)}
                              className="bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 px-3 py-1.5 rounded-lg transition cursor-pointer"
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
        initialDeletedQuestions={deletedQuestions}
        onSave={(newSections, newDeletedQuestions) => {
          setCustomSections(newSections);
          setDeletedQuestions(newDeletedQuestions || []);
        }}
      />

      {/* Modal de Fusión y Consolidación (Fork & Merge) */}
      <AuditMergeModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        evaluations={evaluations}
        currentAuditorUid={currentAuditorUid}
        customSections={customSections}
        initialFinalAnswers={finalAudit.answers || responses}
        onConsolidate={handleConsolidate}
      />

      {renderAccessModal()}

      {renderShareModal()}

      {/* Modal Ágil de Edición de Pregunta y Parámetros */}
      {editingQuestionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div>
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                  Edición Rápida • {editingQuestionData.section}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Modificar Pregunta {editingQuestionData.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuestionData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickEditQuestion} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Enunciado de la Pregunta <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows="3"
                  value={editingQuestionData.pregunta}
                  onChange={(e) => setEditingQuestionData(prev => ({ ...prev, pregunta: e.target.value }))}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition resize-y"
                  placeholder="Escribe la formulación clara de la pregunta..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Guía o Requisito Normativo
                  </label>
                  <input
                    type="text"
                    value={editingQuestionData.requisito}
                    onChange={(e) => setEditingQuestionData(prev => ({ ...prev, requisito: e.target.value }))}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                    placeholder="Ej. ISO 27001 A.8.1 / Política interna..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Evidencia Sugerida
                  </label>
                  <input
                    type="text"
                    value={editingQuestionData.evidencia}
                    onChange={(e) => setEditingQuestionData(prev => ({ ...prev, evidencia: e.target.value }))}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                    placeholder="Ej. Matriz de riesgos, tickets de soporte, capturas..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nota Explicativa (Opcional)
                </label>
                <input
                  type="text"
                  value={editingQuestionData.nota}
                  onChange={(e) => setEditingQuestionData(prev => ({ ...prev, nota: e.target.value }))}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  placeholder="Ej. Criterio de aceptación para auditor..."
                />
              </div>

              {/* Criterios / Parámetros de Evaluación (Escala 0 a 4) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800">
                      Criterio o Parámetro de Evaluación (Escala 0 a 4)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Define la descripción o condición esperada para cada puntaje de madurez en esta pregunta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingQuestionData(prev => ({
                      ...prev,
                      escalaEvaluacion: [...GENERIC_EVALUATION_SCALE]
                    }))}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline self-start sm:self-auto cursor-pointer"
                  >
                    Restablecer escala estándar
                  </button>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
                  {[0, 1, 2, 3, 4].map((score) => {
                    const badgeStyles = [
                      'bg-rose-50 text-rose-700 border-rose-200/60',
                      'bg-amber-50 text-amber-700 border-amber-200/60',
                      'bg-blue-50 text-blue-700 border-blue-200/60',
                      'bg-indigo-50 text-indigo-700 border-indigo-200/60',
                      'bg-emerald-50 text-emerald-700 border-emerald-200/60',
                    ];
                    return (
                      <div key={score} className="flex items-center gap-2.5">
                        <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${badgeStyles[score]}`}>
                          {score}
                        </span>
                        <input
                          type="text"
                          value={editingQuestionData.escalaEvaluacion?.[score] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingQuestionData(prev => {
                              const newScale = prev.escalaEvaluacion ? [...prev.escalaEvaluacion] : [...GENERIC_EVALUATION_SCALE];
                              newScale[score] = val;
                              return { ...prev, escalaEvaluacion: newScale };
                            });
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                          placeholder={`Criterio para puntuación ${score}...`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingQuestionData(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {globalLoadingMessage && <CubeLoader message={globalLoadingMessage} />}
      <CustomDialogModal config={modalConfig} onClose={() => setModalConfig(null)} />
    </div>
  );
};

export default AuditForm;
