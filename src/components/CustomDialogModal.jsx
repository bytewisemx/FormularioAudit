import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, HelpCircle, KeyRound, Trash2, X, Eye, EyeOff } from 'lucide-react';

const CustomDialogModal = ({ config, onClose }) => {
  if (!config) return null;

  const {
    type = 'confirm', // 'confirm' | 'danger' | 'warning' | 'prompt' | 'alert' | 'error' | 'success'
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

  // Determinar icono y colores según el tipo
  let headerBorderColor = 'border-t-[#00d4ff]';
  let iconWrapperClass = 'bg-slate-900 text-[#00d4ff]';
  let IconComponent = HelpCircle;
  let confirmBtnClass = 'bg-slate-900 hover:bg-slate-800 text-white border-b-2 border-[#00d4ff]';

  if (type === 'danger') {
    headerBorderColor = 'border-t-rose-500';
    iconWrapperClass = 'bg-rose-100 text-rose-600';
    IconComponent = Trash2;
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs';
  } else if (type === 'warning') {
    headerBorderColor = 'border-t-amber-500';
    iconWrapperClass = 'bg-amber-100 text-amber-700';
    IconComponent = AlertTriangle;
    confirmBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs';
  } else if (type === 'error') {
    headerBorderColor = 'border-t-rose-600';
    iconWrapperClass = 'bg-rose-100 text-rose-600';
    IconComponent = AlertCircle;
    confirmBtnClass = 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs';
  } else if (type === 'success') {
    headerBorderColor = 'border-t-emerald-500';
    iconWrapperClass = 'bg-emerald-100 text-emerald-700';
    IconComponent = CheckCircle;
    confirmBtnClass = 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs';
  } else if (type === 'prompt') {
    headerBorderColor = 'border-t-[#00d4ff]';
    iconWrapperClass = 'bg-slate-900 text-[#00d4ff]';
    IconComponent = KeyRound;
    confirmBtnClass = 'bg-slate-900 hover:bg-slate-800 text-white border-b-2 border-[#00d4ff]';
  } else if (type === 'alert') {
    headerBorderColor = 'border-t-cyan-500';
    iconWrapperClass = 'bg-cyan-100 text-cyan-800';
    IconComponent = AlertCircle;
    confirmBtnClass = 'bg-slate-900 hover:bg-slate-800 text-white';
  }

  const isSingleButton = type === 'alert' || type === 'error' || type === 'success';

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
      onKeyDown={handleKeyDown}
    >
      {/* Click outside to cancel */}
      <div className="fixed inset-0" onClick={handleCancel} />

      <div 
        className={`bg-white w-full max-w-md shadow-2xl border border-slate-200 border-t-4 ${headerBorderColor} rounded-none relative z-10 animate-in zoom-in-95 duration-150 flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con botón X */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 flex items-center justify-center shrink-0 ${iconWrapperClass}`}>
              <IconComponent size={22} />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-extrabold text-slate-900 leading-snug">
                {title || (type === 'danger' ? 'Confirmar Eliminación' : type === 'prompt' ? 'Ingreso de PIN' : 'Aviso')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">ByteWise Auditoría TI</p>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Message */}
        <div className="px-6 py-2 flex-1">
          <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
            {message}
          </div>

          {/* Campo de entrada si es tipo Prompt */}
          {type === 'prompt' && (
            <div className="mt-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type={inputType === 'password' && !showPassword ? 'password' : 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={placeholder || 'Escribe aquí...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-slate-900 focus:outline-none text-sm transition pr-10"
                />
                {inputType === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-5 mt-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!isSingleButton && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-300 transition cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className={`px-5 py-2 text-xs font-bold transition cursor-pointer ${confirmBtnClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomDialogModal;
