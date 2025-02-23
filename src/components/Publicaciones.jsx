// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  // Estados para cuentas y publicaciones cacheadas
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  
  // Estado para el buscador general (por nombre)
  const [busqueda, setBusqueda] = useState("");
  
  // Estados para filtros individuales
  const [filterName, setFilterName] = useState("");
  const [filterId, setFilterId] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Estado para paginación en la UI
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20; // Cantidad de publicaciones por página

  // 1. Suscribirse a la colección "mercadolibreUsers" para obtener las cuentas conectadas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const cuentasTemp = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCuentas(cuentasTemp);
    });
    return () => unsub();
  }, []);

  // 2. Suscribirse a la colección "publicaciones" (cacheadas)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "publicaciones"), (snapshot) => {
      const pubs = snapshot.docs.map((doc) => doc.data());
      setPublicaciones(pubs);
    });
    return () => unsub();
  }, []);

  // Función para obtener todas las IDs de publicaciones (utilizando un límite máximo de 100)
  const fetchAllItemIDs = async (userId, accessToken) => {
    let offset = 0;
    const limit = 100; // Se establece un límite máximo de 100 items por solicitud
    let allItemIds = [];
    while (true) {
      const url = `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}&access_token=${accessToken}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error("Error al obtener IDs de publicaciones:", resp.status);
        break;
      }
      const data = await resp.json();
      const itemIds = data.results || [];
      allItemIds = [...allItemIds, ...itemIds];
      offset += limit;
      if (offset >= data.paging.total) break;
    }
    return allItemIds;
  };

  // Función para obtener el detalle de los ítems en lotes de 20
  const fetchItemDetailsInBatches = async (itemIds, accessToken, nickname, userId) => {
    const batchSize = 20;
    let allDetails = [];
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batchIds = itemIds.slice(i, i + batchSize).join(",");
      const itemsUrl = `https://api.mercadolibre.com/items?ids=${batchIds}&access_token=${accessToken}`;
      const itemsResponse = await fetch(itemsUrl);
      if (!itemsResponse.ok) {
        console.error("Error al obtener detalles de publicaciones:", itemsResponse.status);
        continue;
      }
      // La respuesta es un array: [{ code, body: { ...itemData } }, ...]
      const itemsData = await itemsResponse.json();
      const validItems = itemsData
        .filter((item) => item.code === 200)
        .map((item) => ({
          ...item.body,             // Incluye id, title, price, status, thumbnail, etc.
          userNickname: nickname,   // Agrega el nickname de la cuenta
          accountId: userId,        // Guarda también el ID de la cuenta
        }));
      allDetails = [...allDetails, ...validItems];
    }
    return allDetails;
  };

  // 3. Actualización en segundo plano: Consulta MercadoLibre y actualiza Firestore
  useEffect(() => {
    const updatePublicacionesFromML = async () => {
      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";
        if (!accessToken || !userId) continue;
        try {
          // Obtener todas las IDs de publicaciones (según lo permitido por la API)
          const allItemIds = await fetchAllItemIDs(userId, accessToken);
          if (allItemIds.length === 0) continue;
          // Obtener los detalles de los ítems en lotes
          const detalles = await fetchItemDetailsInBatches(allItemIds, accessToken, nickname, userId);
          if (detalles.length === 0) continue;
          // Actualizar (o crear) los documentos en Firestore utilizando batch writes para minimizar las operaciones individuales
          const batch = writeBatch(db);
          detalles.forEach((pub) => {
            const pubRef = doc(db, "publicaciones", pub.id);
            batch.set(pubRef, pub, { merge: true });
          });
          await batch.commit();
        } catch (error) {
          console.error("Error actualizando publicaciones para la cuenta:", cuenta.id, error);
        }
      }
    };
    if (cuentas.length > 0) {
      // Ejecuta la actualización en segundo plano sin interrumpir la experiencia del usuario
      updatePublicacionesFromML();
    }
  }, [cuentas]);

  // 4. Filtrado: Se filtran las publicaciones según los filtros ingresados
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

  // 5. Paginación en la UI
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

      {/* Lista de publicaciones con paginación */}
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
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          marginTop: "20px",
        }}
      >
        <button onClick={handlePrevPage} disabled={currentPage === 0}>
          Anterior
        </button>
        <span>
          Página {currentPage + 1} de {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages - 1 || totalPages === 0}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default Publicaciones;
