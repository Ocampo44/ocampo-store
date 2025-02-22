// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  // Obtiene las cuentas conectadas desde Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const cuentasTemp = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCuentas(cuentasTemp);
    });
    return () => unsub();
  }, []);

  // Para cada cuenta, obtiene sus publicaciones usando el endpoint de MercadoLibre
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let todasLasPublicaciones = [];
      for (const cuenta of cuentas) {
        // Asegúrate de que exista el token y el id del perfil
        if (cuenta.token?.access_token && cuenta.profile && cuenta.profile.id) {
          try {
            const response = await fetch(
              `https://api.mercadolibre.com/users/${cuenta.profile.id}/items/search?access_token=${cuenta.token.access_token}`
            );
            if (response.ok) {
              const data = await response.json();
              // data.results contiene los ítems publicados
              todasLasPublicaciones = todasLasPublicaciones.concat(data.results || []);
            }
          } catch (error) {
            console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
          }
        }
      }
      setPublicaciones(todasLasPublicaciones);
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // Filtra las publicaciones en base a la búsqueda ingresada
  const publicacionesFiltradas = publicaciones.filter((item) =>
    // Se asegura que item.title esté definido
    (item.title ? item.title.toLowerCase() : "").includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Buscar ítems..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
        />
      </div>
      {publicacionesFiltradas.length === 0 ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {publicacionesFiltradas.map((pub) => (
            <li
              key={pub.id}
              style={{
                border: "1px solid #ddd",
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <img
                src={pub.thumbnail}
                alt={pub.title}
                style={{ width: "60px", height: "60px", objectFit: "cover" }}
              />
              <div>
                <h3 style={{ margin: "0 0 5px 0" }}>{pub.title}</h3>
                <p style={{ margin: 0 }}>
                  Precio: {pub.price} {pub.currency_id}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Publicaciones;
