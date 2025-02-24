// src/components/Ventas.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Ventas = () => {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");

  // Función que consulta órdenes para una cuenta específica
  const fetchOrdersForAccount = async (accessToken, sellerId, nickname) => {
    // Se actualiza la fecha a formato ISO con "Z" (UTC)
    const fromDate = "2023-01-22T00:00:00.000Z";
    // Se recomienda convertir el sellerId a string si es numérico
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${sellerId.toString()}&order.date_created.from=${encodeURIComponent(
      fromDate
    )}&order.status=paid&sort=date_desc`;
    
    try {
      const response = await fetch(ordersUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      // Log para ver el status de la respuesta
      console.log(`Respuesta para ${nickname}:`, response.status);
      
      if (!response.ok) {
        console.error(`Error al obtener órdenes para ${nickname}:`, response.status);
        return [];
      }
      
      const data = await response.json();
      // Log para inspeccionar la respuesta completa
      console.log(`Datos recibidos para ${nickname}:`, data);
      
      if (data.results && data.results.length > 0) {
        // Se asocia la cuenta (nickname) a cada orden para diferenciarlas
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
      const ordersPromises = [];
      usersSnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        const accessToken = userData.token?.access_token;
        const sellerId = userData.profile?.id; // Se asume que el id del vendedor es el id del perfil
        const nickname = userData.profile?.nickname || "Sin Nombre";
        if (accessToken && sellerId) {
          ordersPromises.push(fetchOrdersForAccount(accessToken, sellerId, nickname));
        } else {
          console.warn(`Cuenta sin token o sellerId para ${nickname}`);
        }
      });

      const ordersPerAccount = await Promise.all(ordersPromises);
      const allOrders = ordersPerAccount.flat();
      setOrders(allOrders);
      setStatus(`Se encontraron ${allOrders.length} órdenes desde el 22 de enero.`);
    } catch (error) {
      console.error("Error al obtener cuentas de MercadoLibre:", error);
      setStatus("Error al cargar las órdenes.");
    }
  };

  useEffect(() => {
    fetchAllOrders();
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
    // Opcional: alternar colores de fondo para mayor legibilidad
  },
  noOrders: {
    textAlign: "center",
    marginTop: "20px",
    color: "#555",
  },
};

export default Ventas;
