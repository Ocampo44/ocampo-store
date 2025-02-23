// src/components/Publicaciones.jsx
import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Función que genera rangos diarios (timestamps Unix) desde startDate hasta endDate
const generateDailyRanges = (startDate, endDate) => {
  const ranges = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current < end) {
    const desde = Math.floor(current.getTime() / 1000);
    const nextDay = new Date(current);
    nextDay.setDate(current.getDate() + 1);
    // El rango diario se define hasta el final del día (un segundo antes del siguiente día)
    const hasta = Math.floor(nextDay.getTime() / 1000) - 1;
    ranges.push({ desde, hasta });
    current = nextDay;
  }
  return ranges;
};

// Función auxiliar para obtener publicaciones en un rango diario para una cuenta
const fetchPublicacionesEnRango = async (userId, accessToken, nickname, desde, hasta) => {
  let publicacionesRango = [];
  let offset = 0;
  let total = Infinity;
  const MAX_OFFSET = 1000; // Límite impuesto por el endpoint para cada consulta

  // Consulta paginada en el rango diario
  while (offset < total && offset < MAX_OFFSET) {
    const url = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&offset=${offset}&date_created_from=${desde}&date_created_to=${hasta}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Error al obtener IDs de publicaciones:", response.status);
      break;
    }
    const data = await response.json();
    if (data.paging?.total !== undefined) {
      total = data.paging.total;
    }
    const nuevosIds = data.results || [];
    if (nuevosIds.length === 0) break;

    // Procesamos en lotes de 20
    const batchSize = 20;
    for (let i = 0; i < nuevosIds.length; i += batchSize) {
      const batchIds = nuevosIds.slice(i, i + batchSize).join(",");
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
          ...item.body,
          userNickname: nickname,
        }));
      publicacionesRango = [...publicacionesRango, ...validItems];
    }
    offset += nuevosIds.length;
  }
  return publicacionesRango;
};

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

  // 2. Para cada cuenta, obtener publicaciones dividiendo la consulta por días
  useEffect(() => {
    const fetchTodasPublicaciones = async () => {
      let todasLasPublicaciones = [];

      // Define la fecha de inicio y la fecha final (puedes ajustar según tus necesidades)
      const fechaInicio = "2020-01-01"; 
      const fechaFin = new Date().toISOString().split("T")[0]; // fecha actual en formato YYYY-MM-DD
      const rangosDiarios = generateDailyRanges(fechaInicio, fechaFin);

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";
        if (!accessToken || !userId) continue;

        for (const rango of rangosDiarios) {
          try {
            const publicacionesRango = await fetchPublicacionesEnRango(
              userId,
              accessToken,
              nickname,
              rango.desde,
              rango.hasta
            );
            todasLasPublicaciones = [...todasLasPublicaciones, ...publicacionesRango];
          } catch (error) {
            console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
          }
        }
      }
      setPublicaciones(todasLasPublicaciones);
    };

    if (cuentas.length > 0) {
      fetchTodasPublicaciones();
    }
  }, [cuentas]);

  // 3. Filtrado de publicaciones según el texto ingresado y el filtro activo
  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((item) => {
      const valor =
        filterType === "id"
          ? (item.id || "").toLowerCase()
          : filterType === "status"
          ? (item.status || "").toLowerCase()
          : filterType === "nickname"
          ? (item.userNickname || "").toLowerCase()
          : "";
      return valor.includes(busqueda.toLowerCase());
    });
  }, [publicaciones, busqueda, filterType]);

  // Reiniciar la página actual solo cuando cambie la búsqueda o el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [busqueda, filterType]);

  // Cálculos de paginación
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / publicacionesPorPagina);
  const indexUltimo = currentPage * publicacionesPorPagina;
  const indexPrimer = indexUltimo - publicacionesPorPagina;
  const publicacionesPaginadas = publicacionesFiltradas.slice(indexPrimer, indexUltimo);

  const handleAnterior = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleSiguiente = () => {
    if (currentPage < totalPaginas) setCurrentPage((prev) => prev + 1);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>

      {/* Filtros */}
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

          {/* Paginación: Botones "Anterior" y "Siguiente" */}
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
