// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// MongoDB SETUP
// -----------------------------
const mongoUri = process.env.MONGO_URI;

let db = null;

async function connectDB() {
    console.log("🔌 Intentando conectar a MongoDB...");

    if (!mongoUri) {
        console.error("❌ ERROR: MONGO_URI no está definida.");
        return;
    }

    try {
        const client = new MongoClient(mongoUri);

        // timeout de 8s para evitar freeze
        await Promise.race([
            client.connect(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout conectando a MongoDB")), 8000)
            )
        ]);

        db = client.db("fb_scraper");
        console.log("✅ MongoDB conectado");
    } catch (err) {
        console.error("❌ Falló conexión MongoDB:", err);
    }
}

// Llamada segura
connectDB().catch(err => console.error("❌ Error inesperado conectDB():", err));


// -----------------------------
// GET /comments
// -----------------------------
app.get("/comments", async (req, res) => {
    try {
        if (!db) {
            console.log("⚠ MongoDB no conectado, devolviendo []");
            return res.json([]);
        }

        const last = await db.collection("comments")
            .find({})
            .sort({ _id: -1 })
            .limit(1)
            .toArray();

        return res.json(last.length ? last[0].data : []);
    } catch (err) {
        console.error("❌ Error GET /comments:", err);
        res.status(500).json({ error: "Error al leer comentarios." });
    }
});


// -----------------------------
// POST /scrape
// -----------------------------
app.post("/scrape", async (req, res) => {
    const { apiToken, facebookUrl, limitComments } = req.body;

    console.log("📩 POST /scrape recibido:", req.body);

    if (!apiToken || !facebookUrl)
        return res.status(400).json({ error: "Faltan parámetros." });

    try {
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

        if (db) {
            await db.collection("comments").insertOne({
                timestamp: new Date(),
                data: dataset
            });
            console.log("💾 Datos guardados en MongoDB.");
        }

        res.json({ ok: true, data: dataset });

    } catch (err) {
        console.error("❌ Error en /scrape:", err);
        res.status(500).json({ error: "Error ejecutando scrape." });
    }
});

// -----------------------------
console.log("🚀 A punto de iniciar servidor...");
app.listen(3000, () => console.log("🔥 Servidor en puerto 3000 LISTO"));
