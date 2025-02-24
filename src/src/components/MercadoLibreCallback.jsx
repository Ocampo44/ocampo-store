import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MercadoLibreCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Procesando autenticación...');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) {
      setMessage('No se encontró el código de autorización.');
      return;
    }

    // Intercambiar el code por el token (directamente desde el frontend, no recomendado en producción)
    const exchangeCodeForToken = async () => {
      try {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', process.env.REACT_APP_MERCADOLIBRE_CLIENT_ID);
        params.append('client_secret', process.env.REACT_APP_MERCADOLIBRE_CLIENT_SECRET);
        params.append('code', code);
        params.append('redirect_uri', process.env.REACT_APP_MERCADOLIBRE_REDIRECT_URI);

        const response = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params
        });
        const data = await response.json();

        if (data.access_token) {
          localStorage.setItem('mercadolibre_token', data.access_token);
          setMessage('Autenticación exitosa. Obteniendo publicaciones...');
          // Redirige a la ruta de publicaciones
          navigate('/mercadolibre/publicaciones');
        } else {
          setMessage('Error al obtener el token.');
          console.error('Detalles:', data);
        }
      } catch (error) {
        setMessage('Error en el intercambio de token.');
        console.error(error);
      }
    };

    exchangeCodeForToken();
  }, [navigate]);

  return (
    <div style={{ padding: '20px' }}>
      <h1>MercadoLibre - Callback</h1>
      <p>{message}</p>
    </div>
  );
};

export default MercadoLibreCallback;
