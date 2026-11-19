/**
 * Servicio Especializado de Borradores en Subcolecciones Independientes de Firestore
 * Arquitectura canónica:
 * - Documento principal: auditorias/{auditId} (metadatos, estructura, officialVersion, draftsSummary)
 * - Subcolección aislada: auditorias/{auditId}/drafts/{userId} (respuestas exclusivas del auditor)
 */
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot } from "firebase/firestore";
import { cleanText, isSameAuditor } from "./auditCollaborativeUtils";

/**
 * Normaliza una respuesta individual garantizando congruencia entre campos
 */
export const normalizeDraftAnswer = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const scoreRaw = raw.score !== undefined ? raw.score : raw.evaluacion;
  const score = (scoreRaw !== undefined && scoreRaw !== null && scoreRaw !== '') ? Number(scoreRaw) : null;
  const notes = (raw.notes !== undefined ? raw.notes : (raw.observaciones || '')).toString();
  const evidence = (raw.evidence !== undefined ? raw.evidence : (raw.evidencia || '')).toString();

  return {
    score,
    evaluacion: score,
    notes,
    observaciones: notes,
    evidence,
    evidencia: evidence,
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
};

/**
 * Construye el objeto canónico de un borrador según la especificación
 */
export const buildDraftDoc = (ownerUid, ownerName, ownerEmail, responses = {}, totalQuestions = 0) => {
  const answers = {};
  let answeredCount = 0;

  Object.entries(responses || {}).forEach(([key, val]) => {
    const norm = normalizeDraftAnswer(val);
    if (norm) {
      answers[key] = norm;
      if (norm.score !== null) {
        answeredCount++;
      }
    }
  });

  const total = Number(totalQuestions) > 0 ? Number(totalQuestions) : 0;
  const progress = total > 0 ? Math.min(100, Math.round((answeredCount / total) * 100)) : (answeredCount > 0 ? 100 : 0);
  const now = new Date().toISOString();

  return {
    ownerUid: (ownerUid || 'auditor_main').toString(),
    ownerName: (ownerName || 'Auditor').trim(),
    ownerEmail: (ownerEmail || '').trim(),
    answers,
    answeredCount,
    totalQuestions: total,
    progress,
    updatedAt: now
  };
};

/**
 * Guarda el borrador del auditor en su subcolección aislada audits/{auditId}/drafts/{userId}
 * y actualiza de forma atómica y ligera el resumen en el documento padre sin sobreescrituras.
 */
export const saveUserDraftToFirestore = async (db, auditId, ownerUid, ownerName, ownerEmail, responses, totalQuestions) => {
  if (!db || !auditId || !ownerUid) return null;

  try {
    const draftDoc = buildDraftDoc(ownerUid, ownerName, ownerEmail, responses, totalQuestions);
    const draftRef = doc(db, "auditorias", auditId, "drafts", ownerUid);

    // 1. Guardar en la subcolección independiente (Cero colisiones)
    await setDoc(draftRef, draftDoc, { merge: true });

    // 2. Actualizar metadatos en documento padre (NUNCA responses)
    const parentRef = doc(db, "auditorias", auditId);
    const summary = {
      ownerUid: draftDoc.ownerUid,
      ownerName: draftDoc.ownerName,
      ownerEmail: draftDoc.ownerEmail,
      answeredCount: draftDoc.answeredCount,
      totalQuestions: draftDoc.totalQuestions,
      progress: draftDoc.progress,
      updatedAt: draftDoc.updatedAt
    };

    updateDoc(parentRef, {
      lastModified: draftDoc.updatedAt,
      [`draftsSummary.${ownerUid}`]: summary
    }).catch(err => {
      console.warn("No se pudo actualizar draftsSummary en doc padre:", err);
    });

    return draftDoc;
  } catch (err) {
    console.error("Error guardando borrador en subcolección:", err);
    throw err;
  }
};

/**
 * Carga todos los borradores de la subcolección audits/{auditId}/drafts
 * Si la subcolección está vacía, migra automáticamente datos existentes de auditorías previas.
 */
