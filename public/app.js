$(document).ready(function () {

    function appendConsole(msg) {
        $("#consoleOutput").append(msg + "\n");
        $("#consoleOutput").scrollTop($("#consoleOutput")[0].scrollHeight);
    }

    // ---------------------- LOAD LAST BATCH ----------------------
    function loadComments() {
        $.get("/comments", function (data) {
            const tbody = $("#commentsTable tbody");
            tbody.empty();

            data.forEach(c => {
                const row = `
                    <tr>
                        <td>${c.postTitle || ""}</td>
                        <td>${c.authorName || "Desconocido"}</td>
                        <td>${c.text}</td>
                        <td>${c.likesCount || 0}</td>
                    </tr>
                `;
                tbody.append(row);
            });
        });
    }
    $("#btnRefresh").click(loadComments);

    // ---------------------- EXPORT CSV ----------------------
    $("#btnExportCSV").click(function () {
        $.get("/comments", function (data) {

            let csv = "Post,Usuario,Comentario,Likes\n";

            data.forEach(c => {
                csv += `"${c.postTitle}","${c.authorName}","${c.text}","${c.likesCount}"\n`;
            });

            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "comments.csv";
            a.click();
        });
    });

    // ---------------------- RUN SCRAPER ----------------------
    $("#btnScrape").click(function () {

        const token = $("#apifyToken").val().trim();
        const urls = $("#fbUrls").val().split("\n").map(u => u.trim()).filter(u => u);
        const limit = $("#limit").val();

        appendConsole("Ejecutando scraper...");

        $.ajax({
            url: "/run-scraper",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ token, urls, limit }),
            success: function (res) {

                appendConsole("Scraper completado. Guardando en Mongo...");

                $.ajax({
                    url: "/save-comments",
                    method: "POST",
                    contentType: "application/json",
                    data: JSON.stringify({ comments: res.comments }),
                    success: function () {
                        appendConsole("Datos guardados ✔");
                        loadComments();
                    }
                });
            }
        });

    });

    // initial load
    loadComments();

});
