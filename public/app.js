function log(msg) {
    const box = document.getElementById("logBox");
    box.textContent += `\n${msg}`;
    box.scrollTop = box.scrollHeight;
}

async function loadComments() {
    log("⏳ Cargando datos desde /comments...");

    try {
        const res = await fetch("/comments");
        log("Fetching /comments ...");

        const raw = await res.json();
        log("Respuesta cruda: " + JSON.stringify(raw));

        const tableBody = document
            .getElementById("commentsTable")
            .querySelector("tbody");

        tableBody.innerHTML = "";

        if (!raw || raw.length === 0) {
            log("ℹ No hay comentarios para mostrar.");
            return;
        }

        raw.forEach((item) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${item.name}</td>
                <td>${item.comment}</td>
                <td>${item.date}</td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (err) {
        log("❌ Error consultando la API.");
    }
}

async function runScraper() {
    log("Ejecutando run-scraper...");

    const apiToken = document.getElementById("apiToken").value.trim();
    const facebookUrl = document.getElementById("facebookUrl").value.trim();
    const maxComments = document.getElementById("maxComments").value.trim();

    const body = { apiToken, facebookUrl, maxComments };

    try {
        const res = await fetch("/run-scraper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        log("Scraper output: " + JSON.stringify(data));

        await loadComments();

    } catch (err) {
        log("❌ Error ejecutando el scraper.");
    }
}

document.getElementById("runScraperBtn").addEventListener("click", runScraper);

// Auto cargar comentarios
loadComments();
