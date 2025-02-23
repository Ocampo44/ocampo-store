import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState(new Map());
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
          const tiposPublicacion = ["gold_pro", "gold_special", "silver"];
          const rangosPrecio = ["0-100", "100-200", "200-500", "500-1000", "1000-5000", "5000-10000", "10000-"];
          const fechas = ["30d", "60d", "90d", "180d", "365d"];

          let allCategories = new Set();

          console.log(`🔍 Buscando categorías de publicaciones para ${nickname}...`);

          for (const estado of estados) {
            let offset = 0;
            let totalItems = 1000;

            while (offset < totalItems) {
              const categoryUrl = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&status=${estado}&offset=${offset}&limit=50`;

              const categoryResponse = await fetch(categoryUrl);
              if (!categoryResponse.ok) break;

              const categoryData = await categoryResponse.json();
              const itemIds = categoryData.results || [];
              totalItems = categoryData.paging?.total || itemIds.length;

              if (itemIds.length === 0) break;
              offset += categoryData.paging?.limit || 50;

              for (const itemId of itemIds) {
                const itemUrl = `https://api.mercadolibre.com/items/${itemId}?access_token=${accessToken}`;
                const itemResponse = await fetch(itemUrl);
                if (!itemResponse.ok) continue;

                const itemData = await itemResponse.json();
                if (itemData.category_id) {
                  allCategories.add(itemData.category_id);
                }
              }
            }
          }

          console.log(`📂 Categorías identificadas para ${nickname}:`, [...allCategories]);

          let allItemIds = [];

          for (const estado of estados) {
            for (const categoria of allCategories) {
              for (const tipoPublicacion of tiposPublicacion) {
                for (const precio of rangosPrecio) {
                  for (const fecha of fechas) {
                    let offset = 0;
                    let totalItems = Infinity;

                    console.log(`🔍 Buscando publicaciones en categoría ${categoria}, tipo ${tipoPublicacion}, precio ${precio}, fecha ${fecha} (${estado}) para ${nickname}...`);

                    while (offset < totalItems) {
                      const searchUrl = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&status=${estado}&category=${categoria}&listing_type=${tipoPublicacion}&price=${precio}&date_created=${fecha}&offset=${offset}&limit=50`;

                      console.log(`➡️ Fetching: ${searchUrl}`);
                      const searchResponse = await fetch(searchUrl);
                      if (!searchResponse.ok) break;

                      const searchData = await searchResponse.json();
                      const itemIds = searchData.results || [];
                      totalItems = searchData.paging?.total || itemIds.length;

                      if (itemIds.length === 0) break;
                      offset += searchData.paging?.limit || 50;
                      allItemIds.push(...itemIds);
                    }
                  }
                }
              }
            }
          }

          console.log(`🔹 Total IDs recopilados para ${nickname}: ${allItemIds.length}`);

          const batchSize = 20;
          for (let i = 0; i < allItemIds.length; i += batchSize) {
            const batchIds = allItemIds.slice(i, i + batchSize).join(",");
            const itemsUrl = `https://api.mercadolibre.com/items?ids=${batchIds}&access_token=${accessToken}`;

            console.log(`📦 Obteniendo detalles: ${itemsUrl}`);
            const itemsResponse = await fetch(itemsUrl);
            if (!itemsResponse.ok) continue;

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

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>

      <p><strong>Total de publicaciones:</strong> {publicaciones.size}</p>

      {cargando && <p>Cargando publicaciones...</p>}

      {publicaciones.size === 0 && !cargando ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        <ul>
          {Array.from(publicaciones.values()).map((pub) => (
            <li key={pub.id}>
              <h3>{pub.title}</h3>
              <p><strong>Cuenta:</strong> {pub.userNickname}</p>
              <p><strong>Categoría:</strong> {pub.category_id}</p>
              <p><strong>Estado:</strong> {pub.status}</p>
              <p><strong>Tipo de Publicación:</strong> {pub.listing_type_id}</p>
              <p><strong>Precio:</strong> {pub.price}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Publicaciones;
