import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Función para generar code_verifier y code_challenge (PKCE)
const generateCodeVerifierAndChallenge = async () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const hashBuffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64Hash = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { codeVerifier, codeChallenge: base64Hash };
};

const MercadoLibre = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [estado, setEstado] = useState("Inactivo");
  const [userProfile, setUserProfile] = useState(null);

  // Función para obtener información del usuario conectado usando el access token
  const fetchUserProfile = async (accessToken) => {
    try {
      const response = await fetch(`https://api.mercadolibre.com/users/me?access_token=${accessToken}`);
      const data = await response.json();
      if (data.nickname) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  // Inicia la autenticación solicitando los permisos que incluyen offline_access
  const iniciarAutenticacion = async () => {
    const { codeVerifier, codeChallenge } = await generateCodeVerifierAndChallenge();
    localStorage.setItem("code_verifier", codeVerifier);

    // Se añade el parámetro scope con offline_access para que se genere el refresh token
    const authUrl = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=8505590495521677&redirect_uri=https://www.ocampostore.store/mercadolibre&code_challenge=${codeChallenge}&code_challenge_method=S256&scope=offline_access%20read%20write`;
    window.location.href = authUrl;
  };

  // Intercambia el código de autorización por el token (incluye refresh token si se solicitó offline_access)
  const exchangeCodeForToken = async (code) => {
    const codeVerifier = localStorage.getItem("code_verifier");
    if (!codeVerifier) {
      console.error("No se encontró code_verifier en localStorage");
      return null;
    }

    const data = new URLSearchParams();
    data.append("grant_type", "authorization_code");
    data.append("client_id", "8505590495521677");
    data.append("client_secret", "Ps3qGnQHLgllwWjcjV0HuDxgBAwYFjLL");
    data.append("code", code);
    data.append("redirect_uri", "https://www.ocampostore.store/mercadolibre");
    data.append("code_verifier", codeVerifier);

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
      if (tokenData.access_token) {
        console.log("Token recibido:", tokenData);
        return tokenData;
      } else {
        console.error("Error al recibir el token:", tokenData);
        return null;
      }
    } catch (error) {
      console.error("Error al intercambiar el código por token:", error);
      return null;
    }
  };

  // Cuando llega el código en la URL, se procesa y se guarda en Firebase junto con el token
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get("code");

    if (code) {
      setEstado("Procesando código de autorización...");
      const saveCodeAndToken = async () => {
        try {
          // Guarda el código en Firestore
          const docRef = await addDoc(collection(db, "mercadolibreUsers"), { code });
          console.log("Código guardado con ID:", docRef.id);

          // Intercambia el código por el token
          const tokenData = await exchangeCodeForToken(code);
          if (!tokenData) {
            setEstado("Error al obtener el token.");
            return;
          }
          console.log("Token de acceso:", tokenData);

          // Actualiza el documento con el token (incluye refresh_token si lo hay)
          await updateDoc(doc(db, "mercadolibreUsers", docRef.id), { token: tokenData });
          setEstado("Autorización completada y token guardado.");

          // Una vez obtenido el token, se llama a la API para obtener el perfil del usuario
          fetchUserProfile(tokenData.access_token);
        } catch (err) {
          console.error("Error al guardar el código o el token:", err);
          setEstado("Error al guardar el código o el token.");
        }
      };
      saveCodeAndToken();
      // Limpia la URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Escucha cambios en la colección de Firebase para mostrar las cuentas vinculadas
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
      <button style={styles.button} onClick={iniciarAutenticacion}>
        Conectar con MercadoLibre
      </button>
      <p style={styles.estado}>Estado: {estado}</p>

      {/* Muestra el nombre del usuario conectado si se obtuvo el perfil */}
      {userProfile && (
        <div style={{ marginTop: "20px", fontSize: "1.2em", color: "#2ecc71" }}>
          Usuario conectado: <strong>{userProfile.nickname}</strong>
        </div>
      )}

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

// Estilos
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
