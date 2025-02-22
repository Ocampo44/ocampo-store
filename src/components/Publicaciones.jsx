// src/components/Publicaciones.jsx
import React, { useEffect, useState } from "react";

const Publicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Asegúrate de tener el token y el user ID. 
  // Puedes obtenerlos de localStorage o de tu estado global, según corresponda.
  const accessToken = localStorage.getItem("mercadoLibreAccessToken");
  const userId = localStorage.getItem("mercadoLibreUserId");

  useEffect(() => {
    const fetchPublicaciones = async () => {
      if (!accessToken || !userId) {
        setError("No se encontró el token o el ID de usuario.");
        setLoading(false);
        return;
      }
      try {
        const url = `https://api.mercadolibre.com/users/${userId}/items/search?orders=start_time_desc`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          throw new Error(`Error en la respuesta: ${response.status}`);
        }
        const data = await response.json();
        // data.results debe contener los IDs de las publicaciones
        setPublicaciones(data.results || []);
      } catch (err) {
        console.error("Error al obtener publicaciones:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicaciones();
  }, [accessToken, userId]);

  if (loading) return <div>Cargando publicaciones...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Publicaciones de MercadoLibre</h1>
      {publicaciones.length === 0 ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        <ul>
          {publicaciones.map((pubId) => (
            <li key={pubId}>Publicación ID: {pubId}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Publicaciones;
