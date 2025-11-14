// server.js
import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---------------------------
// MIDDLEWARE
// ---------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// ENDPOINT: /run
// ---------------------------
app.post("/run", async (req, res) => {
  try {
    console.log("Enviando petición /run");

    const { fbUrls, limit, apifyToken } = req.body;

    // ---------------------------
    // VALIDACIONES
    // ---------------------------
    if (!fbUrls || !Array.isArray(fbUrls) || fbUrls.length === 0) {
      return res.status(400).json({
        error: "fbUrls debe ser un arreglo con al menos una URL."
      });
    }

    // Convertir URLs simples → startUrls: [{url:"..."}]
    const startUrls = fbUrls
      .map(u => (typeof u === "string" && u.trim() !== "" ? { url: u.trim() } : null))
      .filter(Boolean);

    if (startUrls.length === 0) {
      return res.status(400).json({
        error: "No hay URLs válidas en fbUrls."
      });
    }

    const tokenToUse = apifyToken || process.env.APIFY_TOKEN;

    if (!tokenToUse) {
      return res.status(400).json({
        error: "No hay token de Apify disponible (ni en el servidor ni en el POST)."
      });
    }

    // ---------------------------
    // CREAR EJECUCIÓN EN APIFY
    // ---------------------------
    const runPayload = {
      startUrls,
      resultsLimit: limit ? Number(limit) : undefined
    };

    console.log("Payload enviado a Apify:", runPayload);

    const response = await fetch(
      "https://api.apify.com/v2/acts/apify~facebook-post-comments-scraper/run?waitForFinish=1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ input: runPayload })
      }
    );

    const json = await response.json();

    console.log("Respuesta /run:", json);

    if (json.error) {
      return res.status(400).json({ error: json.error });
    }

    return res.json(json);

  } catch (err) {
    console.error("❌ Error en /run:", err);
    return res.status(500).json({
      error: "Error interno en servidor",
      details: err.message
    });
  }
});

// ---------------------------
// ENDPOINT: /data
// obtener datos almacenados
// ---------------------------
app.get("/data", async (req, res) => {
  try {
    const tokenToUse = process.env.APIFY_TOKEN;
    if (!tokenToUse) {
      return res.status(400).json({
        error: "No hay APIFY_TOKEN configurado en el servidor."
      });
    }

    const datasetRes = await fetch(
      "https://api.apify.com/v2/datasets?limit=1&desc=1",
      {
        headers: { Authorization: `Bearer ${tokenToUse}` }
      }
    );

    const datasetJson = await datasetRes.json();

    if (!datasetJson?.data?.items?.length) {
      return res.json({ items: [] });
    }

    const datasetId = datasetJson.data.items[0].id;

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json`,
      {
        headers: { Authorization: `Bearer ${tokenToUse}` }
      }
    );

    const itemsJson = await itemsRes.json();
    return res.json({ items: itemsJson });

  } catch (err) {
    console.error("❌ Error en /data:", err);
    return res.status(500).json({
      error: "Error al obtener datos",
      details: err.message
    });
  }
});

// ---------------------------
// INICIAR SERVIDOR
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
