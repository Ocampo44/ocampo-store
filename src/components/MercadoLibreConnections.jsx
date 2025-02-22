// src/components/MercadoLibreConnections.js
import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// Genera code_verifier y code_challenge (PKCE)
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

// Obtiene el perfil del usuario desde MercadoLibre
const fetchUserProfile = async (accessToken) => {
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/users/me?access_token=${accessToken}`
    );
    if (!response.ok) {
      console.error("Error al obtener el perfil:", response.status);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

// Valida el token
const checkTokenValidity = async (accessToken) => {
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/users/me?access_token=${accessToken}`
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data && data.id ? true : false;
  } catch (error) {
    console.error("Token validation error:", error);
    return false;
  }
};

const MercadoLibreConnections = () => {
  const [accounts, setAccounts] = useState([]);
  const [status, setStatus] = useState("");
  const [tokenStatuses, setTokenStatuses] = useState({});

  // Inicia la autenticación para conectar o renovar la cuenta
  const iniciarAutenticacion = async () => {
    try {
      const { codeVerifier, codeChallenge } = await generateCodeVerifierAndChallenge();
      localStorage.setItem("code_verifier", codeVerifier);
      const redirectUri = "https://www.tu-dominio.com/mercadolibre"; 
      // Reemplaza con tu dominio y ruta correctos
      const authUrl = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=TU_CLIENT_ID&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_challenge=${codeChallenge}&code_challenge_method=S256&scope=offline_access%20read%20write`;
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error iniciando autenticación:", error);
    }
  };

  // Renueva token de una cuenta en particular
  const renovarToken = (accountId) => {
    localStorage.setItem("renewAccountId", accountId);
    iniciarAutenticacion();
  };

  // Elimina un usuario de Firestore
  const eliminarUsuario = async (accountId) => {
    try {
      await deleteDoc(doc(db, "mercadolibreUsers", accountId));
      setStatus("Usuario eliminado exitosamente");
    } catch (error) {
      console.error("Error eliminando usuario:", error);
      setStatus("Error al eliminar el usuario");
    }
  };

  // Intercambia el código de autorización por el token
  const exchangeCodeForToken = async (code) => {
    const codeVerifier = localStorage.getItem("code_verifier");
    if (!codeVerifier) {
      console.error("No se encontró code_verifier");
      return null;
    }
    const data = new URLSearchParams();
    data.append("grant_type", "authorization_code");
    data.append("client_id", "TU_CLIENT_ID");
    data.append("client_secret", "TU_CLIENT_SECRET");
    data.append("code", code);
    data.append("redirect_uri", "https://www.tu-dominio.com/mercadolibre");
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
      if (!response.ok) {
        console.error("Error al intercambiar el código por token:", response.status);
        return null;
      }
      const tokenData = await response.json();
      return tokenData && tokenData.access_token ? tokenData : null;
    } catch (error) {
      console.error("Error al intercambiar el código por token:", error);
      return null;
    }
  };

  // Procesa el código en la URL: intercambia por token y guarda/actualiza el usuario
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get("code");

    if (code) {
      const processCode = async () => {
        setStatus("Procesando código de autorización...");
        const tokenData = await exchangeCodeForToken(code);
        if (!tokenData) {
          setStatus("Error al obtener token.");
          return;
        }
        const profileData = await fetchUserProfile(tokenData.access_token);
        if (!profileData || !profileData.id) {
          setStatus("Error al obtener perfil del usuario.");
          return;
        }
        const profileId = profileData.id.toString();
        const renewAccountId = localStorage.getItem("renewAccountId");
        const accountDocId = renewAccountId ? renewAccountId : profileId;

        // Guarda en Firestore
        const userDocRef = doc(db, "mercadolibreUsers", accountDocId);
        await setDoc(
          userDocRef,
          { token: tokenData, profile: profileData, code },
          { merge: true }
        );

        // Guarda también en localStorage para que otros componentes lo usen (Publicaciones, etc.)
        localStorage.setItem("mercadoLibreAccessToken", tokenData.access_token);
        localStorage.setItem("mercadoLibreUserId", profileId);

        setStatus(
          renewAccountId
            ? "Token renovado exitosamente"
            : "Cuenta conectada exitosamente"
        );
        if (renewAccountId) localStorage.removeItem("renewAccountId");
      };
      processCode();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Escucha cambios en Firestore para obtener las cuentas conectadas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      if (snapshot && snapshot.docs) {
        const acc = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        acc.sort((a, b) => {
          const nameA = a.profile?.nickname || "";
          const nameB = b.profile?.nickname || "";
          return nameA.localeCompare(nameB);
        });
        setAccounts(acc);
      }
    });
    return () => unsub();
  }, []);

  // Verifica la validez de cada token y actualiza el estado
  useEffect(() => {
    const updateTokenStatuses = async () => {
      const statuses = {};
      for (const account of accounts) {
        const active = await checkTokenValidity(account.token?.access_token);
        statuses[account.id] = active;
      }
      setTokenStatuses(statuses);
    };
    if (accounts.length > 0) {
      updateTokenStatuses();
    }
  }, [accounts]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Conexiones con MercadoLibre</h1>
      <button style={styles.connectButton} onClick={iniciarAutenticacion}>
        Conectar cuenta de MercadoLibre
      </button>
      {status && <p style={styles.status}>{status}</p>}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Nombre</th>
            <th style={styles.th}>ID MercadoLibre</th>
            <th style={styles.th}>Estado</th>
            <th style={styles.th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr
              key={account.id}
              style={{
                backgroundColor: tokenStatuses[account.id]
                  ? "#d4edda"
                  : "#f8d7da",
              }}
            >
              <td style={styles.td}>
                {account.profile?.nickname || "Sin Nombre"}
              </td>
              <td style={styles.td}>{account.id}</td>
              <td style={styles.td}>
                {tokenStatuses[account.id] ? "Activo" : "Inactivo"}
              </td>
              <td style={styles.td}>
                <button
                  style={styles.renewButton}
                  onClick={() => renovarToken(account.id)}
                >
                  Renovar Token
                </button>
                <button
                  style={styles.deleteButton}
                  onClick={() => eliminarUsuario(account.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: "800px",
    margin: "20px auto",
    padding: "20px",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  title: {
    textAlign: "center",
    color: "#333",
    marginBottom: "20px",
  },
  connectButton: {
    backgroundColor: "#f1c40f",
    color: "#333",
    border: "none",
    padding: "10px 20px",
    fontSize: "1em",
    borderRadius: "4px",
    cursor: "pointer",
    display: "block",
    margin: "0 auto 20px auto",
  },
  status: {
    textAlign: "center",
    marginBottom: "10px",
    color: "#333",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "20px",
  },
  th: {
    border: "1px solid #ddd",
    padding: "8px",
    backgroundColor: "#f2f2f2",
    textAlign: "left",
  },
  td: {
    border: "1px solid #ddd",
    padding: "8px",
  },
  renewButton: {
    backgroundColor: "#3498db",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "5px",
  },
  deleteButton: {
    backgroundColor: "#e74c3c",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
  },
};

export default MercadoLibreConnections;
