import React, { useState } from 'react';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export default function FileUpload({ currentAuditId, questionId, currentUrl, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit (e.g., max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo es muy pesado. El límite es 10MB.');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(0);

    // Create a storage reference
    const fileName = `${Date.now()}_${file.name}`;
    const fileRef = ref(storage, `auditorias/${currentAuditId}/${questionId}/${fileName}`);

    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const prog = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setProgress(prog);
      },
      (err) => {
        console.error("Error al subir archivo:", err);
        setError('Error al subir el archivo. Verifica tu conexión o intenta con otro archivo.');
        setUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          onUploadComplete(downloadURL);
        } catch (err) {
          console.error("Error obteniendo URL:", err);
          setError('Archivo subido pero falló al obtener el enlace.');
        } finally {
          setUploading(false);
        }
      }
    );
  };

  return (
    <div className="mt-2">
      {!uploading && !currentUrl && (
        <div className="relative">
          <input 
            type="file" 
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Sube un archivo como evidencia"
          />
          <div className="flex items-center gap-2 border border-dashed border-cyan-300 bg-cyan-50 text-cyan-700 px-4 py-2 rounded text-sm font-medium hover:bg-cyan-100 transition-colors">
            <Upload size={16} /> Subir Archivo Adjunto
          </div>
        </div>
      )}

      {uploading && (
        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 relative">
          <div 
            className="bg-cyan-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] font-bold text-white" 
            style={{ width: `${progress}%` }}
          >
            {progress}%
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      {currentUrl && !uploading && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-2 text-sm rounded">
          <FileText size={16} className="text-slate-500" />
          <a href={currentUrl} target="_blank" rel="noreferrer" className="flex-1 text-cyan-600 hover:underline truncate">
            Ver Archivo Adjunto
          </a>
          <CheckCircle2 size={16} className="text-emerald-500" />
          <button 
            type="button" 
            onClick={() => {
              if(window.confirm('¿Deseas remover este archivo?')) {
                onUploadComplete('');
              }
            }}
            className="text-slate-400 hover:text-red-500 transition-colors"
            title="Remover archivo"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
