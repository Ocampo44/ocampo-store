import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const ITEMS_PER_PAGE = 20;

const styles = {
  // ... tus estilos
};

const Publicaciones = () => {
  const [cuentas, setCuentas] = useState([]);
  const [publicaciones, setPublicaciones] = useState([]);
  const [busquedaTitulo, setBusquedaTitulo] = useState("");
  const [busquedaId, setBusquedaId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [selectedCuenta, setSelectedCuenta] = useState("Todas");
  const [currentPage, setCurrentPage] = useState(1);

  // Escuchar cambios en Firestore para obtener las cuentas con token
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

  // Función para obtener todos los IDs de publicaciones usando search_type=scan
  const fetchAllItemIds = async (userId, accessToken) => {
    let allIds = [];
    let scrollId = null;
    let url = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&search_type=scan`;

    do {
      if (scrollId) {
        url = `https://api.mercadolibre.com/users/${userId}/items/search?access_token=${accessToken}&search_type=scan&scroll_id=${scrollId}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Error al obtener publicaciones en modo scan:", response.status);
        break;
      }
      const data = await response.json();
      if (data.results && Array.isArray(data.results)) {
        allIds = [...allIds, ...data.results];
      }
      scrollId = data.scroll_id;
    } while (scrollId);

    return allIds;
  };

  // Obtener publicaciones de cada cuenta usando el modo scan
  useEffect(() => {
    const fetchPublicaciones = async () => {
      let todasLasPublicaciones = [];

      for (const cuenta of cuentas) {
        const accessToken = cuenta.token?.access_token;
        const userId = cuenta.profile?.id;
        const nickname = cuenta.profile?.nickname || "Sin Nombre";

        if (!accessToken || !userId) continue;

        try {
          const itemIds = await fetchAllItemIds(userId, accessToken);
          if (itemIds.length === 0) continue;

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
                ...item.body,
                userNickname: nickname,
              }));

            todasLasPublicaciones = [...todasLasPublicaciones, ...validItems];
          }
        } catch (error) {
          console.error("Error al traer publicaciones para la cuenta:", cuenta.id, error);
        }
      }

      // Filtrar duplicados basados en el ID de la publicación
      const publicacionesUnicas = todasLasPublicaciones.filter(
        (pub, index, self) => index === self.findIndex((p) => p.id === pub.id)
      );

      // Guarda cada publicación en Firestore
      publicacionesUnicas.forEach(async (pub) => {
        try {
          await setDoc(doc(db, "publicaciones", pub.id.toString()), pub, { merge: true });
        } catch (error) {
          console.error("Error al guardar la publicación con id:", pub.id, error);
        }
      });

      setPublicaciones(publicacionesUnicas);
      setCurrentPage(1);
    };

    if (cuentas.length > 0) {
      fetchPublicaciones();
    }
  }, [cuentas]);

  // Filtros: título, id, status y cuenta
  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((item) => {
      const titulo = item.title?.toLowerCase() || "";
      const idPublicacion = item.id?.toString() || "";
      const filtroTitulo = titulo.includes(busquedaTitulo.toLowerCase());
      const filtroId = busquedaId.trim() === "" || idPublicacion.includes(busquedaId);
      const filtroStatus = selectedStatus === "Todos" || item.status === selectedStatus;
      const filtroCuenta =
        selectedCuenta === "Todas" || item.userNickname === selectedCuenta;
      return filtroTitulo && filtroId && filtroStatus && filtroCuenta;
    });
  }, [publicaciones, busquedaTitulo, busquedaId, selectedStatus, selectedCuenta]);

  // Paginación (sin números, solo "Anterior" y "Siguiente")
  const totalPaginas = Math.ceil(publicacionesFiltradas.length / ITEMS_PER_PAGE);
  const indexInicio = (currentPage - 1) * ITEMS_PER_PAGE;
  const publicacionesPaginadas = publicacionesFiltradas.slice(
    indexInicio,
    indexInicio + ITEMS_PER_PAGE
  );

  // Dropdown de estados disponibles
  const estadosDisponibles = useMemo(() => {
    const estados = publicaciones.map((pub) => pub.status);
    return ["Todos", ...Array.from(new Set(estados))];
  }, [publicaciones]);

  // Dropdown de cuentas disponibles
  const cuentasDisponibles = useMemo(() => {
    const nombres = cuentas.map((cuenta) => cuenta.profile?.nickname || "Sin Nombre");
    return ["Todas", ...Array.from(new Set(nombres))];
  }, [cuentas]);

  // Funciones de paginación
  const handleAnterior = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleSiguiente = () => {
    if (currentPage < totalPaginas) setCurrentPage(currentPage + 1);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2>Publicaciones de Usuarios Conectados</h2>
        <p>
          <strong>Total:</strong> {publicacionesFiltradas.length} publicaciones
        </p>
      </header>

      <div style={styles.filtersContainer}>
        <input
          type="text"
          placeholder="Buscar por título..."
          value={busquedaTitulo}
          onChange={(e) => {
            setBusquedaTitulo(e.target.value);
            setCurrentPage(1);
          }}
          style={styles.input}
        />
        <input
          type="text"
          placeholder="Buscar por ID..."
          value={busquedaId}
          onChange={(e) => {
            setBusquedaId(e.target.value);
            setCurrentPage(1);
          }}
          style={styles.input}
        />
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
          style={styles.select}
        >
          {estadosDisponibles.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
        <select
          value={selectedCuenta}
          onChange={(e) => {
            setSelectedCuenta(e.target.value);
            setCurrentPage(1);
          }}
          style={styles.select}
        >
          {cuentasDisponibles.map((cuenta) => (
            <option key={cuenta} value={cuenta}>
              {cuenta}
            </option>
          ))}
        </select>
      </div>

      {publicacionesPaginadas.length === 0 ? (
        <p style={{ textAlign: "center" }}>No se encontraron publicaciones.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Imagen</th>
              <th style={styles.th}>Título</th>
              <th style={styles.th}>Precio</th>
              <th style={styles.th}>Cuenta</th>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {publicacionesPaginadas.map((pub) => (
              <tr key={pub.id}>
                <td style={styles.td}>
                  <img src={pub.thumbnail} alt={pub.title} style={styles.img} />
                </td>
                <td style={styles.td}>{pub.title}</td>
                <td style={styles.td}>
                  {pub.price} {pub.currency_id}
                </td>
                <td style={styles.td}>{pub.userNickname}</td>
                <td style={styles.td}>{pub.id}</td>
                <td style={styles.td}>
                  <span style={styles.statusBadge(pub.status)}>{pub.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPaginas > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={handleAnterior}
            disabled={currentPage === 1}
            style={{
              ...styles.button,
              ...(currentPage === 1 ? styles.buttonDisabled : {}),
            }}
          >
            Anterior
          </button>
          <button
            onClick={handleSiguiente}
            disabled={currentPage === totalPaginas}
            style={{
              ...styles.button,
              ...(currentPage === totalPaginas ? styles.buttonDisabled : {}),
            }}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default Publicaciones;
