// src/components/Ventas.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';

const Ventas = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Recuperar las cuentas de MercadoLibre desde Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const acc = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAccounts(acc);
    });
    return () => unsub();
  }, []);

  // Obtener las ventas de la cuenta seleccionada
  useEffect(() => {
    if (!selectedAccount) return;
    
    // Buscar la cuenta y obtener su token
    const account = accounts.find(acc => acc.id === selectedAccount);
    if (!account || !account.token || !account.token.access_token) return;

    const fetchSales = async () => {
      setLoading(true);
      try {
        // Endpoint para buscar órdenes del vendedor
        let url = `https://api.mercadolibre.com/orders/search?seller=${selectedAccount}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${account.token.access_token}`
          }
        });
        if (!response.ok) {
          console.error('Error al obtener ventas:', response.status);
          setLoading(false);
          return;
        }
        const data = await response.json();
        let results = data.results || [];
        // Filtrado local por estado si no es "all"
        if (statusFilter !== 'all') {
          results = results.filter(sale => sale.status === statusFilter);
        }
        // Actualiza el estado para que se muestren las ventas
        setSales(results);
      } catch (error) {
        console.error('Error al obtener ventas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [selectedAccount, statusFilter, accounts]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Ventas</h1>
      <div className="flex gap-4 mb-4">
        <div>
          <label className="block mb-1 font-medium">Cuenta MercadoLibre</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Seleccione una cuenta</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.profile?.nickname || acc.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Estado de venta</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="all">Todas</option>
            <option value="paid">Pagada</option>
            <option value="refunded">Reembolsada</option>
            <option value="approved">Aprobada</option>
            {/* Agrega más opciones según los estados disponibles */}
          </select>
        </div>
      </div>
      {loading ? (
        <p>Cargando ventas...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">ID Pedido</th>
                <th className="py-2 px-4 border-b">Comprador</th>
                <th className="py-2 px-4 border-b">Monto Total</th>
                <th className="py-2 px-4 border-b">Estado</th>
                <th className="py-2 px-4 border-b">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {sales.length > 0 ? (
                sales.map((sale) => (
                  <tr key={sale.id} className="text-center">
                    <td className="py-2 px-4 border-b">{sale.id}</td>
                    <td className="py-2 px-4 border-b">
                      {sale.buyer ? sale.buyer.nickname : 'N/A'}
                    </td>
                    <td className="py-2 px-4 border-b">{sale.total_amount}</td>
                    <td className="py-2 px-4 border-b">{sale.status}</td>
                    <td className="py-2 px-4 border-b">
                      {new Date(sale.date_created).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-2 px-4 border-b text-center" colSpan="5">
                    No se encontraron ventas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Ventas;
