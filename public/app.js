function log(msg) {
  $("#consoleOutput").append(msg + "\n");
}

$("#btnScrape").click(async () => {
  $("#status").text("Ejecutando scraper...");
  log("Enviando petición /run");

  const token = $("#apifyToken").val().trim();
  const fbUrls = $("#fbUrls").val().split("\n").map(s => s.trim()).filter(s => s);
  const limit = $("#limit").val();

  try {
    const res = await fetch("/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fbUrls, limit, token })
    });

    const json = await res.json();
    log("Respuesta /run: " + JSON.stringify(json, null, 2));

    if (!json.success) {
      $("#status").text("Error: " + json.error);
      return;
    }

    $("#status").text("Scraper finalizado. Guardando datos...");

    await fetch("/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: json.data })
    });

    $("#status").text("Datos guardados.");
    loadComments();

  } catch (err) {
    $("#status").text("Error: " + err.message);
    log("ERROR: " + err.message);
  }
});


async function loadComments() {
  const res = await fetch("/comments");
  const json = await res.json();

  const tbody = $("#commentsTable tbody");
  tbody.empty();

  json.data.forEach(c => {
    tbody.append(`
      <tr>
        <td>${c.postUrl || ""}</td>
        <td>${c.userName || ""}</td>
        <td>${c.text || ""}</td>
        <td>${c.likes || 0}</td>
      </tr>
    `);
  });
}

$("#btnRefresh").click(loadComments);


// --------------------------------------------------
// EXPORTAR CSV
// --------------------------------------------------
$("#btnExportCSV").click(() => {
  const rows = [];
  $("#commentsTable tr").each(function () {
    const cols = $(this).find("td,th").map(function () {
      return `"${$(this).text().replace(/"/g, '""')}"`;
    }).get();
    rows.push(cols.join(","));
  });

  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "comments.csv";
  a.click();
});


// Cargar al inicio
loadComments();
