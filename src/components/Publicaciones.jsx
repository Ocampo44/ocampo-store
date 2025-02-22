// src/components/Publicaciones.jsx
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Se espera que en el archivo .env tengas configurado REACT_APP_API_PROXY_URL
// Ejemplo: REACT_APP_API_PROXY_URL=https://tudominio.com/proxy
const API_PROXY_URL = process.env.REACT_APP_API_PROXY_URL || "https://api.mercadolibre.com";

const Publicaciones = () => {
  const [accounts, setAccounts] = useState([]);
  // Estructura: { [sellerId]: { items: [...], currentPage: 1, totalPages: N } }
  const [publicaciones, setPublicaciones] = useState({});

  // Escucha las cuentas conectadas en Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const acc = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      console.log("Cuentas obtenidas:", acc);
      setAccounts(acc);
    });
    return () => unsub();
  }, []);

  // Función para traer todas las publicaciones de un vendedor, paginando las peticiones
  const fetchPublicacionesForSeller = async (accessToken, sellerId) => {
    const items = [];
    let offset = 0;
    const limit = 50; // Límite según la documentación
    let total = 0;
    try {
      do {
        console.log(`Consultando publicaciones para ${sellerId} - offset: ${offset}`);
        // Se utiliza el proxy para evitar problemas de CORS
        const url = `${API_PROXY_URL}/users/${sellerId}/items/search?include_filters=true&limit=${limit}&offset=${offset}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          console.log("Respuesta de la API:", data);
          // La respuesta devuelve un arreglo de IDs en data.results
          items.push(...data.results);
          total = data.paging.total;
          offset += limit;
        } else {
          console.error(
            `Error al obtener publicaciones para el vendedor ${sellerId}: ${response.status}`
          );
          break;
        }
      } while (offset < total);
    } catch (error) {
      console.error(
        `Error en la consulta de publicaciones para el vendedor ${sellerId}:`,
        error
      );
    }
    return items;
  };

  // Para cada cuenta, se consultan y se guardan todas las publicaciones
  useEffect(() => {
    const fetchAllPublicaciones = async () => {
      const pubs = {};
      for (const account of accounts) {
        const accessToken = account.token?.access_token;
        const sellerId = account.profile?.id;
        if (accessToken && sellerId) {
          const items = await fetchPublicacionesForSeller(accessToken, sellerId);
          // Calcula el total de páginas (50 ítems por página)
          const totalPages = Math.ceil(items.length / 50);
          pubs[sellerId] = {
            items,
            currentPage: 1,
            totalPages,
          };
        }
      }
      console.log("Publicaciones obtenidas:", pubs);
      setPublicaciones(pubs);
    };

    if (accounts.length > 0) {
      fetchAllPublicaciones();
    }
  }, [accounts]);

  // Función de paginación para cada vendedor
  const handlePageChange = (sellerId, newPage) => {
    setPublicaciones((prev) => ({
      ...prev,
      [sellerId]: {
        ...prev[sellerId],
        currentPage: newPage,
      },
    }));
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Publicaciones de Cuentas Conectadas</h1>
      {Object.keys(publicaciones).length === 0 && <p>No se encontraron publicaciones.</p>}
      {Object.entries(publicaciones).map(([sellerId, pubData]) => {
        const { items, currentPage, totalPages } = pubData;
        // Calcula los ítems a mostrar según la página actual
        const startIndex = (currentPage - 1) * 50;
        const endIndex = startIndex + 50;
        const itemsToShow = items.slice(startIndex, endIndex);

        return (
          <div key={sellerId} style={{ marginBottom: "40px" }}>
            <h2>Vendedor: {sellerId}</h2>
            {itemsToShow.length === 0 ? (
              <p>No hay publicaciones para este vendedor.</p>
            ) : (
              itemsToShow.map((itemId) => (
                <div
                  key={itemId}
                  style={{
                    border: "1px solid #ddd",
                    padding: "10px",
                    marginBottom: "10px",
                    borderRadius: "4px",
                  }}
                >
                  <p>ID de Publicación: {itemId}</p>
                  {/* Aquí puedes agregar una llamada adicional para obtener detalles del ítem si es necesario */}
                </div>
              ))
            )}
            {/* Controles de paginación */}
            {totalPages > 1 && (
              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={() =>
                    handlePageChange(sellerId, Math.max(currentPage - 1, 1))
                  }
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <span style={{ margin: "0 10px" }}>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() =>
                    handlePageChange(sellerId, Math.min(currentPage + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Publicaciones;
