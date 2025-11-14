import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------
// SERVIR FRONTEND
// ------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

// ------------------------------
// MONGO
// ------------------------------
let db = null;
async function initMongo() {
  try {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db("fb_scraper");
    console.log("✅ Mongo conectado");
  } catch (err) {
    console.error("❌ Error Mongo:", err.message);
  }
}
initMongo();

// ------------------------------
// GET ÚLTIMO SCRAPE
// ------------------------------
app.get("/comments", async (req, res) => {
  try {
    if (!db) return res.json([]);

    const last = await db.collection("comments")
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .toArray();

    res.json(last.length ? last[0].data : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
// POST SCRAPE
// ------------------------------
app.post("/scrape", async (req, res) => {
  try {
    const { apiToken, facebookUrl, limitComments } = req.body;

    if (!apiToken || !facebookUrl)
      return res.status(400).json({ error: "Faltan datos" });

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

    const runData = await run.json();
    const datasetId = runData?.data?.defaultDatasetId;

    if (!datasetId)
      return res.status(500).json({ error: "No dataset" });

    const datasetReq = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
    );

    let rawData = await datasetReq.json();

    // SOLO los campos solicitados
    const filtered = rawData.map(c => ({
      postTitle: c.postTitle || "",
      text: c.text || "",
      likesCount: c.likesCount || 0,
      facebookUrl: facebookUrl
    }));

    if (db) await db.collection("comments").insertOne({ timestamp: new Date(), data: filtered });

    res.json({ ok: true, data: filtered });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 Server ON:", PORT));
