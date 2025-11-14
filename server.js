import express from "express";
import bodyParser from "body-parser";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Token por defecto desde variable de entorno
const DEFAULT_APIFY_TOKEN = process.env.APIFY_TOKEN || "";

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));


// ---------------------------------------------------------------------
// ✨ ENDPOINT PARA EJECUTAR SCRAPER DE FACEBOOK COMMENTS
// ---------------------------------------------------------------------
app.post("/run", async (req, res) => {
  try {
    const { fbUrls, limit, token } = req.body;

    if (!Array.isArray(fbUrls) || fbUrls.length === 0) {
      return res.status(400).json({ error: "fbUrls debe ser un array con al menos 1 URL." });
    }

    const apiToken = token?.trim() || DEFAULT_APIFY_TOKEN;
    if (!apiToken) {
      return res.status(400).json({ error: "No hay token de Apify disponible." });
    }

    const startUrl = `https://api.apify.com/v2/acts/apify~facebook-comments-scraper/runs?token=${apiToken}`;

    const payload = {
      fbUrls,
      resultsLimit: limit ? Number(limit) : undefined
    };

    const runRes = await fetch(startUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const runData = await runRes.json();

    if (!runRes.ok) {
      return res.status(500).json({ error: runData.error || "No se pudo iniciar el actor." });
    }

    const runId = runData.data.id;

    // Polling a Apify
    const waitForRun = async () => {
      const url = `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`;
      while (true) {
        const check = await fetch(url);
        const json = await check.json();

        if (json.data.status === "SUCCEEDED") return json.data;
        if (json.data.status === "FAILED") throw new Error("El actor falló");

        await new Promise(r => setTimeout(r, 3000));
      }
    };

    const runFinal = await waitForRun();

    // Obtener dataset
    const datasetId = runFinal.defaultDatasetId;
    const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}&clean=true`;

    const itemsRes = await fetch(datasetUrl);
    const items = await itemsRes.json();

    res.json({ success: true, data: items });

  } catch (err) {
    res.status(500).json({ error: err.message || "Error desconocido" });
  }
});


// ---------------------------------------------------------------------
// ✨ ENDPOINT PARA GUARDAR Y CONSULTAR COMENTARIOS (ARCHIVO JSON LOCAL)
// ---------------------------------------------------------------------
import fs from "fs";
const DB_FILE = path.join(__dirname, "comments.json");

if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]", "utf8");

app.post("/save", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    data.push(...req.body.items);
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/comments", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ---------------------------------------------------------------------
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
