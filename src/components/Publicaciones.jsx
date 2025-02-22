// src/components/Publicaciones.jsx
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [accounts, setAccounts] = useState([]);
  // Estructura: { [sellerId]: { items: [...], currentPage: 1, totalPages: N } }
  const [publicaciones, setPublicaciones] = useState({});
  const SITE_ID = "MLM"; // Cambia este valor según la región (MLM, MLA, MLB, etc.)

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

  // Función para traer todas las publicaciones de un vendedor
  // utilizando 50 items por consulta
  const fetchPublicacionesForSeller = async (sellerId) => {
    const items = [];
    let offset = 0;
    const limit = 50; // Máximo 50 items por consulta
    let total = 0;
    try {
      do {
        const url = `https://api.mercadolibre.com/sites/${SITE_ID}/search?seller_id=${sellerId}&limit=${limit}&offset=${offset}`;
        const response = await fetch(url);
        const data = await response.json();
        console.log("Respuesta para vendedor", sellerId, data);
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

  // Para cada cuenta, se consultan y se guardan todas las publicaciones
  useEffect(() => {
    const fetchAllPublicaciones = async () => {
      const pubs = {};
      for (const account of accounts) {
        const sellerId = account.profile?.id;
        if (sellerId) {
          const items = await fetchPublicacionesForSeller(sellerId);
          // Se calcula el total de páginas (50 items por página en la UI)
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

  // Función para cambiar de página en la UI para cada vendedor
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
        // Se calcula el slice para mostrar 50 ítems por página
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
                    handlePageChange(
                      sellerId,
                      Math.min(currentPage + 1, totalPages)
                    )
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
