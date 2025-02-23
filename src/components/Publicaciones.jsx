// src/components/Publicaciones.jsx
import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  // Estados para cuentas y publicaciones cacheadas
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  
  // Estado para el buscador general (por nombre)
  const [busqueda, setBusqueda] = useState("");
  
  // Estados para filtros individuales (nombre, ID) y para filtros por desplegable en Cuenta y Estado
  const [filterName, setFilterName] = useState("");
  const [filterId, setFilterId] = useState("");
  const [filterAccount, setFilterAccount] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");

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

  // Función para obtener todas las IDs de publicaciones de un usuario, paginando y aceptando rangos de fecha
  // Si se pasan 'desde' y 'hasta', se incluyen en la consulta; de lo contrario, se omiten.
  const fetchAllItemIDs = async (userId, accessToken, desde, hasta) => {
    let offset = 0;
    const limit = 50;
    let allItemIds = [];
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

  // 3. Actualización en segundo plano: Cada vez que se carga el componente se consulta MercadoLibre y se actualiza Firestore.
  // Para superar el límite de offset, se segmenta la consulta por año (desde el año actual hasta el 2000, o hasta que no se obtengan resultados).
  useEffect(() => {
    const updatePublicacionesFromML = async () => {
      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";
        if (!accessToken || !userId) continue;
        try {
          const currentYear = new Date().getFullYear();
          let allItemIds = [];
          // Se recorren los años desde el actual hasta el 2000
          for (let year = currentYear; year >= 2000; year--) {
            const desde = `${year}-01-01T00:00:00.000Z`;
            const hasta = `${year}-12-31T23:59:59.999Z`;
            const idsSegment = await fetchAllItemIDs(userId, accessToken, desde, hasta);
            if (idsSegment.length > 0) {
              allItemIds = [...allItemIds, ...idsSegment];
            }
            // Opcional: si se reciben cero resultados en un año, se podría contar años consecutivos sin resultados para romper el ciclo.
          }
          if (allItemIds.length === 0) continue;
          const detalles = await fetchItemDetailsInBatches(allItemIds, accessToken, nickname, userId);
          // Actualizar o crear cada publicación en Firestore
          for (const pub of detalles) {
            await setDoc(doc(db, "publicaciones", pub.id), pub, { merge: true });
          }
        } catch (error) {
          console.error("Error actualizando publicaciones para la cuenta:", cuenta.id, error);
        }
      }
    };

    if (cuentas.length > 0) {
      // Ejecuta la actualización en segundo plano sin interrumpir al usuario
      updatePublicacionesFromML();
    }
  }, [cuentas]);

  // 4. Calcular las opciones disponibles para los desplegables de Cuenta y Estado a partir de los datos cacheados
  const availableAccounts = Array.from(
    new Set(publicaciones.map((item) => item.userNickname).filter(Boolean))
  ).sort();

  const availableStatuses = Array.from(
    new Set(publicaciones.map((item) => item.status).filter(Boolean))
  ).sort();

  // 5. Filtrado: Se filtran las publicaciones según el buscador general y los filtros (Nombre, ID, Cuenta y Estado)
  const publicacionesFiltradas = publicaciones.filter((item) => {
    const title = item.title?.toLowerCase() || "";
    const id = (item.id || "").toLowerCase();
    const cuenta = item.userNickname?.toLowerCase() || "";
    const status = item.status?.toLowerCase() || "";
    return (
      title.includes(filterName.toLowerCase()) &&
      id.includes(filterId.toLowerCase()) &&
      (filterAccount === "Todos" || cuenta === filterAccount.toLowerCase()) &&
      (filterStatus === "Todos" || status === filterStatus.toLowerCase()) &&
      title.includes(busqueda.toLowerCase())
    );
  });

  // 6. Paginación en la UI
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
            <select
              value={filterAccount}
              onChange={(e) => {
                setFilterAccount(e.target.value);
                setCurrentPage(0);
              }}
              style={{ padding: "6px" }}
            >
              <option value="Todos">Todos</option>
              {availableAccounts.map((acc) => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Estado:</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(0);
              }}
              style={{ padding: "6px" }}
            >
              <option value="Todos">Todos</option>
              {availableStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
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
