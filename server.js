// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // Carga las variables de entorno desde el archivo .env

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/proxyOrders", async (req, res) => {
  const { seller, fromDate, toDate } = req.query;
  const accessToken = process.env.ML_ACCESS_TOKEN;

  // Validar que se reciban todos los parámetros necesarios
  if (!seller || !fromDate || !toDate) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  // Construir la URL para la API de MercadoLibre
  const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${seller}&order.date_created.from=${encodeURIComponent(fromDate)}&order.date_created.to=${encodeURIComponent(toDate)}&order.status=paid&sort=date_desc`;

  console.log("URL de la API:", ordersUrl);

  try {
    const response = await fetch(ordersUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Verifica que la respuesta sea de tipo JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      console.error("Respuesta no JSON:", responseText);
      return res.status(500).json({
        error: "Respuesta no válida de MercadoLibre",
        details: responseText,
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error interno en proxyOrders:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
