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

// ✅ Conexión MongoDB con TLS y timeouts configurados
async function startDb() {
  dbClient = new MongoClient(MONGO_URI, {
    tls: true,
    serverSelectionTimeoutMS: 20000,
  });
  await dbClient.connect();
  const db = dbClient.db();
  commentsCollection = db.collection('comments');
  console.log('✅ Conectado a MongoDB');
}
startDb().catch(err => {
  console.error('Error conectando a Mongo:', err);
  process.exit(1);
});

// ✅ Helper: lanzar actor en Apify (nuevo actor JEfR4bNJUZohgv5sb)
async function startApifyRun(apifyToken, fbUrl, limit, cookies) {
  const runUrl = `https://api.apify.com/v2/acts/JEfR4bNJUZohgv5sb/runs?token=${apifyToken}`;
  const actorInput = {
    facebookPostUrls: [fbUrl],
    maxItems: limit ? parseInt(limit, 10) : undefined,
    sortType: "newest",
    minDelay: 2,
    maxDelay: 5,
    cookies: cookies ? JSON.parse(cookies) : undefined,
    proxyConfiguration: { useApifyProxy: true }
  };

  const res = await axios.post(runUrl, actorInput, {
    headers: { 'Content-Type': 'application/json' },
    validateStatus: s => true
  });

  if (res.status !== 201) {
    const errMsg = res.data?.error?.message || res.data || res.statusText;
    throw new Error(`Error al iniciar actor Apify: ${errMsg}`);
  }
  return res.data.data.id;
}

// ✅ Helper: esperar a que termine la ejecución
async function waitForRunToFinish(apifyToken, runId, onProgress) {
  const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`;
  while (true) {
    const res = await axios.get(statusUrl);
    const data = res.data;
    const status = data.data?.status;
    if (onProgress) onProgress(status);
    if (status === 'SUCCEEDED') {
      return data.data.defaultDatasetId;
    } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error('La ejecución falló en Apify: ' + status);
    }
    await new Promise(r => setTimeout(r, 5000)); // espera 5 segundos
  }
}

// ✅ Helper: obtener los resultados del dataset
async function fetchCommentsFromDataset(apifyToken, datasetId) {
  const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&clean=true&format=json`;
  const res = await axios.get(datasetUrl, { validateStatus: s => true });
  if (res.status !== 200) throw new Error(`Error al obtener dataset: ${res.statusText}`);
  return res.data;
}

// ✅ Endpoint principal
app.post('/api/scrape', async (req, res) => {
  const { fbUrl, limit, cookies, apifyToken: tokenFromClient } = req.body;
  const apifyToken = tokenFromClient || DEFAULT_APIFY_TOKEN;

  if (!apifyToken)
    return res.status(400).json({ error: 'Falta token de Apify. Proveer apifyToken en el body o configurar DEFAULT_APIFY_TOKEN en el servidor.' });
  if (!fbUrl)
    return res.status(400).json({ error: 'fbUrl requerido' });

  try {
    const runId = await startApifyRun(apifyToken, fbUrl, limit, cookies);
    console.log('🔄 Apify run iniciado:', runId);

    const datasetId = await waitForRunToFinish(apifyToken, runId, (status) => {
      console.log('📊 Estado de ejecución Apify:', status);
    });

    const comments = await fetchCommentsFromDataset(apifyToken, datasetId);
    const docs = comments.map(c => ({
      apifyRunId: runId,
      datasetId,
      fetchedAt: new Date(),
      commentId: c.id || null,
      message: c.message || null,
      authorName: c.author?.name || null,
      authorUrl: c.author?.profile_url || null,
      reactionCount: c.reaction_count || 0,
      commentCount: c.comment_count || 0,
      raw: c
    }));

    if (docs.length) await commentsCollection.insertMany(docs);

    res.json({ ok: true, runId, datasetId, imported: docs.length });
  } catch (err) {
    console.error('❌ Error en /api/scrape:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ✅ Endpoint: listar comentarios guardados
app.get('/api/comments', async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const page = Math.max(0, parseInt(req.query.page || '0', 10));
  try {
    const cursor = commentsCollection.find().sort({ fetchedAt: -1 }).skip(page * limit).limit(limit);
    const items = await cursor.toArray();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ✅ Fallback: frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Servidor escuchando en puerto ${PORT}`));
