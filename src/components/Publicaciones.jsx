// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filterType, setFilterType] = useState("id"); // "id", "status" o "nickname"
  const [currentPage, setCurrentPage] = useState(1);
  const publicacionesPorPagina = 20;

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

  // 2. Para cada cuenta, obtener todos los IDs de sus publicaciones y luego sus detalles
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let todasLasPublicaciones = [];

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue; // si faltan datos, pasar a la siguiente cuenta

        try {
          // Paginar para obtener TODOS los IDs de las publicaciones
          let allItemIds = [];
          let offset = 0;
          let total = Infinity;
          while (offset < total) {
            const searchResponse = await fetch(
              `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&offset=${offset}`
            );
            if (!searchResponse.ok) {
              console.error("Error al obtener IDs de publicaciones:", searchResponse.status);
              break;
            }
            const searchData = await searchResponse.json();
            if (searchData.paging?.total !== undefined) {
              total = searchData.paging.total;
            }
            const nuevosIds = searchData.results || [];
            allItemIds = [...allItemIds, ...nuevosIds];
            offset += nuevosIds.length;
            // Si no hay más resultados, salimos del bucle
            if (nuevosIds.length === 0) break;
          }

          if (allItemIds.length === 0) continue; // Si no hay ítems, pasar a la siguiente cuenta

          // Procesamos los IDs en batches de 20
          const batchSize = 20;
          for (let i = 0; i < allItemIds.length; i += batchSize) {
            const batchIds = allItemIds.slice(i, i + batchSize).join(",");
            const itemsUrl = `https://api.mercadolibre.com/items?ids=${batchIds}&access_token=${accessToken}`;
            const itemsResponse = await fetch(itemsUrl);

            if (!itemsResponse.ok) {
              console.error("Error al obtener detalles de publicaciones:", itemsResponse.status);
              continue;
            }

            // itemsResponse.json() retorna un array: [{ code, body: { ...itemData }}, ...]
            const itemsData = await itemsResponse.json();

            // Filtramos solo los que tienen code=200 y agregamos nickname
            const validItems = itemsData
              .filter((item) => item.code === 200)
              .map((item) => ({
                ...item.body, // Contiene id, title, price, thumbnail, status, etc.
                userNickname: nickname,
              }));

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

  // 3. Filtrar publicaciones según el texto ingresado y el filtro activo
  const publicacionesFiltradas = publicaciones.filter((item) => {
    const valor =
      filterType === "id"
        ? item.id?.toLowerCase() || ""
        : filterType === "status"
        ? item.status?.toLowerCase() || ""
        : filterType === "nickname"
        ? item.userNickname?.toLowerCase() || ""
        : "";
    return valor.includes(busqueda.toLowerCase());
  });

  // Reiniciamos la página actual cuando cambie la búsqueda o el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [busqueda, filterType]);

  // Calcular la paginación
  const indexUltimo = currentPage * publicacionesPorPagina;
  const indexPrimer = indexUltimo - publicacionesPorPagina;
  const publicacionesPaginadas = publicacionesFiltradas.slice(indexPrimer, indexUltimo);
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / publicacionesPorPagina);

  const handleAnterior = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleSiguiente = () => {
    if (currentPage < totalPaginas) setCurrentPage(currentPage + 1);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>

      {/* Pestañas de filtro */}
      <div style={{ marginBottom: "10px", display: "flex", gap: "10px" }}>
        <button
          onClick={() => setFilterType("id")}
          style={{
            backgroundColor: filterType === "id" ? "#ddd" : "#fff",
            padding: "8px 12px",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          ID de Publicación
        </button>
        <button
          onClick={() => setFilterType("status")}
          style={{
            backgroundColor: filterType === "status" ? "#ddd" : "#fff",
            padding: "8px 12px",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Estado de Publicación
        </button>
        <button
          onClick={() => setFilterType("nickname")}
          style={{
            backgroundColor: filterType === "nickname" ? "#ddd" : "#fff",
            padding: "8px 12px",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Cuenta
        </button>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder={`Buscar por ${filterType}`}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
        />
      </div>

      {publicacionesFiltradas.length === 0 ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {publicacionesPaginadas.map((pub) => (
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

          {/* Paginación con botones "Anterior" y "Siguiente" */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginTop: "20px",
              gap: "10px",
            }}
          >
            <button
              onClick={handleAnterior}
              disabled={currentPage === 1}
              style={{
                padding: "8px 12px",
                border: "1px solid #ccc",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
              }}
            >
              Anterior
            </button>

            <span>
              Página {currentPage} de {totalPaginas}
            </span>

            <button
              onClick={handleSiguiente}
              disabled={currentPage === totalPaginas}
              style={{
                padding: "8px 12px",
                border: "1px solid #ccc",
                cursor: currentPage === totalPaginas ? "not-allowed" : "pointer",
              }}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Publicaciones;
