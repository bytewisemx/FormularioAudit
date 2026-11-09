import React, { useState, useEffect, useMemo } from 'react';
import { 
  GitMerge, 
  Check, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Scale, 
  User, 
  Users, 
  X, 
  Filter, 
  Sparkles,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';

const AuditMergeModal = ({
  isOpen,
  onClose,
  evaluations = {},
  currentAuditorUid,
  customSections = {},
  initialFinalAnswers = {},
  onConsolidate
}) => {
  // Lista de evaluadores disponibles
  const evaluatorUids = useMemo(() => {
    return Object.keys(evaluations);
  }, [evaluations]);

  // Selección de Auditor A y Auditor B
  const [auditorAId, setAuditorAId] = useState('');
  const [auditorBId, setAuditorBId] = useState('');

  // Inicializar selección por defecto
  useEffect(() => {
    if (evaluatorUids.length >= 2) {
      setAuditorAId(evaluatorUids[0]);
      setAuditorBId(evaluatorUids[1]);
    } else if (evaluatorUids.length === 1) {
      setAuditorAId(evaluatorUids[0]);
      setAuditorBId(evaluatorUids[0]);
    }
  }, [evaluatorUids]);

  // Respuestas consolidadas en edición local
  const [consolidatedAnswers, setConsolidatedAnswers] = useState({});
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'diff' | 'same' | 'pending'
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');

  const auditorA = evaluations[auditorAId] || { auditorName: 'Auditor A', answers: {} };
  const auditorB = evaluations[auditorBId] || { auditorName: 'Auditor B', answers: {} };

  // Helper para normalizar score y comentario
  const extractScore = (answer) => {
    if (!answer) return null;
    if (answer.score !== undefined && answer.score !== null && answer.score !== '') return Number(answer.score);
    if (answer.evaluacion !== undefined && answer.evaluacion !== null && answer.evaluacion !== '') return Number(answer.evaluacion);
    return null;
  };

  const extractComment = (answer) => {
    if (!answer) return '';
    return answer.comment || answer.observaciones || '';
  };

  const extractEvidence = (answer) => {
    if (!answer) return '';
    return answer.evidence || answer.evidencia || '';
  };

  // Inicializar respuestas consolidadas al abrir o cambiar de auditores
  useEffect(() => {
    if (!isOpen) return;

    const initialMap = { ...initialFinalAnswers };

    // Si para alguna pregunta coinciden los scores de A y B, se pre-resuelve automáticamente
    Object.entries(customSections).forEach(([section, questions]) => {
      (questions || []).forEach(q => {
        const key = `${section}-${q.id}`;
        const ansA = auditorA.answers?.[key];
        const ansB = auditorB.answers?.[key];
        const scoreA = extractScore(ansA);
        const scoreB = extractScore(ansB);

        // Si ya hay una respuesta previamente consolidada en initialFinalAnswers, preservarla
        if (initialMap[key]?.score !== undefined || initialMap[key]?.evaluacion !== undefined) {
          return;
        }

        // Si ambos evaluaron y coinciden exactamente
        if (scoreA !== null && scoreB !== null && scoreA === scoreB) {
          const comment = extractComment(ansA) || extractComment(ansB);
          const evidence = extractEvidence(ansA) || extractEvidence(ansB);
          initialMap[key] = {
            score: scoreA,
            evaluacion: scoreA,
            comment: comment,
            observaciones: comment,
            evidence: evidence,
            evidencia: evidence,
            resolvedBy: 'auto_match'
          };
        } else if (scoreA !== null && scoreB === null) {
          initialMap[key] = {
            score: scoreA,
            evaluacion: scoreA,
            comment: extractComment(ansA),
            observaciones: extractComment(ansA),
            evidence: extractEvidence(ansA),
            evidencia: extractEvidence(ansA),
            resolvedBy: 'only_a'
          };
        } else if (scoreB !== null && scoreA === null) {
          initialMap[key] = {
            score: scoreB,
            evaluacion: scoreB,
            comment: extractComment(ansB),
            observaciones: extractComment(ansB),
            evidence: extractEvidence(ansB),
            evidencia: extractEvidence(ansB),
            resolvedBy: 'only_b'
          };
        }
      });
    });

    setConsolidatedAnswers(initialMap);
  }, [isOpen, auditorAId, auditorBId, customSections]);

  // Lista plana de todas las preguntas para métricas y comparación
  const allQuestionsList = useMemo(() => {
    const list = [];
    Object.entries(customSections).forEach(([section, questions]) => {
      (questions || []).forEach(q => {
        const key = `${section}-${q.id}`;
        const ansA = auditorA.answers?.[key];
        const ansB = auditorB.answers?.[key];
        const scoreA = extractScore(ansA);
        const scoreB = extractScore(ansB);
        const resolved = consolidatedAnswers[key];

        const isSameScore = scoreA !== null && scoreB !== null && scoreA === scoreB;
        const isDiffScore = scoreA !== null && scoreB !== null && scoreA !== scoreB;
        const isPending = !resolved || resolved.score === undefined;

        list.push({
          section,
          question: q,
          key,
          ansA,
          ansB,
          scoreA,
          scoreB,
          isSameScore,
          isDiffScore,
          isPending,
          resolved
        });
      });
    });
    return list;
  }, [customSections, auditorA, auditorB, consolidatedAnswers]);

  // Estadísticas comparativas
  const stats = useMemo(() => {
    let same = 0;
    let diff = 0;
    let pending = 0;
    let resolved = 0;

    allQuestionsList.forEach(item => {
      if (item.isSameScore) same++;
      if (item.isDiffScore) diff++;
      if (item.isPending) pending++;
      else resolved++;
    });

    return {
      total: allQuestionsList.length,
      same,
      diff,
      pending,
      resolved
    };
  }, [allQuestionsList]);

  // Filtrado de preguntas en la lista
  const filteredQuestions = useMemo(() => {
    return allQuestionsList.filter(item => {
      if (selectedAreaFilter !== 'all' && item.section !== selectedAreaFilter) {
        return false;
      }
      if (filterMode === 'diff') return item.isDiffScore;
      if (filterMode === 'same') return item.isSameScore;
      if (filterMode === 'pending') return item.isPending;
      return true;
    });
  }, [allQuestionsList, filterMode, selectedAreaFilter]);

  // Acciones de resolución por pregunta
  const handleResolveUseA = (key, item) => {
    const score = item.scoreA !== null ? item.scoreA : 0;
    const comment = extractComment(item.ansA);
    const evidence = extractEvidence(item.ansA);
    setConsolidatedAnswers(prev => ({
      ...prev,
      [key]: {
        score,
        evaluacion: score,
        comment,
        observaciones: comment,
        evidence,
        evidencia: evidence,
        resolvedBy: 'use_a'
      }
    }));
  };

  const handleResolveUseB = (key, item) => {
    const score = item.scoreB !== null ? item.scoreB : 0;
    const comment = extractComment(item.ansB);
    const evidence = extractEvidence(item.ansB);
    setConsolidatedAnswers(prev => ({
      ...prev,
      [key]: {
        score,
        evaluacion: score,
        comment,
        observaciones: comment,
        evidence,
        evidencia: evidence,
        resolvedBy: 'use_b'
      }
    }));
  };

  const handleResolveAverage = (key, item) => {
    const sA = item.scoreA !== null ? item.scoreA : 0;
    const sB = item.scoreB !== null ? item.scoreB : 0;
    const avg = Math.round((sA + sB) / 2);

    const commA = extractComment(item.ansA);
    const commB = extractComment(item.ansB);
    let combinedComment = '';
    if (commA && commB && commA !== commB) {
      combinedComment = `[${auditorA.auditorName || 'Auditor A'}]: ${commA}\n[${auditorB.auditorName || 'Auditor B'}]: ${commB}`;
    } else {
      combinedComment = commA || commB || '';
    }

    const combinedEvidence = extractEvidence(item.ansA) || extractEvidence(item.ansB) || '';

    setConsolidatedAnswers(prev => ({
      ...prev,
      [key]: {
        score: avg,
        evaluacion: avg,
        comment: combinedComment,
        observaciones: combinedComment,
        evidence: combinedEvidence,
        evidencia: combinedEvidence,
        resolvedBy: 'averaged'
      }
    }));
  };

  const handleManualScoreChange = (key, scoreVal) => {
    setConsolidatedAnswers(prev => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          score: scoreVal,
          evaluacion: scoreVal,
          resolvedBy: 'manual'
        }
      };
    });
  };

  const handleCommentChange = (key, text) => {
    setConsolidatedAnswers(prev => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          comment: text,
          observaciones: text
        }
      };
    });
  };

  const handleEvidenceChange = (key, text) => {
    setConsolidatedAnswers(prev => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          evidence: text,
          evidencia: text
        }
      };
    });
  };

  // Acciones masivas
  const handleAcceptAllMatches = () => {
    setConsolidatedAnswers(prev => {
      const updated = { ...prev };
      allQuestionsList.forEach(item => {
        if (item.isSameScore) {
          const score = item.scoreA;
          const comment = extractComment(item.ansA) || extractComment(item.ansB);
          const evidence = extractEvidence(item.ansA) || extractEvidence(item.ansB);
          updated[item.key] = {
            score,
            evaluacion: score,
            comment,
            observaciones: comment,
            evidence,
            evidencia: evidence,
            resolvedBy: 'auto_match'
          };
        }
      });
      return updated;
    });
  };

  const handleUseAllFromA = () => {
    if (!window.confirm(`¿Deseas aplicar todas las respuestas de "${auditorA.auditorName}" a las preguntas pendientes o en conflicto?`)) return;
    setConsolidatedAnswers(prev => {
      const updated = { ...prev };
      allQuestionsList.forEach(item => {
        if (item.scoreA !== null) {
          updated[item.key] = {
            score: item.scoreA,
            evaluacion: item.scoreA,
            comment: extractComment(item.ansA),
            observaciones: extractComment(item.ansA),
            evidence: extractEvidence(item.ansA),
            evidencia: extractEvidence(item.ansA),
            resolvedBy: 'use_a'
          };
        }
      });
      return updated;
    });
  };

  const handleUseAllFromB = () => {
    if (!window.confirm(`¿Deseas aplicar todas las respuestas de "${auditorB.auditorName}" a las preguntas pendientes o en conflicto?`)) return;
    setConsolidatedAnswers(prev => {
      const updated = { ...prev };
      allQuestionsList.forEach(item => {
        if (item.scoreB !== null) {
          updated[item.key] = {
            score: item.scoreB,
            evaluacion: item.scoreB,
            comment: extractComment(item.ansB),
            observaciones: extractComment(item.ansB),
            evidence: extractEvidence(item.ansB),
            evidencia: extractEvidence(item.ansB),
            resolvedBy: 'use_b'
          };
        }
      });
      return updated;
    });
  };

  const handleFinalSubmit = () => {
    if (stats.pending > 0) {
      const confirmPending = window.confirm(
        `Aún hay ${stats.pending} pregunta(s) sin consolidar. ¿Deseas generar la versión oficial con las preguntas consolidadas hasta ahora?`
      );
      if (!confirmPending) return;
    }
    onConsolidate(consolidatedAnswers, auditorAId, auditorBId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Módulo de Fusión y Consolidación (Merge)</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  Fork & Merge
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Compara evaluaciones independientes de auditores, resuelve discrepancias y genera la versión oficial de auditoría.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Selección de Auditores y Métricas */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-100 shrink-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector Auditor A */}
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                A
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Auditor Evaluador A
                </label>
                <select
                  value={auditorAId}
                  onChange={(e) => setAuditorAId(e.target.value)}
                  className="w-full bg-transparent font-medium text-slate-800 text-xs sm:text-sm focus:outline-none cursor-pointer truncate"
                >
                  {evaluatorUids.map(uid => {
                    const ev = evaluations[uid];
                    return (
                      <option key={uid} value={uid}>
                        {ev.auditorName || 'Auditor'} ({ev.role || 'Evaluador'}) — {Object.keys(ev.answers || {}).length} respuestas
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Selector Auditor B */}
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                B
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Auditor Evaluador B
                </label>
                <select
                  value={auditorBId}
                  onChange={(e) => setAuditorBId(e.target.value)}
                  className="w-full bg-transparent font-medium text-slate-800 text-xs sm:text-sm focus:outline-none cursor-pointer truncate"
                >
                  {evaluatorUids.map(uid => {
                    const ev = evaluations[uid];
                    return (
                      <option key={uid} value={uid}>
                        {ev.auditorName || 'Auditor'} ({ev.role || 'Evaluador'}) — {Object.keys(ev.answers || {}).length} respuestas
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Métricas y Acciones Masivas */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Badges de estadísticas */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                Total: <strong className="font-bold">{stats.total}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200/60 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Coincidencias: <strong className="font-bold">{stats.same}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-200/60 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Diferencias: <strong className="font-bold">{stats.diff}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-200/60 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Consolidadas: <strong className="font-bold">{stats.resolved}</strong>
              </span>
            </div>

            {/* Acciones Rápidas Masivas */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAcceptAllMatches}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer"
                title="Aceptar todas las respuestas donde ambos auditores coinciden en puntuación"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aceptar Coincidencias
              </button>
              <button
                type="button"
                onClick={handleUseAllFromA}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition cursor-pointer"
                title="Copiar todas las respuestas del Auditor A"
              >
                Copiar Todo de A
              </button>
              <button
                type="button"
                onClick={handleUseAllFromB}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition cursor-pointer"
                title="Copiar todas las respuestas del Auditor B"
              >
                Copiar Todo de B
              </button>
            </div>
          </div>

          {/* Filtros de Lista */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({allQuestionsList.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('diff')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  filterMode === 'diff' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Solo Diferencias ({stats.diff})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('same')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  filterMode === 'same' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Solo Coincidencias ({stats.same})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('pending')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  filterMode === 'pending' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({stats.pending})
              </button>
            </div>

            {/* Filtro por Área */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedAreaFilter}
                onChange={(e) => setSelectedAreaFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                <option value="all">Todas las Áreas</option>
                {Object.keys(customSections).map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contenedor con scroll para la comparativa pregunta por pregunta */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No hay preguntas que coincidan con el filtro</h3>
              <p className="text-xs text-slate-500 mt-1">
                Prueba cambiando el filtro de visualización a "Todas" o seleccionando otra área.
              </p>
            </div>
          ) : (
            filteredQuestions.map(item => {
              const { key, section, question, scoreA, scoreB, isSameScore, isDiffScore, resolved } = item;
              const currentScore = resolved?.score;

              return (
                <div
                  key={key}
                  className={`bg-white rounded-xl border transition-all shadow-xs ${
                    isDiffScore && (!resolved || resolved.resolvedBy === undefined)
                      ? 'border-amber-300 ring-2 ring-amber-100'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Encabezado de la pregunta */}
                  <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 rounded-t-xl flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase tracking-wider shrink-0">
                        {section}
                      </span>
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        Control {question.id}: {question.pregunta}
                      </h4>
                    </div>

                    {/* Estado de resolución */}
                    <div>
                      {isSameScore ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" /> Coinciden en {scoreA} pts
                        </span>
                      ) : isDiffScore ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3" /> Discrepancia: {scoreA ?? '-'} vs {scoreB ?? '-'} pts
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          Evaluación parcial
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cuerpo comparativo: 3 Columnas (Auditor A | Auditor B | Resolución Oficial) */}
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                    
                    {/* Columna Auditor A */}
                    <div className="lg:col-span-4 p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                              A
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {auditorA.auditorName || 'Auditor A'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            scoreA !== null ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {scoreA !== null ? `${scoreA} / 4 pts` : 'Sin evaluar'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1.5 mt-2">
                          <p className="line-clamp-3">
                            <strong className="text-slate-700">Comentario:</strong> {extractComment(item.ansA) || '—'}
                          </p>
                          {extractEvidence(item.ansA) && (
                            <p className="line-clamp-2 text-slate-500 italic">
                              <strong>Evidencia:</strong> {extractEvidence(item.ansA)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-200/60 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleResolveUseA(key, item)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                        >
                          Usar respuesta de A <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Columna Auditor B */}
                    <div className="lg:col-span-4 p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                              B
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {auditorB.auditorName || 'Auditor B'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            scoreB !== null ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {scoreB !== null ? `${scoreB} / 4 pts` : 'Sin evaluar'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1.5 mt-2">
                          <p className="line-clamp-3">
                            <strong className="text-slate-700">Comentario:</strong> {extractComment(item.ansB) || '—'}
                          </p>
                          {extractEvidence(item.ansB) && (
                            <p className="line-clamp-2 text-slate-500 italic">
                              <strong>Evidencia:</strong> {extractEvidence(item.ansB)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-200/60 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleResolveUseB(key, item)}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                        >
                          Usar respuesta de B <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Columna Resolución Oficial Consolidada */}
                    <div className="lg:col-span-4 p-3 bg-blue-50/40 rounded-xl border border-blue-100 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Versión Consolidada
                          </span>
                          
                          {/* Botón de Promediar */}
                          {scoreA !== null && scoreB !== null && (
                            <button
                              type="button"
                              onClick={() => handleResolveAverage(key, item)}
                              className="text-[11px] font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                              title="Promediar puntaje de A y B y fusionar observaciones"
                            >
                              <Scale className="w-3 h-3" /> Promediar
                            </button>
                          )}
                        </div>

                        {/* Botones de selección de puntaje consolidado 0 a 4 */}
                        <div className="flex items-center gap-1 mb-2.5">
                          {[0, 1, 2, 3, 4].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleManualScoreChange(key, val)}
                              className={`flex-1 py-1 text-xs font-bold rounded transition cursor-pointer ${
                                currentScore === val
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>

                        {/* Input para comentario oficial */}
                        <textarea
                          rows={2}
                          placeholder="Comentario / hallazgo consolidado oficial..."
                          value={resolved?.comment || resolved?.observaciones || ''}
                          onChange={(e) => handleCommentChange(key, e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                        />

                        {/* Input para evidencia consolidada */}
                        <input
                          type="text"
                          placeholder="Evidencias finales verificadas..."
                          value={resolved?.evidence || resolved?.evidencia || ''}
                          onChange={(e) => handleEvidenceChange(key, e.target.value)}
                          className="w-full text-[11px] p-1.5 mt-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {resolved?.resolvedBy && (
                        <div className="pt-2 mt-2 border-t border-blue-100/70 text-[10px] text-blue-600 flex items-center justify-between">
                          <span>
                            Resolución: {
                              resolved.resolvedBy === 'auto_match' ? 'Coincidencia automática' :
                              resolved.resolvedBy === 'use_a' ? 'Respuesta de A' :
                              resolved.resolvedBy === 'use_b' ? 'Respuesta de B' :
                              resolved.resolvedBy === 'averaged' ? 'Promedio matemático' : 'Ajuste manual'
                            }
                          </span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Preguntas consolidadas: <strong className="text-slate-800 font-bold">{stats.resolved}</strong> de {stats.total}
            {stats.pending > 0 && (
              <span className="text-amber-600 ml-2 font-medium">({stats.pending} pendientes)</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              Generar Versión Oficial de Auditoría
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuditMergeModal;

