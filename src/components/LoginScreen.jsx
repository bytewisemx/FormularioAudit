import React, { useState, useEffect } from 'react';
import { Shield, ChevronRight, Mail, Lock, QrCode } from 'lucide-react';
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver
} from 'firebase/auth';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mfaResolver, setMfaResolver] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess(userCredential.user);
    } catch (err) {
      if (err.code === 'auth/multi-factor-auth-required') {
        // El usuario tiene MFA habilitado
        setMfaResolver(getMultiFactorResolver(auth, err));
      } else {
        console.error(err);
        setError('Error al iniciar sesión. Revisa tus credenciales o asegúrate de que el usuario existe en Firebase Auth.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const totpAssertion = TotpMultiFactorGenerator.assertionForSignIn(
        mfaResolver.hints[0].uid,
        mfaCode
      );
      const userCredential = await mfaResolver.resolveSignIn(totpAssertion);
      onLoginSuccess(userCredential.user);
    } catch (err) {
      console.error(err);
      setError('Código de autenticador incorrecto.');
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

        {!mfaResolver ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                <Mail size={16}/> Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="auditor@empresa.com"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                <Lock size={16}/> Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold border border-slate-900 hover:bg-slate-800 px-6 py-4 rounded-none transition-all shadow-none disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Iniciar Sesión'} <ChevronRight size={18} />
            </button>
            <p className="text-xs text-slate-500 text-center mt-4">
              Nota: Debes crear tu cuenta y activar MFA en Firebase Identity Platform.
            </p>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                <QrCode size={16}/> Código del Autenticador (MFA)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Abre tu aplicación autenticadora (Google Authenticator, Authy, etc.) e ingresa el código de 6 dígitos.
              </p>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                required
                maxLength={6}
                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none tracking-widest text-center text-lg font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-[#00d4ff] text-slate-900 font-extrabold border border-[#00d4ff] hover:bg-[#00b8e6] px-6 py-4 rounded-none transition-all shadow-none disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Verificar Código'} <Shield size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMfaResolver(null)}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-800 mt-4"
            >
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
