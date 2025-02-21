import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";

const Publicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    titulo: "",
    account: "",
    publicationId: "",
    estado: "",
  });

  // Escuchar las cuentas conectadas en Firestore
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

  // Obtener las publicaciones para cada cuenta conectada
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let allPublicaciones = [];
      for (const account of accounts) {
        const userId = account.profile?.id || account.id;
        const accessToken = account.token?.access_token;
        if (!userId || !accessToken) continue;

        try {
          // Realizar llamadas para publicaciones activas e inactivas
          const [activeRes, inactiveRes] = await Promise.all([
            fetch(
              `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&status=active`
            ),
            fetch(
              `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&status=inactive`
            ),
          ]);
          const activeData = await activeRes.json();
          const inactiveData = await inactiveRes.json();

          const activePublicaciones = (activeData.results || []).map((item) => ({
            ...item,
            estado: "active",
            accountName: account.profile?.nickname || "Sin Nombre",
          }));
          const inactivePublicaciones = (inactiveData.results || []).map((item) => ({
            ...item,
            estado: "inactive",
            accountName: account.profile?.nickname || "Sin Nombre",
          }));

          allPublicaciones = allPublicaciones.concat(activePublicaciones, inactivePublicaciones);
        } catch (error) {
          console.error("Error al obtener publicaciones para la cuenta", account.id, error);
        }
      }
      setPublicaciones(allPublicaciones);
      setLoading(false);
    };

    if (accounts.length > 0) {
      fetchPublicaciones();
    } else {
      // Si no hay cuentas conectadas, detenemos la carga.
      setLoading(false);
    }
  }, [accounts]);

  // Manejar el cambio en los filtros
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Filtrar las publicaciones según los criterios seleccionados
  const filteredPublicaciones = publicaciones.filter((pub) => {
    const matchesTitulo = pub.title?.toLowerCase().includes(filters.titulo.toLowerCase());
    const matchesAccount = pub.accountName?.toLowerCase().includes(filters.account.toLowerCase());
    const matchesId = pub.id?.toString().includes(filters.publicationId);
    const matchesEstado = filters.estado ? pub.estado === filters.estado : true;
    return matchesTitulo && matchesAccount && matchesId && matchesEstado;
  });

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Publicaciones</h1>
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
        <select
          name="estado"
          value={filters.estado}
          onChange={handleFilterChange}
          style={styles.filterInput}
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
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
                    <img src={pub.pictures[0].url} alt={pub.title} style={{ width: "50px" }} />
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
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  title: {
    textAlign: "center",
    color: "#333",
    marginBottom: "20px",
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
