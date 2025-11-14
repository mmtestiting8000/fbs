$(function () {
  const $status = $("#status");
  const $tableBody = $("#commentsTable tbody");

  function logStatus(msg, isError = false) {
    $status.text(msg);
    $status.toggleClass("error", isError);
  }

  // Botón para ejecutar scraping
  $("#btnScrape").on("click", async function () {
    const token = $("#apifyToken").val().trim();
    const url = $("#fbUrl").val().trim();
    const limit = $("#limit").val().trim();

    if (!url) {
      return logStatus("Debes ingresar una URL de Facebook", true);
    }

    logStatus("Iniciando scraping...");

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fbUrl: url,
          limit: limit || null,
          apifyToken: token || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        logStatus("Error: " + data.error, true);
        return;
      }

      logStatus(`Scraping completado. Comentarios importados: ${data.imported}`);
      loadComments();

    } catch (err) {
      logStatus("Error en la petición: " + err.message, true);
    }
  });

  // Botón refrescar datos
  $("#btnRefresh").on("click", loadComments);

  // Cargar comentarios desde MongoDB
  async function loadComments() {
    logStatus("Cargando comentarios...");
    $tableBody.empty();

    try {
      const res = await fetch("/api/comments?limit=200");
      const data = await res.json();

      if (!data.items || !Array.isArray(data.items)) {
        logStatus("Sin datos disponibles");
        return;
      }

      data.items.forEach(item => {
        // El scraper que estás usando NO devuelve userName
        const user = item.userName || item.user || "No disponible";

        const text = item.text || item.commentText || "";
        const likes = item.likesCount || item.reactionCount || 0;
        const url = item.facebookUrl || item.url || "";
        const postTitle = item.postTitle || "—";

        const row = `
          <tr>
            <td>${user}</td>
            <td>${text}</td>
            <td>${likes}</td>
            <td><a href="${url}" target="_blank">Abrir</a></td>
            <td>${postTitle}</td>
          </tr>
        `;
        $tableBody.append(row);
      });

      logStatus("Datos cargados");
    } catch (err) {
      logStatus("Error cargando comentarios: " + err.message, true);
    }
  }

  // Exportar CSV
  $("#btnExportCSV").on("click", function () {
    let csv = "Usuario,Comentario,Likes,URL,PostTitle\n";

    $("#commentsTable tbody tr").each(function () {
      const cols = $(this).find("td").map(function () {
        return '"' + $(this).text().replace(/"/g, '""') + '"';
      }).get();
      csv += cols.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "comentarios.csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  // Cargar datos al inicio
  loadComments();
});
