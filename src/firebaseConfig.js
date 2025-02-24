// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Configuración actualizada de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBGUxXSua0qhbSlcOOXzgBW0I6XQfsGD0M",
  authDomain: "prieba1-c0221.firebaseapp.com",
  projectId: "prieba1-c0221",
  storageBucket: "prieba1-c0221.firebasestorage.app",
  messagingSenderId: "960029128533",
  appId: "1:960029128533:web:e8510b204027f578cce1dc",
  measurementId: "G-0FXJZF6GJ4"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Firestore
const db = getFirestore(app);

// Inicializa Analytics
const analytics = getAnalytics(app);

export { app, db, analytics };
