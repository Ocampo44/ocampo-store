import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";

const Publicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    titulo: "",
    account: "",
    publicationId: "",
  });
  // Estado para la pestaña seleccionada: "active", "paused", "closed" o "all"
  const [selectedStatus, setSelectedStatus] = useState("active");

  // Escuchar las cuentas conectadas en Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      if (snapshot && snapshot.docs) {
        const acc = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        // Filtrar cuentas con token válido
        const validAccounts = acc.filter(
          (account) => account.token?.access_token
        );
        setAccounts(validAccounts);
      }
    });
    return () => unsub();
  }, []);

  // Función para obtener publicaciones con paginación para una cuenta y un estado dado
  const fetchPublicacionesForAccountAndStatus = async (sellerId, accessToken, status) => {
    let results = [];
    let offset = 0;
    const limit = 50; // Puedes probar con 100 si la API lo permite
    while (true) {
      const url = `https://api.mercadolibre.com/users/${sellerId}/items/search?status=${status}&offset=${offset}&limit=${limit}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        console.error(
          `Error para seller ${sellerId} con status ${status}: ${response.status}`
        );
        break;
      }
      const data = await response.json();
      const items = data.results || [];
      results = results.concat(items);
      // Si la cantidad de items obtenidos es menor al límite, se terminó la paginación
      if (items.length < limit) break;
      offset += limit;
    }
    return results;
  };

  // Función para obtener publicaciones según el estado seleccionado (con paginación)
  const fetchPublicaciones = async () => {
    setLoading(true);
    let allPublicaciones = [];
    // Determinar qué estados se deben buscar según la pestaña seleccionada
    let statusesToFetch = selectedStatus === "all"
      ? ["active", "paused", "closed"]
      : [selectedStatus];

    // Para cada cuenta y para cada estado, se hace la paginación
    for (const account of accounts) {
      const sellerId = account.profile?.id;
      const accessToken = account.token?.access_token;
      if (!sellerId || !accessToken) {
        console.error(
          `La cuenta ${account.id} no tiene un sellerId válido o token.`
        );
        continue;
      }

      for (const status of statusesToFetch) {
        try {
          const items = await fetchPublicacionesForAccountAndStatus(
            sellerId,
            accessToken,
            status
          );
          const publicacionesFetch = items.map((item) => ({
            ...item,
            // Se asigna el estado obtenido o se asume el status consultado
            estado: item.status || status,
            accountName: account.profile?.nickname || "Sin Nombre",
          }));
          allPublicaciones = allPublicaciones.concat(publicacionesFetch);
        } catch (error) {
          console.error(
            `Error al obtener publicaciones de la cuenta ${account.id} para status ${status}:`,
            error
          );
        }
      }
    }
    setPublicaciones(allPublicaciones);
    setLoading(false);
  };

  // Ejecutar la búsqueda cada vez que cambien las cuentas o la pestaña seleccionada
  useEffect(() => {
    if (accounts.length > 0) {
      fetchPublicaciones();
    }
  }, [selectedStatus, accounts]);

  // Manejo de filtros para buscar por título, cuenta o ID
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const filteredPublicaciones = publicaciones.filter((pub) => {
    const matchesTitulo = pub.title
      ?.toLowerCase()
      .includes(filters.titulo.toLowerCase());
    const matchesAccount = pub.accountName
      ?.toLowerCase()
      .includes(filters.account.toLowerCase());
    const matchesId = pub.id?.toString().includes(filters.publicationId);
    return matchesTitulo && matchesAccount && matchesId;
  });

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Gestión de Publicaciones</h1>
      {/* Pestañas para seleccionar el estado */}
      <div style={styles.tabs}>
        <button
          style={selectedStatus === "active" ? styles.activeTab : styles.tab}
          onClick={() => setSelectedStatus("active")}
        >
          Activas
        </button>
        <button
          style={selectedStatus === "paused" ? styles.activeTab : styles.tab}
          onClick={() => setSelectedStatus("paused")}
        >
          Pausadas
        </button>
        <button
          style={selectedStatus === "closed" ? styles.activeTab : styles.tab}
          onClick={() => setSelectedStatus("closed")}
        >
          Cerradas
        </button>
        <button
          style={selectedStatus === "all" ? styles.activeTab : styles.tab}
          onClick={() => setSelectedStatus("all")}
        >
          Todas
        </button>
      </div>
      {/* Filtros de búsqueda */}
      <div style={styles.filterContainer}>
        <input
          type="text"
          name="titulo"
          placeholder="Buscar por título"
          value={filters.titulo}
          onChange={handleFilterChange}
          style={styles.filterInput}
        />
        <input
          type="text"
          name="account"
          placeholder="Buscar por nombre de cuenta"
          value={filters.account}
          onChange={handleFilterChange}
          style={styles.filterInput}
        />
        <input
          type="text"
          name="publicationId"
          placeholder="Buscar por ID de publicación"
          value={filters.publicationId}
          onChange={handleFilterChange}
          style={styles.filterInput}
        />
      </div>
      {loading ? (
        <p>Cargando publicaciones...</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Imagen</th>
              <th style={styles.th}>Título</th>
              <th style={styles.th}>Precio</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>ID Publicación</th>
              <th style={styles.th}>Cuenta</th>
            </tr>
          </thead>
          <tbody>
            {filteredPublicaciones.map((pub) => (
              <tr key={pub.id}>
                <td style={styles.td}>
                  {pub.pictures && pub.pictures.length > 0 ? (
                    <img
                      src={pub.pictures[0].url}
                      alt={pub.title}
                      style={{ width: "50px" }}
                    />
                  ) : (
                    "Sin imagen"
                  )}
                </td>
                <td style={styles.td}>{pub.title}</td>
                <td style={styles.td}>{pub.price}</td>
                <td style={styles.td}>{pub.estado}</td>
                <td style={styles.td}>{pub.id}</td>
                <td style={styles.td}>{pub.accountName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: "1000px",
    margin: "20px auto",
    padding: "20px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  title: {
    textAlign: "center",
    color: "#333",
    marginBottom: "20px",
  },
  tabs: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "20px",
  },
  tab: {
    padding: "10px 20px",
    margin: "0 5px",
    backgroundColor: "#f0f0f0",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  activeTab: {
    padding: "10px 20px",
    margin: "0 5px",
    backgroundColor: "#3498db",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  filterContainer: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  filterInput: {
    padding: "8px",
    fontSize: "1em",
    borderRadius: "4px",
    border: "1px solid #ccc",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    border: "1px solid #ddd",
    padding: "8px",
    backgroundColor: "#f2f2f2",
    textAlign: "left",
  },
  td: {
    border: "1px solid #ddd",
    padding: "8px",
  },
};

export default Publicaciones;
