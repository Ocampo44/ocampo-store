import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  getDocs,
  query,
  orderBy,
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
  const pageSize = 50; // 50 ítems por página

  // Estados que se consultarán (según la documentación de MercadoLibre)
  const estados = [
    "active",
    "pending",
    "not_yet_active",
    "programmed",
    "paused",
    "closed",
  ];

  // Escucha la colección de mercadolibreUsers en Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "mercadolibreUsers"),
      (snapshot) => {
        if (snapshot && snapshot.docs) {
          const acc = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          console.log("Cuentas obtenidas:", acc.length);
          // Solo usamos las cuentas con token válido
          const activeAccounts = acc.filter(
            (account) => account.token?.access_token
          );
          console.log("Cuentas activas:", activeAccounts.length);
          setAccounts(activeAccounts);
        }
      }
    );
    return () => unsub();
  }, []);

  // Función para guardar o actualizar ítems en Firestore
  const savePublicacionesToDB = async (publicacionesArr) => {
    console.log("Guardando publicaciones en DB:", publicacionesArr.length);
    for (const pub of publicacionesArr) {
      if (!pub.id) {
        console.warn("Ítem sin ID:", pub);
        continue;
      }
      try {
        await setDoc(
          doc(db, "publicaciones", pub.id.toString()),
          {
            ...pub,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        console.log(`Ítem ${pub.id} guardado correctamente.`);
      } catch (error) {
        console.error("Error al guardar ítem en DB:", pub.id, error);
      }
    }
  };

  // Función para cargar los ítems desde Firestore
  const loadPublicacionesFromDB = async () => {
    try {
      const q = query(
        collection(db, "publicaciones"),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const pubs = querySnapshot.docs.map((docSnap) => docSnap.data());
      console.log("Ítems cargados desde DB:", pubs.length);
      setPublicaciones(pubs);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error al cargar ítems desde DB", error);
    }
  };

  // Función para obtener ítems usando el endpoint /users/$USER_ID/items/search para cada estado
  const fetchPublicaciones = async () => {
    setLoading(true);
    let allPublicaciones = [];
    const limit = 50; // límite máximo permitido por la API

    for (const account of accounts) {
      // Usamos el ID de perfil o el ID de la cuenta
      const userId = account.profile?.id || account.id;
      const accessToken = account.token?.access_token;
      if (!userId || !accessToken) {
        console.warn("Cuenta sin userId o token:", account);
        continue;
      }

      // Para cada estado definido, consultamos las publicaciones
      for (const estado of estados) {
        try {
          console.log(
            `Consultando ítems para el usuario ${userId} con estado: ${estado}`
          );
          // Consulta inicial para obtener el total de ítems en ese estado
          const firstResponse = await fetch(
            `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=0&status=${estado}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (!firstResponse.ok) {
            console.error(
              `Error al obtener ítems para ${userId} con estado ${estado}: ${firstResponse.status}`
            );
            continue;
          }
          const firstData = await firstResponse.json();
          const total = firstData.paging?.total || 0;
          console.log(`Usuario ${userId} - Estado ${estado}: Total ítems: ${total}`);
          let offset = 0;
          if (total === 0) {
            console.warn(`No se encontraron ítems para ${userId} con estado ${estado}`);
          }
          while (offset < total) {
            const pagedResponse = await fetch(
              `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}&status=${estado}`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            if (!pagedResponse.ok) {
              console.error(
                `Error (offset ${offset}) para ${userId} con estado ${estado}: ${pagedResponse.status}`
              );
              break;
            }
            const pagedData = await pagedResponse.json();
            const pagedResults = pagedData.results || [];
            console.log(
              `Usuario ${userId} - Estado ${estado}: Offset ${offset}: ${pagedResults.length} ítems`
            );
            // Agregamos información adicional a cada ítem (por ejemplo, el estado y el nombre de la cuenta)
            const mappedResults = pagedResults.map((item) => ({
              ...item,
              estado: estado,
              accountName: account.profile?.nickname || "Sin Nombre",
            }));
            allPublicaciones = allPublicaciones.concat(mappedResults);
            offset += limit;
          }
        } catch (error) {
          console.error(
            "Error consultando ítems para el usuario",
            userId,
            "con estado",
            estado,
            error
          );
        }
      }
    }
    console.log("Total ítems obtenidos:", allPublicaciones.length);
    await savePublicacionesToDB(allPublicaciones);
    await loadPublicacionesFromDB();
    setLoading(false);
  };

  // Manejo de filtros en la UI
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
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
      <h1 style={styles.title}>Publicaciones Completas (Todos los estados)</h1>
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
          placeholder="Buscar por cuenta"
          value={filters.account}
          onChange={handleFilterChange}
          style={styles.filterInput}
        />
        <input
          type="text"
          name="publicationId"
          placeholder="Buscar por ID"
          value={filters.publicationId}
          onChange={handleFilterChange}
          style={styles.filterInput}
        />
      </div>
      {loading ? (
        <p>Cargando ítems...</p>
      ) : (
        <>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Imagen</th>
                <th style={styles.th}>Título</th>
                <th style={styles.th}>Precio</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>ID Ítem</th>
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
