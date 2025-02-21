import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// Función para generar code_verifier y code_challenge (PKCE)
const generateCodeVerifierAndChallenge = async () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const hashBuffer = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64Hash = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { codeVerifier, codeChallenge: base64Hash };
};

// Función para obtener el perfil del usuario desde MercadoLibre
const fetchUserProfile = async (accessToken) => {
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/users/me?access_token=${accessToken}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

const MercadoLibre = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [estado, setEstado] = useState("Inactivo");
  const [userProfile, setUserProfile] = useState(null);

  // Inicia la autenticación solicitando permisos (incluyendo offline_access)
  const iniciarAutenticacion = async () => {
    const { codeVerifier, codeChallenge } = await generateCodeVerifierAndChallenge();
    localStorage.setItem("code_verifier", codeVerifier);
    const authUrl = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=8505590495521677&redirect_uri=https://www.ocampostore.store/mercadolibre&code_challenge=${codeChallenge}&code_challenge_method=S256&scope=offline_access%20read%20write`;
    window.location.href = authUrl;
  };

  // Intercambia el código de autorización por el token (incluye refresh token)
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

  // Procesa el código en la URL, intercambia por token y guarda o actualiza el usuario en Firestore
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get("code");

    if (code) {
      setEstado("Procesando código de autorización...");
      const saveCodeAndToken = async () => {
        try {
          // Intercambia el código por token
          const tokenData = await exchangeCodeForToken(code);
          if (!tokenData) {
            setEstado("Error al obtener el token.");
            return;
          }

          // Obtiene el perfil del usuario
          const profileData = await fetchUserProfile(tokenData.access_token);
          if (!profileData || !profileData.id) {
            setEstado("Error al obtener el perfil del usuario.");
            return;
          }
          setUserProfile(profileData);

          // Usa el ID del usuario como documento para evitar duplicados
          const userDocRef = doc(db, "mercadolibreUsers", profileData.id.toString());
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            // Si el usuario ya existe, se actualiza el token y se puede notificar que ya estaba conectado
            await setDoc(
              userDocRef,
              { token: tokenData, profile: profileData, code },
              { merge: true }
            );
            setEstado("El usuario ya estaba conectado; token actualizado.");
          } else {
            // Si no existe, se crea el documento
            await setDoc(userDocRef, { token: tokenData, profile: profileData, code });
            setEstado("Autorización completada y token guardado.");
          }
        } catch (err) {
          console.error("Error al guardar el código o el token:", err);
          setEstado("Error al guardar el código o el token.");
        }
      };
      saveCodeAndToken();
      // Limpia la URL para evitar reprocesamiento
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Escucha los cambios en la colección de usuarios y los ordena alfabéticamente por nickname
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const users = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      users.sort((a, b) => {
        const nameA = a.profile?.nickname || a.code || "";
        const nameB = b.profile?.nickname || b.code || "";
        return nameA.localeCompare(nameB);
      });
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

      {userProfile && (
        <div style={styles.connectedUser}>
          Usuario conectado: <strong>{userProfile.nickname}</strong>
        </div>
      )}

      <h2 style={styles.connectedTitle}>Cuentas Vinculadas</h2>
      {usuarios.length === 0 ? (
        <p style={styles.noUsers}>No hay cuentas vinculadas.</p>
      ) : (
        <ul style={styles.lista}>
          {usuarios.map((user) => (
            <li key={user.id} style={styles.item}>
              <span style={styles.userName}>
                {user.profile?.nickname || user.code || "Sin Nickname"}
              </span>
              <span style={styles.userId}> (ID: {user.id})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Estilos profesionales y modernos
const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: "800px",
    margin: "0 auto",
    padding: "40px 20px",
    backgroundColor: "#f5f7fa",
    color: "#333",
    textAlign: "center",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  title: {
    margin: "0 0 20px",
    fontSize: "2.2em",
    color: "#2c3e50",
  },
  subtitle: {
    margin: "0 0 30px",
    fontSize: "1.2em",
    color: "#7f8c8d",
  },
  button: {
    backgroundColor: "#3483fa",
    color: "#fff",
    border: "none",
    padding: "12px 30px",
    fontSize: "1em",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
    marginBottom: "20px",
  },
  estado: {
    marginTop: "10px",
    fontSize: "1em",
    color: "#d35400",
  },
  connectedUser: {
    marginTop: "20px",
    fontSize: "1.2em",
    color: "#27ae60",
  },
  connectedTitle: {
    marginTop: "40px",
    fontSize: "1.8em",
    color: "#2c3e50",
  },
  noUsers: {
    fontSize: "1em",
    color: "#7f8c8d",
  },
  lista: {
    listStyle: "none",
    padding: 0,
    marginTop: "20px",
  },
  item: {
    backgroundColor: "#fff",
    marginBottom: "10px",
    padding: "12px",
    borderRadius: "4px",
    border: "1px solid #ddd",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userName: {
    fontWeight: "bold",
    color: "#2c3e50",
  },
  userId: {
    fontSize: "0.9em",
    color: "#95a5a6",
  },
};

export default MercadoLibre;
