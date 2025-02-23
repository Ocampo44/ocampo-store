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
          // 🔍 1. Obtener todas las categorías en las que el usuario tiene publicaciones
          const categoriasResponse = await fetch(
            `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&limit=50`
          );
          if (!categoriasResponse.ok) {
            console.error("⚠️ Error al obtener categorías:", categoriasResponse.status);
            continue;
          }

          const categoriasData = await categoriasResponse.json();
          const todasLasCategorias = [...new Set(categoriasData.results.map((id) => id.category_id))];

          console.log(`📂 Categorías encontradas para ${nickname}:`, todasLasCategorias);

          const estados = ["active", "paused", "closed"];
          let publicacionesTemp = [];

          // 🔍 2. Consultar publicaciones separadas por `category_id` y `status`
          for (const categoria of todasLasCategorias) {
            for (const estado of estados) {
              let offset = 0;
              let totalItems = Infinity;

              console.log(`🔍 Buscando publicaciones en categoría ${categoria} (${estado}) para ${nickname}...`);

              while (offset < totalItems) {
                const searchUrl = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&category=${categoria}&status=${estado}&offset=${offset}&limit=50`;

                console.log(`➡️ Fetching: ${searchUrl}`);
                const searchResponse = await fetch(searchUrl);
                if (!searchResponse.ok) {
                  console.error(`⚠️ Error al obtener IDs (${estado}, categoría ${categoria}):`, searchResponse.status);
                  break;
                }

                const searchData = await searchResponse.json();
                const itemIds = searchData.results || [];
                totalItems = searchData.paging?.total || itemIds.length;

                console.log(`📌 Total Items en ML (${estado}, categoría ${categoria}): ${totalItems}, Offset: ${offset}`);

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

                await new Promise((r) => setTimeout(r, 500));
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
