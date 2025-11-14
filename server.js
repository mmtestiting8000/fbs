import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI;

// Variable global para almacenar la conexión (si existe)
let db = null;

/* ======================================================
   1. Intentar conectar a Mongo (pero sin detener el server si falla)
====================================================== */
async function connectToMongo() {
  try {
    console.log("Intentando conectar a MongoDB...");

    const client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 4000, // evita que tarde demasiado
    });

    await client.connect();
    db = client.db();
    console.log("✅ MongoDB conectado correctamente");

  } catch (error) {
    console.warn("⚠️ No se pudo conectar a MongoDB, el scraper funcionará sin base de datos.");
    console.warn("Detalle:", error.message);
    db = null; // aseguramos estado consistente
  }
}

connectToMongo();

/* ======================================================
   2. SCRAPER (ejemplo)
====================================================== */
async function scrapePage() {
  const url = "https://www.example.com/";

  try {
    const response = await fetch(url);
    const html = await response.text();

    return {
      ok: true,
      data: html.substring(0, 200), // ejemplo
    };

  } catch (error) {
    return { ok: false, error: "Error al scrapear: " + error.message };
  }
}

/* ======================================================
   3. Endpoint principal con fallback por si Mongo está caído
====================================================== */
app.get("/scrape", async (req, res) => {
  const result = await scrapePage();

  if (!result.ok) {
    return res.status(500).json({ error: result.error });
  }

  // Si Mongo está disponible, insertar
  if (db) {
    try {
      await db.collection("scrapedData").insertOne({
        timestamp: new Date(),
        content: result.data,
      });

      return res.json({
        mongo: "ok",
        message: "Scrape almacenado correctamente",
        data: result.data,
      });

    } catch (error) {
      console.warn("⚠️ Error insertando en Mongo:", error.message);
    }
  }

  // Si Mongo NO está disponible → devolver dato con advertencia
  return res.json({
    mongo: "offline",
    warning: "MongoDB no está conectado, devolviendo sólo los datos del scraper",
    data: result.data,
  });
});

/* ======================================================
   4. Servidor iniciado
====================================================== */
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
