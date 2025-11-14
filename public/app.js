// public/app.js
$(document).ready(() => {
  const $status = $("#status");
  const $console = $("#consoleOutput");
  const $tbody = $("#commentsTable tbody");

  function log(msg) {
    const t = new Date().toLocaleTimeString();
    $console.append(`[${t}] ${msg}\n`);
    $console.scrollTop($console[0].scrollHeight);
    console.log(msg);
  }

  function setStatus(msg, isError = false) {
    $status.text(msg);
    $status.css("color", isError ? "crimson" : "");
    log(msg);
  }

  async function fetchComments() {
    setStatus("⏳ Cargando datos desde /comments...");
    log("Fetching /comments ...");
    try {
      const res = await fetch("/comments", { cache: "no-store" });
      const text = await res.text();

      // mostrar cuerpo crudo en logs para debug si no es JSON
      log("Respuesta cruda: " + text.slice(0, 1000));

      // intentar parsear
      let json;
      try {
        json = JSON.parse(text);
      } catch (err) {
        // respuesta no es JSON válido
        setStatus("❌ La API respondió con contenido no JSON. Revisa logs.", true);
        log("JSON.parse error: " + err.message);
        return [];
      }

      // si la respuesta es { items: [...] } o array
      if (Array.isArray(json)) return json;
      if (Array.isArray(json.items)) return json.items;
      if (Array.isArray(json.data)) return json.data;
      if (json.data && Array.isArray(json.data.items)) return json.data.items;

      // si no encontró array, devuelve objeto vacío y lo reporta
      setStatus("❌ Formato de respuesta inesperado. Ver consola.", true);
      log("Formato inesperado en /comments: " + JSON.stringify(Object.keys(json)));
      return [];
    } catch (err) {
      setStatus("❌ Error al conectar con /comments: " + (err.message || err), true);
      log("Fetch error: " + err);
      return [];
    }
  }

  function renderTable(items) {
    $tbody.empty();
    if (!items || items.length === 0) {
      $tbody.append(`<tr><td colspan="5">Sin datos (último scrape vacío)</td></tr>`);
      setStatus("ℹ No hay comentarios para mostrar.");
      return;
    }

    items.forEach(c => {
      const postTitle = c.postTitle || c.inputUrl || "(sin título)";
      const author = c.profileName || c.authorName || "Desconocido";
      const text = c.text || c.commentText || "";
      const likes = (c.likesCount ?? c.likeCount ?? c.reactions ?? 0).toString();
      const url = c.facebookUrl || c.inputUrl || c.postUrl || "";

      const titleCell = url ? `<a href="${encodeURI(url)}" target="_blank" rel="noreferrer">${escapeHtml(postTitle).slice(0,100)}${postTitle.length>100?'...':''}</a>` : escapeHtml(postTitle);

      const row = `
        <tr>
          <td>${titleCell}</td>
          <td>${escapeHtml(author)}</td>
          <td>${escapeHtml(text)}</td>
          <td style="text-align:center">${escapeHtml(likes)}</td>
          <td>${url?`<a href="${encodeURI(url)}" target="_blank">Abrir</a>`:'-'}</td>
        </tr>
      `;
      $tbody.append(row);
    });

    setStatus(`✅ Mostrando ${items.length} comentarios (último batch)`);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // refresh button
  $("#btnRefresh").on("click", async () => {
    const items = await fetchComments();
    renderTable(items);
  });

  // export CSV
  $("#btnExportCSV").on("click", () => {
    const rows = [["PostTitle","Usuario","Comentario","Likes","URL"]];
    $("#commentsTable tbody tr").each(function(){
      const tds = $(this).find("td");
      const title = tds.eq(0).text().trim();
      const user = tds.eq(1).text().trim();
      const comment = tds.eq(2).text().trim();
      const likes = tds.eq(3).text().trim();
      const urlEl = tds.eq(4).find("a");
      const url = urlEl.length ? urlEl.attr("href") : "";
      rows.push([title,user,comment,likes,url]);
    });
    const csv = rows.map(r=> r.map(cell=> `"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "comments_export.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // initial load
  (async ()=>{
    const items = await fetchComments();
    renderTable(items);
  })();

});
