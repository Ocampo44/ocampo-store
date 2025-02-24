import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const ITEMS_PER_PAGE = 20;

const getStatusStyle = (status) => {
  switch (status) {
    case "active":
      return { backgroundColor: "#2ecc71", color: "#fff", padding: "2px 4px", borderRadius: "4px" };
    case "paused":
      return { backgroundColor: "#f1c40f", color: "#fff", padding: "2px 4px", borderRadius: "4px" };
    case "closed":
      return { backgroundColor: "#e74c3c", color: "#fff", padding: "2px 4px", borderRadius: "4px" };
    default:
      return { backgroundColor: "#95a5a6", color: "#fff", padding: "2px 4px", borderRadius: "4px" };
  }
};

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaId, setBusquedaId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [selectedCuenta, setSelectedCuenta] = useState("Todas");
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    const fetchPublicaciones = async () => {
      setPublicaciones([]);
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
                ...item.body,
                userNickname: nickname,
              }));
            setPublicaciones((prev) => [...prev, ...validItems]);
          }
        } catch (error) {
          console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }
      setCurrentPage(1);
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

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

  const totalPaginas = Math.ceil(publicacionesFiltradas.length / ITEMS_PER_PAGE);
  const indexInicio = (currentPage - 1) * ITEMS_PER_PAGE;
  const publicacionesPaginadas = publicacionesFiltradas.slice(indexInicio, indexInicio + ITEMS_PER_PAGE);

  const estadosDisponibles = useMemo(() => {
    const estados = publicaciones.map((pub) => pub.status);
    return ["Todos", ...Array.from(new Set(estados))];
  }, [publicaciones]);

  const cuentasDisponibles = useMemo(() => {
    const nombres = cuentas.map((cuenta) => cuenta.profile?.nickname || "Sin Nombre");
    return ["Todas", ...Array.from(new Set(nombres))];
  }, [cuentas]);

  const handlePaginaAnterior = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handlePaginaSiguiente = () => {
    if (currentPage < totalPaginas) setCurrentPage(currentPage + 1);
  };

  return (
    <div style={{ width: "100%", padding: "8px", boxSizing: "border-box", backgroundColor: "#f7f9fa" }}>
      <h2 style={{ textAlign: "center", color: "#2c3e50", marginBottom: "10px", fontSize: "1.2rem" }}>
        Publicaciones de usuarios conectados
      </h2>
      <div
        style={{
          background: "#ecf0f1",
          padding: "8px",
          borderRadius: "6px",
          marginBottom: "10px",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          justifyContent: "center",
        }}
      >
        <p style={{ flexBasis: "100%", textAlign: "center", margin: 0, fontSize: "0.9rem" }}>
          <strong>Total:</strong> {publicacionesFiltradas.length}
        </p>
        <input
          type="text"
          placeholder="Buscar por título..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: "4px 6px",
            border: "1px solid #bdc3c7",
            borderRadius: "4px",
            flex: "1 1 150px",
            fontSize: "0.8rem",
          }}
        />
        <input
          type="text"
          placeholder="Filtrar por ID..."
          value={busquedaId}
          onChange={(e) => {
            setBusquedaId(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: "4px 6px",
            border: "1px solid #bdc3c7",
            borderRadius: "4px",
            flex: "1 1 150px",
            fontSize: "0.8rem",
          }}
        />
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: "4px 6px",
            border: "1px solid #bdc3c7",
            borderRadius: "4px",
            flex: "1 1 120px",
            fontSize: "0.8rem",
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
            padding: "4px 6px",
            border: "1px solid #bdc3c7",
            borderRadius: "4px",
            flex: "1 1 120px",
            fontSize: "0.8rem",
          }}
        >
          {cuentasDisponibles.map((cuenta) => (
            <option key={cuenta} value={cuenta}>
              {cuenta}
            </option>
          ))}
        </select>
      </div>

      {publicacionesPaginadas.length === 0 ? (
        <p style={{ textAlign: "center", color: "#e74c3c", fontSize: "0.9rem" }}>No se encontraron publicaciones.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {publicacionesPaginadas.map((pub) => (
            <div
              key={pub.id}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "4px",
                display: "flex",
                flexDirection: "row",
                overflow: "hidden",
                width: "100%",
                padding: "4px",
              }}
            >
              <img
                src={pub.thumbnail}
                alt={pub.title}
                style={{ width: "120px", height: "80px", objectFit: "cover", flexShrink: 0 }}
              />
              <div style={{ padding: "4px", flex: "1", fontSize: "0.8rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h3 style={{ margin: "0 0 2px 0", color: "#34495e", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {pub.title}
                </h3>
                <p style={{ margin: "0", color: "#7f8c8d" }}>
                  <strong>Precio:</strong> {pub.price} {pub.currency_id}
                </p>
                <p style={{ margin: "0", color: "#7f8c8d" }}>
                  <strong>Cuenta:</strong> {pub.userNickname}
                </p>
                <p style={{ margin: "0", color: "#7f8c8d" }}>
                  <strong>ID:</strong> {pub.id}
                </p>
                <p style={{ margin: "0", display: "flex", alignItems: "center", gap: "4px" }}>
                  <strong>Estado:</strong>
                  <span style={getStatusStyle(pub.status)}>{pub.status}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "6px", gap: "6px" }}>
          <button
            onClick={handlePaginaAnterior}
            disabled={currentPage === 1}
            style={{
              padding: "4px 8px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: currentPage === 1 ? "#bdc3c7" : "#3498db",
              color: "#fff",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
            }}
          >
            Anterior
          </button>
          <span style={{ fontWeight: "bold", color: "#2c3e50", fontSize: "0.8rem" }}>
            Página {currentPage} de {totalPaginas}
          </span>
          <button
            onClick={handlePaginaSiguiente}
            disabled={currentPage === totalPaginas}
            style={{
              padding: "4px 8px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: currentPage === totalPaginas ? "#bdc3c7" : "#3498db",
              color: "#fff",
              cursor: currentPage === totalPaginas ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
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
