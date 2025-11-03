$(document).ready(function () {
  const apiUrl = "/api";
  const $status = $("#status");
  const $tableBody = $("#commentsTable tbody");

  // Función para mostrar estado
  function setStatus(msg, type = "info") {
    $status.removeClass().addClass("status " + type).text(msg);
  }

  // Obtener comentarios guardados
  async function fetchComments() {
    setStatus("Cargando comentarios...");
    try {
      const res = await fetch(`${apiUrl}/comments`);
      if (!res.ok) throw new Error("Error al obtener comentarios.");
      const data = await res.json();
      renderComments(data);
      setStatus(`Se cargaron ${data.length} comentarios.`, "success");
    } catch (err) {
      setStatus("Error al cargar comentarios: " + err.message, "error");
    }
  }

  // Renderizar tabla
  function renderComments(comments) {
    $tableBody.empty();
    if (!comments.length) {
      $tableBody.append(`<tr><td colspan="3">No hay comentarios almacenados.</td></tr>`);
      return;
    }
    comments.forEach((c) => {
      const text = c.message || "(sin texto)";
      const user = c.author?.short_name || c.author?.name || "Anónimo";
      const name = c.author?.name || "Desconocido";
      $tableBody.append(`<tr>
        <td>${user}</td>
        <td>${name}</td>
        <td>${text}</td>
      </tr>`);
    });
  }

  // Botón para obtener comentarios de un nuevo post
  $("#btnScrape").click(async function () {
    const fbUrl = $("#fbUrl").val().trim();
    const apifyToken = $("#apifyToken").val().trim();
    const limit = $("#limit").val().trim();

    if (!fbUrl) {
      setStatus("Por favor, ingresa la URL de la publicación.", "error");
      return;
    }

    setStatus("Ejecutando scraper en Apify... esto puede tardar unos segundos.", "loading");

    try {
      const res = await fetch(`${apiUrl}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: fbUrl,
          limit: limit ? parseInt(limit) : undefined,
          token: apifyToken || undefined
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Error desconocido al ejecutar el scraper.");
      }

      setStatus(`✅ Scraper ejecutado correctamente. Se guardaron ${data.count || 0} comentarios.`, "success");
      fetchComments();
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message, "error");
    }
  });

  // Botones auxiliares
  $("#btnRefresh").click(fetchComments);

  $("#btnExportCSV").click(function () {
    const rows = [];
    $("#commentsTable tr").each(function () {
      const cols = $(this).find("td,th").map(function () {
        return `"${$(this).text().replace(/"/g, '""')}"`;
      }).get();
      rows.push(cols.join(","));
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "comentarios.csv");
    link.click();
  });

  // Cargar datos al iniciar
  fetchComments();
});
