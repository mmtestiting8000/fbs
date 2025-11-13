// app.js
$(function(){
  function setStatus(txt, isError) {
    $('#status').text(txt).css('color', isError ? 'crimson' : '');
  }

  async function fetchCommentsSaved() {
    setStatus('Cargando comentarios guardados...');
    try {
      const res = await $.getJSON('/api/comments?limit=100');
      const items = res.items || [];
      const $tbody = $('#commentsTable tbody').empty();
      items.forEach(it => {
        const postUrl = it.facebookUrl || '-';
        const userName = it.userName || '-';
        const text = it.commentText || it.text || '-';
        const likes = it.likes != null ? it.likes : '-';
        const tr = `<tr><td>${postUrl}</td><td>${userName}</td><td>${text}</td><td>${likes}</td></tr>`;
        $tbody.append(tr);
      });
      setStatus(`Cargados ${items.length} comentarios (máximo 100).`);
    } catch (err) {
      setStatus('Error al cargar comentarios: ' + (err.responseJSON?.error || err.statusText || err), true);
    }
  }

  $('#btnRefresh').on('click', fetchCommentsSaved);
  fetchCommentsSaved();

  $('#btnScrape').on('click', async function(){
    const apifyToken = $('#apifyToken').val().trim();
    const fbUrlsRaw = $('#fbUrls').val().trim();
    const limitVal = $('#limit').val().trim();

    if (!fbUrlsRaw) {
      setStatus('Ingresa al menos un enlace de publicación de Facebook.', true);
      return;
    }
    const fbUrls = fbUrlsRaw.split('\n').map(s => s.trim()).filter(s => s);

    setStatus('Iniciando extracción, esto puede tardar…');
    $('#btnScrape').prop('disabled', true).text('Obteniendo…');

    try {
      const payload = { fbUrls };
      if (limitVal) payload.limit = limitVal;
      if (apifyToken) payload.apifyToken = apifyToken;

      const res = await $.ajax({
        url: '/api/scrape',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        dataType: 'json',
        timeout: 20 * 60 * 1000 // 20 minutos
      });

      if (res.ok) {
        setStatus(`Éxito: se importaron ${res.imported} comentarios. Run ID: ${res.runId}`);
        fetchCommentsSaved();
      } else {
        setStatus('Respuesta inesperada del servidor: ' + JSON.stringify(res), true);
      }
    } catch (err) {
      const msg = err.responseJSON?.error || (err.statusText || err);
      setStatus('Error: ' + msg, true);
    } finally {
      $('#btnScrape').prop('disabled', false).text('Obtener Comentarios');
    }
  });

  $('#btnExportCSV').on('click', function(){
    const rows = [];
    $('#commentsTable tbody tr').each(function(){
      const cols = $(this).find('td').map(function(){ return $(this).text().trim(); }).get();
      rows.push(cols.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    });
    if (!rows.length) {
      setStatus('No hay datos para exportar.', true);
      return;
    }
    const csv = ['PostURL,Usuario,Comentario,Likes', ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'facebook_comments_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
});
