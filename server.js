// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/facebook_scraper';
const DEFAULT_APIFY_TOKEN = process.env.DEFAULT_APIFY_TOKEN || '';

let dbClient;
let commentsCollection;

// --- CONEXIÓN MONGO ---
async function startDb() {
  try {
    dbClient = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      tls: true, // 🔹 fuerza conexión TLS (Atlas exige esto)
      tlsAllowInvalidCertificates: true, // evitar error SSL interno en Render
    });
    await dbClient.connect();
    const db = dbClient.db();
    commentsCollection = db.collection('comments');
    await commentsCollection.createIndex({ apifyRunId: 1 });
    console.log('✅ MongoDB conectado correctamente');
  } catch (err) {
    console.error('❌ Error conectando a Mongo:', err);
    process.exit(1);
  }
}
startDb();

// --- FUNCIONES DE APIFY ---
async function startApifyRun(apifyToken, fbUrls, limit) {
  const runUrl = `https://api.apify.com/v2/acts/apify~facebook-comments-scraper/runs?token=${apifyToken}`;
  const actorInput = {
    fbUrls, // ahora debe ser un array
  };
  if (limit) actorInput.maxComments = parseInt(limit, 10);

  const res = await axios.post(runUrl, actorInput, {
    headers: { 'Content-Type': 'application/json' },
    validateStatus: s => true,
  });

  if (res.status !== 201) {
    const errMsg =
      res.data?.error?.message || res.data || res.statusText;
    const e = new Error('Error al iniciar actor Apify: ' + errMsg);
    e.status = res.status;
    throw e;
  }

  return res.data.data.id;
}

async function waitForRunToFinish(apifyToken, runId, onProgress) {
  const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`;
  while (true) {
    const res = await axios.get(statusUrl);
    const data = res.data;
    const status = data.data?.status;
    if (onProgress) onProgress(status);
    if (status === 'SUCCEEDED') return data.data.defaultDatasetId;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status))
      throw new Error('La ejecución falló en Apify: ' + status);
    await new Promise(r => setTimeout(r, 5000));
  }
}

async function fetchCommentsFromDataset(apifyToken, datasetId) {
  const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&clean=true`;
  const res = await axios.get(datasetUrl);
  return res.data;
}

// --- ENDPOINTS ---
app.post('/api/scrape', async (req, res) => {
  const { fbUrl, limit, apifyToken: tokenFromClient } = req.body;
  const apifyToken = tokenFromClient || DEFAULT_APIFY_TOKEN;

  if (!apifyToken)
    return res.status(400).json({ error: 'Falta token de Apify' });
  if (!fbUrl)
    return res.status(400).json({ error: 'fbUrl requerido' });

  try {
    const fbUrls = Array.isArray(fbUrl) ? fbUrl : [fbUrl];
    const runId = await startApifyRun(apifyToken, fbUrls, limit);

    const datasetId = await waitForRunToFinish(apifyToken, runId, status =>
      console.log('Apify run status:', status)
    );

    const comments = await fetchCommentsFromDataset(apifyToken, datasetId);
    const docs = comments.map(c => ({
      apifyRunId: runId,
      datasetId,
      fetchedAt: new Date(),
      userId: c.userId || null,
      userName: c.userName || null,
      commentText: c.commentText || null,
      commentId: c.commentId || null,
      reactionCount: c.reactionCount || null,
      parentId: c.parentId || null,
      raw: c,
    }));

    if (docs.length) await commentsCollection.insertMany(docs);

    res.json({ ok: true, runId, datasetId, imported: docs.length });
  } catch (err) {
    console.error('Error en /api/scrape:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.get('/api/comments', async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const page = Math.max(0, parseInt(req.query.page || '0', 10));
  try {
    const cursor = commentsCollection
      .find()
      .sort({ fetchedAt: -1 })
      .skip(page * limit)
      .limit(limit);
    const items = await cursor.toArray();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
