import React from 'react';
import { 
  GitMerge, 
  User, 
  Users, 
  Eye, 
  Edit3, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

const AuditEvaluationManager = ({
  evaluations = {},
  currentAuditorUid,
  currentAuditorName,
  activeView, // 'my_draft' | 'official' | other_uid
  onChangeView,
  onOpenMergeModal,
  finalAudit = {},
  isAdminOrEditor = true,
  isReadOnlyGlobal = false
}) => {
  // Lista de otros auditores con respuestas guardadas
  const otherEvaluators = Object.entries(evaluations).filter(
    ([uid]) => uid !== currentAuditorUid
  );

  const isViewingOther = activeView !== 'my_draft' && activeView !== 'official';
  const otherAuditorName = isViewingOther 
    ? (evaluations[activeView]?.auditorName || 'Otro Auditor') 
    : '';

  const isConsolidated = finalAudit?.status === 'consolidated';

  return (
    <div className="mb-6 space-y-2">
      {/* Barra principal de alternancia de versiones */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3">
        
        {/* Grupo de Botones de Modo */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          
          {/* Botón: Mi Borrador */}
          <button
            type="button"
            onClick={() => onChangeView('my_draft')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeView === 'my_draft'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Mi Borrador</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${
              activeView === 'my_draft' ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
            }`}>
              Editable
            </span>
          </button>

          {/* Selector de Borradores de Otros Auditores */}
          {otherEvaluators.length > 0 && (
            <div className="relative inline-flex items-center">
              <select
                value={isViewingOther ? activeView : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    onChangeView(e.target.value);
                  }
                }}
                className={`text-xs font-semibold py-1.5 pl-2.5 pr-7 rounded-lg border transition cursor-pointer appearance-none ${
                  isViewingOther
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                <option value="" disabled className="text-slate-500 bg-white">
                  👥 Ver borrador de colega...
                </option>
                {otherEvaluators.map(([uid, ev]) => (
                  <option key={uid} value={uid} className="text-slate-800 bg-white">
                    Borrador de {ev.auditorName || 'Auditor'} ({Object.keys(ev.answers || {}).length} resp.)
                  </option>
                ))}
              </select>
              <Eye className={`w-3.5 h-3.5 absolute right-2 pointer-events-none ${
                isViewingOther ? 'text-white' : 'text-slate-400'
              }`} />
            </div>
          )}

          {/* Botón: Versión Oficial Consolidada */}
          <button
            type="button"
            onClick={() => onChangeView('official')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeView === 'official'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Versión Oficial</span>
            {isConsolidated ? (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500 text-white">
                Consolidada
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 text-slate-600">
                Oficial Base
              </span>
            )}
          </button>
        </div>

        {/* Grupo de Acciones de Consolidación */}
        <div className="flex items-center gap-2.5">
          {/* Badge de estado global */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-medium mr-1">
            {isConsolidated ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5" /> Oficial Consolidada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                <Users className="w-3.5 h-3.5" /> Evaluaciones Paralelas
              </span>
            )}
          </div>

          {/* Botón Fusión / Consolidación */}
          {isAdminOrEditor && (
            <button
              type="button"
              onClick={onOpenMergeModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition cursor-pointer"
              title="Comparar respuestas entre auditores y generar la versión oficial consolidada"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Comparar y Fusionar (Merge)</span>
            </button>
          )}
        </div>

      </div>

      {/* Banner de Alerta cuando se visualiza el borrador de otro auditor */}
      {isViewingOther && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="truncate">
              Estás visualizando el borrador de <strong className="font-bold">{otherAuditorName}</strong> en modo <strong>Solo Lectura</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeView('my_draft')}
            className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shrink-0 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Regresar a Mi Borrador
          </button>
        </div>
      )}

      {/* Banner si está viendo la versión oficial */}
      {activeView === 'official' && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-slate-800 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="truncate">
              Visualizando la <strong>Versión Oficial de Auditoría</strong>.
              {isConsolidated 
                ? ` Consolidada el ${new Date(finalAudit.consolidatedAt || Date.now()).toLocaleDateString('es-MX')} por ${finalAudit.consolidatedBy || 'Administrador'}.`
                : ' Puedes consolidarla usando el botón "Comparar y Fusionar".'
              }
            </p>
          </div>
          {activeView !== 'my_draft' && (
            <button
              type="button"
              onClick={() => onChangeView('my_draft')}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded-lg shrink-0 transition cursor-pointer"
            >
              Ir a Mi Borrador
            </button>
          )}
        </div>
      )}

    </div>
  );
};

export default AuditEvaluationManager;

