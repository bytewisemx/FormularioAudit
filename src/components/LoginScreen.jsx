import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  setDoc 
} from 'firebase/firestore';
import './GeometricLogin.css';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Detección de dispositivos táctiles o móviles para activar por defecto
  const [isActive, setIsActive] = useState(() => {
    if (typeof window !== 'undefined') {
      const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
      const isMobile = window.innerWidth <= 768;
      return isTouch || isMobile;
    }
    return false;
  });

  useEffect(() => {
    const handleDeviceCheck = () => {
      if (window.matchMedia('(hover: none), (pointer: coarse)').matches || window.innerWidth <= 768) {
        setIsActive(true);
      }
    };
    handleDeviceCheck();
    window.addEventListener('resize', handleDeviceCheck);
    return () => window.removeEventListener('resize', handleDeviceCheck);
  }, []);

  // Función común para validar permisos en Firestore (allowed_emails)
  const verifyUserPermissions = async (user) => {
    const userEmail = user.email;
    if (!userEmail) {
      await signOut(auth);
      throw new Error('No se pudo obtener el correo de la cuenta autenticada.');
    }

    // Caso Superadmin
    if (userEmail.toLowerCase() === 'thomason.mx@gmail.com') {
      const emailDocRef = doc(db, 'allowed_emails', userEmail.toLowerCase());
      const emailDoc = await getDoc(emailDocRef);
      if (!emailDoc.exists()) {
        await setDoc(emailDocRef, { role: 'admin', addedAt: new Date().toISOString() });
      }
      return true;
    }

    // Verificar en lista de correos autorizados
    const emailDocRef = doc(db, 'allowed_emails', userEmail.toLowerCase());
    const emailDoc = await getDoc(emailDocRef);

    if (emailDoc.exists()) {
      return true;
    }

    // Si la colección está vacía (primer setup inicial), registrar como admin
    const snapshot = await getDocs(collection(db, 'allowed_emails'));
    if (snapshot.empty) {
      await setDoc(emailDocRef, { role: 'admin', addedAt: new Date().toISOString() });
      return true;
    }

    // Si no está autorizado, revocar sesión
    await signOut(auth);
    throw new Error(`Acceso denegado: El correo "${userEmail}" no está autorizado para ingresar.`);
  };

  // Manejador: Inicio de Sesión con Email y Contraseña
  const handleEmailPasswordLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setError('Por favor completa tanto el correo electrónico como la contraseña.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await verifyUserPermissions(userCredential.user);
      onLoginSuccess(userCredential.user);
    } catch (err) {
      console.error('Error de autenticación:', err);
      let message = 'Error al iniciar sesión.';
      if (
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/user-not-found'
      ) {
        message = 'Credenciales inválidas. Verifica tu correo y contraseña.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'El formato del correo electrónico es inválido.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Demasiados intentos fallidos. Por seguridad, inténtalo más tarde.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Manejador: Inicio de Sesión con Google
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      await verifyUserPermissions(userCredential.user);
      onLoginSuccess(userCredential.user);
    } catch (err) {
      console.error('Error en Google Sign-In:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('El inicio de sesión con Google fue cancelado.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Solicitud cancelada.');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Error al conectar con Google Authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="geometric-login-wrapper">
      <div 
        className={`container ${isActive ? 'active' : ''}`}
        onClick={() => setIsActive(true)}
        onTouchStart={() => setIsActive(true)}
      >
        <div className="top" />
        <div className="bottom" />
        <div className="center">
          <h2>Acceso Seguro</h2>
          <p className="subtitle">Panel de TI & Auditoría</p>

          {/* Bloque para mensajes de error dinámicos */}
          <div 
            id="auth-error" 
            className="error-message" 
            style={{ display: error ? 'block' : 'none' }}
          >
            {error}
          </div>

          {/* Formulario de Email y Contraseña */}
          <form 
            onSubmit={handleEmailPasswordLogin}
            style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <input
              id="email"
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
            />
            <input
              id="password"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              required
            />
            <button
              id="btn-login"
              className="btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="divider">
            <span>o</span>
          </div>

          {/* Botón de Autenticación con Google */}
          <button
            id="btn-google"
            className="btn-google"
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.16 7.13-10.36 7.13-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>Continuar con Google</span>
          </button>
        </div>
      </div>

      {!isActive && (
        <div className="interactive-hint">
          Pasa el cursor o haz clic para interactuar
        </div>
      )}
    </div>
  );
}
