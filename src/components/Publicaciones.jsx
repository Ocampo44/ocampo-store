// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, writeBatch } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  // Estados para cuentas y publicaciones cacheadas
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  
  // Estado para el buscador general y filtros
  const [busqueda, setBusqueda] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterId, setFilterId] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Estado para paginación
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  // 1. Suscripción a la colección "mercadolibreUsers"
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const cuentasTemp = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Cuentas obtenidas:", cuentasTemp);
      setCuentas(cuentasTemp);
    });
    return () => unsub();
  }, []);

  // 2. Suscripción a la colección "publicaciones"
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "publicaciones"), (snapshot) => {
      const pubs = snapshot.docs.map((doc) => doc.data());
      console.log("Publicaciones actuales:", pubs);
      setPublicaciones(pubs);
    });
    return () => unsub();
  }, []);

  // Función para obtener todas las IDs de publicaciones (limit máximo 100)
  const fetchAllItemIDs = async (userId, accessToken) => {
    let offset = 0;
    const limit = 100; // Límite máximo permitido
    let allItemIds = [];
    while (true) {
      const url = `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}&access_token=${accessToken}`;
      console.log("Llamada a URL (IDs):", url);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error("Error al obtener IDs de publicaciones:", resp.status);
        break;
      }
      const data = await resp.json();
      console.log("Respuesta de IDs:", data);
      const itemIds = data.results || [];
      allItemIds = [...allItemIds, ...itemIds];
      offset += limit;
      if (offset >= data.paging.total) break;
    }
    return allItemIds;
  };

  // Función para obtener detalles de ítems en lotes (de 20 en 20)
  const fetchItemDetailsInBatches = async (itemIds, accessToken, nickname, userId) => {
    const batchSize = 20;
    let allDetails = [];
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batchIds = itemIds.slice(i, i + batchSize).join(",");
      const itemsUrl = `https://api.mercadolibre.com/items?ids=${batchIds}&access_token=${accessToken}`;
      console.log("Llamada a URL (detalles):", itemsUrl);
      const itemsResponse = await fetch(itemsUrl);
      if (!itemsResponse.ok) {
        console.error("Error al obtener detalles de publicaciones:", itemsResponse.status);
        continue;
      }
      const itemsData = await itemsResponse.json();
      console.log("Detalles recibidos:", itemsData);
      const validItems = itemsData
        .filter((item) => item.code === 200)
        .map((item) => ({
          ...item.body,             // id, title, price, status, thumbnail, etc.
          userNickname: nickname,   // Agrega el nickname de la cuenta
          accountId: userId,        // Guarda también el ID de la cuenta
        }));
      allDetails = [...allDetails, ...validItems];
    }
    return allDetails;
  };

  // 3. Actualización en segundo plano: Consulta MercadoLibre y guarda en Firestore usando batch writes
  useEffect(() => {
    const updatePublicacionesFromML = async () => {
      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";
        if (!accessToken || !userId) continue;
        try {
          const allItemIds = await fetchAllItemIDs(userId, accessToken);
          console.log(`Cuenta ${cuenta.id} - IDs obtenidos:`, allItemIds);
          if (allItemIds.length === 0) continue;
          
          const detalles = await fetchItemDetailsInBatches(allItemIds, accessToken, nickname, userId);
          console.log(`Cuenta ${cuenta.id} - Detalles obtenidos:`, detalles);
          if (detalles.length === 0) continue;
          
          const batch = writeBatch(db);
          detalles.forEach((pub) => {
            if (!pub.id) {
              console.error("Elemento sin ID:", pub);
              return;
            }
            const pubRef = doc(db, "publicaciones", pub.id);
            batch.set(pubRef, pub, { merge: true });
          });
          await batch.commit();
          console.log(`Cuenta ${cuenta.id} - Batch commit exitoso.`);
        } catch (error) {
          console.error("Error actualizando publicaciones para la cuenta:", cuenta.id, error);
        }
      }
    };
    if (cuentas.length > 0) {
      updatePublicacionesFromML();
    }
  }, [cuentas]);

  // 4. Filtrado de publicaciones
  const publicacionesFiltradas = publicaciones.filter((item) => {
    const title = item.title?.toLowerCase() || "";
    const id = (item.id || "").toLowerCase();
    const cuenta = item.userNickname?.toLowerCase() || "";
    const status = item.status?.toLowerCase() || "";
    return (
      title.includes(filterName.toLowerCase()) &&
      id.includes(filterId.toLowerCase()) &&
      cuenta.includes(filterAccount.toLowerCase()) &&
      status.includes(filterStatus.toLowerCase()) &&
      title.includes(busqueda.toLowerCase())
    );
  });

  // 5. Paginación
  const totalPages = Math.ceil(publicacionesFiltradas.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  const publicacionesEnPagina = publicacionesFiltradas.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>
      
      {/* Buscador general */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setCurrentPage(0);
          }}
          style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
        />
      </div>
      
      {/* Filtros adicionales */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Filtros</h3>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <label>Nombre:</label>
            <input
              type="text"
              placeholder="Filtrar por nombre"
              value={filterName}
              onChange={(e) => {
                setFilterName(e.target.value);
                setCurrentPage(0);
              }}
              style={{ padding: "6px" }}
            />
          </div>
          <div>
            <label>ID:</label>
            <input
              type="text"
              placeholder="Filtrar por ID"
              value={filterId}
              onChange={(e) => {
                setFilterId(e.target.value);
                setCurrentPage(0);
              }}
              style={{ padding: "6px" }}
            />
          </div>
          <div>
            <label>Cuenta:</label>
            <input
              type="text"
              placeholder="Filtrar por cuenta"
              value={filterAccount}
              onChange={(e) => {
                setFilterAccount(e.target.value);
                setCurrentPage(0);
              }}
              style={{ padding: "6px" }}
            />
          </div>
          <div>
            <label>Estado:</label>
            <input
              type="text"
              placeholder="Filtrar por estado"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(0);
              }}
              style={{ padding: "6px" }}
            />
          </div>
        </div>
      </div>

      {/* Lista de publicaciones */}
      {publicacionesEnPagina.length === 0 ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {publicacionesEnPagina.map((pub) => (
            <li
              key={pub.id}
              style={{
                border: "1px solid #ddd",
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <img
                src={pub.thumbnail}
                alt={pub.title}
                style={{ width: "60px", height: "60px", objectFit: "cover" }}
              />
              <div>
                <h3 style={{ margin: "0 0 5px 0" }}>{pub.title}</h3>
                <p style={{ margin: 0 }}>
                  Precio: {pub.price} {pub.currency_id}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Cuenta:</strong> {pub.userNickname}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>ID:</strong> {pub.id}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Estado:</strong> {pub.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Controles de paginación */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
        <button onClick={handlePrevPage} disabled={currentPage === 0}>
          Anterior
        </button>
        <span>
          Página {currentPage + 1} de {totalPages}
        </span>
        <button onClick={handleNextPage} disabled={currentPage === totalPages - 1 || totalPages === 0}>
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default Publicaciones;
