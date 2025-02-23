// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  
  // Para la paginación en la interfaz
  const [currentPage, setCurrentPage] = useState(0); 
  const pageSize = 20; // Cantidad de publicaciones por página en la UI

  // 1. Escuchar cambios en Firestore para obtener las cuentas con token
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

  // Función auxiliar para obtener **todas** las IDs de publicaciones de un usuario, paginando
  const fetchAllItemIDs = async (userId, accessToken) => {
    let offset = 0;
    const limit = 50;
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
      // Si ya alcanzamos o pasamos el total, salimos
      if (offset >= data.paging.total) {
        break;
      }
    }

    return allItemIds;
  };

  // Función auxiliar para obtener los detalles de ítems en lotes de 20
  const fetchItemDetailsInBatches = async (itemIds, accessToken, nickname) => {
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

      // Retorna un array: [{ code: 200, body: { ...itemData }}, ...]
      const itemsData = await itemsResponse.json();

      // Filtramos solo los que tienen code=200 (peticiones exitosas)
      const validItems = itemsData
        .filter((item) => item.code === 200)
        .map((item) => ({
          ...item.body,             // Incluye id, title, price, status, thumbnail, etc.
          userNickname: nickname,   // Agregamos el nickname de la cuenta
        }));

      allDetails = [...allDetails, ...validItems];
    }

    return allDetails;
  };

  // 2. Para cada cuenta, obtener TODAS las IDs (paginando), 
  //    luego el detalle de cada ítem y guardarlo en "publicaciones".
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let todasLasPublicaciones = [];

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue; // si faltan datos, pasar a la siguiente cuenta

        try {
          // 2a. Obtener TODAS las IDs de las publicaciones, paginando de 50 en 50
          const allItemIds = await fetchAllItemIDs(userId, accessToken);

          if (allItemIds.length === 0) continue;

          // 2b. Obtener los detalles de todos esos ítems en lotes de 20
          const detalles = await fetchItemDetailsInBatches(allItemIds, accessToken, nickname);

          // Agregamos estos ítems al array general
          todasLasPublicaciones = [...todasLasPublicaciones, ...detalles];
        } catch (error) {
          console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }

      setPublicaciones(todasLasPublicaciones);
      setCurrentPage(0); // resetear la página a 0 cada vez que se recarga la data
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // 3. Filtrar las publicaciones según el texto ingresado
  const publicacionesFiltradas = publicaciones.filter((item) => {
    const titulo = item.title?.toLowerCase() || "";
    return titulo.includes(busqueda.toLowerCase());
  });

  // 4. Paginación en la UI
  const totalPages = Math.ceil(publicacionesFiltradas.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  const publicacionesEnPagina = publicacionesFiltradas.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((prev) => prev + 1);
    }
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
            setCurrentPage(0); // Volver a la primera página si se cambia el filtro
          }}
          style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
        />
      </div>

      {/* Lista paginada */}
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
              {/* Imagen */}
              <img
                src={pub.thumbnail}
                alt={pub.title}
                style={{ width: "60px", height: "60px", objectFit: "cover" }}
              />

              {/* Información del ítem */}
              <div>
                <h3 style={{ margin: "0 0 5px 0" }}>{pub.title}</h3>
                <p style={{ margin: 0 }}>
                  Precio: {pub.price} {pub.currency_id}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Cuenta:</strong> {pub.userNickname}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>ID de la publicación:</strong> {pub.id}
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
        <button onClick={handleNextPage} disabled={currentPage === totalPages - 1}>
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default Publicaciones;
