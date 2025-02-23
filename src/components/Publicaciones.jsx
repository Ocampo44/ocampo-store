import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState(new Map());

  // Filtros
  const [filtroCuenta, setFiltroCuenta] = useState(""); 
  const [filtroTitulo, setFiltroTitulo] = useState(""); 
  const [filtroEstado, setFiltroEstado] = useState(""); 
  const [filtroID, setFiltroID] = useState(""); 

  const [cargando, setCargando] = useState(false);

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

  useEffect(() => {
    if (cuentas.length === 0) return;

    const fetchPublicaciones = async () => {
      setCargando(true);
      let tempPublicaciones = new Map(publicaciones);

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue;

        try {
          const estados = ["active", "paused", "closed"];
          let allItemIds = [];

          for (const estado of estados) {
            let offset = 0;
            let totalItems = Infinity;
            let estadoItems = 0; // Contador para depurar

            console.log(`🔍 Buscando publicaciones en estado: ${estado} para ${nickname}...`);

            while (offset < totalItems) {
              const searchUrl = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&status=${estado}&offset=${offset}&limit=50`;

              console.log(`➡️ Fetching: ${searchUrl}`);
              const searchResponse = await fetch(searchUrl);
              if (!searchResponse.ok) {
                console.error(`⚠️ Error al obtener IDs (${estado}):`, searchResponse.status);
                break;
              }

              const searchData = await searchResponse.json();
              const itemIds = searchData.results || [];
              totalItems = searchData.paging?.total || itemIds.length;

              console.log(`📌 Total Items en ML (${estado}): ${totalItems}, Offset Actual: ${offset}, IDs obtenidos: ${itemIds.length}`);

              if (itemIds.length === 0) break;
              offset += searchData.paging?.limit || 50;
              allItemIds.push(...itemIds);
              estadoItems += itemIds.length;
            }

            console.log(`✅ Total de publicaciones en estado ${estado} para ${nickname}: ${estadoItems}`);
          }

          console.log(`🔹 Total IDs recopilados para ${nickname}: ${allItemIds.length}`);

          // 🔹 Obtener detalles de los IDs en lotes de 20
          const batchSize = 20;
          for (let i = 0; i < allItemIds.length; i += batchSize) {
            const batchIds = allItemIds.slice(i, i + batchSize).join(",");
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

            for (const item of validItems) {
              tempPublicaciones.set(item.id, item);
            }

            setPublicaciones(new Map(tempPublicaciones));
            await new Promise((r) => setTimeout(r, 500));
          }

        } catch (error) {
          console.error("❌ Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }
      setCargando(false);
    };

    fetchPublicaciones();
  }, [cuentas]);

  const publicacionesArray = Array.from(publicaciones.values()).filter((pub) => {
    const matchCuenta = filtroCuenta ? pub.userNickname === filtroCuenta : true;
    const matchTitulo = filtroTitulo ? pub.title.toLowerCase().includes(filtroTitulo.toLowerCase()) : true;
    const matchEstado = filtroEstado ? pub.status === filtroEstado : true;
    const matchID = filtroID ? pub.id.includes(filtroID) : true;
    return matchCuenta && matchTitulo && matchEstado && matchID;
  });

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>

      {/* Filtros */}
      <div style={{ marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <select value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)} style={{ padding: "6px" }}>
          <option value="">Todas las cuentas</option>
          {cuentas.map((cuenta) => (
            <option key={cuenta.id} value={cuenta.profile?.nickname}>
              {cuenta.profile?.nickname || "Sin Nombre"}
            </option>
          ))}
        </select>

        <input type="text" placeholder="Buscar por título..." value={filtroTitulo} onChange={(e) => setFiltroTitulo(e.target.value)} style={{ padding: "8px", maxWidth: "200px" }}/>

        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: "6px" }}>
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="paused">Pausado</option>
          <option value="closed">Cerrado</option>
        </select>

        <input type="text" placeholder="Buscar por ID..." value={filtroID} onChange={(e) => setFiltroID(e.target.value)} style={{ padding: "8px", maxWidth: "200px" }}/>
      </div>

      <p><strong>Total de publicaciones:</strong> {publicacionesArray.length}</p>

      {cargando && <p>Cargando publicaciones...</p>}

      {publicacionesArray.length === 0 && !cargando ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        <ul>
          {publicacionesArray.map((pub) => (
            <li key={pub.id}>
              <h3>{pub.title}</h3>
              <p><strong>Cuenta:</strong> {pub.userNickname}</p>
              <p><strong>Estado:</strong> {pub.status}</p>
              <p><strong>Precio:</strong> {pub.price}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Publicaciones;
