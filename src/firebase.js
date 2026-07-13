import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: REEMPLAZA ESTO CON LA CONFIGURACIÓN DE TU PROYECTO FIREBASE
// Ve a Console > Configuración del Proyecto > General > Mis Apps (Web)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Inicializar Firebase
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch(e) {
  console.error("Error al inicializar Firebase. Asegúrate de haber llenado tus credenciales en src/firebase.js");
}

export { db };
