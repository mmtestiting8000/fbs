$(document).ready(() => {

    function log(msg) {
        $("#consoleOutput").append(msg + "\n");
        $("#consoleOutput").scrollTop($("#consoleOutput")[0].scrollHeight);
    }

    // Ejecutar scraper
    $("#btnScrape").click(async () => {

        const token = $("#apifyToken").val().trim();
        const urls = $("#fbUrls").val().trim().split("\n").filter(x => x);
        const limit = $("#limit").val().trim();

        if (!urls.length) {
            alert("Debes ingresar al menos 1 URL.");
            return;
        }

        $("#status").text("Ejecutando scraper...");
        log("=== Enviando petición al backend ===");

        try {
            const res = await fetch("/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    fbUrls: urls,
                    limit: limit ? Number(limit) : undefined
                })
            });

            const data = await res.json();
            log("Respuesta /run:\n" + JSON.stringify(data, null, 2));

            if (data.error) {
                $("#status").text("Error: " + data.error.message);
                return;
            }

            $("#status").text("Scraper completado.");
            loadComments();

        } catch (e) {
            log("ERROR:\n" + e);
            $("#status").text("Error ejecutando scraper.");
        }
    });

    // Obtener datos almacenados
    async function loadComments() {
        try {
            const res = await fetch("/data");
            const list = await res.json();

            const tbody = $("#commentsTable tbody");
            tbody.empty();

            list.forEach(item => {

                const user = item.authorName || "Usuario desconocido";
                const text = item.text || "";
                const likes = item.likesCount ?? 0;
                const post = item.postTitle || "(Sin título)";
                const postUrl = item.facebookUrl || "";

                const row = `
                    <tr>
                        <td><a href="${postUrl}" target="_blank">${post.substring(0, 50)}...</a></td>
                        <td>${user}</td>
                        <td>${text}</td>
                        <td>${likes}</td>
                    </tr>
                `;

                tbody.append(row);
            });

            log("Tabla actualizada con " + list.length + " registros.");
        } catch (err) {
            log("Error cargando datos:\n" + err);
        }
    }

    $("#btnRefresh").click(loadComments);

    // Exportar CSV
    $("#btnExportCSV").click(() => {
        const rows = [["Post", "Usuario", "Comentario", "Likes"]];

        $("#commentsTable tbody tr").each(function () {
            const cols = $(this).find("td").map(function () {
                return $(this).text().replace(/\n/g, " ");
            }).get();
            rows.push(cols);
        });

        const csv = rows.map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "comments.csv";
        a.click();
    });

    // Carga inicial
    loadComments();
});
