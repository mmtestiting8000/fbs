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
const MONGO_URI = process.env.MONGO_URI;
const DEFAULT_APIFY_TOKEN = process.env.DEFAULT_APIFY_TOKEN;

let dbClient, commentsCollection;

// 🔹 Conectar a MongoDB
async function startDb() {
  dbClient = new MongoClient(MONGO_URI);
  await dbClient.connect();
  const db = dbClient.db();
  commentsCollection = db.collection('comments');
  await commentsCollection.createIndex({ apifyRunId: 1 });
  console.log('✅ Conectado a MongoDB');
}
startDb().catch(err => {
  console.error('❌ Error conectando a Mongo:', err);
});

// 🔹 Lanza actor oficial de Apify
async function startApifyRun(token, fbUrls, limit) {
  const url = `https://api.apify.com/v2/acts/apify~facebook-comments-scraper/runs?token=${token}`;
  const input = { fbUrls };
  if (limit) input.maxComments = parseInt(limit);

  const res = await axios.post(url, input, { headers: { 'Content-Type': 'application/json' } });
  if (res.status !== 201) throw new Error(`Error al iniciar actor: ${res.statusText}`);
  return res.data.data.id;
}

// 🔹 Espera a que termine
async function waitForRunToFinish(token, runId) {
  const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`;
  while (true) {
    const res = await axios.get(statusUrl);
    const status = res.data.data.status;
    console.log('Apify run status:', status);
    if (status === 'SUCCEEDED') return res.data.data.defaultDatasetId;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status))
      throw new Error('La ejecución falló: ' + status);
    await new Promise(r => setTimeout(r, 5000));
  }
}

// 🔹 Descarga los comentarios
async function fetchComments(token, datasetId) {
  const res = await axios.get(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true`);
  return res.data;
}

// 🔹 Endpoint principal
app.post('/api/scrape', async (req, res) => {
  const { fbUrls, limit, apifyToken } = req.body;
  const token = apifyToken || DEFAULT_APIFY_TOKEN;

  if (!token) return res.status(400).json({ error: 'Falta token de Apify' });
  if (!fbUrls || !Array.isArray(fbUrls) || fbUrls.length === 0)
    return res.status(400).json({ error: 'fbUrls requerido como array de URLs' });

  try {
    const runId = await startApifyRun(token, fbUrls, limit);
    const datasetId = await waitForRunToFinish(token, runId);
    const comments = await fetchComments(token, datasetId);

    const docs = comments.map(c => ({
      apifyRunId: runId,
      datasetId,
      fetchedAt: new Date(),
      ...c
    }));

    if (docs.length) await commentsCollection.insertMany(docs);

    res.json({ ok: true, runId, datasetId, count: docs.length });
  } catch (err) {
    console.error('❌ Error en /api/scrape:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Listar comentarios
app.get('/api/comments', async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const page = Math.max(0, parseInt(req.query.page || '0', 10));
  const cursor = commentsCollection.find().sort({ fetchedAt: -1 }).skip(page * limit).limit(limit);
  const items = await cursor.toArray();
  res.json({ ok: true, items });
});

// 🔹 Servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`));
