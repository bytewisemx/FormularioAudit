import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, BrainCircuit, Minimize2, Loader2, ChevronRight, Menu, AlertTriangle, Download } from 'lucide-react';

const AudioAssistant = ({ pendingQuestions, onSuggestionClick }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true); // Empezamos minimizado
  const [volume, setVolume] = useState(0);
  const [micError, setMicError] = useState('');

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Mantenemos isRecording en un ref para callbacks asíncronos (como onend)
  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Instanciar SpeechRecognition UNA SOLA VEZ
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API no soportada en este navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-MX'; // Asumimos español

    recognition.onresult = (event) => {
      let currentInterim = '';
      let finalTranscriptChunk = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptChunk += event.results[i][0].transcript + ' ';
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      setInterimTranscript(currentInterim);
      
      if (finalTranscriptChunk) {
        setTranscript((prev) => {
          const newTranscript = prev + finalTranscriptChunk;
          resetSilenceTimer(newTranscript);
          return newTranscript;
        });
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setMicError('Permiso de micrófono denegado o ocupado por otra app.');
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch(e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      clearTimeout(silenceTimerRef.current);
    };
  }, []); // <--- Dependencia vacía (solo se ejecuta 1 vez)

  // Controlar el inicio y apagado según el estado isRecording
  useEffect(() => {
    const startAudioAnalyzer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        
        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
        microphoneRef.current.connect(analyserRef.current);
        
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setVolume(average);

          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };

        updateVolume();
        setMicError(''); 

        // Iniciar reconocimiento DESPUÉS de que getUserMedia desbloqueó el hardware
        if (recognitionRef.current && isRecordingRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {}
        }

      } catch (err) {
        console.error("No se pudo acceder al micrófono:", err);
        setMicError('Micrófono denegado u ocupado.');
        setIsRecording(false);
      }
    };

    const stopAudioAnalyzer = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setVolume(0);
    };

    if (isRecording) {
      startAudioAnalyzer();
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch(e){}
      }
      stopAudioAnalyzer();
    }

    return () => {
      stopAudioAnalyzer();
    };
  }, [isRecording]);


  const resetSilenceTimer = (currentTranscript) => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      analyzeTranscript(currentTranscript);
    }, 4000); 
  };

  const analyzeTranscript = async (textToAnalyze) => {
    if (!textToAnalyze.trim() || isAnalyzing) return;
    
    setIsAnalyzing(true);
    try {
      // --- INICIO MOCK (Para fiabilidad y prueba inicial sin n8n) ---
      // Como sugeriste que no sabes si n8n es fiable, usamos este algoritmo local rápido:
      await new Promise(r => setTimeout(r, 800)); // Simulamos proceso IA
      
      const textLower = textToAnalyze.toLowerCase();
      const matches = pendingQuestions.filter(q => {
        const qLower = q.pregunta.toLowerCase();
        // Palabras clave de más de 4 letras
        const words = textLower.split(/[\s,.-]+/).filter(w => w.length > 4);
        return words.some(w => qLower.includes(w));
      }).slice(0, 3);
      
      let suggestedIds = matches.map(m => m.id);
      if (suggestedIds.length === 0 && pendingQuestions.length > 0) {
          suggestedIds = pendingQuestions.slice(0, 2).map(q => q.id);
      }
      // --- FIN MOCK ---

      const newSuggestions = pendingQuestions.filter(q => suggestedIds.includes(q.id));
      setSuggestions(newSuggestions);
      
    } catch (error) {
      console.error("Error al analizar transcripción:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (isMinimized) setIsMinimized(false); // Abrir al grabar
  };

  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-slate-800 border border-slate-700 shadow-2xl rounded-xl p-4 text-xs text-slate-400">
        La API de dictado no es compatible con este navegador.<br/>Te sugerimos usar Google Chrome.
      </div>
    );
  }

  return (
    <>
      {/* Botón flotante para abrir la barra lateral si está minimizada */}
      {isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed top-24 right-0 z-50 bg-slate-800 border-y border-l border-slate-700 p-3 rounded-l-xl shadow-xl flex items-center justify-center hover:bg-slate-700 transition-colors group"
        >
          <div className="relative">
             <BrainCircuit className={`w-6 h-6 ${isRecording ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`} />
             {isRecording && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
          </div>
        </button>
      )}

      {/* Barra Lateral Derecha */}
      <div 
        className={`fixed top-0 right-0 h-full z-50 bg-slate-800 border-l border-slate-700 shadow-2xl flex flex-col transition-transform duration-300 w-80 sm:w-96
          ${isMinimized ? 'translate-x-full' : 'translate-x-0'}
        `}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100">Asistente de Auditoría</h3>
          </div>
          <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-slate-800 rounded-md transition-colors" title="Minimizar">
            <Minimize2 className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* CONTROLS (Top) */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex flex-col items-center">
                  <div className="flex flex-col w-full mt-3">
                    <button
                      onClick={toggleRecording}
                      className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-white font-bold transition-all shadow-lg hover:scale-105 active:scale-95 border-b-4 ${
                        isRecording 
                        ? "bg-red-500 hover:bg-red-400 border-red-700 shadow-red-500/30" 
                        : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border-blue-800 shadow-blue-500/30"
                      }`}
                    >
                      {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                      <span>{isRecording ? "Detener" : "Iniciar Plática"}</span>
                    </button>
                  </div>
          
          {micError && (
            <div className="mt-3 text-xs text-red-400 text-center bg-red-900/30 p-2 rounded w-full flex items-center justify-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0" /> {micError}
            </div>
          )}

          {/* Visualizador de Audio */}
          {isRecording && !micError && (
            <div className="mt-3 flex gap-1 items-end h-6">
              {[0.4, 0.7, 1, 0.8, 0.5, 0.9, 0.6].map((multiplier, i) => {
                 const normalized = Math.min(100, (volume / 60) * 100);
                 const h = Math.max(15, normalized * multiplier);
                 return (
                   <div 
                     key={i} 
                     className="w-1.5 bg-cyan-400 rounded-full transition-all duration-75" 
                     style={{ height: `${h}%`, opacity: h > 20 ? 1 : 0.5 }}
                   ></div>
                 );
              })}
            </div>
          )}
        </div>

        {/* TRANSCRIPT AREA */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-800/50 text-sm font-light leading-relaxed border-b border-slate-700 relative flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transcripción en vivo</h4>
            {transcript && (
              <button onClick={() => setTranscript('')} className="text-[10px] text-slate-500 hover:text-white">
                Limpiar Texto
              </button>
            )}
          </div>
          <div className="flex-1">
            {!transcript && !interimTranscript && (
              <p className="text-slate-500 italic text-center mt-10 text-xs">
                {isRecording ? "Escuchando..." : "Inicia la grabación para empezar a dictar..."}
              </p>
            )}
            <p className="text-slate-300">
              {transcript}
              <span className="text-slate-400 italic ml-1">{interimTranscript}</span>
            </p>
          </div>
          
          {isAnalyzing && (
            <div className="absolute bottom-4 right-4 bg-slate-900/80 px-3 py-1.5 rounded-md text-xs flex items-center gap-2 text-cyan-400 shadow-md">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando plática...
            </div>
          )}
        </div>

        {/* SUGGESTIONS AREA */}
        <div className="p-4 bg-slate-900/50 min-h-[250px] overflow-y-auto">
          <h4 className="text-xs font-semibold text-cyan-400 mb-3 uppercase tracking-wider flex items-center gap-2">
            <BrainCircuit className="w-4 h-4" /> Preguntas Sugeridas
          </h4>
          {suggestions.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-xs text-slate-500">
                {isRecording ? "Habla sobre temas de TI para ver sugerencias..." : "No hay sugerencias aún."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {suggestions.map((sug) => (
                <button 
                  key={sug.id} 
                  onClick={() => onSuggestionClick(sug.section, sug.id)}
                  className="text-left text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 transition-all p-3 rounded-xl flex items-start gap-3 group shadow-sm"
                >
                  <ChevronRight className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  <span className="line-clamp-3 leading-snug text-slate-200 group-hover:text-white">{sug.pregunta}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default AudioAssistant;
