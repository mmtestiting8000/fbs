$(document).ready(function () {

    const apiBase = "";

    function log(msg) {
        $("#consoleOutput").append(msg + "\n");
        $("#consoleOutput").scrollTop($("#consoleOutput")[0].scrollHeight);
    }

    // LOAD LAST COMMENTS ON START -----------------------------
    async function loadComments() {
        $("#status").text("⏳ Cargando datos desde /comments...");

        try {
            const res = await fetch(`${apiBase}/comments`);
            log("Fetching /comments ...");

            const raw = await res.json();
            log("Respuesta cruda: " + JSON.stringify(raw));

            if (!Array.isArray(raw) || raw.length === 0) {
                $("#status").text("ℹ No hay comentarios para mostrar.");
                $("#commentsTable tbody").html("");
                return;
            }

            $("#status").text(`Mostrando ${raw.length} comentarios.`);
            renderTable(raw);

        } catch (err) {
            console.error(err);
            $("#status").text("Error consultando la API.");
        }
    }

    // RENDER TABLE -------------------------------------------
    function renderTable(data) {
        const tbody = $("#commentsTable tbody");
        tbody.html("");

        data.forEach(c => {
            const row = `
                <tr>
                  <td>${c.postTitle || ""}</td>
                  <td>${c.authorName || "N/A"}</td>
                  <td>${c.text || ""}</td>
                  <td>${c.likesCount || 0}</td>
                  <td><a href="${c.facebookUrl}" target="_blank">Abrir</a></td>
                </tr>`;
            tbody.append(row);
        });
    }

    // RUN SCRAPER --------------------------------------------
    $("#btnScrape").click(async function () {
        const token = $("#apifyToken").val().trim();
        const urls = $("#fbUrls").val().trim().split("\n").filter(x => x.length > 3);
        const limit = parseInt($("#limit").val()) || 200;

        if (!token) return alert("Debes ingresar el token de Apify.");
        if (urls.length === 0) return alert("Debes ingresar al menos una URL.");

        $("#status").text("⏳ Ejecutando scraper...");
        log("Ejecutando run-scraper...");

        try {
            const res = await fetch(`${apiBase}/run-scraper`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, urls, limit })
            });

            const data = await res.json();

            log("Scraper output: " + JSON.stringify(data));

            if (!data.comments) {
                $("#status").text("Error ejecutando el scraper.");
                return;
            }

            // SAVE TO DB
            await fetch(`${apiBase}/save-comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comments: data.comments })
            });

            $("#status").text("Scrape guardado. Actualizando tabla...");
            loadComments();

        } catch (err) {
            log("ERROR SCRAPER: " + err.toString());
            $("#status").text("Error ejecutando scraper.");
        }
    });

    // REFRESH ----------------------------------------
    $("#btnRefresh").click(loadComments);

    // CSV EXPORT -------------------------------------
    $("#btnExportCSV").click(function () {
        const rows = [];
        $("#commentsTable tr").each(function () {
            const cols = $(this).find("td,th").map(function () {
                return '"' + ($(this).text().trim()) + '"';
            }).get();
            rows.push(cols.join(","));
        });

        const blob = new Blob([rows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "comments.csv";
        a.click();
    });

    loadComments();
});
