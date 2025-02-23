import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
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
    const fetchPublicaciones = async () => {
      setCargando(true);
      setPublicaciones([]);

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue;

        try {
          let allItemIds = [];
          let offset = 0;
          let totalItems = Infinity;

          console.log(`🔍 Buscando IDs de publicaciones para ${nickname}...`);

          // 🔹 1. Obtener TODOS los IDs de publicación
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

            console.log(`📌 Total Items en ML: ${totalItems}, Offset: ${offset}`);

            if (itemIds.length === 0) break;
            offset += searchData.paging?.limit || 50;
            allItemIds.push(...itemIds);
          }

          console.log(`✅ Total IDs recopilados: ${allItemIds.length}`);

          // 🔹 2. Obtener detalles de los IDs para extraer categorías
          let categoryMap = new Map();
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
            for (const item of itemsData) {
              if (item.code === 200 && item.body.category_id) {
                if (!categoryMap.has(item.body.category_id)) {
                  categoryMap.set(item.body.category_id, []);
                }
                categoryMap.get(item.body.category_id).push(item.body.id);
              }
            }

            await new Promise((r) => setTimeout(r, 500));
          }

          console.log(`📂 Categorías identificadas:`, [...categoryMap.keys()]);

          const estados = ["active", "paused", "closed"];
          let publicacionesTemp = [];

          // 🔹 3. Consultar publicaciones por `category_id` y `status`
          for (const [categoria, itemIds] of categoryMap) {
            for (const estado of estados) {
              let offset = 0;
              let totalItems = itemIds.length;

              console.log(`🔍 Buscando publicaciones en categoría ${categoria} (${estado}) para ${nickname}...`);

              while (offset < totalItems) {
                const idsLote = itemIds.slice(offset, offset + 50).join(",");
                const searchUrl = `https://api.mercadolibre.com/items?ids=${idsLote}&access_token=${accessToken}`;

                console.log(`➡️ Fetching: ${searchUrl}`);
                const searchResponse = await fetch(searchUrl);
                if (!searchResponse.ok) {
                  console.error(`⚠️ Error al obtener IDs (${estado}, categoría ${categoria}):`, searchResponse.status);
                  break;
                }

                const searchData = await searchResponse.json();
                const validItems = searchData
                  .filter((item) => item.code === 200)
                  .map((item) => ({
                    ...item.body,
                    userNickname: nickname,
                  }));

                publicacionesTemp.push(...validItems);
                offset += 50;
              }
            }
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

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>
      <p>
        <strong>Total de publicaciones:</strong> {publicaciones.length}
      </p>

      {cargando && <p>Cargando publicaciones...</p>}

      {publicaciones.length === 0 && !cargando ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        <ul>
          {publicaciones.map((pub) => (
            <li key={pub.id}>
              <h3>{pub.title}</h3>
              <p><strong>Cuenta:</strong> {pub.userNickname}</p>
              <p><strong>Categoría:</strong> {pub.category_id}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Publicaciones;
