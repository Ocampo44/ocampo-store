// api/proxy.js
export default async function handler(req, res) {
    const { seller, token } = req.query;
  
    if (!seller || !token) {
      res.status(400).json({ error: "Faltan parámetros 'seller' o 'token'." });
      return;
    }
  
    const url = `https://api.mercadolibre.com/orders/search?seller=${seller}&order.status=paid`;
  
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!response.ok) {
        res.status(response.status).json({
          error: `Error en la respuesta de MercadoLibre: ${response.statusText}`,
        });
        return;
      }
  
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      console.error("Error en el proxy:", error);
      res.status(500).json({ error: "Error interno en el proxy" });
    }
  }
  