import React, { useEffect, useState } from "react";

const Publicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Suponiendo que ya tienes almacenado el access token y el user ID (por ejemplo, en Firestore o en localStorage)
  const accessToken = localStorage.getItem("mercadoLibreAccessToken");
  const userId = localStorage.getItem("mercadoLibreUserId");

  const fetchPublicaciones = async () => {
    try {
      // Agregamos el parámetro orders=start_time_desc para ordenar según lo requerido
      const url = `https://api.mercadolibre.com/users/${userId}/items/search?orders=start_time_desc`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Error en la respuesta: ${response.status}`);
      }
      const data = await response.json();
      // data.results contendrá los IDs de las publicaciones
      setPublicaciones(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken && userId) {
      fetchPublicaciones();
    } else {
      setError("No se encontró la información de autenticación.");
      setLoading(false);
    }
  }, [accessToken, userId]);

  if (loading) return <p>Cargando publicaciones...</p>;
  if (error) return <p>Error: {error}</p>;

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
