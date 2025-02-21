import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";

const Publicaciones = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [stateFilter, setStateFilter] = useState("all"); // "all", "active", "paused", "closed"
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Escucha las cuentas conectadas en Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      if (snapshot && snapshot.docs) {
        const acc = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Solo consideramos cuentas con token válido
        const validAccounts = acc.filter(
          (account) => account.token?.access_token
        );
        setAccounts(validAccounts);
        // Seleccionar la primera cuenta si no hay una seleccionada
        if (validAccounts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(validAccounts[0].id);
        }
      }
    });
    return () => unsub();
  }, [selectedAccountId]);

  /**
   * Función para traer TODOS los ítems para una cuenta y un estado usando search_type=scan.
   * Si stateFilter es "all", no se aplica filtro de estado.
   */
  const fetchItemsForAccount = async (account, stateFilter) => {
    setLoading(true);
    const sellerId = account.profile?.id;
    const accessToken = account.token?.access_token;
    if (!sellerId || !accessToken) {
      setLoading(false);
      return [];
    }
    let results = [];
    // Construir la URL base con search_type=scan y un límite de 100
    let url = `https://api.mercadolibre.com/users/${sellerId}/items/search?search_type=scan&limit=100`;
    if (stateFilter !== "all") {
      url += `&status=${stateFilter}`;
    }
    // Bucle para recorrer todos los lotes usando scroll_id
    while (true) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        console.error(
          `Error para seller ${sellerId} con filtro ${stateFilter}: ${response.status}`
        );
        break;
      }
      const data = await response.json();
      results = results.concat(data.results || []);
      if (!data.scroll_id) break; // ya no hay más registros
      // Actualiza la URL para la siguiente llamada usando scroll_id
      url = `https://api.mercadolibre.com/users/${sellerId}/items/search?search_type=scan&limit=100${
        stateFilter !== "all" ? `&status=${stateFilter}` : ""
      }&scroll_id=${encodeURIComponent(data.scroll_id)}`;
    }
    setLoading(false);
    return results;
  };

  // Actualiza los ítems cada vez que cambie la cuenta seleccionada o el filtro de estado
  useEffect(() => {
    const account = accounts.find((acc) => acc.id === selectedAccountId);
    if (account) {
      fetchItemsForAccount(account, stateFilter).then((fetchedItems) => {
        const processedItems = fetchedItems.map((item) => ({
          ...item,
          accountName: account.profile?.nickname || "Sin Nombre",
          estado: item.status || stateFilter,
        }));
        setItems(processedItems);
      });
    } else {
      setItems([]);
    }
  }, [selectedAccountId, stateFilter, accounts]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Gestión de Publicaciones</h1>
      {/* Pestañas de cuentas */}
      <div style={styles.accountTabs}>
        {accounts.length > 1 ? (
          accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setSelectedAccountId(account.id)}
              style={
                account.id === selectedAccountId
                  ? styles.activeAccountTab
                  : styles.accountTab
              }
            >
              {account.profile?.nickname || account.id}
            </button>
          ))
        ) : accounts.length === 1 ? (
          <button style={styles.activeAccountTab}>
            {accounts[0].profile?.nickname || accounts[0].id}
          </button>
        ) : (
          <p>No hay cuentas conectadas</p>
        )}
      </div>
      {/* Pestañas de estado */}
      <div style={styles.stateTabs}>
        {["all", "active", "paused", "closed"].map((state) => (
          <button
            key={state}
            onClick={() => setStateFilter(state)}
            style={
              state === stateFilter ? styles.activeStateTab : styles.stateTab
            }
          >
            {state.charAt(0).toUpperCase() + state.slice(1)}
          </button>
        ))}
      </div>
      {/* Tabla de publicaciones */}
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
            {items.map((pub) => (
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
    marginBottom: "20px",
    color: "#333",
  },
  accountTabs: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "10px",
    flexWrap: "wrap",
    gap: "10px",
  },
  accountTab: {
    padding: "10px 15px",
    backgroundColor: "#eee",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  activeAccountTab: {
    padding: "10px 15px",
    backgroundColor: "#3498db",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  stateTabs: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "20px",
    gap: "10px",
  },
  stateTab: {
    padding: "10px 15px",
    backgroundColor: "#eee",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  activeStateTab: {
    padding: "10px 15px",
    backgroundColor: "#3498db",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
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
