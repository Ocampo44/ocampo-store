// api/proxyOrders.js

export default async function handler(req, res) {
    const { seller, fromDate, toDate } = req.query;
    // Obtén el token de forma segura desde las variables de entorno en Vercel
    const accessToken = process.env.ML_ACCESS_TOKEN;
  
    // Validar parámetros
    if (!seller || !fromDate || !toDate) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }
  
    // Construir la URL para la API de MercadoLibre
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${seller}&order.date_created.from=${encodeURIComponent(
      fromDate
    )}&order.date_created.to=${encodeURIComponent(
      toDate
    )}&order.status=paid&sort=date_desc`;
  
    try {
      const response = await fetch(ordersUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
  
      if (!response.ok) {
        return res.status(response.status).json({ error: "Error al obtener órdenes" });
      }
  
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
  