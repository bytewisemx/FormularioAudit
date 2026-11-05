import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Mail, 
  Shield, 
  ShieldCheck, 
  UserCheck, 
  KeyRound, 
  Lock, 
  Unlock, 
  Check, 
  Info,
  Sparkles
} from 'lucide-react';

export default function AccessManagement({ onBack }) {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('auditor');
  const [newEmailBypassPin, setNewEmailBypassPin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Política global de seguridad (acceso sin PIN a nivel general)
  const [globalPinBypass, setGlobalPinBypass] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const fetchSecurityPolicy = async () => {
    try {
      const policyRef = doc(db, 'system_settings', 'access_policy');
      const policySnap = await getDoc(policyRef);
      if (policySnap.exists()) {
        const data = policySnap.data();
        setGlobalPinBypass(data.globalPinBypass === true);
      }
    } catch (err) {
      console.warn("No se pudo cargar la política global de PIN:", err);
    }
  };

  const fetchEmails = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'allowed_emails'));
      const emailsList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      emailsList.sort((a, b) => (a.id > b.id ? 1 : -1));
      setEmails(emailsList);
    } catch (error) {
      console.error("Error al obtener correos autorizados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchSecurityPolicy();
  }, []);

  const handleToggleGlobalPinBypass = async () => {
    const nextVal = !globalPinBypass;
    setGlobalPinBypass(nextVal);
    setSavingPolicy(true);
    try {
      const policyRef = doc(db, 'system_settings', 'access_policy');
      await setDoc(policyRef, {
        globalPinBypass: nextVal,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error al guardar política global de PIN:", err);
      setGlobalPinBypass(!nextVal);
      alert("Hubo un error al actualizar la política de acceso sin PIN.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleToggleUserPinBypass = async (emailId, currentVal) => {
    const newVal = !currentVal;
    try {
      await updateDoc(doc(db, 'allowed_emails', emailId), {
        bypassPin: newVal
      });
      setEmails(prev => prev.map(item => item.id === emailId ? { ...item, bypassPin: newVal } : item));
    } catch (err) {
      console.error("Error al actualizar permiso individual de PIN:", err);
      alert("No se pudo actualizar el permiso de acceso sin PIN para este usuario.");
    }
  };

  const getUserInitials = (emailStr) => {
    if (!emailStr) return 'US';
    const namePart = emailStr.split('@')[0];
    const clean = namePart.replace(/[^a-zA-Z0-9]/g, ' ').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return namePart.slice(0, 2).toUpperCase();
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    const emailClean = newEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) return;
    
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'allowed_emails', emailClean), {
        addedAt: new Date().toISOString(),
        role: selectedRole,
        bypassPin: newEmailBypassPin
      });
      setNewEmail('');
      await fetchEmails();
    } catch (error) {
      console.error("Error al agregar correo:", error);
      alert("Hubo un error al agregar el usuario en la base de datos.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveEmail = async (emailId) => {
    if (emailId.toLowerCase() === 'thomason.mx@gmail.com') {
      alert("No se puede revocar el acceso a la cuenta de superadministrador principal.");
      return;
    }

    if (window.confirm(`¿Estás seguro de que deseas revocar el acceso a "${emailId}"?\nEl usuario ya no podrá iniciar sesión en la plataforma.`)) {
      try {
        await deleteDoc(doc(db, 'allowed_emails', emailId));
        await fetchEmails();
      } catch (error) {
        console.error("Error al revocar acceso:", error);
        alert("Ocurrió un error al eliminar el acceso.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 font-sans text-slate-800">
      {/* Botón Volver al Panel */}
      <div className="max-w-5xl mx-auto mb-6">
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Volver al panel principal</span>
        </button>
      </div>

      {/* Contenedor Principal */}
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Encabezado General */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
          <div className="border-b border-slate-100 pb-5 mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Gestión de Accesos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Administra los usuarios autorizados, sus roles y las políticas de acceso directo a las evaluaciones.
            </p>
          </div>

          {/* Tarjeta de Política de Seguridad: Acceso sin PIN */}
          <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 md:p-6 mb-8 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                  globalPinBypass 
                    ? 'bg-blue-50 text-blue-600 border-blue-200/60' 
                    : 'bg-white text-slate-600 border-slate-200/80'
                }`}>
                  <KeyRound size={22} strokeWidth={2} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Acceso a Auditorías sin PIN
                    </h2>
                    {globalPinBypass ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <Unlock size={12} /> Habilitado para todos
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                        <Lock size={12} /> Control individual por usuario
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
                    Cuando esta política está activa, cualquier usuario autorizado en la plataforma puede abrir y editar las auditorías directamente desde el panel principal sin tener que solicitar o ingresar el PIN del creador.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Info size={12} className="shrink-0" />
                    <span>Los accesos externos mediante enlaces compartidos o invitados seguirán protegidos con PIN.</span>
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleToggleGlobalPinBypass}
                  disabled={savingPolicy}
                  className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    globalPinBypass ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={globalPinBypass}
                  title={globalPinBypass ? 'Desactivar acceso global sin PIN' : 'Activar acceso global sin PIN'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      globalPinBypass ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Formulario Agregar Acceso */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Registrar Nuevo Acceso
            </h3>
            <form onSubmit={handleAddEmail} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </span>
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="correo@empresa.com" 
                    required
                    disabled={submitting}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 placeholder:text-slate-400 transition" 
                  />
                </div>

                <div className="w-full sm:w-44">
                  <select 
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={submitting}
                    className="w-full py-2.5 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition cursor-pointer"
                  >
                    <option value="auditor">Auditor</option>
                    <option value="admin">Administrador</option>
                    <option value="viewer">Solo Lectura</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <Plus size={16} strokeWidth={2.2} />
                  <span>{submitting ? 'Guardando...' : 'Agregar Acceso'}</span>
                </button>
              </div>

              {/* Checkbox Opción sin PIN */}
              <div className="pt-1 flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newEmailBypassPin}
                    onChange={(e) => setNewEmailBypassPin(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Permitir acceso a auditorías sin PIN para este usuario</span>
                </label>
              </div>
            </form>
          </div>

          {/* Tabla de Usuarios Autorizados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Usuarios Autorizados ({emails.length})
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Cargando lista de accesos autorizados...
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Usuario / Correo</th>
                      <th className="py-3.5 px-4">Rol Asignado</th>
                      <th className="py-3.5 px-4">Acceso a Auditorías</th>
                      <th className="py-3.5 px-4">Fecha de Alta</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {emails.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400 text-xs">
                          No hay usuarios autorizados registrados aún.
                        </td>
                      </tr>
                    ) : (
                      emails.map((item) => {
                        const isSuperadmin = item.id.toLowerCase() === 'thomason.mx@gmail.com';
                        const isAdmin = item.role === 'admin' || isSuperadmin;
                        const isViewer = item.role === 'viewer';
                        const userBypassPin = item.bypassPin === true;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            {/* Usuario / Correo */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase shrink-0 ${
                                  isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {getUserInitials(item.id)}
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-medium text-slate-800 text-sm truncate" title={item.id}>
                                    {item.id}
                                  </span>
                                  {isSuperadmin && (
                                    <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                      Superadmin
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Rol Asignado */}
                            <td className="py-3.5 px-4">
                              {isAdmin ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50">
                                  Administrador
                                </span>
                              ) : isViewer ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/40">
                                  Solo Lectura
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/40">
                                  Auditor
                                </span>
                              )}
                            </td>

                            {/* Acceso a Auditorías (con o sin PIN) */}
                            <td className="py-3.5 px-4">
                              {isAdmin ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60" title="Los administradores tienen acceso sin PIN por privilegio de rol">
                                  <ShieldCheck size={13} className="text-blue-600" />
                                  <span>Sin PIN (Admin)</span>
                                </span>
                              ) : globalPinBypass ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60" title="Habilitado por la política global de acceso sin PIN">
                                  <Unlock size={13} className="text-emerald-600" />
                                  <span>Sin PIN (Global)</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserPinBypass(item.id, userBypassPin)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                                    userBypassPin
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/70'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200/70'
                                  }`}
                                  title={userBypassPin ? "Haz clic para requerir PIN a este usuario" : "Haz clic para permitir acceso sin PIN a este usuario"}
                                >
                                  {userBypassPin ? (
                                    <>
                                      <Unlock size={12} className="text-emerald-600" />
                                      <span>Sin PIN</span>
                                    </>
                                  ) : (
                                    <>
                                      <Lock size={12} className="text-slate-500" />
                                      <span>Requiere PIN</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </td>

                            {/* Fecha de Alta */}
                            <td className="py-3.5 px-4 text-slate-500 text-xs">
                              {item.addedAt ? new Date(item.addedAt).toLocaleDateString() : 'N/A'}
                            </td>

                            {/* Acciones */}
                            <td className="py-3.5 px-4 text-right">
                              {isSuperadmin ? (
                                <span className="text-xs text-slate-300 italic px-2">Protegido</span>
                              ) : (
                                <button
                                  onClick={() => handleRemoveEmail(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Revocar acceso"
                                  aria-label="Revocar acceso"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
