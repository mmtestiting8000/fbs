// public/app.js
$(document).ready(() => {
  const $status = $("#status");
  const $console = $("#consoleOutput");
  const $tableBody = $("#commentsTable tbody");

  function log(msg) {
    const time = new Date().toLocaleTimeString();
    $console.append(`[${time}] ${msg}\n`);
    $console.scrollTop($console[0].scrollHeight);
    console.log(msg);
  }

  function setStatus(msg, isError = false) {
    $status.text(msg);
    $status.css("color", isError ? "crimson" : "");
    log(msg);
  }

  // Intenta varios endpoints y formatos para obtener datos
  async function fetchStoredComments() {
    const candidates = ["/data", "/api/comments", "/comments"];
    for (const url of candidates) {
      try {
        log(`Intentando obtener datos desde ${url}...`);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          log(`Respuesta ${res.status} desde ${url}`);
          continue;
        }
        const json = await res.json();
        // Normalizar distintos formatos:
        // 1) array directo -> json is array
        if (Array.isArray(json)) return json;
        // 2) { items: [...] }
        if (Array.isArray(json.items)) return json.items;
        // 3) { data: { items: [...] } }
        if (json.data && Array.isArray(json.data.items)) return json.data.items;
        // 4) { success: true, data: [...] }
        if (Array.isArray(json.data)) return json.data;
        // 5) { success: true, items: [...] }
        if (Array.isArray(json.items)) return json.items;
        // fallback: if object contains array-like first property
        for (const k of Object.keys(json)) {
          if (Array.isArray(json[k])) return json[k];
        }
        log(`Formato de respuesta desde ${url} no reconocido.`);
      } catch (err) {
        log(`Error consultando ${url}: ${err.message}`);
      }
    }
    // si no encontrou nada
    return [];
  }

  // Renderiza tabla usando campos reales que enviaste
  function renderTable(items) {
    $tableBody.empty();
    if (!items || items.length === 0) {
      $tableBody.append(`<tr><td colspan="4">Sin datos</td></tr>`);
      return;
    }

    items.forEach(item => {
      // la respuesta real tiene: postTitle, text, likesCount, facebookUrl
      // pero aseguramos con varios alias
      const postTitle = (item.postTitle || item.post_title || item.title || "").toString();
      const text = (item.text || item.message || item.comment || "").toString();
      // likesCount puede ser string "2" o número, o venir como likesCount/likes/likeCount
      const likesRaw = item.likesCount ?? item.likes ?? item.likeCount ?? item.likes_count ?? item.reactions;
      // convertir a número seguro
      const likes = (() => {
        if (likesRaw == null) return 0;
        const n = Number(String(likesRaw).replace(/[^\d\-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      })();
      const facebookUrl = (item.facebookUrl || item.facebook_url || item.url || item.postUrl || "").toString();

      // sanitizar para evitar inyección
      const esc = s => String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const titleCell = facebookUrl
        ? `<a href="${encodeURI(facebookUrl)}" target="_blank" rel="noreferrer">${esc(postTitle).slice(0, 80)}${postTitle.length>80?'...':''}</a>`
        : esc(postTitle);

      const row = `
        <tr>
          <td>${titleCell}</td>
          <td>${esc(text)}</td>
          <td style="text-align:center">${likes}</td>
          <td>${facebookUrl ? `<a href="${encodeURI(facebookUrl)}" target="_blank" rel="noreferrer">Abrir</a>` : "-"}</td>
        </tr>
      `;
      $tableBody.append(row);
    });
  }

  // Cargar datos y render
  async function loadAndRender() {
    setStatus("⏳ Cargando datos...");
    const items = await fetchStoredComments();
    setStatus(`✅ Datos cargados (${items.length} registros)`);
    renderTable(items);
  }

  // Botón refrescar
  $("#btnRefresh").on("click", async () => {
    await loadAndRender();
  });

  // Exportar CSV (usa exactamente las celdas visibles)
  $("#btnExportCSV").on("click", () => {
    const rows = [];
    // encabezado
    rows.push(["PostTitle", "Comentario", "Likes", "URL"]);
    $("#commentsTable tbody tr").each(function () {
      const tds = $(this).find("td");
      const title = tds.eq(0).text().trim();
      const comment = tds.eq(1).text().trim();
      const likes = tds.eq(2).text().trim();
      const url = tds.eq(3).find("a").attr("href") || "";
      rows.push([title, comment, likes, url]);
    });
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "comments_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // Ejecutar scraper -> envía /run al backend
  $("#btnScrape").on("click", async () => {
    const token = $("#apifyToken").val().trim();
    const raw = $("#fbUrls").val().trim();
    const limitVal = $("#limit").val().trim();
    const urls = raw.split("\n").map(s => s.trim()).filter(Boolean);
    if (urls.length === 0) { setStatus("Ingresa al menos 1 URL", true); return; }
    setStatus("⏳ Iniciando scraping...");
    log(`Iniciando /run con ${urls.length} URL(s)  (limit=${limitVal || 'n/a'})`);

    try {
      // Intentar enviar en la forma que espera tu backend (/run expecting fbUrls array)
      const payload = { fbUrls: urls };
      if (token) payload.apifyToken = token;
      if (limitVal) payload.limit = Number(limitVal);

      const res = await fetch("/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const j = await res.json();
      log("/run response: " + JSON.stringify(j, null, 2));

      if (!res.ok) {
        setStatus("Error en /run: " + (j.error?.message || JSON.stringify(j.error) || res.statusText), true);
        return;
      }

      // algunos endpoints devuelven { ok:true, items: [...] } o { items: [...] } o { data: { items: [...] } }
      // si /run devolvió directamente items en j.items o j.data.items, los usamos; si devuelve runId, esperamos a que /data tenga el dataset
      let items = [];
      if (Array.isArray(j)) items = j;
      else if (Array.isArray(j.items)) items = j.items;
      else if (Array.isArray(j.data)) items = j.data;
      else if (j.data && Array.isArray(j.data.items)) items = j.data.items;

      if (items.length > 0) {
        setStatus(`✅ Scraping finalizado (${items.length} items devueltos)`);
        renderTable(items);
      } else {
        // Si no se devuelven items desde /run, recargar desde los endpoints de almacenamiento
        setStatus("✅ Scraping solicitado. Esperando datos guardados...");
        // espera breve y luego recarga
        await new Promise(r => setTimeout(r, 1500));
        await loadAndRender();
      }
    } catch (err) {
      log("Error en /run: " + err);
      setStatus("Error ejecutando /run: " + err.message, true);
    }
  });

  // carga inicial
  loadAndRender();
});
