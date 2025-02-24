// Ventas.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Ventas = () => {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");

  // Helper: Obtiene la fecha actual truncada hasta la hora
  const getCurrentHourISOString = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.toISOString().replace("Z", "-00:00");
  };

  // Fecha de inicio fija: 22 de enero de 2023 a las 00:00:00
  const fromDate = "2023-01-22T00:00:00.000-00:00";

  // Función que consulta órdenes para una cuenta específica usando el proxy
  const fetchOrdersForAccount = async (sellerId, nickname) => {
    const toDate = getCurrentHourISOString();
    const proxyUrl = `/api/proxyOrders?seller=${sellerId}&fromDate=${encodeURIComponent(
      fromDate
    )}&toDate=${encodeURIComponent(toDate)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.error(`Error al obtener órdenes para ${nickname}:`, response.status);
        return [];
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error(`Respuesta no JSON para ${nickname}:`, text);
        return [];
      }

      const data = await response.json();
      // Según la documentación, la respuesta debe tener un array "results"
      if (data.results) {
        return data.results.map((order) => ({
          ...order,
          account: nickname,
        }));
      }
      return [];
    } catch (error) {
      console.error(`Error en fetchOrdersForAccount para ${nickname}:`, error);
      return [];
    }
  };

  // Función para consultar todas las órdenes de todas las cuentas conectadas
  const fetchAllOrders = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "mercadolibreUsers"));
      let totalOrders = 0;
      setOrders([]);

      usersSnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        const sellerId = userData.profile?.id;
        const nickname = userData.profile?.nickname || "Sin Nombre";

        if (sellerId) {
          fetchOrdersForAccount(sellerId, nickname)
            .then((newOrders) => {
              if (newOrders.length > 0) {
                setOrders((prevOrders) => [...prevOrders, ...newOrders]);
                totalOrders += newOrders.length;
                setStatus(`Se encontraron ${totalOrders} órdenes desde el 22 de enero.`);
              }
            })
            .catch((error) => {
              console.error(`Error al obtener órdenes para ${nickname}:`, error);
            });
        }
      });
    } catch (error) {
      console.error("Error al obtener cuentas de MercadoLibre:", error);
      setStatus("Error al cargar las órdenes.");
    }
  };

  useEffect(() => {
    fetchAllOrders();
    const intervalId = setInterval(() => {
      fetchAllOrders();
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Ventas - Órdenes desde el 22 de Enero</h1>
      {status && <p style={styles.status}>{status}</p>}
      {orders.length > 0 ? (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID Orden</th>
              <th style={styles.th}>Cuenta</th>
              <th style={styles.th}>Fecha de Creación</th>
              <th style={styles.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} style={styles.tr}>
                <td style={styles.td}>{order.id}</td>
                <td style={styles.td}>{order.account}</td>
                <td style={styles.td}>
                  {order.date_created ? new Date(order.date_created).toLocaleString() : "N/A"}
                </td>
                <td style={styles.td}>{order.status || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={styles.noOrders}>No se encontraron órdenes.</p>
      )}
    </div>
  );
};

const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: "900px",
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
  status: {
    textAlign: "center",
    marginBottom: "10px",
    color: "#333",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    border: "1px solid #ddd",
    padding: "10px",
    backgroundColor: "#f2f2f2",
    textAlign: "left",
  },
  td: {
    border: "1px solid #ddd",
    padding: "10px",
  },
  tr: {
    // Puedes agregar estilos para alternar colores si lo deseas
  },
  noOrders: {
    textAlign: "center",
    marginTop: "20px",
    color: "#555",
  },
};

export default Ventas;
