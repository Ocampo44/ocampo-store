// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  // 1. Escuchar cambios en Firestore para obtener las cuentas con token
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

  // 2. Para cada cuenta, obtener los IDs de sus publicaciones,
  //    luego obtener el detalle de cada publicación y guardarlo en "publicaciones".
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let todasLasPublicaciones = [];

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue; // si faltan datos, pasar a la siguiente cuenta

        try {
          // Primero, obtener los IDs de las publicaciones
          const searchResponse = await fetch(
            `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}`
          );
          if (!searchResponse.ok) {
            console.error("Error al obtener IDs de publicaciones:", searchResponse.status);
            continue;
          }

          const searchData = await searchResponse.json();
          const itemIds = searchData.results || []; // Array de IDs de ítems

          // Si no hay ítems, pasamos a la siguiente cuenta
          if (itemIds.length === 0) continue;

          // Usamos batch de 20 en 20 para no saturar la API
          const batchSize = 20;
          for (let i = 0; i < itemIds.length; i += batchSize) {
            const batchIds = itemIds.slice(i, i + batchSize).join(",");
            const itemsUrl = `https://api.mercadolibre.com/items?ids=${batchIds}&access_token=${accessToken}`;
            const itemsResponse = await fetch(itemsUrl);

            if (!itemsResponse.ok) {
              console.error("Error al obtener detalles de publicaciones:", itemsResponse.status);
              continue;
            }

            // itemsResponse.json() retorna un array: [{ code, body: { ...itemData }}, ...]
            const itemsData = await itemsResponse.json();

            // Filtramos solo los que tienen code=200 (peticiones exitosas)
            const validItems = itemsData
              .filter((item) => item.code === 200)
              .map((item) => {
                // Agregamos nickname al objeto body
                return {
                  ...item.body, // Contiene id, title, price, thumbnail, status, etc.
                  userNickname: nickname,
                };
              });

            // Agregamos estos ítems al array general
            todasLasPublicaciones = [...todasLasPublicaciones, ...validItems];
          }
        } catch (error) {
          console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }

      setPublicaciones(todasLasPublicaciones);
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // 3. Filtrar publicaciones según el texto ingresado
  const publicacionesFiltradas = publicaciones.filter((item) => {
    const titulo = item.title?.toLowerCase() || "";
    return titulo.includes(busqueda.toLowerCase());
  });

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
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              {/* Imagen */}
              <img
                src={pub.thumbnail}
                alt={pub.title}
                style={{ width: "60px", height: "60px", objectFit: "cover" }}
              />

              {/* Información del ítem */}
              <div>
                <h3 style={{ margin: "0 0 5px 0" }}>{pub.title}</h3>
                <p style={{ margin: 0 }}>
                  Precio: {pub.price} {pub.currency_id}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Cuenta:</strong> {pub.userNickname}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>ID de la publicación:</strong> {pub.id}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Estado:</strong> {pub.status}
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
