import express from "express";
import bodyParser from "body-parser";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_APIFY_TOKEN = process.env.APIFY_TOKEN || "";

app.use(bodyParser.json());

// LOGS
app.use((req, res, next) => {
  console.log("➡️ Request:", req.method, req.url);
  next();
});

// =============== POST /run ===============
app.post("/run", async (req, res) => {
  try {
    console.log("📥 Body recibido:", req.body);

    const { fbUrls, limit, token } = req.body;

    if (!Array.isArray(fbUrls) || fbUrls.length === 0) {
      return res.status(400).json({ error: "fbUrls debe ser un array con URLs" });
    }

    const apiToken = token?.trim() || DEFAULT_APIFY_TOKEN;
    if (!apiToken) return res.status(400).json({ error: "No hay token disponible" });

    // Iniciar actor
    const start = await fetch(`https://api.apify.com/v2/acts/apify~facebook-comments-scraper/runs?token=${apiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fbUrls,
        resultsLimit: limit ? Number(limit) : undefined
      })
    });

    const startJson = await start.json();
    console.log("▶️ start JSON:", startJson);

    if (!start.ok) return res.status(500).json(startJson);

    const runId = startJson.data.id;

    // Polling
    while (true) {
      const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`);
      const data = await poll.json();

      console.log("⏳ Poll:", data.data.status);

      if (data.data.status === "SUCCEEDED") {
        const datasetId = data.data.defaultDatasetId;

        const itemsRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}&clean=true`
        );

        const items = await itemsRes.json();

        return res.json({ success: true, data: items });
      }

      if (data.data.status === "FAILED") {
        return res.status(500).json({ error: "Actor failed" });
      }

      await new Promise(r => setTimeout(r, 3000));
    }

  } catch (err) {
    console.error("🔥 Error en /run:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============== GUARDAR / CONSULTAR JSON LOCAL ===============
const DB_FILE = path.join(__dirname, "comments.json");
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

app.post("/save", (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE));
  db.push(...req.body.items);
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  res.json({ success: true });
});

app.get("/comments", (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE));
  res.json({ success: true, data: db });
});

// ❗ IMPORTANTE: archivos estáticos al FINAL
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log(`🔥 Server running http://localhost:${PORT}`));
