import React, { useState } from 'react';
import { Shield, ChevronRight } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export default function LoginScreen({ onLoginSuccess }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      onLoginSuccess(userCredential.user);
    } catch (err) {
      console.error(err);
      setError('Error al iniciar sesión con Google. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 border border-slate-200 border-t-4 border-t-[#00d4ff] shadow-sm">
        <div className="flex flex-col items-center mb-8">
           <div className="w-16 h-16 bg-slate-900 rounded-none flex items-center justify-center shadow-none mb-4">
              <Shield size={32} className="text-[#00d4ff]" />
           </div>
           <h1 className="text-2xl font-extrabold text-slate-800 text-center">Acceso Seguro</h1>
           <p className="text-slate-500 mt-2 text-center text-sm font-medium">Panel de Auditores</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <p className="text-sm text-slate-600 text-center mb-6">
            Inicia sesión con tu cuenta de Google. Tu cuenta ya debe contar con Autenticación Multifactor (MFA) configurada en los ajustes de seguridad de Google para mantener protegido el sistema.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 font-semibold border border-slate-300 hover:bg-slate-50 px-6 py-4 rounded-none transition-all shadow-sm disabled:opacity-50"
          >
            <svg width="24" height="24" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.16 7.13-10.36 7.13-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
            {loading ? 'Verificando...' : 'Continuar con Google'}
          </button>
        </div>
      </div>
    </div>
  );
}
