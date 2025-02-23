// src/components/Publicaciones.jsx
import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const ITEMS_PER_PAGE = 20;

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);

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

  // 2. Obtener publicaciones de cada cuenta
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let todasLasPublicaciones = [];

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue;

        try {
          // Obtener IDs de publicaciones
          const searchResponse = await fetch(
            `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}`
          );
          if (!searchResponse.ok) {
            console.error("Error al obtener IDs de publicaciones:", searchResponse.status);
            continue;
          }

          const searchData = await searchResponse.json();
          const itemIds = searchData.results || [];
          if (itemIds.length === 0) continue;

          // Procesar en lotes de 20
          const batchSize = 20;
          for (let i = 0; i < itemIds.length; i += batchSize) {
            const batchIds = itemIds.slice(i, i + batchSize).join(",");
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

            todasLasPublicaciones = [...todasLasPublicaciones, ...validItems];
          }
        } catch (error) {
          console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }
      setPublicaciones(todasLasPublicaciones);
      setCurrentPage(1); // Reiniciar la página cuando se cargan nuevas publicaciones
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // 3. Filtrar publicaciones según búsqueda y estado
  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((item) => {
      const titulo = item.title?.toLowerCase() || "";
      const busquedaOk = titulo.includes(busqueda.toLowerCase());
      const statusOk = selectedStatus === "Todos" || item.status === selectedStatus;
      return busquedaOk && statusOk;
    });
  }, [publicaciones, busqueda, selectedStatus]);

  // 4. Paginación: calcular las publicaciones a mostrar
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / ITEMS_PER_PAGE);
  const indexInicio = (currentPage - 1) * ITEMS_PER_PAGE;
  const publicacionesPaginadas = publicacionesFiltradas.slice(indexInicio, indexInicio + ITEMS_PER_PAGE);

  // 5. Obtener lista de estados únicos para el dropdown
  const estadosDisponibles = useMemo(() => {
    const estados = publicaciones.map((pub) => pub.status);
    return ["Todos", ...Array.from(new Set(estados))];
  }, [publicaciones]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>
      {/* Total de publicaciones */}
      <p><strong>Total de publicaciones:</strong> {publicacionesFiltradas.length}</p>
      
      {/* Filtros */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar ítems..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setCurrentPage(1);
          }}
          style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
        />
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
          style={{ padding: "8px" }}
        >
          {estadosDisponibles.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </div>

      {/* Listado de publicaciones */}
      {publicacionesPaginadas.length === 0 ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
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
      )}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div style={{ display: "flex", gap: "5px", marginTop: "20px", flexWrap: "wrap" }}>
          {Array.from({ length: totalPaginas }, (_, idx) => idx + 1).map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                backgroundColor: num === currentPage ? "#eee" : "#fff",
                cursor: "pointer",
              }}
            >
              {num}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Publicaciones;
