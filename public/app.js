$(document).ready(function () {
  // -----------------------------
  //  CLIC: EJECUTAR SCRAPER
  // -----------------------------
  $("#btnScrape").on("click", async () => {
    const token = $("#apifyToken").val().trim();
    const fbUrlsRaw = $("#fbUrls").val().trim();
    const limit = $("#limit").val().trim();

    const fbUrls = fbUrlsRaw
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    if (fbUrls.length === 0) {
      showStatus("❌ Debes agregar al menos una URL de Facebook", true);
      return;
    }

    showStatus("⏳ Ejecutando scraper…");

    try {
      const res = await fetch("/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fbUrls,
          limit: limit ? Number(limit) : undefined
        })
      });

      const data = await res.json();

      if (data.error) {
        showStatus("❌ " + data.error, true);
        return;
      }

      showStatus("✅ Scraping completado. Cargando tabla…");
      loadComments(); 
    } catch (err) {
      showStatus("❌ Error enviando solicitud: " + err.message, true);
    }
  });

  // -----------------------------
  //  CLIC: REFRESCAR TABLA
  // -----------------------------
  $("#btnRefresh").on("click", () => {
    loadComments();
  });

  // -----------------------------
  //  CLIC: EXPORTAR CSV
  // -----------------------------
  $("#btnExportCSV").on("click", () => {
    exportTableToCSV("comments_export.csv");
  });

  // -----------------------------
  //  CARGAR COMENTARIOS GUARDADOS
  // -----------------------------
  async function loadComments() {
    showStatus("⏳ Cargando datos…");
    try {
      const res = await fetch("/comments");
      const data = await res.json();

      if (!Array.isArray(data)) {
        showStatus("❌ Respuesta inesperada del servidor", true);
        return;
      }

      renderCommentsTable(data);
      showStatus("✅ Datos cargados");
    } catch (err) {
      showStatus("❌ Error cargando comentarios: " + err.message, true);
    }
  }

  // -----------------------------
  //  RENDER DE LA TABLA
  // -----------------------------
  function renderCommentsTable(items) {
    const tbody = $("#commentsTable tbody");
    tbody.empty();

    if (!items || items.length === 0) {
      tbody.append(`<tr><td colspan="4">Sin datos aún</td></tr>`);
      return;
    }

    items.forEach((item) => {
      const postUrl = item.postUrl || item.url || "-";

      // Usuario (viene de name o de from.name)
      const user =
        item.name ||
        (item.from && item.from.name) ||
        "Desconocido";

      // Comentario (text o message)
      const comment =
        item.text ||
        item.message ||
        "(sin texto)";

      // Likes
      const likes =
        item.likeCount ??
        item.reactions ??
        0;

      const row = `
        <tr>
          <td>${postUrl}</td>
          <td>${user}</td>
          <td>${comment}</td>
          <td>${likes}</td>
        </tr>
      `;

      tbody.append(row);
    });
  }

  // -----------------------------
  //  ESTADO / MENSAJES
  // -----------------------------
  function showStatus(message, isError = false) {
    const el = $("#status");
    el.text(message);
    el.removeClass("error");

    if (isError) el.addClass("error");
  }

  // -----------------------------
  //  EXPORTAR CSV
  // -----------------------------
  function exportTableToCSV(filename) {
    const rows = document.querySelectorAll("table tr");
    let csv = [];

    rows.forEach((row) => {
      const cols = [...row.querySelectorAll("td, th")].map((col) =>
        `"${col.innerText.replace(/"/g, '""')}"`
      );
      csv.push(cols.join(","));
    });

    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  // Cargar tabla apenas abra la página
  loadComments();
});
