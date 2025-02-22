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
  const [filters, setFilters] = useState({
    title: "",
    family: "",
    productId: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      if (snapshot && snapshot.docs) {
        const acc = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        const validAccounts = acc.filter((account) => account.token?.access_token);
        setAccounts(validAccounts);
        console.log("Cuentas cargadas:", validAccounts);
      }
    });
    return () => unsub();
  }, []);

  const saveProductsToDB = async (productsArr) => {
    console.log("Guardando publicaciones en DB:", productsArr.length);
    for (const prod of productsArr) {
      if (!prod.id) {
        console.warn("Ítem sin ID:", prod);
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
        console.log(`Ítem ${prod.id} guardado correctamente.`);
      } catch (error) {
        console.error("Error al guardar ítem en DB:", prod.id, error);
      }
    }
  };

  const loadProductsFromDB = async () => {
    try {
      const q = query(collection(db, "userProducts"), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const prods = querySnapshot.docs.map((docSnap) => docSnap.data());
      console.log("Publicaciones cargadas desde DB:", prods.length);
      setProducts(prods);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error al cargar publicaciones desde DB", error);
    }
  };

  const fetchUserProducts = async () => {
    setLoading(true);
    let allProducts = [];
    const limit = 50;
    const additionalParams = "&include_filters=true&search_type=scan";

    for (const account of accounts) {
      const userId = account.profile?.id || account.id;
      const accessToken = account.token?.access_token;
      if (!userId || !accessToken) {
        console.warn("Cuenta sin userId o token:", account);
        continue;
      }
      try {
        console.log(`Consultando publicaciones para el usuario ${userId}`);
        let offset = 0;
        const url = `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}${additionalParams}`;
        console.log("URL de consulta:", url);
        
        const firstResponse = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!firstResponse.ok) {
          console.error(`Error ${firstResponse.status} al obtener publicaciones de ${userId}`);
          continue;
        }
        
        const firstData = await firstResponse.json();
        console.log("Datos iniciales obtenidos:", firstData);
        const total = firstData.paging?.total || 0;
        console.log(`Usuario ${userId}: total ítems: ${total}`);
        
        while (offset < total) {
          const response = await fetch(
            `https://api.mercadolibre.com/users/${userId}/items/search?limit=${limit}&offset=${offset}${additionalParams}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!response.ok) {
            console.error(`Error (offset ${offset}) para ${userId}: ${response.status}`);
            break;
          }
          
          const data = await response.json();
          const results = data.results || [];
          const mapped = results.map((item) => ({
            ...item,
            accountName: account.profile?.nickname || "Sin Nombre",
          }));
          
          allProducts = allProducts.concat(mapped);
          offset += limit;
        }
      } catch (error) {
        console.error("Error consultando publicaciones para", userId, error);
      }
    }
    console.log("Total de publicaciones obtenidas:", allProducts.length);
    await saveProductsToDB(allProducts);
    await loadProductsFromDB();
    setLoading(false);
  };

  useEffect(() => {
    console.log("Productos en el estado:", products);
  }, [products]);

  return (
    <div>
      <h1>Publicaciones</h1>
      <button onClick={fetchUserProducts}>Traer Publicaciones</button>
      {loading ? (
        <p>Cargando publicaciones...</p>
      ) : (
        <ul>
          {products.map((prod) => (
            <li key={prod.id}>{prod.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Publicaciones;
