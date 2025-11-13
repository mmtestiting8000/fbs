// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();

// Log de cada request
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/facebook_scraper';
const DEFAULT_APIFY_TOKEN = process.env.DEFAULT_APIFY_TOKEN || '';

let dbClient;
let commentsCollection;

async function startDb() {
  try {
    dbClient = new MongoClient(MONGO_URI, { tls: true, serverSelectionTimeoutMS: 20000 });
    await dbClient.connect();
    const db = dbClient.db();
    commentsCollection = db.collection('comments');
    await commentsCollection.createIndex({ apifyRunId: 1 });
    console.log('✅ Conectado a MongoDB');
  } catch (err) {
    console.error('❌ Error conectando a MongoDB:', err.message);
    process.exit(1);
  }
}
startDb();

async function startApifyRun(apifyToken, fbUrls, limit) {
  const runUrl = `https://api.apify.com/v2/acts/apify~facebook-comments-scraper/runs?token=${apifyToken}`;
  const actorInput = {
    postUrls: fbUrls,
    resultsLimit: limit ? parseInt(limit, 10) : undefined
  };
  console.log('🚀 Lanzando actor Apify con payload:', actorInput);
  const res = await axios.post(runUrl, actorInput, {
    headers: { 'Content-Type': 'application/json' },
    validateStatus: s => true
  });
  if (res.status !== 201) {
    const errMsg = res.data?.error?.message || res.data || res.statusText;
    throw new Error(`Error al iniciar actor Apify: ${errMsg}`);
  }
  const runId = res.data.data.id;
  console.log('✅ Actor iniciado. Run ID:', runId);
  return runId;
}

async function waitForRunToFinish(apifyToken, runId, onProgress) {
  const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`;
  while (true) {
    const res = await axios.get(statusUrl);
    const data = res.data;
    const status = data.data?.status;
    if (onProgress) onProgress(status, data);
    console.log('⏳ Estado del run:', status);
    if (status === 'SUCCEEDED') {
      console.log('✅ Ejecución Apify completada.');
      return data.data.defaultDatasetId;
    } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`❌ La ejecución falló en Apify: ${status}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

async function fetchCommentsFromDataset(apifyToken, datasetId) {
  const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&clean=true`;
  console.log('📦 Descargando dataset:', datasetId);
  const res = await axios.get(datasetUrl);
  return res.data;
}

app.post('/api/scrape', async (req, res) => {
  console.log('📥 Body recibido:', req.body);
  const { fbUrls, limit, apifyToken: tokenFromClient } = req.body;
  const apifyToken = tokenFromClient || DEFAULT_APIFY_TOKEN;

  if (!apifyToken) {
    return res.status(400).json({
      error: 'Falta token de Apify. Proveer apifyToken en el body o configurar DEFAULT_APIFY_TOKEN en el servidor.'
    });
  }
  if (!fbUrls || !Array.isArray(fbUrls) || fbUrls.length === 0) {
    return res.status(400).json({ error: 'fbUrls requerido como array de URLs' });
  }

  try {
    const runId = await startApifyRun(apifyToken, fbUrls, limit);
    const datasetId = await waitForRunToFinish(apifyToken, runId);
    const comments = await fetchCommentsFromDataset(apifyToken, datasetId);
    const docs = comments.map(c => ({
      apifyRunId: runId,
      datasetId,
      fetchedAt: new Date(),
      facebookUrl: c.facebookUrl || null,
      commentUrl: c.commentUrl || null,
      id: c.id || null,
      userName: c.userName || null,
      commentText: c.text || c.comment || null,
      likes: c.likes || null,
      repliesCount: c.repliesCount || null,
      raw: c
    }));

    if (docs.length) {
      await commentsCollection.insertMany(docs);
    }

    res.json({
      ok: true,
      runId,
      datasetId,
      imported: docs.length,
      comments: docs
    });
  } catch (err) {
    console.error('❌ ERROR en /api/scrape:', err);
    res.status(500).json({ error: err.message || 'Error desconocido en /api/scrape' });
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
    console.error('❌ ERROR en /api/comments:', err);
    res.status(500).json({ error: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Error global no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor: ' + (err.message || err) });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
