/* eslint-env node */
/**
 * Cloud Function para sincronizar publicaciones de MercadoLibre a Firestore.
 * Se ejecuta cada 5 minutos usando Firebase Functions v2 Scheduler.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// Función para obtener todos los IDs de publicaciones usando search_type=scan
async function fetchAllItemIds(userId, accessToken) {
  let allIds = [];
  let scrollId = null;
  let url = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&search_type=scan`;

  do {
    if (scrollId) {
      url = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&search_type=scan&scroll_id=${scrollId}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      logger.error("Error al obtener publicaciones en modo scan", { status: response.status });
      break;
    }
    const data = await response.json();
    if (data.results && Array.isArray(data.results)) {
      allIds = allIds.concat(data.results);
    }
    scrollId = data.scroll_id;
  } while (scrollId);

  return allIds;
}

// Cloud Function programada para sincronizar publicaciones cada 5 minutos
exports.syncPublicaciones = onSchedule("every 5 minutes", async (event) => {
  logger.info("Iniciando sincronización de publicaciones...");
  
  // Obtiene las cuentas de MercadoLibre registradas en Firestore
  const usersSnapshot = await db.collection("mercadolibreUsers").get();

  for (const doc of usersSnapshot.docs) {
    const cuenta = doc.data();
    const accessToken = cuenta.token && cuenta.token.access_token;
    const userId = cuenta.profile && cuenta.profile.id;
    const nickname = (cuenta.profile && cuenta.profile.nickname) || "Sin Nombre";

    if (!accessToken || !userId) continue;

    try {
      const itemIds = await fetchAllItemIds(userId, accessToken);
      if (itemIds.length === 0) continue;

      // Procesa las publicaciones en lotes para evitar URLs muy largas
      const batchSize = 20;
      for (let i = 0; i < itemIds.length; i += batchSize) {
        const batchIds = itemIds.slice(i, i + batchSize).join(",");
        const itemsUrl = `https://api.mercadolibre.com/items?ids=${batchIds}&access_token=${accessToken}`;
        const itemsResponse = await fetch(itemsUrl);

        if (!itemsResponse.ok) {
          logger.error("Error al obtener detalles de publicaciones", { status: itemsResponse.status });
          continue;
        }

        const itemsData = await itemsResponse.json();

        for (let item of itemsData) {
          if (item.code === 200) {
            const pub = item.body;
            pub.userNickname = nickname;

            // Guarda o actualiza la publicación en Firestore (colección "publicaciones")
            await db.collection("publicaciones").doc(pub.id).set(pub, { merge: true });
          }
        }
      }

      // Elimina publicaciones que ya no existen en MercadoLibre para este usuario
      // Se asume que cada publicación tiene el campo "seller_id" con el ID del usuario.
      const publicacionesSnapshot = await db
        .collection("publicaciones")
        .where("seller_id", "==", userId)
        .get();
      const currentIdsSet = new Set(itemIds);

      for (let pubDoc of publicacionesSnapshot.docs) {
        if (!currentIdsSet.has(pubDoc.id)) {
          await db.collection("publicaciones").doc(pubDoc.id).delete();
          logger.info(`Eliminada publicación ${pubDoc.id}`);
        }
      }
    } catch (error) {
      logger.error("Error al sincronizar publicaciones para la cuenta", { userId, error });
    }
  }

  logger.info("Sincronización completada.");
});
