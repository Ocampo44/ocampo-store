export default async function handler(req, res) {
    const { seller, fromDate, toDate } = req.query;
    const accessToken = process.env.ML_ACCESS_TOKEN;
  
    // Validar parámetros obligatorios
    if (!seller || !fromDate || !toDate) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }
  
    // Construir la URL para la API de MercadoLibre utilizando template literal (backticks)
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${seller}&order.date_created.from=${encodeURIComponent(
      fromDate
    )}&order.date_created.to=${encodeURIComponent(
      toDate
    )}&order.status=paid&sort=date_desc`;
  
    console.log("URL de la API:", ordersUrl);
  
    try {
      const response = await fetch(ordersUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
  
      // Imprimir detalles de la respuesta para depuración
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers.get("content-type"));
  
      // Si la respuesta no es exitosa, devolver un JSON con el error
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error en proxyOrders:", errorText);
        return res
          .status(response.status)
          .json({ error: "Error al obtener órdenes", details: errorText });
      }
  
      // Verificar si la respuesta es JSON antes de parsearla
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.error("Error: Respuesta no es JSON");
        return res
          .status(500)
          .json({ error: "Respuesta no válida de MercadoLibre", details: "No es JSON" });
      }
  
      // Convertir la respuesta a JSON y enviarla al cliente
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      console.error("Error interno en proxyOrders:", error);
      res.status(500).json({ error: "Error interno del servidor", details: error.message });
    }
  }
  