// src/components/Publicaciones.jsx
import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const Publicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Función para obtener las publicaciones de un usuario
  const fetchPublicacionesPorUsuario = async (userId, accessToken) => {
    try {
      const response = await fetch(
        `https://api.mercadolibre.com/users/${userId}/items/search`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      if (!response.ok) {
        console.error(`Error al obtener publicaciones para ${userId}:`, response.status);
        return [];
      }
      const data = await response.json();
      return data.results || [];
    } catch (err) {
      console.error(`Error al obtener publicaciones para ${userId}:`, err);
      return [];
    }
  };

  useEffect(() => {
    const fetchAllPublicaciones = async () => {
      setLoading(true);
      setError(null);
      try {
        // Obtener cuentas conectadas desde Firestore
        const snapshot = await getDocs(collection(db, 'mercadolibreUsers'));
        const cuentas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Para cada cuenta, obtener las publicaciones
        const publicacionesPromises = cuentas.map(async (cuenta) => {
          const userId = cuenta.profile?.id || cuenta.id;
          const accessToken = cuenta.token?.access_token;
          if (!accessToken) return [];
          const pubs = await fetchPublicacionesPorUsuario(userId, accessToken);
          // Puedes incluir también la información del vendedor en cada publicación
          return pubs.map(pub => ({ ...pub, vendedor: cuenta.profile?.nickname || 'Sin Nombre' }));
        });

        const pubsPorCuenta = await Promise.all(publicacionesPromises);
        // Aplanar el arreglo de arreglos
        const todasPublicaciones = pubsPorCuenta.flat();
        setPublicaciones(todasPublicaciones);
      } catch (err) {
        console.error('Error al cargar las publicaciones:', err);
        setError('Error al cargar las publicaciones.');
      }
      setLoading(false);
    };

    fetchAllPublicaciones();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Publicaciones de Usuarios Conectados</h1>
      {loading && <p>Cargando publicaciones...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {(!loading && publicaciones.length === 0) && <p>No se encontraron publicaciones.</p>}
      {publicaciones.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Título</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Precio</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Estado</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Vendedor</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Link</th>
            </tr>
          </thead>
          <tbody>
            {publicaciones.map((pub) => (
              <tr key={pub.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pub.title}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pub.price}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pub.condition}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pub.vendedor}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <a href={pub.permalink} target="_blank" rel="noopener noreferrer">Ver Publicación</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Publicaciones;
