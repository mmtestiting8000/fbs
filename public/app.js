$(function() {
  async function refreshTable() {
    const res = await fetch('/api/comments');
    const data = await res.json();
    const tbody = $('#commentsTable tbody');
    tbody.empty();

    data.items.forEach(item => {
      const row = `<tr>
        <td>${item.postUrl || '-'}</td>
        <td>${item.userName || '-'}</td>
        <td>${item.commentText || '-'}</td>
        <td>${item.reactionCount || 0}</td>
      </tr>`;
      tbody.append(row);
    });
  }

  $('#btnScrape').on('click', async () => {
    const apifyToken = $('#apifyToken').val().trim();
    const fbUrls = $('#fbUrls').val().trim().split('\n').filter(Boolean);
    const limit = $('#limit').val().trim();

    $('#status').text('⏳ Ejecutando scraper...');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbUrls, limit, apifyToken })
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error || 'Error desconocido');
      $('#status').text(`✅ ${data.count} comentarios guardados`);
      refreshTable();
    } catch (err) {
      $('#status').text(`❌ ${err.message}`);
    }
  });

  $('#btnRefresh').on('click', refreshTable);

  $('#btnExportCSV').on('click', async () => {
    const res = await fetch('/api/comments');
    const data = await res.json();
    const rows = [['Post URL', 'Usuario', 'Comentario', 'Likes']];
    data.items.forEach(c => rows.push([c.postUrl, c.userName, c.commentText, c.reactionCount]));

    const csv = rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'comments.csv';
    a.click();
  });

  refreshTable();
});
