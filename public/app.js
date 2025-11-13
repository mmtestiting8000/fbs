const btn = document.getElementById('scrapeBtn');
const statusDiv = document.getElementById('status');
const list = document.getElementById('commentsList');

btn.addEventListener('click', async () => {
  const fbUrl = document.getElementById('fbUrl').value.trim();
  const limit = document.getElementById('limit').value.trim();

  if (!fbUrl) {
    alert('Por favor, ingresa una URL de Facebook.');
    return;
  }

  statusDiv.textContent = 'Ejecutando scraper...';
  list.innerHTML = '';

  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fbUrl, limit })
    });
    const data = await res.json();

    if (!data.ok) throw new Error(data.error);

    statusDiv.textContent = `✅ ${data.count} comentarios guardados`;
    loadComments();
  } catch (err) {
    statusDiv.textContent = `❌ Error: ${err.message}`;
  }
});

async function loadComments() {
  const res = await fetch('/api/comments');
  const data = await res.json();
  list.innerHTML = '';
  data.items.forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.userName || 'Usuario'}: ${c.commentText || ''}`;
    list.appendChild(li);
  });
}
