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
  const [products, setProducts] = useState([]); // Publicaciones (todos los ítems)
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    title: "",
    family: "",
    productId: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50; // 50 ítems por página

  // Escucha las cuentas conectadas en Firestore (colección mercadolibreUsers)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      if (snapshot && snapshot.docs) {
        const acc = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        // Filtramos cuentas con token válido
        const validAccounts = acc.filter((account) => account.token?.access_token);
        setAccounts(validAccounts);
      }
    });
    return () => unsub();
  }, []);

  // Guarda o actualiza las publicaciones en Firestore (colección userProducts)
  const saveProductsToDB = async (productsArr) => {
    console.log("Guardando publicaciones en DB:", productsArr.length);
    for (const prod of productsArr) {
      if (!prod.id) {
        console.warn("Ítem sin ID:", prod);
        continue;
      }
      try {
        await setDoc(
          doc(db, "userProducts", prod.id.toString()),
          {
            ...prod,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        console.log(`Ítem ${prod.id} guardado correctamente.`);
      } catch (error) {
        console.error("Error al guardar ítem en DB:", prod.id, error);
      }
    }
  };

  // Carga las publicaciones guardadas en Firestore
  const loadProductsFromDB = async () => {
    try {
      const q = query(collection(db, "userProducts"), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const prods = querySnapshot.docs.map((docSnap) => docSnap.data());
      console.log("Publicaciones cargadas desde DB:", prods.length);
      setProducts(prods);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error al cargar publicaciones desde DB", error);
    }
  };

  // Función para obtener las publicaciones utilizando el endpoint de User Products
  // Se consulta /users/$USER_ID/items/search con include_filters=true, search_type=scan y status=all.
  // Se eliminó el filtrado por family_name para traer TODOS los ítems, sin importar el status.
  const fetchUserProducts = async () => {
    setLoading(true);
    let allProducts = [];
    const limit = 50; // límite máximo permitido por la API
    // Parámetros adicionales para incluir filtros, escanear más de 1000 registros y traer todos los status
    const additionalParams = "&include_filters=true&search_type=scan&status=all";

    for (const account of accounts) {
      // Se utiliza el ID de perfil o el ID de la cuenta
      const userId = account.profile?.id || account.id;
      const accessToken = account.token?.access_token;
      if (!userId || !accessToken) {
        console.warn("Cuenta sin userId o token:", account);
        continue;
      }
      try {
        console.log(`Consultando publicaciones para el usuario ${userId}`);
        let offset = 0;
        // Primera llamada para conocer el total de ítems publicados
        const firstResponse = await fetch(
          `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}${additionalParams}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!firstResponse.ok) {
          console.error(
            `Error al obtener publicaciones para el usuario ${userId}: ${firstResponse.status}`
          );
          continue;
        }
        const firstData = await firstResponse.json();
        const total = firstData.paging?.total || 0;
        console.log(`Usuario ${userId}: total ítems: ${total}`);
        while (offset < total) {
          const response = await fetch(
            `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}${additionalParams}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (!response.ok) {
            console.error(
              `Error (offset ${offset}) para el usuario ${userId}: ${response.status}`
            );
            break;
          }
          const data = await response.json();
          let results = data.results || [];
          // Se elimina el filtrado por family_name para incluir todos los ítems
          // results = results.filter((item) => item.family_name != null);
          // Agregamos información adicional, como el nombre de la cuenta
          const mapped = results.map((item) => ({
            ...item,
            accountName: account.profile?.nickname || "Sin Nombre",
          }));
          allProducts = allProducts.concat(mapped);
          offset += limit;
        }
      } catch (error) {
        console.error("Error consultando publicaciones para el usuario", userId, error);
      }
    }
    console.log("Total de publicaciones obtenidas:", allProducts.length);
    await saveProductsToDB(allProducts);
    await loadProductsFromDB();
    setLoading(false);
  };

  // Manejo de filtros en la UI
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const filteredProducts = products.filter((prod) => {
    const matchesTitle = prod.title
      ?.toLowerCase()
      .includes(filters.title.toLowerCase());
    const matchesFamily = prod.family_name
      ?.toLowerCase()
      .includes(filters.family.toLowerCase());
    const matchesId = prod.id?.toString().includes(filters.productId);
    return matchesTitle && matchesFamily && matchesId;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>
        Publicaciones (Todos los ítems de MercadoLibre sin importar su status)
      </h1>
      <button onClick={fetchUserProducts} style={styles.fetchButton}>
        Traer Publicaciones (Todos)
      </button>
      <div style={styles.filterContainer}>
        <input
          type="text"
          name="title"
          placeholder="Buscar por título"
          value={filters.title}
          onChange={handleFilterChange}
          style={styles.filterInput}
        />
        <input
          type="text"
          name="family"
          placeholder="Buscar por Family Name"
          value={filters.family}
          onChange={handleFilterChange}
          style={styles.filterInput}
        />
        <input
          type="text"
          name="productId"
          placeholder="Buscar por ID"
          value={filters.productId}
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
                <th style={styles.th}>Family Name</th>
                <th style={styles.th}>ID Ítem</th>
                <th style={styles.th}>Cuenta</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((prod) => (
                <tr key={prod.id}>
                  <td style={styles.td}>
                    {prod.pictures && prod.pictures.length > 0 ? (
                      <img
                        src={prod.pictures[0].url}
                        alt={prod.title}
                        style={{ width: "50px" }}
                      />
                    ) : (
                      "Sin imagen"
                    )}
                  </td>
                  <td style={styles.td}>{prod.title}</td>
                  <td style={styles.td}>{prod.price}</td>
                  <td style={styles.td}>{prod.family_name}</td>
                  <td style={styles.td}>{prod.id}</td>
                  <td style={styles.td}>{prod.accountName}</td>
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
