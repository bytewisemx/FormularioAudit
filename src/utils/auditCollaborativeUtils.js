/**
 * Utilidades para el Sistema de Trabajo Colaborativo por Versiones (Fork & Merge)
 * Estructura canónica:
 * {
 *   id, companyName, mode: 'single' | 'collaborative', maxAuditors: 1 | 2,
 *   auditors: [{ uid, name, email, role }],
 *   drafts: { [uid]: { answers: {}, progress: 0, updatedAt: '' } },
 *   officialVersion: { isPublished: false, mergedAt: null, mergedBy: null, answers: {} }
 * }
 */

/**
 * Normaliza nombres o cadenas para comparación segura
 */
export const cleanText = (str) => {
  if (!str) return '';
  return str.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Comprueba si un objeto de auditor representa al usuario actualmente autenticado
 */
export const isSameAuditor = (auditorObj, currentUid, currentEmail, currentName) => {
  if (!auditorObj) return false;

  const aUid = (auditorObj.uid || '').toString().trim();
  const aEmail = cleanText(auditorObj.email);
  const aName = cleanText(auditorObj.name || auditorObj.auditorName);

  const myUid = (currentUid || '').toString().trim();
  const myEmail = cleanText(currentEmail);
  const myName = cleanText(currentName);

  // 1. Coincidencia estricta por UID
  if (aUid && myUid && aUid === myUid) return true;

  // 2. Coincidencia estricta por Email
  if (aEmail && myEmail && aEmail === myEmail) return true;

  // 3. Caso especial cuenta master Oscar Thomason
  const isOscarMe = myEmail === 'thomason.mx@gmail.com' || myName.includes('oscar') || myName.includes('thomason');
  const isOscarOther = aEmail === 'thomason.mx@gmail.com' || aName.includes('oscar') || aName.includes('thomason');
  if (isOscarMe && isOscarOther) return true;

  // 4. Coincidencia por Nombre
  if (aName && myName) {
    if (aName === myName) return true;
    if (aName.length >= 4 && myName.length >= 4) {
      if (aName.includes(myName) || myName.includes(aName)) return true;
    }
  }

  return false;
};

/**
 * Calcula el total de preguntas a partir de las secciones
 */
export const getTotalQuestionsCount = (customSections) => {
  if (!customSections || typeof customSections !== 'object') return 0;
  return Object.values(customSections).reduce((acc, sec) => {
    return acc + (Array.isArray(sec) ? sec.length : 0);
  }, 0);
};

/**
 * Calcula el progreso (%) a partir del mapa de respuestas
 */
export const calculateProgressFromAnswers = (answers = {}, totalQuestions = 0) => {
  if (!answers || typeof answers !== 'object') return 0;
  const answeredCount = Object.values(answers).filter(a => {
    if (!a) return false;
    return a.score !== undefined && a.score !== null && a.score !== '' ||
      a.evaluacion !== undefined && a.evaluacion !== null && a.evaluacion !== '';
  }).length;

  if (totalQuestions <= 0) return answeredCount > 0 ? 100 : 0;
  return Math.min(100, Math.round((answeredCount / totalQuestions) * 100));
};

/**
 * Normaliza cualquier auditoría (antigua o nueva) a la estructura canónica
 */
export const normalizeAudit = (rawAudit, _currentUser = null) => {
  if (!rawAudit) return null;

  const data = rawAudit.data || rawAudit;
  const auditId = rawAudit.id || 'temp_audit_id';
  const companyName = rawAudit.companyName || rawAudit.nombreEmpresa || data.introData?.nombreEmpresa || 'Empresa';

  // 1. Obtener o inferir lista de auditores
  let auditors = Array.isArray(rawAudit.auditors)
    ? [...rawAudit.auditors]
    : (Array.isArray(data.auditors) ? [...data.auditors] : []);

  if (auditors.length === 0) {
    const evals = data.evaluations || rawAudit.evaluations || {};
    const evalEntries = Object.entries(evals);
    if (evalEntries.length > 0) {
      auditors = evalEntries.map(([uid, ev]) => ({
        uid,
        name: ev.auditorName || 'Auditor',
        email: ev.email || '',
        role: ev.role || 'Auditor'
      }));
    } else {
      const ownerName = (data.actor?.nombreAuditor || rawAudit.actor?.nombreAuditor || '').trim();
      if (ownerName.toLowerCase().includes(' y ') || ownerName.toLowerCase().includes(' & ')) {
        const parts = ownerName.split(/\s+[yY&]\s+/);
        auditors = [
          { uid: 'auditor_1', name: parts[0].trim(), email: '', role: data.actor?.rol || 'Auditor Líder' },
          { uid: 'auditor_2', name: parts[1].trim(), email: '', role: 'Co-Auditor' }
        ];
      } else if (ownerName) {
        auditors = [{ uid: 'auditor_main', name: ownerName, email: '', role: data.actor?.rol || 'Auditor' }];
      }
    }
  }

  // 2. Modo y Límite de Auditores
  const rawMode = rawAudit.mode || data.mode;
  const mode = rawMode || (auditors.length > 1 ? 'collaborative' : 'single');
  const maxAuditors = rawAudit.maxAuditors || (mode === 'single' ? 1 : 2);

  // Asegurar que si es single, el array de auditors no exceda 1
  if (mode === 'single' && auditors.length > 1) {
    auditors = [auditors[0]];
  } else if (auditors.length > 2) {
    auditors = auditors.slice(0, 2);
  }

  // 3. Borradores y resumen por UID
  let drafts = rawAudit.drafts || data.drafts || {};
  const draftsSummary = rawAudit.draftsSummary || data.draftsSummary || {};

  // Si existen entradas en draftsSummary, incorporarlas
  Object.entries(draftsSummary).forEach(([uid, summ]) => {
    if (!drafts[uid]) {
      drafts[uid] = {
        answers: {},
        progress: summ.progress || 0,
        answeredCount: summ.answeredCount || 0,
        totalQuestions: summ.totalQuestions || 0,
        updatedAt: summ.updatedAt || rawAudit.lastModified || new Date().toISOString()
      };
    }
  });

  if (Object.keys(drafts).length === 0) {
    drafts = {};
    const evals = data.evaluations || rawAudit.evaluations || {};
    if (Object.keys(evals).length > 0) {
      Object.entries(evals).forEach(([uid, ev]) => {
        const ans = ev.answers || {};
        drafts[uid] = {
          answers: ans,
          progress: ev.progress !== undefined ? ev.progress : calculateProgressFromAnswers(ans),
          updatedAt: ev.updatedAt || rawAudit.lastModified || new Date().toISOString()
        };
      });
    } else if (data.responses && Object.keys(data.responses).length > 0) {
      const firstUid = auditors[0]?.uid || 'auditor_main';
      drafts[firstUid] = {
        answers: { ...data.responses },
        progress: calculateProgressFromAnswers(data.responses),
        updatedAt: rawAudit.lastModified || new Date().toISOString()
      };
    }
  }

  // Asegurar que cada auditor tenga al menos una entrada de borrador
  auditors.forEach(aud => {
    if (!drafts[aud.uid]) {
      drafts[aud.uid] = {
        answers: {},
        progress: 0,
        updatedAt: rawAudit.lastModified || new Date().toISOString()
      };
    }
  });

  // 4. Versión oficial consolidada
  let officialVersion = rawAudit.officialVersion || data.officialVersion || null;
  if (!officialVersion) {
    const finalA = data.finalAudit || rawAudit.finalAudit || {};
    const isPub = finalA.status === 'consolidated' && finalA.answers && Object.keys(finalA.answers).length > 0;
    officialVersion = {
      isPublished: !!isPub,
      mergedAt: finalA.consolidatedAt || null,
      mergedBy: finalA.consolidatedBy || null,
      answers: finalA.answers || {}
    };
  }

  return {
    ...rawAudit,
    id: auditId,
    companyName,
    nombreEmpresa: companyName,
    mode,
    maxAuditors,
    auditors,
    drafts,
    officialVersion,
    data: {
      ...data,
      companyName,
      mode,
      maxAuditors,
      auditors,
      drafts,
      officialVersion
    }
  };
};

/**
 * Obtiene el colega real de una auditoría para el usuario actual, evitando toda auto-referencia
 */
export const getColleagueFromAudit = (audit, currentUid, currentEmail, currentName) => {
  if (!audit) return null;
  const norm = normalizeAudit(audit);
  if (!norm) return null;

  const auditors = norm.auditors || [];
  // 1. Buscar en lista de auditores normalizada
  let colleague = auditors.find(aud => !isSameAuditor(aud, currentUid, currentEmail, currentName));

  // 2. Si no se encontró, buscar en draftsSummary
  if (!colleague && audit.draftsSummary) {
    const summaryEntries = Object.entries(audit.draftsSummary);
    for (const [sUid, summ] of summaryEntries) {
      if (!isSameAuditor({ uid: sUid, email: summ.ownerEmail, name: summ.ownerName }, currentUid, currentEmail, currentName)) {
        colleague = {
          uid: sUid,
          name: summ.ownerName || 'Co-Auditor',
          email: summ.ownerEmail || '',
          role: 'Co-Auditor'
        };
        break;
      }
    }
  }

  // 3. Si sigue sin encontrarse, buscar en drafts
  if (!colleague && norm.drafts) {
    const draftKeys = Object.keys(norm.drafts);
    for (const dUid of draftKeys) {
      if (!isSameAuditor({ uid: dUid }, currentUid, currentEmail, currentName)) {
        colleague = { uid: dUid, name: 'Co-Auditor', email: '', role: 'Co-Auditor' };
        break;
      }
    }
  }

  if (!colleague) return null;

  const colleagueDraft = norm.drafts?.[colleague.uid] || {};
  const summ = audit.draftsSummary?.[colleague.uid];

  return {
    uid: colleague.uid,
    auditorName: colleague.name || 'Co-Auditor',
    name: colleague.name || 'Co-Auditor',
    email: colleague.email || summ?.ownerEmail || '',
    role: colleague.role || 'Co-Auditor',
    answers: colleagueDraft.answers || {},
    answeredCount: summ?.answeredCount || colleagueDraft.answeredCount || 0,
    totalQuestions: summ?.totalQuestions || colleagueDraft.totalQuestions || 0,
    progress: summ?.progress !== undefined ? summ.progress : (colleagueDraft.progress || 0),
    updatedAt: summ?.updatedAt || colleagueDraft.updatedAt || null
  };
};

/**
 * Obtiene el borrador propio del usuario actual en la auditoría
 */
export const getMyDraftFromAudit = (audit, currentUid, currentEmail, currentName) => {
  if (!audit) return { answers: {}, progress: 0 };
  const norm = normalizeAudit(audit);
  if (!norm) return { answers: {}, progress: 0 };

  const auditors = norm.auditors || [];
  const myAuditor = auditors.find(aud => isSameAuditor(aud, currentUid, currentEmail, currentName)) || auditors[0];

  const uid = myAuditor?.uid || currentUid;
  const myDraft = norm.drafts?.[uid] || norm.drafts?.[currentUid] || {};

  return {
    uid,
    answers: myDraft.answers || {},
    progress: myDraft.progress || 0,
    updatedAt: myDraft.updatedAt || null
  };
};

/**
 * Fusión automática de dos borradores
 * Si coinciden scores, toma el score y combina observaciones/evidencias.
 * Si hay discrepancia, predefine el promedio o marca para resolución en modal.
 */
export const autoMergeDraftAnswers = (answersA = {}, answersB = {}) => {
  const allKeys = Array.from(new Set([...Object.keys(answersA), ...Object.keys(answersB)]));
  const merged = {};
  let totalMatches = 0;
  let totalDiscrepancies = 0;

  allKeys.forEach(key => {
    const a = answersA[key];
    const b = answersB[key];

    const scoreA = a?.score !== undefined ? Number(a.score) : (a?.evaluacion !== undefined ? Number(a.evaluacion) : null);
    const scoreB = b?.score !== undefined ? Number(b.score) : (b?.evaluacion !== undefined ? Number(b.evaluacion) : null);

    const commentA = a?.comment || a?.observaciones || '';
    const commentB = b?.comment || b?.observaciones || '';

    const evidenceA = a?.evidence || a?.evidencia || '';
    const evidenceB = b?.evidence || b?.evidencia || '';

    if (scoreA !== null && scoreB !== null) {
      if (scoreA === scoreB) {
        totalMatches++;
        merged[key] = {
          score: scoreA,
          evaluacion: scoreA,
          comment: commentA || commentB,
          observaciones: commentA || commentB,
          evidence: evidenceA || evidenceB,
          evidencia: evidenceA || evidenceB,
          status: 'match'
        };
      } else {
        totalDiscrepancies++;
        // Pre-consenso inicial: promedio redondeado o prioridad
        const avg = Math.round((scoreA + scoreB) / 2);
        merged[key] = {
          score: avg,
          evaluacion: avg,
          comment: commentA ? (commentB ? `${commentA} | ${commentB}` : commentA) : commentB,
          observaciones: commentA ? (commentB ? `${commentA} | ${commentB}` : commentA) : commentB,
          evidence: evidenceA || evidenceB,
          evidencia: evidenceA || evidenceB,
          status: 'discrepancy',
          scoreA,
          scoreB
        };
      }
    } else if (scoreA !== null) {
      merged[key] = {
        score: scoreA,
        evaluacion: scoreA,
        comment: commentA,
        observaciones: commentA,
        evidence: evidenceA,
        evidencia: evidenceA,
        status: 'single_a'
      };
    } else if (scoreB !== null) {
      merged[key] = {
        score: scoreB,
        evaluacion: scoreB,
        comment: commentB,
        observaciones: commentB,
        evidence: evidenceB,
        evidencia: evidenceB,
        status: 'single_b'
      };
    }
  });

  return {
    answers: merged,
    totalMatches,
    totalDiscrepancies,
    totalEvaluated: allKeys.length
  };
};

