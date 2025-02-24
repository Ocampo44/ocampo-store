// Importar las funciones necesarias del SDK de Firebase
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// Si necesitas autenticación, descomenta la siguiente línea:
// import { getAuth } from "firebase/auth";

/* ---------------------------------------
   Configuración para "prieba1-c0221"
----------------------------------------- */
const firebaseConfigPrueba = {
  apiKey: "AIzaSyBGUxXSua0qhbSlcOOXzgBW0I6XQfsGD0M",
  authDomain: "prieba1-c0221.firebaseapp.com",
  projectId: "prieba1-c0221",
  storageBucket: "prieba1-c0221.firebasestorage.app",
  messagingSenderId: "960029128533",
  appId: "1:960029128533:web:e8510b204027f578cce1dc",
  measurementId: "G-0FXJZF6GJ4"
};

// Inicializar la primera app de Firebase (pruebas)
const appPrueba = initializeApp(firebaseConfigPrueba, "prueba");
const analytics = getAnalytics(appPrueba);

/* ---------------------------------------
   Configuración para "Ocampo Store"
----------------------------------------- */
const firebaseConfigOcampo = {
  apiKey: "AIzaSyAEIfc0jVIt1-yctZatdQbi1TsyoPIAQt0",
  authDomain: "ocampo-store.firebaseapp.com",
  projectId: "ocampo-store",
  storageBucket: "ocampo-store.appspot.com",
  messagingSenderId: "769300555409",
  appId: "1:769300555409:web:f2043682c967d568964130"
};

// Inicializar la segunda app de Firebase (Ocampo Store)
const appOcampo = initializeApp(firebaseConfigOcampo, "ocampo");
const db = getFirestore(appOcampo);
const storage = getStorage(appOcampo);
// Si necesitas autenticación, descomenta la siguiente línea:
// const auth = getAuth(appOcampo);

export { appPrueba, analytics, appOcampo, db, storage };
