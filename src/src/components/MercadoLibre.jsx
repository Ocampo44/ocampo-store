import React from 'react';

const MercadoLibre = () => {
  const handleConnect = () => {
    const clientId = process.env.REACT_APP_MERCADOLIBRE_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.REACT_APP_MERCADOLIBRE_REDIRECT_URI);

    // Redirige a la página de autenticación de MercadoLibre
    window.location.href = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>MercadoLibre - Inicio</h1>
      <button onClick={handleConnect}>Conectar con MercadoLibre</button>
    </div>
  );
};

export default MercadoLibre;
