// src/components/Publicaciones.jsx
import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const ITEMS_PER_PAGE = 20;

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "'Roboto', sans-serif",
    color: "#333",
  },
  header: {
    textAlign: "center",
    marginBottom: "30px",
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: "20px",
    justifyContent: "center",
    marginBottom: "20px",
  },
  input: {
    padding: "10px",
    width: "300px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "16px",
  },
  select: {
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "16px",
  },
  cardList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },
  card: {
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
    backgroundColor: "#fff",
    display: "flex",
    flexDirection: "column",
  },
  cardImage: {
    width: "100%",
    height: "180px",
    objectFit: "cover",
  },
  cardBody: {
    padding: "15px",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "10px",
  },
  cardText: {
    fontSize: "14px",
    marginBottom: "5px",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    marginTop: "30px",
    flexWrap: "wrap",
    gap: "10px",
  },
  pageButton: (active) => ({
    padding: "8px 12px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    backgroundColor: active ? "#1976d2" : "#fff",
    color: active ? "#fff" : "#1976d2",
    cursor: "pointer",
  }),
};

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
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
                ...item.body,
                userNickname: nickname,
              }));

            todasLasPublicaciones = [...todasLasPublicaciones, ...validItems];
          }
        } catch (error) {
          console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }

      // Filtrar duplicados basados en el ID de la publicación
      const publicacionesUnicas = todasLasPublicaciones.filter(
        (pub, index, self) => index === self.findIndex((p) => p.id === pub.id)
      );

      setPublicaciones(publicacionesUnicas);
      setCurrentPage(1);
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // Filtrar publicaciones según la búsqueda y el estado seleccionado
  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((item) => {
      const titulo = item.title?.toLowerCase() || "";
      const busquedaOk = titulo.includes(busqueda.toLowerCase());
      const statusOk = selectedStatus === "Todos" || item.status === selectedStatus;
      return busquedaOk && statusOk;
    });
  }, [publicaciones, busqueda, selectedStatus]);

  // Paginación
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / ITEMS_PER_PAGE);
  const indexInicio = (currentPage - 1) * ITEMS_PER_PAGE;
  const publicacionesPaginadas = publicacionesFiltradas.slice(indexInicio, indexInicio + ITEMS_PER_PAGE);

  // Obtener lista de estados disponibles para el dropdown
  const estadosDisponibles = useMemo(() => {
    const estados = publicaciones.map((pub) => pub.status);
    return ["Todos", ...Array.from(new Set(estados))];
  }, [publicaciones]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2>Publicaciones de usuarios conectados</h2>
        <p>
          <strong>Total de publicaciones:</strong> {publicacionesFiltradas.length}
        </p>
      </header>

      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Buscar ítems..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setCurrentPage(1);
          }}
          style={styles.input}
        />
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
          style={styles.select}
        >
          {estadosDisponibles.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </div>

      {publicacionesPaginadas.length === 0 ? (
        <p style={{ textAlign: "center" }}>No se encontraron publicaciones.</p>
      ) : (
        <div style={styles.cardList}>
          {publicacionesPaginadas.map((pub) => (
            <div key={pub.id} style={styles.card}>
              <img
                src={pub.thumbnail}
                alt={pub.title}
                style={styles.cardImage}
              />
              <div style={styles.cardBody}>
                <h3 style={styles.cardTitle}>{pub.title}</h3>
                <p style={styles.cardText}>
                  Precio: {pub.price} {pub.currency_id}
                </p>
                <p style={styles.cardText}>
                  <strong>Cuenta:</strong> {pub.userNickname}
                </p>
                <p style={styles.cardText}>
                  <strong>ID:</strong> {pub.id}
                </p>
                <p style={styles.cardText}>
                  <strong>Estado:</strong> {pub.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div style={styles.pagination}>
          {Array.from({ length: totalPaginas }, (_, idx) => idx + 1).map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              style={styles.pageButton(num === currentPage)}
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
