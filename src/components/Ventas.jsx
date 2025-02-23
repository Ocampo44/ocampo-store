// src/components/Ventas.jsx
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Ventas = () => {
  const [accounts, setAccounts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Escucha las cuentas conectadas
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const acc = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAccounts(acc);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      let allOrders = [];

      for (const account of accounts) {
        const token = account.token?.access_token;
        const sellerId = account.profile?.id;
        if (token && sellerId) {
          try {
            // Llamada al endpoint /api/proxy
            const proxyUrl = `/api/proxy?seller=${sellerId}&token=${token}`;
            const response = await fetch(proxyUrl);

            if (response.ok) {
              const data = await response.json();
              if (data.results) {
                allOrders = allOrders.concat(data.results);
              }
            } else {
              console.error(
                `Error al obtener órdenes para el vendedor ${sellerId}:`,
                response.status
              );
            }
          } catch (error) {
            console.error(`Error al obtener órdenes para el vendedor ${sellerId}:`, error);
          }
        }
      }

      setOrders(allOrders);
      setLoading(false);
    };

    if (accounts.length > 0) {
      fetchOrders();
    }
  }, [accounts]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Ventas - Órdenes</h1>
      {loading && <p>Cargando órdenes...</p>}
      {!loading && orders.length === 0 && <p>No se encontraron órdenes.</p>}
      {!loading && orders.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>ID Orden</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>Estado</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>Total</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{order.id}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{order.status}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{order.total_amount}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{order.date_created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Ventas;
