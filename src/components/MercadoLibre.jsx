import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const MercadoLibre = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [estado, setEstado] = useState("Inactivo"); // para mostrar mensajes de estado

  // URL para redirigir a MercadoLibre, con redirect_uri apuntando a /mercadolibre
  const authUrl =
    "https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=8505590495521677&redirect_uri=https://www.ocampostore.store/mercadolibre";

  // Función para intercambiar el código por un access token
  const exchangeCodeForToken = async (code) => {
    const data = new URLSearchParams();
    data.append("grant_type", "authorization_code");
    data.append("client_id", "8505590495521677");
    data.append("client_secret", "Ps3qGnQHLgllwWjcjV0HuDxgBAwYFjLL");
    data.append("code", code);
    data.append("redirect_uri", "https://www.ocampostore.store/mercadolibre");
    // Si usas PKCE, descomenta y agrega el code_verifier:
    // data.append("code_verifier", "TU_CODE_VERIFIER");

    try {
      const response = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: data,
      });
      const tokenData = await response.json();
      console.log("Access token recibido:", tokenData);
      return tokenData;
    } catch (error) {
      console.error("Error al intercambiar el código por token:", error);
      return null;
    }
  };

  // Efecto para extraer el código de la URL, guardarlo en Firebase y obtener el token
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get("code");
    console.log("Código obtenido de la URL:", code);

    if (code) {
      setEstado("Procesando código de autorización...");
      const saveCodeAndToken = async () => {
        try {
          // Guarda el código en Firestore
          const docRef = await addDoc(collection(db, "mercadolibreUsers"), { code });
          console.log("Código guardado con ID:", docRef.id);

          // Intercambia el código por token
          const tokenData = await exchangeCodeForToken(code);
          if (!tokenData) {
            setEstado("Error al obtener el token.");
            return;
          }
          console.log("Token de acceso:", tokenData);

          // Actualiza el documento para incluir el token
          await updateDoc(doc(db, "mercadolibreUsers", docRef.id), { token: tokenData });
          setEstado("Autorización completada y token guardado.");
        } catch (err) {
          console.error("Error al guardar el código o el token:", err);
          setEstado("Error al guardar el código o el token.");
        }
      };
      saveCodeAndToken();

      // Limpiar el parámetro de la URL para evitar reprocesos
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Escuchar cambios en la colección de usuarios vinculados en Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsuarios(users);
    });
    return () => unsub();
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Conecta tu cuenta de MercadoLibre</h1>
      <p style={styles.subtitle}>
        Conecta tu cuenta para acceder a promociones y administrar tus anuncios.
      </p>
      <a href={authUrl} style={styles.link}>
        <button style={styles.button}>Conectar con MercadoLibre</button>
      </a>
      <p style={styles.estado}>Estado: {estado}</p>

      <h2 style={styles.connectedTitle}>Cuentas Vinculadas</h2>
      {usuarios.length === 0 ? (
        <p>No hay cuentas vinculadas.</p>
      ) : (
        <ul style={styles.lista}>
          {usuarios.map((user) => (
            <li key={user.id} style={styles.item}>
              <strong>{user.nickname || user.code || "Sin Nickname"}</strong> (ID: {user.id})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    padding: "40px 20px",
    backgroundColor: "#f5f7fa",
    color: "#333",
    textAlign: "center",
  },
  title: {
    margin: "0 0 20px",
    fontSize: "2em",
  },
  subtitle: {
    margin: "0 0 30px",
    fontSize: "1.1em",
    color: "#555",
  },
  link: {
    textDecoration: "none",
  },
  button: {
    backgroundColor: "#3483fa",
    color: "#fff",
    border: "none",
    padding: "12px 24px",
    fontSize: "1em",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
  },
  estado: {
    marginTop: "20px",
    fontSize: "1em",
    color: "#d35400",
  },
  connectedTitle: {
    marginTop: "40px",
    fontSize: "1.5em",
    color: "#333",
  },
  lista: {
    listStyle: "none",
    padding: 0,
    marginTop: "20px",
  },
  item: {
    backgroundColor: "#fff",
    marginBottom: "10px",
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #ddd",
  },
};

export default MercadoLibre;
