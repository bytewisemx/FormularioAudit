import React, { useState } from 'react';
import { Shield, ChevronRight, Lock } from 'lucide-react';
import logoPng from '../assets/bytewise.mx.png';

// Import hashPassword from where it's defined, or define it locally here if we can't easily export it.
// Wait, hashPassword is async and uses crypto.subtle in AuditForm.jsx.
// I will just redefine it here to keep things simple and decoupled.
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function GuestPinScreen({ targetAudit, onAccessGranted }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(() => {
    return parseInt(sessionStorage.getItem(`pin_attempts_${targetAudit.id}`) || '0', 10);
  });

  const isBlocked = attempts >= 3;

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (isBlocked) return;
    setError('');
    setLoading(true);

    try {
      const savedHash = targetAudit.data?.actor?.contrasenaHash;
      const enteredHash = await hashPassword(pin);

      if (enteredHash === savedHash) {
        sessionStorage.removeItem(`pin_attempts_${targetAudit.id}`);
        onAccessGranted(targetAudit);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        sessionStorage.setItem(`pin_attempts_${targetAudit.id}`, newAttempts.toString());
        if (newAttempts >= 3) {
          setError('Has excedido el límite de intentos. Acceso bloqueado.');
        } else {
          setError(`El PIN ingresado es incorrecto. Intentos restantes: ${3 - newAttempts}`);
        }
      }
    } catch (err) {
      setError('Hubo un error al verificar el PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <img src={logoPng} alt="ByteWise" className="h-10 mb-8 w-auto object-contain drop-shadow-none brightness-0 invert" />
      <div className="max-w-md w-full bg-white p-8 border border-slate-200 border-t-4 border-t-[#00d4ff] shadow-sm">
        <div className="flex flex-col items-center mb-8">
           <div className="w-16 h-16 bg-slate-900 rounded-none flex items-center justify-center shadow-none mb-4">
              <Shield size={32} className="text-[#00d4ff]" />
           </div>
           <h1 className="text-2xl font-extrabold text-slate-800 text-center">Acceso a Auditoría</h1>
           <p className="text-slate-500 mt-2 text-center text-sm font-medium">
             {targetAudit.nombreEmpresa || targetAudit.data?.introData?.nombreEmpresa || 'Empresa'}
           </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        {isBlocked ? (
           <div className="text-center p-6 bg-red-50 border border-red-200">
             <Lock className="mx-auto mb-3 text-red-500" size={32} />
             <h2 className="text-lg font-bold text-red-800 mb-2">Acceso Bloqueado</h2>
             <p className="text-sm text-red-700">Por seguridad, la sesión ha sido bloqueada tras múltiples intentos fallidos. Contacta al administrador.</p>
           </div>
        ) : (
          <form onSubmit={handlePinSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                <Lock size={16}/> PIN de Acceso
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Ingresa el PIN privado proporcionado por tu auditor para entrar a la sesión.
              </p>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-3 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none text-center tracking-widest text-lg font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold border border-slate-900 hover:bg-slate-800 px-6 py-4 rounded-none transition-all shadow-none disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Entrar a la Auditoría'} <ChevronRight size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
