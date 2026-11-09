import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  FileText, 
  CheckCircle, 
  Search, 
  Sparkles, 
  RotateCcw, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Loader2, 
  Layers,
  Undo2,
  Redo2,
  Inbox,
  AlertCircle
} from 'lucide-react';
import { DEFAULT_SECTIONS } from '../defaultSections';
import { downloadExcelTemplate, parseQuestionsFile } from '../excelTemplateHelper';
import CustomDialogModal from './CustomDialogModal';
import { filterAiResponse } from '../utils/aiResponseFilter';

const MAX_HISTORY_SNAPSHOTS = 30;

const EditQuestionsModal = ({ 
  isOpen, 
  onClose, 
  initialSections, 
  initialDeletedQuestions = [], 
  onSave 
}) => {
  const [sections, setSections] = useState({});
  const [deletedQuestions, setDeletedQuestions] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [rewritingQuestion, setRewritingQuestion] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalConfig, setModalConfig] = useState(null);

  // Pilas de Historial en Memoria (Undo / Redo)
  const [historyStack, setHistoryStack] = useState([]);
  const [futureStack, setFutureStack] = useState([]);

  // Notificación Toast flotante
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  // Referencia para controlar el guardado de snapshots durante la escritura
  const updateTimeoutRef = useRef(null);

  const showConfirm = ({ title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', isDanger = false }) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: isDanger ? 'danger' : 'confirm',
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

  const showAlert = ({ title, message, type = 'alert', confirmText = 'Entendido' }) => {
    return new Promise((resolve) => {
      setModalConfig({
        type,
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

  // Inicialización al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const clonedSections = JSON.parse(JSON.stringify(initialSections || {}));
      const clonedDeleted = JSON.parse(JSON.stringify(initialDeletedQuestions || []));
      setSections(clonedSections);
      setDeletedQuestions(clonedDeleted);
      setHistoryStack([]);
      setFutureStack([]);
      setToastMessage(null);

      const areas = Object.keys(clonedSections);
      if (areas.length > 0 && (!selectedArea || selectedArea === '__trash__' || !clonedSections[selectedArea])) {
        setSelectedArea(areas[0]);
      }
    }
  }, [isOpen, initialSections, initialDeletedQuestions]);

  // Guardar instantánea (Snapshot) en la pila de historial
  const saveSnapshot = (currentSecs = sections, currentDeleted = deletedQuestions) => {
    const snapshot = {
      sections: JSON.parse(JSON.stringify(currentSecs)),
      deletedQuestions: JSON.parse(JSON.stringify(currentDeleted)),
      selectedArea
    };
    setHistoryStack(prev => {
      const next = [...prev, snapshot];
      if (next.length > MAX_HISTORY_SNAPSHOTS) {
        next.shift();
      }
      return next;
    });
    setFutureStack([]); // Una nueva acción limpia la pila de rehacer
  };

  // Función Deshacer (Undo)
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, -1);

    const currentSnapshot = {
      sections: JSON.parse(JSON.stringify(sections)),
      deletedQuestions: JSON.parse(JSON.stringify(deletedQuestions)),
      selectedArea
    };

    setFutureStack(prev => [...prev, currentSnapshot]);
    setHistoryStack(newHistory);

    setSections(previous.sections);
    setDeletedQuestions(previous.deletedQuestions);

    if (previous.selectedArea && (previous.selectedArea === '__trash__' || previous.sections[previous.selectedArea])) {
      setSelectedArea(previous.selectedArea);
    } else {
      const areas = Object.keys(previous.sections);
      setSelectedArea(areas[0] || (previous.deletedQuestions.length > 0 ? '__trash__' : ''));
    }
  };

  // Función Rehacer (Redo)
  const handleRedo = () => {
    if (futureStack.length === 0) return;
    const next = futureStack[futureStack.length - 1];
    const newFuture = futureStack.slice(0, -1);

    const currentSnapshot = {
      sections: JSON.parse(JSON.stringify(sections)),
      deletedQuestions: JSON.parse(JSON.stringify(deletedQuestions)),
      selectedArea
    };

    setHistoryStack(prev => [...prev, currentSnapshot]);
    setFutureStack(newFuture);

    setSections(next.sections);
    setDeletedQuestions(next.deletedQuestions);

    if (next.selectedArea && (next.selectedArea === '__trash__' || next.sections[next.selectedArea])) {
      setSelectedArea(next.selectedArea);
    } else {
      const areas = Object.keys(next.sections);
      setSelectedArea(areas[0] || (next.deletedQuestions.length > 0 ? '__trash__' : ''));
    }
  };

  // Atajos globales de teclado dentro del modal (Ctrl+Z y Ctrl+Y)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, historyStack, futureStack, sections, deletedQuestions, selectedArea]);

  if (!isOpen) return null;

  const handleAreaChange = (area) => setSelectedArea(area);

  // Actualizar campo de pregunta con snapshot de escritura
  const updateQuestion = (area, questionId, field, value) => {
    if (!updateTimeoutRef.current) {
      saveSnapshot();
    }
    clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      updateTimeoutRef.current = null;
    }, 1500);

    setSections(prev => {
      const newSections = { ...prev };
      const qIndex = newSections[area]?.findIndex(q => q.id === questionId);
      if (qIndex !== undefined && qIndex !== -1) {
        newSections[area][qIndex] = { ...newSections[area][qIndex], [field]: value };
      }
      return newSections;
    });
  };

  const rewriteQuestionWithAI = async (area, item) => {
    const key = area + '-' + item.id;
    const userText = (item.pregunta || '').trim();
    if (!userText) return alert('Escribe algo en la pregunta primero.');

    setRewritingQuestion(key);
    try {
      const res = await fetch(
        'https://n8n-n8n.bg5sbc.easypanel.host/webhook/cd537a01-7f79-4b98-b05b-0c681e507dbe',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'bw_ai_comments_9F3xL8Qp_2026',
          },
          body: JSON.stringify({
            text: `[INSTRUCCIÓN: Actúa como redactor técnico de encuestas y cuestionarios. Reescribe y mejora la redacción y ortografía de la siguiente PREGUNTA de auditoría de TI. Es imperativo que devuelvas el resultado estrictamente en formato de PREGUNTA (utilizando signos de interrogación). NO redactes una observación, ni hallazgo, ni recomendación. Devuelve únicamente la pregunta mejorada].\n\nPregunta original a mejorar: ${userText}`,
            context: {
              tipo: 'pregunta_auditoria',
              area: area
            }
          }),
        }
      );

      if (!res.ok) throw new Error('Error al llamar IA');

      const data = await res.json();
      const cleanText = filterAiResponse(data);

      saveSnapshot();
      updateQuestion(area, item.id, 'pregunta', cleanText);
    } catch (err) {
      console.error(err);
      alert('Error al mejorar la pregunta con IA');
    } finally {
      setRewritingQuestion(null);
    }
  };

  const addQuestion = (area) => {
    saveSnapshot();
    setSections(prev => {
      const newSections = { ...prev };
      const currentQuestions = newSections[area] || [];
      const newId = currentQuestions.length > 0 ? Math.max(...currentQuestions.map(q => Number(q.id) || 0)) + 1 : 1;
      
      newSections[area] = [
        ...currentQuestions,
        {
          id: newId,
          pregunta: 'Nueva pregunta de evaluación...',
          evidencia: '',
          nota: '',
          requisito: '',
          escalaEvaluacion: [
            '0 - No existe',
            '1 - Existe informalmente',
            '2 - Parcialmente documentado',
            '3 - Documentado y aplicado',
            '4 - Óptimo, aprobado y en mejora continua',
          ]
        }
      ];
      return newSections;
    });
  };

  // Borrado Lógico (Soft Delete): mueve a deletedQuestions y conserva respuestas
  const removeQuestion = (area, questionId) => {
    const questionToDelete = sections[area]?.find(q => q.id === questionId);
    if (!questionToDelete) return;

    saveSnapshot();

    const deletedItem = {
      ...questionToDelete,
      originalArea: area,
      deletedAt: new Date().toISOString()
    };

    setSections(prev => {
      const newSections = { ...prev };
      newSections[area] = (newSections[area] || []).filter(q => q.id !== questionId);
      return newSections;
    });

    setDeletedQuestions(prev => [deletedItem, ...prev]);

    // Notificación Toast flotante con botón Deshacer (7 segundos)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({
      text: `Pregunta #${questionId} eliminada del área "${area}".`,
      questionId,
      area
    });

    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 7000);
  };

  // Restaurar pregunta desde la papelera o desde el Toast
  const restoreQuestion = (deletedItem) => {
    saveSnapshot();

    const { originalArea, deletedAt, ...questionData } = deletedItem;
    const targetArea = originalArea || Object.keys(sections)[0] || 'Área General';

    setSections(prev => {
      const newSections = { ...prev };
      const list = [...(newSections[targetArea] || [])];
      if (!list.some(q => q.id === questionData.id)) {
        list.push(questionData);
      }
      newSections[targetArea] = list;
      return newSections;
    });

    setDeletedQuestions(prev => 
      prev.filter(q => !(q.id === deletedItem.id && q.originalArea === deletedItem.originalArea))
    );

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({
      text: `Pregunta #${questionData.id} restaurada a "${targetArea}".`,
      isRestore: true
    });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 5000);
  };

  // Eliminación definitiva desde la papelera
  const permanentlyDeleteQuestion = async (deletedItem) => {
    const ok = await showConfirm({
      title: 'Eliminar Definitivamente',
      message: `¿Deseas purgar definitivamente la pregunta #${deletedItem.id} de la papelera?\nEsta acción no se puede deshacer.`,
      isDanger: true,
      confirmText: 'Purgar Pregunta'
    });
    if (ok) {
      saveSnapshot();
      setDeletedQuestions(prev => 
        prev.filter(q => !(q.id === deletedItem.id && q.originalArea === deletedItem.originalArea))
      );
    }
  };

  // Vaciar toda la papelera
  const handleEmptyTrash = async () => {
    if (deletedQuestions.length === 0) return;
    const ok = await showConfirm({
      title: 'Vaciar Papelera',
      message: `¿Estás seguro de que deseas purgar permanentemente las ${deletedQuestions.length} preguntas en la papelera?`,
      isDanger: true,
      confirmText: 'Vaciar Papelera'
    });
    if (ok) {
      saveSnapshot();
      setDeletedQuestions([]);
    }
  };

  const addArea = async () => {
    if (!newAreaName.trim()) return;
    const cleanName = newAreaName.trim();
    if (cleanName === '__trash__' || sections[cleanName]) {
      await showAlert({
        type: 'warning',
        title: 'Área Existente',
        message: 'Ya existe un área con este nombre. Elige un nombre distinto.'
      });
      return;
    }

    saveSnapshot();
    setSections(prev => ({
      ...prev,
      [cleanName]: []
    }));
    setSelectedArea(cleanName);
    setNewAreaName('');
    setIsAddingArea(false);
  };

  const removeArea = async (area) => {
    const questionsCount = sections[area]?.length || 0;
    const ok = await showConfirm({
      title: 'Eliminar Área Completa',
      message: `¿Estás seguro de que deseas eliminar el área "${area}"${questionsCount > 0 ? ` y sus ${questionsCount} preguntas` : ''}?\nLas preguntas se moverán a la Papelera para que puedas recuperarlas si lo deseas.`,
      isDanger: true,
      confirmText: 'Mover Área a Papelera'
    });
    if (ok) {
      saveSnapshot();
      // Mover preguntas del área a la papelera
      const questionsToTrash = (sections[area] || []).map(q => ({
        ...q,
        originalArea: area,
        deletedAt: new Date().toISOString()
      }));

      setDeletedQuestions(prev => [...questionsToTrash, ...prev]);

      setSections(prev => {
        const newSections = { ...prev };
        delete newSections[area];
        return newSections;
      });

      const remaining = Object.keys(sections).filter(a => a !== area);
      setSelectedArea(remaining.length > 0 ? remaining[0] : (questionsToTrash.length > 0 ? '__trash__' : ''));
    }
  };

  const handleResetToDefault = async () => {
    const ok = await showConfirm({
      title: 'Restablecer Estructura',
      message: 'Esto reiniciará el cuestionario a la plantilla estándar oficial de ByteWise, pero no borrará las respuestas ya evaluadas en la auditoría.\n\n¿Deseas continuar?',
      isDanger: true,
      confirmText: 'Restablecer Plantilla'
    });
    if (ok) {
      saveSnapshot();
      const freshDefault = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
      setSections(freshDefault);
      const areas = Object.keys(freshDefault);
      setSelectedArea(areas.length > 0 ? areas[0] : '');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setIsProcessing(true);
      await downloadExcelTemplate(sections, `Plantilla_Preguntas_${Date.now()}.xlsx`);
    } catch (err) {
      console.error(err);
      await showAlert({
        type: 'error',
        title: 'Error en Descarga',
        message: 'Error al generar la plantilla Excel: ' + (err.message || '')
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      const exportPayload = {
        sections,
        deletedQuestions,
        exportedAt: new Date().toISOString()
      };
      const dataStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_cuestionario_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      await showAlert({
        type: 'error',
        title: 'Error de Exportación',
        message: 'Error al exportar la plantilla en formato JSON.'
      });
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessing(true);
      const parsed = await parseQuestionsFile(file);
      
      saveSnapshot();

      // Si el JSON incluía deletedQuestions exportadas
      if (parsed.sections && typeof parsed.sections === 'object') {
        setSections(parsed.sections);
        if (Array.isArray(parsed.deletedQuestions)) {
          setDeletedQuestions(parsed.deletedQuestions);
        }
        const areas = Object.keys(parsed.sections);
        setSelectedArea(areas[0] || '');
      } else {
        setSections(parsed);
        const areas = Object.keys(parsed);
        setSelectedArea(areas[0] || '');
      }

      const totalQ = Object.values(parsed.sections || parsed).reduce((acc, curr) => acc + (curr?.length || 0), 0);
      await showAlert({
        type: 'success',
        title: 'Cuestionario Importado',
        message: `Plantilla cargada con éxito desde "${file.name}":\n• ${Object.keys(parsed.sections || parsed).length} áreas identificadas\n• ${totalQ} preguntas cargadas\n\nHaz clic en "Guardar Cambios" para aplicar esta estructura.`
      });
    } catch (err) {
      console.error(err);
      await showAlert({
        type: 'error',
        title: 'Error de Importación',
        message: err.message || "Error al procesar el archivo. Asegúrate de que sea un archivo .xlsx, .xls o .json válido."
      });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    onSave(sections, deletedQuestions);
    onClose();
  };

  const totalQuestionsActive = Object.values(sections).reduce((acc, list) => acc + (list?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 md:p-6 font-sans">
      <div className="bg-white w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl rounded-2xl border border-slate-100 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Superior del Editor con Undo / Redo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 border-b border-slate-100 bg-white gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <Edit2 size={20} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Editor de Cuestionario</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {totalQuestionsActive} {totalQuestionsActive === 1 ? 'pregunta activa' : 'preguntas activas'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Ajusta los controles, ponderaciones y preguntas de esta evaluación.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
            {/* Botones Deshacer / Rehacer */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50 mr-1 shadow-2xs">
              <button 
                type="button"
                id="btn-undo"
                onClick={handleUndo}
                disabled={historyStack.length === 0}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Deshacer último cambio (Ctrl+Z)"
                aria-label="Deshacer (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button 
                type="button"
                id="btn-redo"
                onClick={handleRedo}
                disabled={futureStack.length === 0}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Rehacer cambio (Ctrl+Y)"
                aria-label="Rehacer (Ctrl+Y)"
              >
                <Redo2 size={16} />
              </button>
            </div>

            {/* Acciones Secundarias */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Descargar este cuestionario en plantilla Excel (.xlsx) para editarlo en tu computadora"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Plantilla Excel</span>
            </button>

            <label 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition shadow-2xs cursor-pointer"
              title="Importar cuestionario desde archivo Excel (.xlsx, .xls) o JSON (.json)"
            >
              {isProcessing ? <Loader2 size={14} className="text-blue-600 animate-spin" /> : <Upload size={14} className="text-blue-600" />}
              <span>Importar</span>
              <input type="file" accept=".xlsx,.xls,.json" onChange={handleImportFile} disabled={isProcessing} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleExportJSON}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Descargar esta estructura como respaldo .json"
            >
              <Download size={14} className="text-slate-600" />
              <span>Exportar JSON</span>
            </button>

            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer ml-1"
              title="Cerrar editor"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body Principal */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Barra Lateral: Áreas de Evaluación y Papelera */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/70 flex flex-col max-h-[220px] md:max-h-none shrink-0">
            <div className="p-3.5 border-b border-slate-100 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-600">
              <span>Áreas de Evaluación</span>
              <button 
                type="button"
                onClick={() => setIsAddingArea(!isAddingArea)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                title="Añadir nueva área"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isAddingArea && (
                <div className="p-2.5 bg-white border border-blue-200 rounded-xl shadow-xs mb-2">
                  <input 
                    type="text"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="Nombre del área nueva..."
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-600 focus:outline-none mb-2"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button 
                      type="button"
                      onClick={() => setIsAddingArea(false)} 
                      className="text-xs px-2.5 py-1 text-slate-500 hover:bg-slate-100 rounded-md transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      onClick={addArea} 
                      className="text-xs px-3 py-1 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition cursor-pointer shadow-2xs"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              )}
 
              {Object.keys(sections).map(area => {
                const count = sections[area]?.length || 0;
                const isSelected = selectedArea === area;
                return (
                  <div 
                    key={area}
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-white text-blue-700 font-semibold shadow-xs border border-slate-100' 
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                    onClick={() => handleAreaChange(area)}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-blue-600' : 'bg-slate-300'}`} />
                      <span className="truncate text-xs font-medium">{area}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">
                        {count}
                      </span>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeArea(area); }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Eliminar área"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pestaña Especial: Papelera de Preguntas */}
            <div className="p-2 border-t border-slate-200/80 bg-slate-100/50">
              <div 
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                  selectedArea === '__trash__' 
                    ? 'bg-rose-50 border border-rose-200 text-rose-900 font-semibold shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
                onClick={() => setSelectedArea('__trash__')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Trash2 size={14} className={deletedQuestions.length > 0 ? "text-rose-500 shrink-0" : "text-slate-400 shrink-0"} />
                  <span className="truncate text-xs font-medium">Papelera de Preguntas</span>
                </div>
                {deletedQuestions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                    {deletedQuestions.length}
                  </span>
                )}
              </div>
            </div>
          </div>
 
          {/* Panel Principal: Preguntas del Área o Papelera */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedArea === '__trash__' ? (
              /* ========================================== */
              /* VISTA DE LA PAPELERA DE PREGUNTAS */
              /* ========================================== */
              <>
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                      <Trash2 size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Papelera de Preguntas Eliminadas ({deletedQuestions.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Las respuestas evaluadas a estas preguntas continúan preservadas intactas en la base de datos.
                      </p>
                    </div>
                  </div>

                  {deletedQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleEmptyTrash}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <Trash2 size={13} />
                      <span>Vaciar Papelera</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {deletedQuestions.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl max-w-lg mx-auto">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Inbox size={22} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">No hay preguntas en la papelera</h4>
                      <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                        Cuando elimines una pregunta, se moverá a esta sección para que puedas recuperarla en cualquier momento sin perder tus respuestas ni evidencias.
                      </p>
                    </div>
                  ) : (
                    deletedQuestions.map((q, idx) => (
                      <div key={`del-${q.id}-${idx}`} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold font-mono">
                              #{q.id}
                            </span>
                            <span className="text-xs font-medium text-slate-400">
                              Área original: <strong className="text-slate-700 font-semibold">{q.originalArea || 'General'}</strong>
                            </span>
                            {q.deletedAt && (
                              <span className="text-[10px] text-slate-400 hidden sm:inline">
                                • {new Date(q.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-800 font-medium leading-relaxed">
                            {q.pregunta}
                          </p>
                          {q.requisito && (
                            <p className="text-xs text-slate-500 italic">
                              Requisito: {q.requisito}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => restoreQuestion(q)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="Restaurar a su área original"
                          >
                            <RotateCcw size={13} />
                            <span>Restaurar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => permanentlyDeleteQuestion(q)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Purgar definitivamente"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : selectedArea ? (
              /* ========================================== */
              /* VISTA DE PREGUNTAS ACTIVAS DEL ÁREA */
              /* ========================================== */
              <>
                <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{selectedArea}</h3>
                    <span className="text-xs text-slate-400">
                      ({sections[selectedArea]?.length || 0} {sections[selectedArea]?.length === 1 ? 'control' : 'controles'})
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => addQuestion(selectedArea)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Añadir Pregunta</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                  {(!sections[selectedArea] || sections[selectedArea].length === 0) ? (
                    <div className="text-center py-16 px-4 bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl max-w-lg mx-auto">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Plus size={22} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">No hay preguntas en esta área</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Comienza agregando la primera pregunta o control de evaluación para "{selectedArea}".
                      </p>
                      <button 
                        type="button"
                        onClick={() => addQuestion(selectedArea)}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <Plus size={14} /> Añadir Primera Pregunta
                      </button>
                    </div>
                  ) : (
                    sections[selectedArea].map((q, index) => (
                      <div key={q.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 relative group hover:border-blue-200 hover:shadow-xs transition-all space-y-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold font-mono">
                              #{q.id}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Control {index + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => rewriteQuestionWithAI(selectedArea, q)}
                              disabled={rewritingQuestion === (selectedArea + '-' + q.id) || !q.pregunta}
                              className={"inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer " + (rewritingQuestion === (selectedArea + '-' + q.id) ? "bg-indigo-100 text-indigo-500 animate-pulse" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100")}
                              title="Mejorar redacción con IA"
                            >
                              <Sparkles size={12} />
                              <span>{rewritingQuestion === (selectedArea + '-' + q.id) ? "Mejorando..." : "Mejorar con IA"}</span>
                            </button>

                            <button 
                              type="button"
                              onClick={() => removeQuestion(selectedArea, q.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar pregunta (se moverá a la papelera)"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Enunciado Principal <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={q.pregunta || ''}
                              onChange={(e) => updateQuestion(selectedArea, q.id, 'pregunta', e.target.value)}
                              rows="2"
                              className="w-full text-sm p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition resize-y font-medium text-slate-900"
                              placeholder="Ej: ¿El site cuenta con mecanismos que aseguren la continuidad operativa...?"
                            />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                                <FileText size={12} className="text-slate-400" />
                                <span>Requisito Normativo (Opcional)</span>
                              </label>
                              <input
                                type="text"
                                value={q.requisito || ''}
                                onChange={(e) => updateQuestion(selectedArea, q.id, 'requisito', e.target.value)}
                                className="w-full text-xs p-2 bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                placeholder="Ej: ISO 27001: A.11.1.2"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                                <Search size={12} className="text-blue-500" />
                                <span>Evidencia Sugerida (Opcional)</span>
                              </label>
                              <input
                                type="text"
                                value={q.evidencia || ''}
                                onChange={(e) => updateQuestion(selectedArea, q.id, 'evidencia', e.target.value)}
                                className="w-full text-xs p-2 bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-600 focus:outline-none transition"
                                placeholder="Ej: Fotos, Políticas, Logs..."
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                              <CheckCircle size={12} className="text-emerald-500" />
                              <span>Nota de Ayuda o Criterio Auditor (Opcional)</span>
                            </label>
                            <input
                              type="text"
                              value={q.nota || ''}
                              onChange={(e) => updateQuestion(selectedArea, q.id, 'nota', e.target.value)}
                              className="w-full text-xs p-2 bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-600 focus:outline-none transition"
                              placeholder="Ej: Cubre: UPS, planta eléctrica, enlaces..."
                            />
                          </div>

                          {/* Criterios / Parámetros de Evaluación (Escala 0 a 4) */}
                          <div className="pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                <Layers size={13} className="text-blue-600" />
                                <span>Criterios de Evaluación (Escala 0 a 4)</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => updateQuestion(selectedArea, q.id, 'escalaEvaluacion', [
                                  '0 - No existe',
                                  '1 - Existe informalmente',
                                  '2 - Parcialmente documentado',
                                  '3 - Documentado y aplicado',
                                  '4 - Óptimo, aprobado y en mejora continua'
                                ])}
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                              >
                                Restablecer escala estándar
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                              {[0, 1, 2, 3, 4].map(score => {
                                const currentScale = Array.isArray(q.escalaEvaluacion) && q.escalaEvaluacion.length > 0
                                  ? q.escalaEvaluacion
                                  : [
                                      '0 - No existe',
                                      '1 - Existe informalmente',
                                      '2 - Parcialmente documentado',
                                      '3 - Documentado y aplicado',
                                      '4 - Óptimo, aprobado y en mejora continua'
                                    ];
                                const badgeColors = [
                                  'bg-rose-100 text-rose-700 border-rose-200/60',
                                  'bg-amber-100 text-amber-700 border-amber-200/60',
                                  'bg-blue-100 text-blue-700 border-blue-200/60',
                                  'bg-indigo-100 text-indigo-700 border-indigo-200/60',
                                  'bg-emerald-100 text-emerald-700 border-emerald-200/60',
                                ];
                                return (
                                  <div key={score} className="flex items-center gap-2">
                                    <span className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 border ${badgeColors[score]}`}>
                                      {score}
                                    </span>
                                    <input
                                      type="text"
                                      value={currentScale[score] || ''}
                                      onChange={(e) => {
                                        const newArr = [...currentScale];
                                        while (newArr.length < 5) newArr.push('');
                                        newArr[score] = e.target.value;
                                        updateQuestion(selectedArea, q.id, 'escalaEvaluacion', newArr);
                                      }}
                                      className="flex-1 text-xs p-1.5 bg-white border border-slate-200 rounded-lg focus:border-blue-600 focus:outline-none transition"
                                      placeholder={`Criterio para puntuación ${score}...`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                Selecciona un área de evaluación en el panel izquierdo para editar sus preguntas.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <button 
            type="button"
            onClick={handleResetToDefault}
            className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 bg-white border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            title="Restablece las preguntas de esta auditoría a la plantilla inicial por defecto"
          >
            <RotateCcw size={14} className="text-slate-500" />
            <span>Restablecer Plantilla Estándar</span>
          </button>

          <div className="flex w-full sm:w-auto justify-end items-center gap-2.5">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Save size={15} />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </div>

        {/* Notificación Flotante Toast con botón Deshacer */}
        {toastMessage && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3.5 text-xs animate-in slide-in-from-bottom-2 duration-150 border border-slate-800">
            <span className="font-medium">{toastMessage.text}</span>
            {!toastMessage.isRestore && (
              <button
                type="button"
                onClick={() => {
                  if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                  setToastMessage(null);
                  handleUndo();
                }}
                className="text-blue-400 hover:text-blue-300 font-bold underline transition cursor-pointer ml-1"
              >
                Deshacer
              </button>
            )}
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
              title="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <CustomDialogModal config={modalConfig} onClose={() => setModalConfig(null)} />
    </div>
  );
};

export default EditQuestionsModal;
