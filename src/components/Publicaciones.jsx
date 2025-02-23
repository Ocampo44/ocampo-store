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
          const estados = ["active", "paused", "closed"];
          const tiposListado = ["gold_special", "gold_pro", "silver"];
          const rangosPrecio = ["0-500", "500-1000", "1000-"];

          let publicacionesTemp = [];

          for (const estado of estados) {
            for (const tipo of tiposListado) {
              for (const precio of rangosPrecio) {
                let offset = 0;
                let totalItems = Infinity;

                console.log(`🔍 Buscando publicaciones (${estado}, ${tipo}, ${precio}) para ${nickname}...`);

                while (offset < totalItems) {
                  const searchUrl = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&status=${estado}&listing_type=${tipo}&price=${precio}&offset=${offset}&limit=50`;

                  console.log(`➡️ Fetching: ${searchUrl}`);
                  const searchResponse = await fetch(searchUrl);
                  if (!searchResponse.ok) {
                    console.error(`⚠️ Error al obtener IDs (${estado}, ${tipo}, ${precio}):`, searchResponse.status);
                    break;
                  }

                  const searchData = await searchResponse.json();
                  const itemIds = searchData.results || [];
                  totalItems = searchData.paging?.total || itemIds.length;

                  console.log(`📌 Total Items en ML (${estado}, ${tipo}, ${precio}): ${totalItems}, Offset: ${offset}`);

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
