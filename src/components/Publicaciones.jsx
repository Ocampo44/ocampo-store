// src/components/Publicaciones.jsx
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [accounts, setAccounts] = useState([]);
  // Objeto donde cada clave es el sellerId y su valor contiene: { items: [...], currentPage: 1, totalPages: N }
  const [publicaciones, setPublicaciones] = useState({});
  const SITE_ID = "MLM"; // Cambia este valor según la región (por ejemplo, MLA, MLB, etc.)

  // Escucha en tiempo real las cuentas conectadas en Firestore
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

  // Función para traer todas las publicaciones de un vendedor paginando las peticiones a la API
  const fetchPublicacionesForSeller = async (accessToken, sellerId) => {
    const items = [];
    let offset = 0;
    const limit = 100; // Límite máximo por llamada
    let total = 0;
    try {
      do {
        // Puedes probar removiendo el header Authorization, ya que este endpoint es público
        const response = await fetch(
          `https://api.mercadolibre.com/sites/${SITE_ID}/search?seller_id=${sellerId}&limit=${limit}&offset=${offset}`
          // ,{
          //   headers: {
          //     Authorization: `Bearer ${accessToken}`,
          //   },
          // }
        );
        const data = await response.json();
        console.log("Respuesta de publicaciones para vendedor", sellerId, data);
        if (!response.ok) {
          console.error(
            `Error al obtener publicaciones para el vendedor ${sellerId}: ${response.status}`,
            data
          );
          break;
        }
        items.push(...data.results);
        total = data.paging.total;
        offset += limit;
      } while (offset < total);
    } catch (error) {
      console.error(
        `Error en la consulta de publicaciones para el vendedor ${sellerId}:`,
        error
      );
    }
    return items;
  };

  // Para cada cuenta conectada, se consultan y se guardan todas las publicaciones
  useEffect(() => {
    const fetchAllPublicaciones = async () => {
      const pubs = {};
      for (const account of accounts) {
        // Usamos el token si lo necesitamos, pero recuerda verificar si la cuenta pertenece al SITE_ID correcto.
        const accessToken = account.token?.access_token;
        const sellerId = account.profile?.id;
        if (sellerId) {
          const items = await fetchPublicacionesForSeller(accessToken, sellerId);
          // Calcula el total de páginas (mostrando 50 ítems por página)
          const totalPages = Math.ceil(items.length / 50);
          pubs[sellerId] = {
            items,
            currentPage: 1,
            totalPages,
          };
        }
      }
      setPublicaciones(pubs);
    };

    if (accounts.length > 0) {
      fetchAllPublicaciones();
    }
  }, [accounts]);

  // Función para manejar el cambio de página para cada vendedor
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
      {Object.keys(publicaciones).length === 0 && (
        <p>No se encontraron publicaciones.</p>
      )}
      {Object.entries(publicaciones).map(([sellerId, pubData]) => {
        const { items, currentPage, totalPages } = pubData;
        // Se calcula el slice de ítems para mostrar 50 por página
        const startIndex = (currentPage - 1) * 50;
        const endIndex = startIndex + 50;
        const itemsToShow = items.slice(startIndex, endIndex);

        return (
          <div key={sellerId} style={{ marginBottom: "40px" }}>
            <h2>Vendedor: {sellerId}</h2>
            {itemsToShow.length === 0 ? (
              <p>No hay publicaciones para este vendedor.</p>
            ) : (
              itemsToShow.map((item) => (
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
