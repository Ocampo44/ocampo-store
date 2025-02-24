import React, { useEffect, useState } from 'react';

const MercadoLibrePublicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('mercadolibre_token');
    if (!token) {
      setError('No se encontró token. Primero debes conectar con MercadoLibre.');
      return;
    }

    const fetchPublicaciones = async () => {
      try {
        const response = await fetch(`https://api.mercadolibre.com/users/me/items/search?access_token=${token}`);
        const data = await response.json();
        if (data.results) {
          setPublicaciones(data.results);
        } else {
          setError('No se encontraron publicaciones o hubo un error.');
          console.error(data);
        }
      } catch (err) {
        console.error('Error al obtener publicaciones:', err);
        setError('Error al obtener publicaciones.');
      }
    };

    fetchPublicaciones();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Mis Publicaciones de MercadoLibre</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!error && publicaciones.length === 0 && <p>No hay publicaciones para mostrar.</p>}
      {publicaciones.length > 0 && (
        <ul>
          {publicaciones.map((pub) => (
            <li key={pub.id}>{pub.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MercadoLibrePublicaciones;
