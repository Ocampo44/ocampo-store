import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);

  // Estados de filtros
  const [busquedaTitulo, setBusquedaTitulo] = useState("");
  const [busquedaID, setBusquedaID] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("");

  // Estado de paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 20;

  // Indicador de carga
  const [cargando, setCargando] = useState(false);

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

  // 2. Obtener y mostrar todas las publicaciones sin el límite de 1050
  useEffect(() => {
    const fetchPublicaciones = async () => {
      setCargando(true);
      setPublicaciones([]);

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue;

        try {
          let offset = 0;
          let totalItems = Infinity;
          const publicacionesTemp = [];

          console.log(`🔍 Buscando publicaciones para ${nickname}...`);

          while (offset < totalItems) {
            const searchUrl = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&offset=${offset}&limit=50`;
            console.log(`➡️ Fetching: ${searchUrl}`);

            const searchResponse = await fetch(searchUrl);
            if (!searchResponse.ok) {
              console.error("⚠️ Error al obtener IDs de publicaciones:", searchResponse.status);
              break;
            }

            const searchData = await searchResponse.json();
            const itemIds = searchData.results || [];
            totalItems = searchData.paging?.total || itemIds.length;

            console.log(`📌 Total Items en ML: ${totalItems}, Offset Actual: ${offset}`);

            if (itemIds.length === 0) break;
            offset += searchData.paging?.limit || 50;

            // Obtener detalles en lotes de 20
            const batchSize = 20;
            for (let i = 0; i < itemIds.length; i += batchSize) {
              const batchIds = itemIds.slice(i, i + batchSize).join(",");
              const itemsUrl = `https://api.mercadolibre.com/items?ids=${batchIds}&access_token=${accessToken}`;
              
              console.log(`📦 Obteniendo detalles: ${itemsUrl}`);

              const itemsResponse = await fetch(itemsUrl);
              if (!itemsResponse.ok) {
                console.error("⚠️ Error al obtener detalles de publicaciones:", itemsResponse.status);
                continue;
              }

              const itemsData = await itemsResponse.json();
              const validItems = itemsData
                .filter((item) => item.code === 200)
                .map((item) => ({
                  ...item.body,
                  userNickname: nickname,
                }));

              publicacionesTemp.push(...validItems);
            }

            // Evitar bloqueos con pausa de 500ms
            await new Promise((r) => setTimeout(r, 500));
          }

          console.log(`✅ Se trajeron ${publicacionesTemp.length} publicaciones para ${nickname}`);

          setPublicaciones((prev) => [...prev, ...publicacionesTemp]);
        } catch (error) {
          console.error("❌ Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }
      setCargando(false);
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // Opciones únicas para filtros
  const opcionesEstado = Array.from(new Set(publicaciones.map((pub) => pub.status))).filter(Boolean);
  const opcionesCuenta = Array.from(new Set(publicaciones.map((pub) => pub.userNickname))).filter(Boolean);

  // Filtrar publicaciones según criterios
  const publicacionesFiltradas = publicaciones.filter((item) => {
    const titulo = item.title?.toLowerCase() || "";
    const idItem = item.id?.toString().toLowerCase() || "";
    const matchTitulo = titulo.includes(busquedaTitulo.toLowerCase());
    const matchID = idItem.includes(busquedaID.toLowerCase());
    const matchEstado = filtroEstado === "" || item.status === filtroEstado;
    const matchCuenta = filtroCuenta === "" || item.userNickname === filtroCuenta;

    return matchTitulo && matchID && matchEstado && matchCuenta;
  });

  // Paginación
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / itemsPorPagina);
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const publicacionesPagina = publicacionesFiltradas.slice(inicio, inicio + itemsPorPagina);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>
      <p>
        <strong>Total de publicaciones:</strong> {publicacionesFiltradas.length}
      </p>

      {/* Filtros */}
      <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <input
          type="text"
          placeholder="Buscar por título..."
          value={busquedaTitulo}
          onChange={(e) => setBusquedaTitulo(e.target.value)}
          style={{ padding: "8px", maxWidth: "400px" }}
        />
        <input
          type="text"
          placeholder="Buscar por ID de publicación..."
          value={busquedaID}
          onChange={(e) => setBusquedaID(e.target.value)}
          style={{ padding: "8px", maxWidth: "400px" }}
        />
        <div>
          <label htmlFor="filtroEstado" style={{ marginRight: "10px" }}>Filtrar por Estado:</label>
          <select id="filtroEstado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: "6px" }}>
            <option value="">Todos</option>
            {opcionesEstado.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="filtroCuenta" style={{ marginRight: "10px" }}>Filtrar por Cuenta:</label>
          <select id="filtroCuenta" value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)} style={{ padding: "6px" }}>
            <option value="">Todas</option>
            {opcionesCuenta.map((cuenta) => <option key={cuenta} value={cuenta}>{cuenta}</option>)}
          </select>
        </div>
      </div>

      {cargando && <p>Cargando publicaciones...</p>}

      {publicacionesPagina.length === 0 && !cargando ? <p>No se encontraron publicaciones.</p> : (
        <ul>
          {publicacionesPagina.map((pub) => (
            <li key={pub.id}>
              <h3>{pub.title}</h3>
              <p><strong>Cuenta:</strong> {pub.userNickname}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Publicaciones;
