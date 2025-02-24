// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Si necesitas Analytics, descomenta la siguiente línea:
// import { getAnalytics } from "firebase/analytics";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDwlBYLr5hTFZwxwpbB_9HaCop_VE3l3Uo",
  authDomain: "sistema-de-inventarios-63b5f.firebaseapp.com",
  projectId: "sistema-de-inventarios-63b5f",
  storageBucket: "sistema-de-inventarios-63b5f.firebasestorage.app",
  messagingSenderId: "608990255818",
  appId: "1:608990255818:web:3ea2413a71b2d283f33233",
  measurementId: "G-174PK18J6J"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Firestore
const db = getFirestore(app);

// Si necesitas Analytics, descomenta:
// const analytics = getAnalytics(app);

export { app, db };