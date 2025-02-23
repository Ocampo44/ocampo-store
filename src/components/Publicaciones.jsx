// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  // Estado para las cuentas conectadas (mercadolibreUsers)
  const [cuentas, setCuentas] = useState([]);
  // Estado para las publicaciones cacheadas en Firestore
  const [publicaciones, setPublicaciones] = useState([]);
  // Estado para el buscador
  const [busqueda, setBusqueda] = useState("");

  // Estados opcionales para filtrar por fecha (si deseas segmentar la consulta)
  const [desde, setDesde] = useState(""); // Ejemplo: "2021-01-01"
  const [hasta, setHasta] = useState(""); // Ejemplo: "2021-12-31"

  // Para paginación en la UI
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20; // Cantidad de publicaciones mostradas por página

  // 1. Suscripción a la colección de cuentas de MercadoLibre
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

  // 2. Suscripción a la colección "publicaciones" (cacheadas)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "publicaciones"), (snapshot) => {
      const pubs = snapshot.docs.map((doc) => doc.data());
      setPublicaciones(pubs);
    });
    return () => unsub();
  }, []);

  // Función para obtener todas las IDs de publicaciones de un usuario (paginar)
  const fetchAllItemIDs = async (userId, accessToken, desde, hasta) => {
    let offset = 0;
    const limit = 50;
    let allItemIds = [];
    // Si se establecen fechas, se asume que el endpoint acepta un filtro (ver documentación)
    let dateFilter = "";
    if (desde && hasta) {
      dateFilter = `&date_created=${desde},${hasta}`;
    }
    while (true) {
      const url = `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}&access_token=${accessToken}${dateFilter}`;
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

  // Función para obtener el detalle de los ítems en lotes (batch de 20)
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
          userNickname: nickname,   // Agregamos el nickname de la cuenta
          accountId: userId,        // Puedes guardar también el ID de la cuenta
        }));
      allDetails = [...allDetails, ...validItems];
    }
    return allDetails;
  };

  // 3. Actualización en segundo plano: Buscar nuevas publicaciones en MercadoLibre y actualizar Firestore
  useEffect(() => {
    const updatePublicacionesFromML = async () => {
      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";
        if (!accessToken || !userId) continue;

        try {
          // Se obtienen todas las IDs (según lo permitido por la API)
          const allItemIds = await fetchAllItemIDs(userId, accessToken, desde, hasta);
          if (allItemIds.length === 0) continue;
          // Se obtienen los detalles de los ítems en lotes
          const detalles = await fetchItemDetailsInBatches(allItemIds, accessToken, nickname, userId);
          // Se actualiza cada publicación en Firestore (si ya existe, se actualiza; si no, se crea)
          for (const pub of detalles) {
            await setDoc(doc(db, "publicaciones", pub.id), pub, { merge: true });
          }
        } catch (error) {
          console.error("Error actualizando publicaciones para la cuenta:", cuenta.id, error);
        }
      }
    };

    if (cuentas.length > 0) {
      // Ejecuta la actualización en segundo plano
      updatePublicacionesFromML();
    }
  }, [cuentas, desde, hasta]);

  // 4. Filtrado de publicaciones según el texto ingresado
  const publicacionesFiltradas = publicaciones.filter((item) => {
    const titulo = item.title?.toLowerCase() || "";
    return titulo.includes(busqueda.toLowerCase());
  });

  // 5. Paginación en la interfaz
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

      {/* Buscador */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Buscar ítems..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setCurrentPage(0);
          }}
          style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
        />
      </div>

      {/* Filtros por fecha (opcional) */}
      <div style={{ marginBottom: "10px" }}>
        <label>
          Desde:{" "}
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label style={{ marginLeft: "20px" }}>
          Hasta:{" "}
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
      </div>

      {/* Lista de publicaciones (obtenidas de Firestore) con paginación */}
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
