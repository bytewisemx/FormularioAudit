import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  HelpCircle, 
  KeyRound, 
  Trash2, 
  X, 
  Eye, 
  EyeOff, 
  Archive, 
  Check 
} from 'lucide-react';

const CustomDialogModal = ({ config, onClose }) => {
  if (!config) return null;

  const {
    type = 'confirm', // 'confirm' | 'danger' | 'warning' | 'prompt' | 'alert' | 'error' | 'success'
    isDanger = false,
    title = '',
    message = '',
    placeholder = '',
    defaultValue = '',
    inputType = 'text',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    onConfirm,
    onCancel
  } = config;

  const [inputValue, setInputValue] = useState(defaultValue || '');
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setInputValue(defaultValue || '');
    if (type === 'prompt' && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [config, defaultValue, type]);

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(type === 'prompt' ? inputValue : true);
    }
    if (onClose) onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    if (onClose) onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Detectar semántica según el título y confirmText
  const lowerTitle = (title || '').toLowerCase();
  const lowerConfirm = (confirmText || '').toLowerCase();
  const isArchiveSemantic = lowerTitle.includes('archiv') || lowerConfirm.includes('archiv');
  const isDeleteSemantic = type === 'danger' || isDanger || lowerTitle.includes('elimina') || lowerConfirm.includes('elimina');

  // Configuración de Iconos, Contenedores y Botones con la paleta minimalista
  let iconWrapperClass = 'bg-blue-50 text-blue-600 border border-blue-100';
  let IconComponent = HelpCircle;
  let confirmBtnClass = 'bg-blue-600 hover:bg-blue-700 text-white';
  let ButtonIcon = null;

  if (isDeleteSemantic) {
    iconWrapperClass = 'bg-red-50 text-red-600 border border-red-100';
    IconComponent = Trash2;
    confirmBtnClass = 'bg-red-600 hover:bg-red-700 text-white';
    ButtonIcon = Trash2;
  } else if (isArchiveSemantic) {
    iconWrapperClass = 'bg-amber-50 text-amber-600 border border-amber-100';
    IconComponent = Archive;
    confirmBtnClass = 'bg-blue-600 hover:bg-blue-700 text-white';
    ButtonIcon = Archive;
  } else if (type === 'warning') {
    iconWrapperClass = 'bg-amber-50 text-amber-600 border border-amber-100';
    IconComponent = AlertTriangle;
    confirmBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white';
    ButtonIcon = AlertTriangle;
  } else if (type === 'error') {
    iconWrapperClass = 'bg-red-50 text-red-600 border border-red-100';
    IconComponent = AlertCircle;
    confirmBtnClass = 'bg-slate-900 hover:bg-slate-800 text-white';
  } else if (type === 'success') {
    iconWrapperClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    IconComponent = CheckCircle;
    confirmBtnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white';
    ButtonIcon = Check;
  } else if (type === 'prompt') {
    iconWrapperClass = 'bg-blue-50 text-blue-600 border border-blue-100';
    IconComponent = KeyRound;
    confirmBtnClass = isDanger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white';
    ButtonIcon = KeyRound;
  } else if (type === 'alert') {
    iconWrapperClass = 'bg-blue-50 text-blue-600 border border-blue-100';
    IconComponent = AlertCircle;
    confirmBtnClass = 'bg-blue-600 hover:bg-blue-700 text-white';
  }

  const isSingleButton = type === 'alert' || type === 'error' || type === 'success';

  // Resaltado estilizado para nombres o elementos entre comillas
  const renderFormattedText = (text) => {
    if (typeof text !== 'string') return text;
    const parts = text.split(/(".*?")/g);
    return parts.map((part, index) => {
      if (part.startsWith('"') && part.endsWith('"')) {
        return (
          <span key={index} className="font-semibold text-slate-900">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const paragraphs = typeof message === 'string' ? message.split('\n\n') : [message];

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150 font-sans"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
    >
      {/* Clic exterior para cancelar */}
      <div className="fixed inset-0" onClick={handleCancel} />

      {/* Tarjeta Modal Principal */}
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 relative z-10 transition-all transform animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconWrapperClass}`}>
              <IconComponent size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {title || (isDeleteSemantic ? 'Confirmar Eliminación' : type === 'prompt' ? 'Ingreso de PIN' : 'Aviso')}
              </h3>
              <p className="text-xs text-slate-400 font-medium">ByteWise Auditoría TI</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors cursor-pointer"
            title="Cerrar"
            aria-label="Cerrar modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido / Cuerpo del Diálogo */}
        <div className="space-y-2 mb-6">
          <p className="text-sm text-slate-700 leading-relaxed">
            {renderFormattedText(paragraphs[0])}
          </p>

          {paragraphs.slice(1).map((para, i) => (
            <p key={i} className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
              {renderFormattedText(para)}
            </p>
          ))}

          {/* Campo de entrada si es tipo Prompt (ej. PIN de seguridad) */}
          {type === 'prompt' && (
            <div className="mt-3 pt-1">
              <div className="relative">
                <input
                  ref={inputRef}
                  type={inputType === 'password' && !showPassword ? 'password' : 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={placeholder || 'Ingresa el PIN de seguridad...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition pr-10"
                />
                {inputType === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botones de Acción (Footer) */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          {!isSingleButton && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer ${confirmBtnClass}`}
          >
            {ButtonIcon && <ButtonIcon size={14} />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomDialogModal;
