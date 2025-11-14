// app.js

function log(msg) {
    const box = document.getElementById("log");
    box.value += msg + "\n";
    box.scrollTop = box.scrollHeight;
}

// ---------------------------------------------
// Cargar últimos comentarios desde backend
// ---------------------------------------------
async function loadComments() {
    log("⏳ Cargando últimos comentarios...");

    try {
        const res = await fetch("/comments");
        const data = await res.json();

        if (!data || data.length === 0) {
            log("ℹ No hay comentarios guardados.");
            document.querySelector("#comments-body").innerHTML =
                `<tr><td colspan="3">Sin datos</td></tr>`;
            return;
        }

        renderTable(data);
        log("✅ Comentarios cargados.");
    } catch (err) {
        console.error(err);
        log("❌ Error obteniendo comentarios.");
    }
}

function renderTable(rows) {
    const body = document.querySelector("#comments-body");
    body.innerHTML = "";

    rows.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${c.fromName || "-"}</td>
            <td>${c.text || "-"}</td>
            <td>${c.publishedAt || "-"}</td>
        `;
        body.appendChild(tr);
    });
}

// ---------------------------------------------
// Ejecutar scrap
// ---------------------------------------------
document.querySelector("#scrapeBtn").addEventListener("click", async () => {
    const apiToken = document.querySelector("#apiToken").value;
    const facebookUrl = document.querySelector("#facebookUrl").value;
    const limitComments = document.querySelector("#limitComments").value;

    if (!apiToken || !facebookUrl) {
        log("⚠ Llene todos los campos.");
        return;
    }

    log("🚀 Iniciando scrape...");

    try {
        const res = await fetch("/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiToken, facebookUrl, limitComments })
        });

        const data = await res.json();

        if (!data.ok) {
            log("❌ Error: " + data.error);
            return;
        }

        log("📥 Scrap completado. Actualizando tabla...");

        renderTable(data.data);
    } catch (err) {
        console.error(err);
        log("❌ Error ejecutando scrape.");
    }
});

// Inicial
loadComments();
