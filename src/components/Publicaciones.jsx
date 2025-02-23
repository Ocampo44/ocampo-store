// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busquedaNombre, setBusquedaNombre] = useState(""); // Filtro por título
  const [busqueda, setBusqueda] = useState(""); // Filtro para ID (texto) o valor seleccionado para status/nickname
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

            const itemsData = await itemsResponse.json();

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

  // Opciones únicas para status y nickname
  const uniqueStatus = Array.from(new Set(publicaciones.map((pub) => pub.status))).filter(Boolean);
  const uniqueNicknames = Array.from(new Set(publicaciones.map((pub) => pub.userNickname))).filter(Boolean);

  // 3. Filtrar publicaciones según el filtro por nombre (título) y el filtro activo
  const publicacionesFiltradas = publicaciones.filter((item) => {
    // Filtro por nombre (título)
    const filtroNombre = item.title?.toLowerCase().includes(busquedaNombre.toLowerCase());

    let filtroAdicional = true;
    if (filterType === "id") {
      filtroAdicional = item.id?.toLowerCase().includes(busqueda.toLowerCase());
    } else if (filterType === "status") {
      filtroAdicional = busqueda === "all" || item.status === busqueda;
    } else if (filterType === "nickname") {
      filtroAdicional = busqueda === "all" || item.userNickname === busqueda;
    }
    return filtroNombre && filtroAdicional;
  });

  // Reiniciamos la página actual cuando cambie la búsqueda o el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [busqueda, busquedaNombre, filterType]);

  // Calcular la paginación
  const indexUltimo = currentPage * publicacionesPorPagina;
  const indexPrimer = indexUltimo - publicacionesPorPagina;
  const publicacionesPaginadas = publicacionesFiltradas.slice(indexPrimer, indexUltimo);
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / publicacionesPorPagina);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>

      {/* Filtro adicional por nombre (título) */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Buscar por nombre (título)"
          value={busquedaNombre}
          onChange={(e) => setBusquedaNombre(e.target.value)}
          style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
        />
      </div>

      {/* Pestañas de filtro */}
      <div style={{ marginBottom: "10px", display: "flex", gap: "10px" }}>
        <button
          onClick={() => {
            setFilterType("id");
            setBusqueda("");
          }}
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
          onClick={() => {
            setFilterType("status");
            setBusqueda("all");
          }}
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
          onClick={() => {
            setFilterType("nickname");
            setBusqueda("all");
          }}
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

      {/* Filtro según el tipo seleccionado */}
      <div style={{ marginBottom: "10px" }}>
        {filterType === "id" ? (
          <input
            type="text"
            placeholder="Buscar por ID de publicación"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
          />
        ) : filterType === "status" ? (
          <select
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
          >
            <option value="all">Todos</option>
            {uniqueStatus.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        ) : filterType === "nickname" ? (
          <select
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
          >
            <option value="all">Todas</option>
            {uniqueNicknames.map((nick) => (
              <option key={nick} value={nick}>
                {nick}
              </option>
            ))}
          </select>
        ) : null}
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

          {/* Paginación */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px", gap: "5px" }}>
            {Array.from({ length: totalPaginas }, (_, index) => (
              <button
                key={index + 1}
                onClick={() => setCurrentPage(index + 1)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #ccc",
                  backgroundColor: currentPage === index + 1 ? "#ddd" : "#fff",
                  cursor: "pointer",
                }}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Publicaciones;
