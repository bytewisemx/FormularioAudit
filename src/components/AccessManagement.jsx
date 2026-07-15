import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Shield, Plus, Trash2, ArrowLeft, Mail } from 'lucide-react';

export default function AccessManagement({ onBack }) {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchEmails = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'allowed_emails'));
      const emailsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmails(emailsList);
    } catch (error) {
      console.error("Error fetching emails:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) return;
    
    try {
      const email = newEmail.trim().toLowerCase();
      await setDoc(doc(db, 'allowed_emails', email), {
        addedAt: new Date().toISOString(),
        role: 'user'
      });
      setNewEmail('');
      fetchEmails();
    } catch (error) {
      console.error("Error adding email:", error);
      alert("Hubo un error al agregar el correo.");
    }
  };

  const handleRemoveEmail = async (emailId) => {
    if (window.confirm(`¿Seguro que deseas revocar el acceso a ${emailId}?`)) {
      try {
        await deleteDoc(doc(db, 'allowed_emails', emailId));
        fetchEmails();
      } catch (error) {
        console.error("Error removing email:", error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft size={20} /> Volver al Panel
        </button>

        <div className="bg-white border border-slate-200 border-t-4 border-t-[#00d4ff] shadow-sm p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-slate-900 flex items-center justify-center">
              <Shield size={24} className="text-[#00d4ff]" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">Control de Accesos</h1>
              <p className="text-slate-500 text-sm mt-1">Administra qué correos pueden iniciar sesión en el sistema.</p>
            </div>
          </div>

          <form onSubmit={handleAddEmail} className="flex gap-4 mb-8">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ejemplo@empresa.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 focus:border-slate-800 focus:outline-none transition-colors rounded-none"
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 bg-slate-900 text-white font-semibold border border-slate-900 hover:bg-slate-800 px-6 py-3 rounded-none transition-all shadow-none"
            >
              <Plus size={18} /> Agregar
            </button>
          </form>

          {loading ? (
            <div className="text-center py-8 text-slate-500">Cargando correos...</div>
          ) : (
            <div className="border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Correo Electrónico</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Rol</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Agregado el</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                        No hay correos registrados.
                      </td>
                    </tr>
                  ) : (
                    emails.map((email) => (
                      <tr key={email.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">{email.id}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 capitalize">
                          {email.role === 'admin' ? (
                            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                              Admin
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                              Auditor
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {email.addedAt ? new Date(email.addedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRemoveEmail(email.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-2"
                            title="Revocar acceso"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
