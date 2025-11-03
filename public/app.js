// app.js
$(function(){
  function setStatus(txt, isError) {
    $('#status').text(txt).css('color', isError ? 'crimson' : '');
  }

  async function fetchComments() {
    setStatus('Cargando comentarios...');
    try {
      const res = await $.getJSON('/api/comments?limit=100');
      const items = res.items || [];
      const $b = $('#commentsTable tbody').empty();
      items.forEach(it => {
        const user = it.userId || '-';
        const name = it.userName || '-';
        const text = it.commentText ? $('<div>').text(it.commentText).html() : '-';
        const tr = `<tr><td>${user}</td><td>${name}</td><td>${text}</td></tr>`;
        $b.append(tr);
      });
      setStatus(`Cargados ${items.length} comentarios (mostrando hasta 100).`);
    } catch (err) {
      setStatus('Error cargando comentarios: ' + (err.responseJSON?.error || err.statusText || err), true);
    }
  }

  $('#btnRefresh').on('click', fetchComments);
  fetchComments();

  $('#btnScrape').on('click', async function(){
    const fbUrl = $('#fbUrl').val().trim();
    const limit = $('#limit').val().trim();
    const apifyToken = $('#apifyToken').val().trim();

    if (!fbUrl) { setStatus('Ingresa la URL de la publicación.', true); return; }

    setStatus('Iniciando extracción en Apify, esto puede tardar varios segundos...');

    try {
      const payload = { fbUrl, limit: limit || undefined, apifyToken: apifyToken || undefined };
      // Bloquear UI
      $('#btnScrape').prop('disabled', true).text('Obteniendo...');
      const res = await $.ajax({
        url: '/api/scrape',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        dataType: 'json',
        timeout: 20 * 60 * 1000 // 20 min en caso de ejecuciones muy largas
      });

      if (res.ok) {
        setStatus(`Éxito: importados ${res.imported} comentarios (runId: ${res.runId})`);
        fetchComments();
      } else {
        setStatus('Respuesta inesperada: ' + JSON.stringify(res), true);
      }
    } catch (err) {
      const msg = err.responseJSON?.error || (err.statusText || err);
      setStatus('Error: ' + msg, true);
    } finally {
      $('#btnScrape').prop('disabled', false).text('Obtener Comentarios');
    }
  });

  $('#btnExportCSV').on('click', function(){
    // Exportar tabla a CSV simple (cliente)
    const rows = [];
    $('#commentsTable tbody tr').each(function(){
      const cols = $(this).find('td').map(function(){ return $(this).text().trim(); }).get();
      rows.push(cols.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    });
    if (!rows.length) { setStatus('No hay datos para exportar.', true); return; }
    const csv = ['Usuario,Nombre,Comentario', ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comments_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
});
