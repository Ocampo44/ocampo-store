import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

const Publicaciones = () => {
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Escucha en tiempo real las cuentas en Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "mercadolibreUsers"),
      (snapshot) => {
        if (snapshot?.docs) {
          const acc = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          const validAccounts = acc.filter(
            (account) => account.token?.access_token
          );
          setAccounts(validAccounts);
          console.log("🔥 Cuentas cargadas desde Firestore:", validAccounts);
        }
      },
      (error) => {
        console.error("Error al cargar cuentas:", error);
      }
    );
    return () => unsub();
  }, []);

  // Guarda las publicaciones en Firestore
  const saveProductsToDB = async (productsArr) => {
    console.log("📝 Guardando publicaciones en DB:", productsArr);
    for (const prod of productsArr) {
      if (!prod.id) {
        console.warn("⚠️ Ítem sin ID:", prod);
        continue;
      }
      try {
        await setDoc(
          doc(db, "userProducts", prod.id.toString()),
          {
            ...prod,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        console.log(`✅ Ítem ${prod.id} guardado correctamente.`);
      } catch (error) {
        console.error("❌ Error al guardar ítem en DB:", prod.id, error);
      }
    }
  };

  // Carga las publicaciones guardadas desde Firestore
  const loadProductsFromDB = async () => {
    try {
      const q = query(
        collection(db, "userProducts"),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const prods = querySnapshot.docs.map((docSnap) => docSnap.data());
      console.log("📂 Publicaciones cargadas desde Firestore:", prods);
      setProducts(prods);
      setCurrentPage(1);
    } catch (error) {
      console.error("❌ Error al cargar publicaciones desde Firestore:", error);
    }
  };

  // Consulta la API de MercadoLibre y procesa las publicaciones de cada cuenta
  const fetchUserProducts = async () => {
    setLoading(true);
    let allProducts = [];
    const limit = 50;
    const additionalParams = "&include_filters=true&search_type=scan";

    console.log(`🚀 Cargando publicaciones para ${accounts.length} cuentas...`);
    if (accounts.length === 0) {
      console.warn("⚠️ No hay cuentas con tokens válidos.");
      setLoading(false);
      return;
    }
    
    for (const account of accounts) {
      const userId = account.profile?.id || account.id;
      const accessToken = account.token?.access_token;
      if (!userId || !accessToken) {
        console.warn("⚠️ Cuenta sin userId o token válido:", account);
        continue;
      }
      try {
        console.log(`🔍 Consultando publicaciones para el usuario ${userId}`);
        let offset = 0;
        let total = 1;
        while (offset < total) {
          const url = `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}${additionalParams}`;
          console.log("🌐 URL de consulta:", url);
          
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!response.ok) {
            const errorData = await response.json();
            console.error(
              `❌ Error ${response.status} en la petición:`,
              errorData
            );
            break;
          }
          
          const data = await response.json();
          console.log(`🟢 Respuesta de la API para ${userId}:`, data);
          if (offset === 0) total = data.paging?.total || 0;
          
          if (!Array.isArray(data.results) || data.results.length === 0) {
            console.warn(`⚠️ No se obtuvieron publicaciones para el usuario ${userId}`);
            break;
          }

          // Se asume que cada item es un objeto con propiedades "id" y "title"
          const mapped = data.results.map((item) => ({
            id: item.id,
            title: item.title,
            accountName: account.profile?.nickname || "Sin Nombre",
            // Puedes agregar otros campos relevantes del item aquí
          }));
          
          allProducts = allProducts.concat(mapped);
          offset += limit;
        }
      } catch (error) {
        console.error("❌ Error al consultar la API de MercadoLibre:", error);
      }
    }
    console.log("📊 Total de publicaciones obtenidas antes de guardar:", allProducts);
    await saveProductsToDB(allProducts);
    await loadProductsFromDB();
    setLoading(false);
  };

  useEffect(() => {
    console.log("📢 Productos en el estado actual:", products);
  }, [products]);

  return (
    <div>
      <h1>Publicaciones</h1>
      <button onClick={fetchUserProducts} disabled={loading}>
        Traer Publicaciones
      </button>
      {loading ? (
        <p>Cargando publicaciones...</p>
      ) : (
        <>
          <p>Total de publicaciones en estado: {products.length}</p>
          {products.length === 0 && <p>⚠️ No hay publicaciones para mostrar</p>}
          <ul>
            {products.map((prod) => (
              <li key={prod.id}>
                {prod.title} - {prod.id} ({prod.accountName})
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default Publicaciones;
