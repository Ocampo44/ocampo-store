// src/components/Publicaciones.jsx
import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const ITEMS_PER_PAGE = 20;

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaId, setBusquedaId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [selectedCuenta, setSelectedCuenta] = useState("Todas");
  const [currentPage, setCurrentPage] = useState(1);

  // Escuchar cambios en Firestore para obtener las cuentas con token
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

  // Función para obtener todos los IDs de publicaciones usando search_type=scan
  const fetchAllItemIds = async (userId, accessToken) => {
    let allIds = [];
    let scrollId = null;
    let url = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&search_type=scan`;
    
    do {
      if (scrollId) {
        url = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&search_type=scan&scroll_id=${scrollId}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Error al obtener publicaciones en modo scan:", response.status);
        break;
      }
      
      const data = await response.json();
      if (data.results && Array.isArray(data.results)) {
        allIds = [...allIds, ...data.results];
      }
      scrollId = data.scroll_id;
    } while (scrollId);
    
    return allIds;
  };

  // Obtener publicaciones de cada cuenta usando el modo scan
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let todasLasPublicaciones = [];

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue;

        try {
          const itemIds = await fetchAllItemIds(userId, accessToken);
          if (itemIds.length === 0) continue;

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
      setCurrentPage(1);
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // Filtro de publicaciones según búsqueda, ID, estado y cuenta
  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((item) => {
      const titulo = item.title?.toLowerCase() || "";
      const idItem = item.id?.toString() || "";
      const busquedaOk = titulo.includes(busqueda.toLowerCase());
      const busquedaIdOk = idItem.includes(busquedaId);
      const statusOk = selectedStatus === "Todos" || item.status === selectedStatus;
      const cuentaOk = selectedCuenta === "Todas" || item.userNickname === selectedCuenta;
      return busquedaOk && busquedaIdOk && statusOk && cuentaOk;
    });
  }, [publicaciones, busqueda, busquedaId, selectedStatus, selectedCuenta]);

  // Paginación
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / ITEMS_PER_PAGE);
  const indexInicio = (currentPage - 1) * ITEMS_PER_PAGE;
  const publicacionesPaginadas = publicacionesFiltradas.slice(indexInicio, indexInicio + ITEMS_PER_PAGE);

  // Lista de estados disponibles
  const estadosDisponibles = useMemo(() => {
    const estados = publicaciones.map((pub) => pub.status);
    return ["Todos", ...Array.from(new Set(estados))];
  }, [publicaciones]);

  // Lista de cuentas disponibles para el filtro
  const cuentasDisponibles = useMemo(() => {
    const nombres = cuentas.map((cuenta) => cuenta.profile?.nickname || "Sin Nombre");
    return ["Todas", ...Array.from(new Set(nombres))];
  }, [cuentas]);

  // Manejo de paginación con botones "Anterior" y "Siguiente"
  const handlePaginaAnterior = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handlePaginaSiguiente = () => {
    if (currentPage < totalPaginas) setCurrentPage(currentPage + 1);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", color: "#2c3e50" }}>Publicaciones de usuarios conectados</h2>
      <div style={{ background: "#ecf0f1", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
        <p>
          <strong>Total de publicaciones:</strong> {publicacionesFiltradas.length}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", justifyContent: "center" }}>
          <input
            type="text"
            placeholder="Buscar por título..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "10px",
              border: "1px solid #bdc3c7",
              borderRadius: "4px",
              flex: "1 1 250px"
            }}
          />
          <input
            type="text"
            placeholder="Filtrar por ID de MercadoLibre..."
            value={busquedaId}
            onChange={(e) => {
              setBusquedaId(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "10px",
              border: "1px solid #bdc3c7",
              borderRadius: "4px",
              flex: "1 1 250px"
            }}
          />
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "10px",
              border: "1px solid #bdc3c7",
              borderRadius: "4px",
              flex: "1 1 200px"
            }}
          >
            {estadosDisponibles.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
          <select
            value={selectedCuenta}
            onChange={(e) => {
              setSelectedCuenta(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "10px",
              border: "1px solid #bdc3c7",
              borderRadius: "4px",
              flex: "1 1 200px"
            }}
          >
            {cuentasDisponibles.map((cuenta) => (
              <option key={cuenta} value={cuenta}>
                {cuenta}
              </option>
            ))}
          </select>
        </div>
      </div>

      {publicacionesPaginadas.length === 0 ? (
        <p style={{ textAlign: "center", color: "#e74c3c" }}>No se encontraron publicaciones.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {publicacionesPaginadas.map((pub) => (
            <li
              key={pub.id}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                padding: "15px",
                marginBottom: "15px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "15px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
              }}
            >
              <img
                src={pub.thumbnail}
                alt={pub.title}
                style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "4px" }}
              />
              <div style={{ flex: "1" }}>
                <h3 style={{ margin: "0 0 8px 0", color: "#34495e" }}>{pub.title}</h3>
                <p style={{ margin: "4px 0", color: "#7f8c8d" }}>
                  <strong>Precio:</strong> {pub.price} {pub.currency_id}
                </p>
                <p style={{ margin: "4px 0", color: "#7f8c8d" }}>
                  <strong>Cuenta:</strong> {pub.userNickname}
                </p>
                <p style={{ margin: "4px 0", color: "#7f8c8d" }}>
                  <strong>ID:</strong> {pub.id}
                </p>
                <p style={{ margin: "4px 0", color: "#7f8c8d" }}>
                  <strong>Estado:</strong> {pub.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Controles de paginación */}
      {totalPaginas > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "20px", gap: "10px" }}>
          <button
            onClick={handlePaginaAnterior}
            disabled={currentPage === 1}
            style={{
              padding: "10px 15px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: currentPage === 1 ? "#bdc3c7" : "#3498db",
              color: "#fff",
              cursor: currentPage === 1 ? "not-allowed" : "pointer"
            }}
          >
            Anterior
          </button>
          <span style={{ fontWeight: "bold", color: "#2c3e50" }}>
            Página {currentPage} de {totalPaginas}
          </span>
          <button
            onClick={handlePaginaSiguiente}
            disabled={currentPage === totalPaginas}
            style={{
              padding: "10px 15px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: currentPage === totalPaginas ? "#bdc3c7" : "#3498db",
              color: "#fff",
              cursor: currentPage === totalPaginas ? "not-allowed" : "pointer"
            }}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default Publicaciones;
