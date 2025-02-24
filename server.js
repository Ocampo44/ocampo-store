// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // Carga las variables de entorno desde el archivo .env

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint para hacer proxy a la API de MercadoLibre
app.get("/api/proxyOrders", async (req, res) => {
  const { seller, fromDate, toDate } = req.query;
  const accessToken = process.env.ML_ACCESS_TOKEN;

  // Validar que se reciban todos los parámetros necesarios
  if (!seller || !fromDate || !toDate) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  // Construir la URL para la API de MercadoLibre
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

    console.log("Response status:", response.status);
    console.log("Response content-type:", response.headers.get("content-type"));

    // Leer la respuesta completa para depuración
    const responseText = await response.text();
    console.log("Response body:", responseText);

    // Verificar que la respuesta sea JSON
    if (!response.headers.get("content-type")?.includes("application/json")) {
      console.error("Error: Respuesta no es JSON");
      return res.status(500).json({
        error: "Respuesta no válida de MercadoLibre",
        details: "No es JSON",
      });
    }

    // Convertir la respuesta a JSON y devolverla
    const data = JSON.parse(responseText);
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
