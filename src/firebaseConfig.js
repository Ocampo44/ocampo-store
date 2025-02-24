// Importar las funciones necesarias del SDK de Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// Si necesitas autenticación, descomenta la siguiente línea:
// import { getAuth } from "firebase/auth";

// Configuración de Firebase para "Ocampo Store"
const firebaseConfig = {
  apiKey: "AIzaSyAEIfc0jVIt1-yctZatdQbi1TsyoPIAQt0",
  authDomain: "ocampo-store.firebaseapp.com",
  projectId: "ocampo-store",
  storageBucket: "ocampo-store.appspot.com",
  messagingSenderId: "769300555409",
  appId: "1:769300555409:web:f2043682c967d568964130"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore
const db = getFirestore(app);

// Inicializar Storage (si necesitas almacenamiento de archivos)
const storage = getStorage(app);

// Si necesitas autenticación, descomenta la siguiente línea:
// const auth = getAuth(app);

export { app, db, storage };
