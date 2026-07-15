import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: REEMPLAZA ESTO CON LA CONFIGURACIÓN DE TU PROYECTO FIREBASE
// Ve a Console > Configuración del Proyecto > General > Mis Apps (Web)
const firebaseConfig = {
  apiKey: "AIzaSyCQ0p9ENCMCGtiI-BzZCxJMq_EprZDJTU4",
  authDomain: "auditoriati-def46.firebaseapp.com",
  projectId: "auditoriati-def46",
  storageBucket: "auditoriati-def46.firebasestorage.app",
  messagingSenderId: "185258021886",
  appId: "1:185258021886:web:37a4d8aaa03124e96726af",
  measurementId: "G-0BB5CV6R1B"
};

// Inicializar Firebase
let app;
let db;
let auth;
let googleProvider;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch(e) {
  console.error("Error al inicializar Firebase. Asegúrate de haber llenado tus credenciales en src/firebase.js");
}

export { db, auth, googleProvider };
