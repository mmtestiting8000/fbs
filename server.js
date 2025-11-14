import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public")); 

// MongoDB CONNECTION -------------------------
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ ERROR FATAL: MONGO_URI no está definido en Render");
    process.exit(1);
}

const client = new MongoClient(MONGO_URI);

let commentsCollection;

async function connectDB() {
    await client.connect();
    const db = client.db("fb_scraper");
    commentsCollection = db.collection("comments");
    console.log("MongoDB conectado ✔");
}
connectDB();

// --------------------------------------------

// SAVE SCRAPER RESULTS ------------------------
app.post("/save-comments", async (req, res) => {
    try {
        const comments = req.body.comments;

        if (!Array.isArray(comments)) {
            return res.status(400).json({ error: "comments must be an array" });
        }

        const batchId = new ObjectId().toString();

        const docs = comments.map(c => ({
            ...c,
            batchId,
            createdAt: new Date()
        }));

        await commentsCollection.insertMany(docs);

        return res.json({ success: true });
    } catch (err) {
        console.error("Error saving comments:", err);
        return res.status(500).json({ error: "Failed saving comments" });
    }
});

// GET ONLY THE LAST SCRAPE --------------------
app.get("/comments", async (req, res) => {
    try {
        const latest = await commentsCollection
            .find({})
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();

        if (latest.length === 0) {
            return res.json([]);
        }

        const lastBatchId = latest[0].batchId;

        const lastBatchComments = await commentsCollection
            .find({ batchId: lastBatchId })
            .sort({ createdAt: 1 })
            .toArray();

        return res.json(lastBatchComments);
    } catch (err) {
        console.error("Error fetching last batch:", err);
        return res.status(500).json({ error: "Failed loading comments" });
    }
});

// RUN SCRAPER VIA API -------------------------
app.post("/run-scraper", async (req, res) => {
    try {
        const { token, urls, limit } = req.body;

        const runResponse = await fetch("https://api.apify.com/v2/actor-tasks/facebook-scraper/run-sync", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                startUrls: urls.map(u => ({ url: u })),
                resultsLimit: limit || 200
            })
        });

        const data = await runResponse.json();

        if (!data.defaultDatasetId) {
            return res.status(500).json({ error: "No dataset from Apify" });
        }

        const itemsResponse = await fetch(
            `https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items?clean=true`
        );

        const rawItems = await itemsResponse.json();

        const comments = rawItems.map(item => ({
            postTitle: item?.postTitle || "",
            text: item?.text || "",
            likesCount: item?.likesCount || 0,
            facebookUrl: item?.facebookUrl || "",
            authorName: item?.authorName || "",
        }));

        return res.json({ comments });

    } catch (err) {
        console.error("SCRAPER error:", err);
        res.status(500).json({ error: "Scraper failed" });
    }
});

// START SERVER -------------------------
app.listen(3000, () => console.log("Server running on port 3000"));
