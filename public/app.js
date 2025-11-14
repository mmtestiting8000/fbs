const API_URL = "http://localhost:3000/api/v1/comments"; 
// Ajusta si tu backend usa otra ruta

async function loadComments() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();

        console.log("Datos recibidos desde la API:", data);

        const container = document.getElementById("comments");
        container.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = "<p>No hay comentarios disponibles.</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.classList.add("comment");

            const author = item.authorName ?? "Usuario desconocido";
            const text = item.commentText ?? "(sin texto)";
            const likes = item.likeCounter ?? 0;
            const postTitle = item.postTitle ?? "Sin título";
            const postUrl = item.facebookUrl ?? "#";

            div.innerHTML = `
                <div class="title">${postTitle}</div>
                <div class="meta">
                    <strong>${author}</strong> comentó:
                </div>
                <p>${text}</p>
                <div class="likes">❤️ Likes: <strong>${likes}</strong></div>
                <div class="meta">
                    <a href="${postUrl}" target="_blank">Ver publicación en Facebook</a>
                </div>
            `;

            container.appendChild(div);
        });

    } catch (error) {
        console.error("Error cargando comentarios:", error);
        document.getElementById("comments").innerHTML =
            "<p>Error consultando la API.</p>";
    }
}

loadComments();
