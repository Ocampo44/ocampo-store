import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [accounts, setAccounts] = useState([]);
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Escucha en tiempo real las cuentas registradas en Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "mercadolibreUsers"),
      (snapshot) => {
        if (snapshot?.docs) {
          const accts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          // Filtrar cuentas que tengan token válido
          const validAccounts = accts.filter(
            (acct) => acct.token?.access_token
          );
          setAccounts(validAccounts);
        }
      },
      (err) => {
        console.error("Error al cargar cuentas:", err);
        setError("Error al cargar cuentas");
      }
    );
    return () => unsubscribe();
  }, []);

  // Función para obtener publicaciones activas de cada cuenta
  const fetchPublications = async () => {
    setLoading(true);
    setError("");
    let allPublications = [];

    if (accounts.length === 0) {
      setError("No se encontraron cuentas con token válido.");
      setLoading(false);
      return;
    }

    for (const account of accounts) {
      const userId = account.profile?.id || account.id;
      const accessToken = account.token?.access_token;
      if (!userId || !accessToken) continue;

      try {
        const response = await fetch(
          `https://api.mercadolibre.com/users/${userId}/items/search?status=active`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!response.ok) {
          const errData = await response.json();
          console.error(`Error en cuenta ${userId}:`, errData);
          continue;
        }
        const data = await response.json();
        if (Array.isArray(data.results)) {
          // Extraer propiedades relevantes
          const mapped = data.results.map((item) => ({
            id: item.id,
            title: item.title,
            accountName: account.profile?.nickname || "Sin Nombre",
          }));
          allPublications = allPublications.concat(mapped);
        }
      } catch (fetchError) {
        console.error(`Error al obtener publicaciones para ${userId}:`, fetchError);
      }
    }
    setPublications(allPublications);
    setLoading(false);
  };

  return (
    <div className="container my-4">
      <h1 className="text-center mb-4">Publicaciones Activas</h1>
      <div className="text-center mb-3">
        <button
          onClick={fetchPublications}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? "Cargando..." : "Cargar Publicaciones"}
        </button>
      </div>
      {error && (
        <div className="alert alert-danger text-center" role="alert">
          {error}
        </div>
      )}
      <div className="card shadow">
        <div className="card-body">
          {publications.length === 0 ? (
            <p className="text-center text-warning">No hay publicaciones para mostrar.</p>
          ) : (
            <>
              <p className="text-center">
                Total de publicaciones: <strong>{publications.length}</strong>
              </p>
              <ul className="list-group">
                {publications.map((pub) => (
                  <li
                    key={pub.id}
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <strong>{pub.title}</strong> <br />
                      <small>ID: {pub.id}</small>
                    </div>
                    <span className="badge bg-secondary">{pub.accountName}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Publicaciones;
