// src/components/Publicaciones.jsx
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

  // 2. Para cada cuenta, obtener los IDs de sus publicaciones y sus detalles
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let todasLasPublicaciones = [];

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue;

        try {
          // Obtener los IDs de las publicaciones
          const searchResponse = await fetch(
            `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}`
          );
          if (!searchResponse.ok) {
            console.error("Error al obtener IDs de publicaciones:", searchResponse.status);
            continue;
          }

          const searchData = await searchResponse.json();
          const itemIds = searchData.results || [];

          if (itemIds.length === 0) continue;

          // Procesar en lotes de 20
          const batchSize = 20;
          for (let i = 0; i < itemIds.length; i += batchSize) {
            const batchIds = itemIds.slice(i, i + batchSize).join(",");
            const itemsUrl = `https://api.mercadolibre.com/items?ids=${batchIds}&access_token=${accessToken}`;
            const itemsResponse = await fetch(itemsUrl);

            if (!itemsResponse.ok) {
              console.error("Error al obtener detalles de publicaciones:", itemsResponse.status);
              continue;
            }

            const itemsData = await itemsResponse.json();
            const validItems = itemsData
              .filter((item) => item.code === 200)
              .map((item) => ({
                ...item.body, // id, title, price, thumbnail, status, etc.
                userNickname: nickname,
              }));

            todasLasPublicaciones = [...todasLasPublicaciones, ...validItems];
          }
        } catch (error) {
          console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }

      setPublicaciones(todasLasPublicaciones);
      setPaginaActual(1); // Reinicia la página al actualizar las publicaciones
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // 3. Calcular las opciones únicas para filtros de estado y cuenta
  const opcionesEstado = Array.from(new Set(publicaciones.map(pub => pub.status))).filter(Boolean);
  const opcionesCuenta = Array.from(new Set(publicaciones.map(pub => pub.userNickname))).filter(Boolean);

  // 4. Filtrar publicaciones según múltiples criterios
  const publicacionesFiltradas = publicaciones.filter((item) => {
    const titulo = item.title?.toLowerCase() || "";
    const idItem = item.id?.toString().toLowerCase() || "";
    const matchTitulo = titulo.includes(busquedaTitulo.toLowerCase());
    const matchID = idItem.includes(busquedaID.toLowerCase());
    const matchEstado = filtroEstado === "" || item.status === filtroEstado;
    const matchCuenta = filtroCuenta === "" || item.userNickname === filtroCuenta;

    return matchTitulo && matchID && matchEstado && matchCuenta;
  });

  // 5. Paginación
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / itemsPorPagina);
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const publicacionesPagina = publicacionesFiltradas.slice(inicio, inicio + itemsPorPagina);

  // Funciones de navegación de páginas
  const paginaSiguiente = () => {
    if (paginaActual < totalPaginas) {
      setPaginaActual(paginaActual + 1);
    }
  };

  const paginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual(paginaActual - 1);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Publicaciones de usuarios conectados</h2>
      <p><strong>Total de publicaciones:</strong> {publicacionesFiltradas.length}</p>

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
          <label htmlFor="filtroEstado" style={{ marginRight: "10px" }}>
            Filtrar por Estado:
          </label>
          <select
            id="filtroEstado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ padding: "6px" }}
          >
            <option value="">Todos</option>
            {opcionesEstado.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtroCuenta" style={{ marginRight: "10px" }}>
            Filtrar por Cuenta:
          </label>
          <select
            id="filtroCuenta"
            value={filtroCuenta}
            onChange={(e) => setFiltroCuenta(e.target.value)}
            style={{ padding: "6px" }}
          >
            <option value="">Todas</option>
            {opcionesCuenta.map((cuenta) => (
              <option key={cuenta} value={cuenta}>
                {cuenta}
              </option>
            ))}
          </select>
        </div>
      </div>

      {publicacionesPagina.length === 0 ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {publicacionesPagina.map((pub) => (
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
                  <strong>ID de la publicación:</strong> {pub.id}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Estado:</strong> {pub.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Navegación de páginas */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={paginaAnterior} disabled={paginaActual === 1} style={{ padding: "8px 12px" }}>
          Anterior
        </button>
        <span>
          Página {paginaActual} de {totalPaginas}
        </span>
        <button onClick={paginaSiguiente} disabled={paginaActual === totalPaginas} style={{ padding: "8px 12px" }}>
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default Publicaciones;
