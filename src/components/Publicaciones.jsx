import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const ITEMS_PER_PAGE = 20;

const styles = {
  container: {
    width: "100%",
    padding: "10px 20px",
    fontFamily: "'Roboto', sans-serif",
    color: "#444",
    backgroundColor: "#f7f9fc",
    boxSizing: "border-box",
  },
  header: {
    textAlign: "center",
    marginBottom: "20px",
  },
  filtersContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "20px",
    justifyContent: "center",
    marginBottom: "10px",
  },
  input: {
    padding: "10px",
    width: "250px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "16px",
  },
  select: {
    padding: "10px",
    width: "250px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "16px",
    backgroundColor: "#fff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    backgroundColor: "#1976d2",
    color: "#fff",
    fontSize: "16px",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #ddd",
    verticalAlign: "middle",
  },
  img: {
    width: "80px",
    height: "80px",
    objectFit: "cover",
    borderRadius: "4px",
  },
  statusBadge: (status) => {
    let backgroundColor = "#999";
    if (status === "active") backgroundColor = "#4caf50"; // verde
    else if (status === "paused") backgroundColor = "#ff9800"; // naranja
    else if (status === "inactive") backgroundColor = "#f44336"; // rojo
    return {
      padding: "5px 10px",
      borderRadius: "12px",
      backgroundColor,
      color: "#fff",
      fontSize: "12px",
      textTransform: "capitalize",
      textAlign: "center",
      minWidth: "80px",
    };
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    marginTop: "20px",
    gap: "15px",
  },
  button: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    cursor: "pointer",
    backgroundColor: "#1976d2",
    color: "#fff",
    transition: "background-color 0.3s",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    cursor: "default",
  },
};

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busquedaTitulo, setBusquedaTitulo] = useState("");
  const [busquedaId, setBusquedaId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [selectedCuenta, setSelectedCuenta] = useState("Todas");
  const [currentPage, setCurrentPage] = useState(1);

  // Listener para las cuentas en Firestore
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

  // Listener para la colección "publicaciones" en Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "publicaciones"), (snapshot) => {
      const pubs = snapshot.docs.map((doc) => doc.data());
      setPublicaciones(pubs);
    });
    return () => unsub();
  }, []);

  // Función para obtener todos los IDs de publicaciones usando search_type=scan
  const fetchAllItemIds = async (userId, accessToken) => {
    let allIds = [];
    let scrollId = null;
    try {
      do {
        let url = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&search_type=scan`;
        if (scrollId) {
          url += `&scroll_id=${scrollId}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
          console.error("Error al obtener publicaciones en modo scan:", response.status);
          break;
        }
        const data = await response.json();
        if (data.results && Array.isArray(data.results)) {
          allIds = allIds.concat(data.results);
        } else {
          console.warn("No se encontraron 'results' en la respuesta:", data);
        }
        scrollId = data.scroll_id;
      } while (scrollId);
    } catch (error) {
      console.error("Error en fetchAllItemIds:", error);
    }
    return allIds;
  };

  // Función para traer y guardar las publicaciones
  const fetchPublicaciones = useCallback(async () => {
    let todasLasPublicaciones = [];

    for (const cuenta of cuentas) {
      const accessToken = cuenta.token?.access_token;
      const userId = cuenta.profile?.id;
      const nickname = cuenta.profile?.nickname || "Sin Nombre";

      if (!accessToken || !userId) continue;

      try {
        const itemIds = await fetchAllItemIds(userId, accessToken);
        if (!itemIds.length) continue;

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
            .filter((item) => item.code === 200 && item.body)
            .map((item) => ({
              ...item.body,
              userNickname: nickname,
            }));

          todasLasPublicaciones = todasLasPublicaciones.concat(validItems);
        }
      } catch (error) {
        console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
      }
    }

    // Filtrar duplicados basados en el ID de la publicación
    const publicacionesUnicas = todasLasPublicaciones.filter(
      (pub, index, self) => index === self.findIndex((p) => p.id === pub.id)
    );

    // Guarda (o actualiza) cada publicación en Firestore
    for (const pub of publicacionesUnicas) {
      try {
        await setDoc(doc(db, "publicaciones", pub.id.toString()), pub, { merge: true });
      } catch (error) {
        console.error("Error al guardar la publicación con id:", pub.id, error);
      }
    }
    setCurrentPage(1);
  }, [cuentas]);

  // Actualización al cargar o cambiar las cuentas
  useEffect(() => {
    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas, fetchPublicaciones]);

  // Actualización periódica cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (cuentas.length > 0) {
        fetchPublicaciones();
      }
    }, 60000); // 60000 ms = 60 segundos
    return () => clearInterval(interval);
  }, [cuentas, fetchPublicaciones]);

  // Filtros: título, id, status y cuenta
  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((item) => {
      const titulo = item.title?.toLowerCase() || "";
      const idPublicacion = item.id?.toString() || "";
      const filtroTitulo = titulo.includes(busquedaTitulo.toLowerCase());
      const filtroId = busquedaId.trim() === "" || idPublicacion.includes(busquedaId);
      const filtroStatus = selectedStatus === "Todos" || item.status === selectedStatus;
      const filtroCuenta = selectedCuenta === "Todas" || item.userNickname === selectedCuenta;
      return filtroTitulo && filtroId && filtroStatus && filtroCuenta;
    });
  }, [publicaciones, busquedaTitulo, busquedaId, selectedStatus, selectedCuenta]);

  // Paginación
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / ITEMS_PER_PAGE);
  const indexInicio = (currentPage - 1) * ITEMS_PER_PAGE;
  const publicacionesPaginadas = publicacionesFiltradas.slice(
    indexInicio,
    indexInicio + ITEMS_PER_PAGE
  );

  // Dropdown de estados disponibles
  const estadosDisponibles = useMemo(() => {
    const estados = publicaciones.map((pub) => pub.status);
    return ["Todos", ...Array.from(new Set(estados))];
  }, [publicaciones]);

  // Dropdown de cuentas disponibles
  const cuentasDisponibles = useMemo(() => {
    const nombres = cuentas.map(
      (cuenta) => cuenta.profile?.nickname || "Sin Nombre"
    );
    return ["Todas", ...Array.from(new Set(nombres))];
  }, [cuentas]);

  // Funciones de paginación
  const handleAnterior = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleSiguiente = () => {
    if (currentPage < totalPaginas) setCurrentPage(currentPage + 1);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2>Publicaciones de Usuarios Conectados</h2>
        <p>
          <strong>Total:</strong> {publicacionesFiltradas.length} publicaciones
        </p>
      </header>

      <div style={styles.filtersContainer}>
        <input
          type="text"
          placeholder="Buscar por título..."
          value={busquedaTitulo}
          onChange={(e) => {
            setBusquedaTitulo(e.target.value);
            setCurrentPage(1);
          }}
          style={styles.input}
        />
        <input
          type="text"
          placeholder="Buscar por ID..."
          value={busquedaId}
          onChange={(e) => {
            setBusquedaId(e.target.value);
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
        <select
          value={selectedCuenta}
          onChange={(e) => {
            setSelectedCuenta(e.target.value);
            setCurrentPage(1);
          }}
          style={styles.select}
        >
          {cuentasDisponibles.map((cuenta) => (
            <option key={cuenta} value={cuenta}>
              {cuenta}
            </option>
          ))}
        </select>
      </div>

      {publicacionesPaginadas.length === 0 ? (
        <p style={{ textAlign: "center" }}>No se encontraron publicaciones.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Imagen</th>
              <th style={styles.th}>Título</th>
              <th style={styles.th}>Precio</th>
              <th style={styles.th}>Cuenta</th>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {publicacionesPaginadas.map((pub) => (
              <tr key={pub.id}>
                <td style={styles.td}>
                  <img src={pub.thumbnail} alt={pub.title} style={styles.img} />
                </td>
                <td style={styles.td}>{pub.title}</td>
                <td style={styles.td}>
                  {pub.price} {pub.currency_id}
                </td>
                <td style={styles.td}>{pub.userNickname}</td>
                <td style={styles.td}>{pub.id}</td>
                <td style={styles.td}>
                  <span style={styles.statusBadge(pub.status)}>{pub.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPaginas > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={handleAnterior}
            disabled={currentPage === 1}
            style={{
              ...styles.button,
              ...(currentPage === 1 ? styles.buttonDisabled : {}),
            }}
          >
            Anterior
          </button>
          <button
            onClick={handleSiguiente}
            disabled={currentPage === totalPaginas}
            style={{
              ...styles.button,
              ...(currentPage === totalPaginas ? styles.buttonDisabled : {}),
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
