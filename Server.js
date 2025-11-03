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

async function startDb() {
  dbClient = new MongoClient(MONGO_URI);
  await dbClient.connect();
  const db = dbClient.db(); // usa nombre de DB del URI o por defecto
  commentsCollection = db.collection('comments');
  // Opcional: crear índices
  await commentsCollection.createIndex({ apifyRunId: 1 });
}
startDb().catch(err => {
  console.error('Error conectando a Mongo:', err);
  process.exit(1);
});

// Helper: lanzar actor en Apify
async function startApifyRun(apifyToken, fbUrl, limit) {
  const runUrl = `https://api.apify.com/v2/acts/easyapi~facebook-post-comments-scraper/runs?token=${apifyToken}`;
  const actorInput = { postUrls: [fbUrl] };
  if (limit) actorInput.maxComments = parseInt(limit, 10);

  const res = await axios.post(runUrl, actorInput, {
    headers: { 'Content-Type': 'application/json' },
    validateStatus: s => true
  });

  if (res.status !== 201) {
    const errMsg = res.data && res.data.error && res.data.error.message ? res.data.error.message : res.data || res.statusText;
    const e = new Error('Error al iniciar actor Apify: ' + errMsg);
    e.status = res.status;
    throw e;
  }
  return res.data.data.id;
}

// Helper: esperar a que termine la ejecución y devolver datasetId
async function waitForRunToFinish(apifyToken, runId, onProgress) {
  const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`;
  while (true) {
    const res = await axios.get(statusUrl);
    const data = res.data;
    const status = data.data && data.data.status;
    if (onProgress) onProgress(status, data);
    if (status === 'SUCCEEDED') {
      return data.data.defaultDatasetId;
    } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error('La ejecución falló en Apify: ' + status);
    }
    // Espera 5s
    await new Promise(r => setTimeout(r, 5000));
  }
}

// Helper: obtener items desde dataset
async function fetchCommentsFromDataset(apifyToken, datasetId) {
  const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&clean=true`;
  const res = await axios.get(datasetUrl);
  return res.data; // array
}

// Endpoint: iniciar extracción y guardar en Mongo
app.post('/api/scrape', async (req, res) => {
  const { fbUrl, limit, apifyToken: tokenFromClient } = req.body;
  const apifyToken = tokenFromClient || DEFAULT_APIFY_TOKEN;

  if (!apifyToken) {
    return res.status(400).json({ error: 'Falta token de Apify. Proveer apifyToken en el body o configurar DEFAULT_APIFY_TOKEN en el servidor.' });
  }
  if (!fbUrl) return res.status(400).json({ error: 'fbUrl requerido' });

  try {
    const runId = await startApifyRun(apifyToken, fbUrl, limit);
    // Opcional: responder de inmediato con runId y luego procesar en background.
    // Pero por requerimiento del user, procesamos y respondemos con resultado en esta misma petición (bloqueante).
    const datasetId = await waitForRunToFinish(apifyToken, runId, (status) => {
      // podríamos emitir logs
      console.log('Apify run status:', status);
    });

    const comments = await fetchCommentsFromDataset(apifyToken, datasetId);
    // Normalizar y guardar en Mongo
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
      raw: c
    }));

    if (docs.length) {
      await commentsCollection.insertMany(docs);
    }

    res.json({
      ok: true,
      runId,
      datasetId,
      imported: docs.length
    });
  } catch (err) {
    console.error('Error en /api/scrape:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Endpoint: listar comentarios guardados (paginado simple)
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

// Fallback: servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