export const fetchAuditDraftsFromFirestore = async (db, auditId, rawAuditData = null, defaultUid = null) => {
  if (!db || !auditId) return {};

  try {
    const draftsCol = collection(db, "auditorias", auditId, "drafts");
    const snap = await getDocs(draftsCol);
    const drafts = {};

    snap.forEach(d => {
      drafts[d.id] = d.data();
    });

    // Si ya existen borradores en la subcolección, retornarlos
    if (Object.keys(drafts).length > 0) {
      return drafts;
    }

    // MIGRACIÓN RETROCOMPATIBLE AUTOMÁTICA:
    // Si la subcolección está vacía pero el documento padre tiene evaluaciones o respuestas previas
    if (rawAuditData) {
      const data = rawAuditData.data || rawAuditData;
      const evals = data.evaluations || rawAuditData.evaluations || {};

      if (Object.keys(evals).length > 0) {
        for (const [uid, ev] of Object.entries(evals)) {
          const answers = ev.answers || {};
          const ownerName = ev.auditorName || ev.name || 'Auditor';
          const ownerEmail = ev.email || '';
          const totalQ = Object.keys(answers).length;
          const draftDoc = buildDraftDoc(uid, ownerName, ownerEmail, answers, totalQ);
          try {
            await setDoc(doc(db, "auditorias", auditId, "drafts", uid), draftDoc, { merge: true });
            drafts[uid] = draftDoc;
          } catch (e) { }
        }
      } else if (data.responses && Object.keys(data.responses).length > 0) {
        const uid = defaultUid || 'auditor_main';
        const ownerName = data.actor?.nombreAuditor || 'Auditor Principal';
        const ownerEmail = data.actor?.email || '';
        const totalQ = Object.keys(data.responses).length;
        const draftDoc = buildDraftDoc(uid, ownerName, ownerEmail, data.responses, totalQ);
        try {
          await setDoc(doc(db, "auditorias", auditId, "drafts", uid), draftDoc, { merge: true });
          drafts[uid] = draftDoc;
        } catch (e) { }
      }
    }

    return drafts;
  } catch (err) {
    console.error("Error consultando subcolección de borradores:", err);
    return {};
  }
};

/**
 * Identifica con total precisión al compañero en una auditoría, evitando cualquier auto-referencia
 */
export const findColleagueInAudit = (audit, draftsMap = {}, currentUid = '', currentEmail = '', currentName = '') => {
  if (!audit) return null;

  // 1. Revisar borradores en la subcolección (draftsMap)
  const draftEntries = Object.entries(draftsMap || {});
  for (const [uid, draft] of draftEntries) {
    const isMe = isSameAuditor({ uid, email: draft.ownerEmail, name: draft.ownerName }, currentUid, currentEmail, currentName);
    if (!isMe) {
      return {
        uid,
        name: draft.ownerName || 'Co-Auditor',
        auditorName: draft.ownerName || 'Co-Auditor',
        email: draft.ownerEmail || '',
        role: 'Co-Auditor',
        answers: draft.answers || {},
        answeredCount: draft.answeredCount || 0,
        totalQuestions: draft.totalQuestions || 0,
        progress: draft.progress || 0,
        updatedAt: draft.updatedAt || null,
        hasDraft: true
      };
    }
  }

  // 2. Revisar draftsSummary del documento padre
  const summaryEntries = Object.entries(audit.draftsSummary || {});
  for (const [uid, summary] of summaryEntries) {
    const isMe = isSameAuditor({ uid, email: summary.ownerEmail, name: summary.ownerName }, currentUid, currentEmail, currentName);
    if (!isMe) {
      return {
        uid,
        name: summary.ownerName || 'Co-Auditor',
        auditorName: summary.ownerName || 'Co-Auditor',
        email: summary.ownerEmail || '',
        role: 'Co-Auditor',
        answers: {},
        answeredCount: summary.answeredCount || 0,
        totalQuestions: summary.totalQuestions || 0,
        progress: summary.progress || 0,
        updatedAt: summary.updatedAt || null,
        hasDraft: true
      };
    }
  }

  // 3. Revisar lista de participantes predefinida en audit.auditors
  const auditors = Array.isArray(audit.auditors) ? audit.auditors : (audit.data?.auditors || []);
  if (auditors.length > 0) {
    const colAud = auditors.find(aud => !isSameAuditor(aud, currentUid, currentEmail, currentName));
    if (colAud) {
      return {
        uid: colAud.uid || 'colleague_uid',
        name: colAud.name || 'Co-Auditor',
        auditorName: colAud.name || 'Co-Auditor',
        email: colAud.email || '',
        role: colAud.role || 'Co-Auditor',
        answers: {},
        answeredCount: 0,
        totalQuestions: 0,
        progress: 0,
        updatedAt: null,
        hasDraft: false
      };
    }
  }

  // 4. Si la auditoría tiene modo colaborativo pero no está en auditors, verificar campo actor compuesto
  const ownerName = (audit.data?.actor?.nombreAuditor || audit.actor?.nombreAuditor || '').trim();
  if (ownerName.toLowerCase().includes(' y ') || ownerName.toLowerCase().includes(' & ')) {
    const parts = ownerName.split(/\s+[yY&]\s+/);
    const isMeFirst = isSameAuditor({ name: parts[0] }, currentUid, currentEmail, currentName);
    const colName = isMeFirst ? parts[1].trim() : parts[0].trim();
    return {
      uid: isMeFirst ? 'auditor_2' : 'auditor_1',
      name: colName,
      auditorName: colName,
      email: '',
      role: 'Co-Auditor',
      answers: {},
      answeredCount: 0,
      totalQuestions: 0,
      progress: 0,
      updatedAt: null,
      hasDraft: false
    };
  }

  return null;
};
