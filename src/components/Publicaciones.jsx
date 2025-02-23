// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, writeBatch, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Función auxiliar para dividir un array en trozos
const chunkArray = (array, chunkSize) => {
  const results = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
};

// Función para limpiar/sanitizar los datos de la publicación,
// extrayendo sólo las propiedades necesarias.
const sanitizePublication = (pub, nickname, userId) => {
  return {
    id: pub.id,
    title: pub.title,
    price: pub.price,
    status: pub.status,
    thumbnail: pub.thumbnail, // Se revisa la URL al renderizar la imagen
    currency_id: pub.currency_id,
    userNickname: nickname,
    accountId: userId,
  };
};

// Función para introducir retardo (en milisegundos)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para comparar si dos publicaciones son diferentes
const hasPublicationChanged = (oldPub, newPub) => {
  // Aquí se comparan los campos que nos interesan
  return (
    oldPub.title !== newPub.title ||
    oldPub.price !== newPub.price ||
    oldPub.status !== newPub.status ||
    oldPub.thumbnail !== newPub.thumbnail ||
    oldPub.currency_id !== newPub.currency_id
  );
};

const Publicaciones = () => {
  // Estados para cuentas y publicaciones cacheadas
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  
  // Estados para buscador y filtros
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

  // Función para obtener todas las IDs de publicaciones (límite máximo 100)
  const fetchAllItemIDs = async (userId, accessToken) => {
    let offset = 0;
    const limit = 100;
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
        .map((item) => sanitizePublication(item.body, nickname, userId));
      allDetails = [...allDetails, ...validItems];
    }
    return allDetails;
  };

  // 3. Actualización en segundo plano: consulta MercadoLibre y actualiza Firestore
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
          console.log(`Cuenta ${cuenta.id} - Detalles obtenidos (sanitizados):`, detalles);
          if (detalles.length === 0) continue;
          
          // Dividir los detalles en batches pequeños (5 documentos por batch)
          const chunks = chunkArray(detalles, 5);
          for (const [index, chunk] of chunks.entries()) {
            const batch = writeBatch(db);
            for (const pub of chunk) {
              if (!pub.id) {
                console.error("Elemento sin ID:", pub);
                continue;
              }
              const pubRef = doc(db, "publicaciones", pub.id);
              // Opcional: comprobar si existe y si ha cambiado para actualizar sólo cuando sea necesario
              const docSnap = await getDoc(pubRef);
              if (docSnap.exists()) {
                const existingData = docSnap.data();
                if (!hasPublicationChanged(existingData, pub)) {
                  // No hay cambios, omitir la escritura
                  continue;
                }
              }
              batch.set(pubRef, pub, { merge: true });
            }
            // Commit del batch solo si contiene escrituras
            if (!batch._writes || batch._writes.length === 0) {
              console.log(`Cuenta ${cuenta.id} - Batch ${index + 1} sin cambios, se omite commit.`);
            } else {
              await batch.commit();
              console.log(`Cuenta ${cuenta.id} - Batch ${index + 1} commit exitoso.`);
            }
            // Espera 1000ms entre batch commits para reducir la carga
            await sleep(1000);
          }
        } catch (error) {
          console.error("Error actualizando publicaciones para la cuenta:", cuenta.id, error);
        }
      }
    };
    // Para evitar actualizaciones excesivas, se puede programar la actualización cada cierto tiempo
    if (cuentas.length > 0) {
      updatePublicacionesFromML();
      // Ejemplo: repetir cada 10 minutos (600000 ms)
      const interval = setInterval(updatePublicacionesFromML, 600000);
      return () => clearInterval(interval);
    }
  }, [cuentas]);

  // 4. Filtrado de publicaciones para la vista
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
          {publicacionesEnPagina.map((pub) => {
            // Forzar HTTPS en la URL de la imagen, si es necesario
            const secureThumbnail =
              pub.thumbnail && pub.thumbnail.startsWith("http://")
                ? pub.thumbnail.replace(/^http:\/\//i, "https://")
                : pub.thumbnail;
            return (
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
                  src={secureThumbnail}
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
            );
          })}
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
