import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Save, FileText, CheckCircle, Search, Sparkles } from 'lucide-react';

const EditQuestionsModal = ({ isOpen, onClose, initialSections, onSave }) => {
  const [sections, setSections] = useState({});
  const [selectedArea, setSelectedArea] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [rewritingQuestion, setRewritingQuestion] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSections(JSON.parse(JSON.stringify(initialSections))); // Deep copy
      const areas = Object.keys(initialSections);
      if (areas.length > 0 && !selectedArea) {
        setSelectedArea(areas[0]);
      }
    }
  }, [isOpen, initialSections]);

  if (!isOpen) return null;

  const handleAreaChange = (area) => setSelectedArea(area);

  const updateQuestion = (area, questionId, field, value) => {
    setSections(prev => {
      const newSections = { ...prev };
      const qIndex = newSections[area].findIndex(q => q.id === questionId);
      if (qIndex !== -1) {
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
        'https://n8n-n8n.bg5sbc.easypanel.host/webhook/rewrite-comments',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'bw_ai_comments_9F3xL8Qp_2026',
          },
          body: JSON.stringify({
            text: userText,
            context: {
              tipo: 'pregunta_auditoria',
              area: area
            }
          }),
        }
      );

      if (!res.ok) throw new Error('Error al llamar IA');

      const data = await res.json();
      let cleanText = String(data.rewritten || '')
        .replace(/^({\s*)?\"?rewritten\"?\s*:\s*\"?/i, '') 
        .replace(/\"}\s*$/, '')                          
        .replace(/\\n/g, '\n')                           
        .replace(/\\r/g, '')
        .replace(/\"\s*$/, '')  
        .replace(/\s*}\s*$/, '') 
        .trim();

      updateQuestion(area, item.id, 'pregunta', cleanText);
    } catch (err) {
      console.error(err);
      alert('Error al mejorar la pregunta con IA');
    } finally {
      setRewritingQuestion(null);
    }
  };
  const addQuestion = (area) => {
    setSections(prev => {
      const newSections = { ...prev };
      const currentQuestions = newSections[area] || [];
      const newId = currentQuestions.length > 0 ? Math.max(...currentQuestions.map(q => q.id)) + 1 : 1;
      
      newSections[area] = [
        ...currentQuestions,
        {
          id: newId,
          pregunta: 'Nueva pregunta...',
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

  const removeQuestion = (area, questionId) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta pregunta?')) {
      setSections(prev => {
        const newSections = { ...prev };
        newSections[area] = newSections[area].filter(q => q.id !== questionId);
        return newSections;
      });
    }
  };

  const addArea = () => {
    if (!newAreaName.trim()) return;
    if (sections[newAreaName]) {
      alert("Ya existe un área con este nombre.");
      return;
    }
    setSections(prev => ({
      ...prev,
      [newAreaName.trim()]: []
    }));
    setSelectedArea(newAreaName.trim());
    setNewAreaName('');
    setIsAddingArea(false);
  };

  const removeArea = (area) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el área "${area}" y TODAS sus preguntas?`)) {
      setSections(prev => {
        const newSections = { ...prev };
        delete newSections[area];
        return newSections;
      });
      const remaining = Object.keys(sections).filter(a => a !== area);
      setSelectedArea(remaining.length > 0 ? remaining[0] : '');
    }
  };

  const handleSave = () => {
    onSave(sections);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl rounded-none animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Edit2 size={24} className="text-[#00d4ff]" />
              Editor de Cuestionario
            </h2>
            <p className="text-sm text-slate-500 mt-1">Personaliza las áreas y preguntas para esta auditoría específica.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar - Areas */}
          <div className="w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col">
            <div className="p-4 border-b border-slate-200 font-semibold text-slate-700 flex justify-between items-center">
              Áreas de Evaluación
              <button 
                onClick={() => setIsAddingArea(!isAddingArea)}
                className="p-1 text-cyan-600 hover:bg-cyan-50 rounded"
                title="Añadir Área"
              >
                <Plus size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {isAddingArea && (
                <div className="p-2 bg-white border border-cyan-200 shadow-sm mb-2">
                  <input 
                    type="text"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="Nombre de la nueva área..."
                    className="w-full text-sm p-2 border border-slate-300 focus:border-cyan-500 focus:outline-none mb-2"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsAddingArea(false)} className="text-xs px-2 py-1 text-slate-500 hover:bg-slate-100">Cancelar</button>
                    <button onClick={addArea} className="text-xs px-2 py-1 bg-cyan-600 text-white hover:bg-cyan-700">Añadir</button>
                  </div>
                </div>
              )}

              {Object.keys(sections).map(area => (
                <div 
                  key={area}
                  className={`group flex items-center justify-between p-3 cursor-pointer border-l-4 transition-colors ${selectedArea === area ? 'bg-white border-l-[#00d4ff] shadow-sm text-slate-900 font-semibold' : 'border-l-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  onClick={() => handleAreaChange(area)}
                >
                  <span className="truncate pr-2 text-sm">{area}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeArea(area); }}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Eliminar Área"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main - Questions */}
          <div className="w-2/3 flex flex-col bg-white">
            {selectedArea ? (
              <>
                <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center sticky top-0 z-10 shadow-sm">
                  <h3 className="font-bold text-slate-800">{selectedArea}</h3>
                  <button 
                    onClick={() => addQuestion(selectedArea)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <Plus size={16} /> Añadir Pregunta
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                  {(!sections[selectedArea] || sections[selectedArea].length === 0) ? (
                    <div className="text-center p-8 text-slate-500 bg-slate-50 border border-dashed border-slate-300">
                      No hay preguntas en esta área. Añade una para comenzar.
                    </div>
                  ) : (
                    sections[selectedArea].map((q, index) => (
                      <div key={q.id} className="border border-slate-200 p-4 relative group hover:border-cyan-300 transition-colors bg-slate-50">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={() => removeQuestion(selectedArea, q.id)}
                             className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors"
                             title="Eliminar Pregunta"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <span className="bg-slate-200 text-slate-700 px-2 py-1 text-xs font-bold font-mono">#{q.id}</span>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pregunta {index + 1}</span>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            
                            <div className="flex justify-between items-end mb-1">
                              <label className="block text-xs font-bold text-slate-700">Enunciado Principal *</label>
                              <button
                                onClick={() => rewriteQuestionWithAI(selectedArea, q)}
                                disabled={rewritingQuestion === (selectedArea + '-' + q.id) || !q.pregunta}
                                className={"flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition " + (rewritingQuestion === (selectedArea + '-' + q.id) ? "bg-indigo-100 text-indigo-400 animate-pulse" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100")}
                                title="Mejorar redacción con IA"
                              >
                                <Sparkles size={12} /> {rewritingQuestion === (selectedArea + '-' + q.id) ? "Mejorando..." : "Mejorar con IA"}
                              </button>
                            </div>

                            <textarea
                              value={q.pregunta || ''}
                              onChange={(e) => updateQuestion(selectedArea, q.id, 'pregunta', e.target.value)}
                              rows="2"
                              className="w-full text-sm p-2 border border-slate-300 focus:border-cyan-500 focus:outline-none resize-none font-medium"
                              placeholder="Ej: ¿El site cuenta con mecanismos que aseguren la continuidad...?"
                            />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><FileText size={12}/> Requisito (Opcional)</label>
                              <input
                                type="text"
                                value={q.requisito || ''}
                                onChange={(e) => updateQuestion(selectedArea, q.id, 'requisito', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-300 focus:border-cyan-500 focus:outline-none"
                                placeholder="Ej: ISO 27001: A.11.1.2"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Search size={12}/> Evidencia Sugerida (Opcional)</label>
                              <input
                                type="text"
                                value={q.evidencia || ''}
                                onChange={(e) => updateQuestion(selectedArea, q.id, 'evidencia', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-300 focus:border-cyan-500 focus:outline-none"
                                placeholder="Ej: Fotos, Políticas, Logs..."
                              />
                            </div>
                          </div>
                          
                          <div>
                             <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><CheckCircle size={12}/> Nota de Ayuda (Opcional)</label>
                             <input
                                type="text"
                                value={q.nota || ''}
                                onChange={(e) => updateQuestion(selectedArea, q.id, 'nota', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-300 focus:border-cyan-500 focus:outline-none"
                                placeholder="Ej: Cubre: UPS, planta, enlaces..."
                             />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                Selecciona un área para editar sus preguntas
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 flex items-center gap-2 bg-[#00d4ff] text-slate-900 text-sm font-bold hover:bg-cyan-400 transition-colors"
          >
            <Save size={16} /> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditQuestionsModal;
