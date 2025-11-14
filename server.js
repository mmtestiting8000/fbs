// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// MongoDB SETUP
// -----------------------------
const mongoUri = process.env.MONGO_URI;
let db = null;

async function connectDB() {
    console.log("🔌 Conectando a MongoDB...");

    try {
        if (!mongoUri) {
            console.error("❌ ERROR: MONGO_URI no está definida!");
            return;
        }

        const client = new MongoClient(mongoUri, {
            serverSelectionTimeoutMS: 5000
        });

        await client.connect();
        db = client.db("fb_scraper");

        console.log("✅ MongoDB conectado");
    } catch (err) {
        console.error("❌ Error conectando a Mongo:", err);
    }
}

connectDB();

// -----------------------------
// GET /comments
// -----------------------------
app.get("/comments", async (req, res) => {
    try {
        if (!db) return res.json([]);

        const last = await db.collection("comments")
            .find({})
            .sort({ _id: -1 })
            .limit(1)
            .toArray();

        return res.json(last.length ? last[0].data : []);
    } catch (err) {
        console.error("❌ Error GET /comments:", err);
        res.status(500).json({ error: "Error al leer comentarios" });
    }
});

// -----------------------------
// POST /scrape
// -----------------------------
app.post("/scrape", async (req, res) => {
    const { apiToken, facebookUrl, limitComments } = req.body;

    if (!apiToken || !facebookUrl)
        return res.status(400).json({ error: "Faltan parámetros." });

    try {
        // Ejecutar tarea de Apify
        const run = await fetch(
            `https://api.apify.com/v2/actor-tasks/facebook-comments-run/run-sync?token=${apiToken}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startUrls: [{ url: facebookUrl }],
                    resultsLimit: Number(limitComments) || 50
                })
            }
        );

        const output = await run.json();

        if (!output?.data?.defaultDatasetId)
            return res.status(500).json({ error: "No se obtuvo datasetId." });

        const datasetId = output.data.defaultDatasetId;

        const datasetReq = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
        );

        const dataset = await datasetReq.json();

        // Guardar en Mongo
        if (db) {
            await db.collection("comments").insertOne({
                timestamp: new Date(),
                data: dataset
            });
        }

        res.json({ ok: true, data: dataset });
    } catch (err) {
        console.error("❌ Error en /scrape:", err);
        res.status(500).json({ error: "Error ejecutando scrape." });
    }
});

// -----------------------------
// SERVIR FRONTEND (index.html + app.js)
// -----------------------------
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🔥 Servidor LISTO en puerto ${PORT}`);
});
