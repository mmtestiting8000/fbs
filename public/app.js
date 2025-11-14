document.getElementById("scrapeForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = document.getElementById("token").value;
    const facebookUrl = document.getElementById("facebookUrl").value;
    const limit = document.getElementById("limit").value;

    const statusBox = document.getElementById("status");
    statusBox.innerText = "⏳ Ejecutando scraper...";
    statusBox.style.color = "black";

    try {
        const response = await fetch("/api/run-scraper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, facebookUrl, limit })
        });

        const data = await response.json();

        if (!response.ok) {
            statusBox.innerText = "❌ Error: " + data.error;
            statusBox.style.color = "red";
            return;
        }

        statusBox.innerText = "✔ Datos obtenidos correctamente";
        statusBox.style.color = "green";

        renderTable(data.comments);

        document.getElementById("downloadCsvBtn").classList.remove("hidden");

    } catch (err) {
        statusBox.innerText = "❌ Error al conectar con el servidor";
        statusBox.style.color = "red";
    }
});

function renderTable(comments) {
    const tbody = document.querySelector("#commentsTable tbody");
    tbody.innerHTML = "";

    comments.forEach(c => {
        const row = `
            <tr>
                <td>${c.postTitle}</td>
                <td>${c.text}</td>
                <td>${c.likesCount}</td>
                <td><a href="${c.facebookUrl}" target="_blank">Ver</a></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Descargar CSV
document.getElementById("downloadCsvBtn").addEventListener("click", async () => {
    const response = await fetch("/api/export-csv");
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "comments.csv";
    a.click();
});
