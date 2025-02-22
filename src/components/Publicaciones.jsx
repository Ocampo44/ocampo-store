import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy 
} from "firebase/firestore";

const Publicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    titulo: "",
    account: "",
    publicationId: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50; // Mostrar 50 productos por pestaña

  // Escuchar las cuentas conectadas en Firestore (colección mercadolibreUsers)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "mercadolibreUsers"),
      (snapshot) => {
        if (snapshot && snapshot.docs) {
          const acc = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          // Filtrar cuentas con token válido (activas)
          const activeAccounts = acc.filter(
            (account) => account.token?.access_token
          );
          setAccounts(activeAccounts);
        }
      }
    );
    return () => unsub();
  }, []);

  // Función para guardar o actualizar las publicaciones en Firestore
  const savePublicacionesToDB = async (publicacionesArr) => {
    for (const pub of publicacionesArr) {
      try {
        // Se usa el id de la publicación como id del documento
        await setDoc(
          doc(db, "publicaciones", pub.id.toString()),
          {
            ...pub,
            updatedAt: new Date().toISOString(), // marca de tiempo de actualización
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Error al guardar publicación en DB:", pub.id, error);
      }
    }
  };

  // Función para cargar publicaciones desde Firestore (ordenadas, por ejemplo, por updatedAt)
  const loadPublicacionesFromDB = async () => {
    try {
      const q = query(
        collection(db, "publicaciones"),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const pubs = querySnapshot.docs.map((docSnap) => docSnap.data());
      setPublicaciones(pubs);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error al cargar publicaciones desde DB", error);
    }
  };

  // Función para obtener (y guardar) las publicaciones desde la API
  const fetchPublicaciones = async () => {
    setLoading(true);
    let allPublicaciones = [];
    const limit = 50; // máximo permitido por la API
    for (const account of accounts) {
      // Usamos el id del perfil si existe o el id de la cuenta
      const sellerId = account.profile?.id || account.id;
      const accessToken = account.token?.access_token;
      if (!sellerId || !accessToken) continue;

      try {
        // Usamos el endpoint de usuario para traer todas las publicaciones
        const firstResponse = await fetch(
          `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=${limit}&offset=0&status=all`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        if (!firstResponse.ok) {
          console.error(
            `Error al obtener publicaciones de la cuenta ${account.id}: ${firstResponse.status}`
          );
          continue;
        }
        const firstData = await firstResponse.json();
        const total = firstData.paging?.total || 0;
        console.log(`Cuenta ${account.id} - Total publicaciones: ${total}`);
        let offset = 0;

        while (offset < total) {
          const pagedResponse = await fetch(
            `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=${limit}&offset=${offset}&status=all`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          if (!pagedResponse.ok) {
            console.error(
              `Error al obtener publicaciones (offset: ${offset}) para la cuenta ${account.id}: ${pagedResponse.status}`
            );
            break;
          }
          const pagedData = await pagedResponse.json();
          let pagedResults = pagedData.results || [];
          pagedResults = pagedResults.map((item) => ({
            ...item,
            estado: item.status || "active", // usa el status que retorna la API o define uno por defecto
            accountName: account.profile?.nickname || "Sin Nombre",
          }));
          allPublicaciones = allPublicaciones.concat(pagedResults);
          offset += limit;
        }
      } catch (error) {
        console.error(
          "Error al obtener publicaciones para la cuenta",
          account.id,
          error
        );
      }
    }
    // Guardar o actualizar en Firestore
    await savePublicacionesToDB(allPublicaciones);
    // Luego, recargar desde la DB (esto te permite ver nuevas publicaciones o actualizaciones)
    await loadPublicacionesFromDB();
    setLoading(false);
  };

  // Manejo de filtros para buscar por título, cuenta o ID
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Reinicia la paginación al filtrar
  };

  // Filtrar las publicaciones según los filtros aplicados
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

  // Paginación en la UI (50 items por pestaña)
  const totalPages = Math.ceil(filteredPublicaciones.length / pageSize);
  const paginatedPublicaciones = filteredPublicaciones.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Publicaciones de Usuarios Activos</h1>
      <button onClick={fetchPublicaciones} style={styles.fetchButton}>
        Traer Publicaciones (Nuevos)
      </button>
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
        <>
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
              {paginatedPublicaciones.map((pub) => (
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
          <div style={styles.pagination}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={styles.pageButton}
            >
              Anterior
            </button>
            <span style={styles.pageInfo}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={styles.pageButton}
            >
              Siguiente
            </button>
          </div>
        </>
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
  fetchButton: {
    display: "block",
    margin: "0 auto 20px auto",
    padding: "10px 20px",
    fontSize: "1em",
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
    marginBottom: "20px",
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
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "15px",
    marginTop: "20px",
  },
  pageButton: {
    padding: "8px 12px",
    fontSize: "1em",
    backgroundColor: "#3498db",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  pageInfo: {
    fontSize: "1em",
  },
};

export default Publicaciones;
