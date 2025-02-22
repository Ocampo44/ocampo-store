// src/components/Publicaciones.jsx
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const SITE_ID = "MLM"; // Ajusta según corresponda

  // Escucha las cuentas conectadas en Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const acc = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setAccounts(acc);
    });
    return () => unsub();
  }, []);

  // Por cada cuenta, se consulta las publicaciones usando el endpoint de MercadoLibre
  useEffect(() => {
    const fetchPublicaciones = async () => {
      const allPublicaciones = [];

      for (const account of accounts) {
        const accessToken = account.token?.access_token;
        const sellerId = account.profile?.id;
        if (accessToken && sellerId) {
          try {
            const response = await fetch(
              `https://api.mercadolibre.com/sites/${SITE_ID}/search?seller_id=${sellerId}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
            if (response.ok) {
              const data = await response.json();
              allPublicaciones.push({ sellerId, items: data.results });
            } else {
              console.error(
                `Error al obtener publicaciones para el vendedor ${sellerId}: ${response.status}`
              );
            }
          } catch (error) {
            console.error(
              `Error al consultar publicaciones para el vendedor ${sellerId}:`,
              error
            );
          }
        }
      }
      setPublicaciones(allPublicaciones);
    };

    if (accounts.length > 0) {
      fetchPublicaciones();
    }
  }, [accounts]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Publicaciones de Cuentas Conectadas</h1>
      {publicaciones.length === 0 && <p>No se encontraron publicaciones.</p>}
      {publicaciones.map((pub) => (
        <div key={pub.sellerId} style={{ marginBottom: "20px" }}>
          <h2>Vendedor: {pub.sellerId}</h2>
          {pub.items.length === 0 ? (
            <p>No hay publicaciones para este vendedor.</p>
          ) : (
            pub.items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "10px",
                  marginBottom: "10px",
                  borderRadius: "4px",
                }}
              >
                <h3>{item.title}</h3>
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    style={{ maxWidth: "150px" }}
                  />
                )}
                <p>Precio: ${item.price}</p>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
};

export default Publicaciones;
