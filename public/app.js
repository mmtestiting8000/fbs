document.getElementById("runBtn").addEventListener("click", async () => {
    const apiToken = document.getElementById("apiToken").value.trim();
    const fbUrlsRaw = document.getElementById("fbUrls").value.trim();

    if (!apiToken) {
        alert("Por favor ingresa tu API Token.");
        return;
    }

    if (!fbUrlsRaw) {
        alert("Por favor ingresa al menos una URL de Facebook.");
        return;
    }

    // Convertimos URLs separadas por nueva línea
    const fbUrls = fbUrlsRaw.split("\n").map(u => u.trim()).filter(Boolean);

    console.log("Enviando petición /run");

    try {
        const response = await fetch("/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiToken,
                startUrls: fbUrls
            })
        });

        const data = await response.json();

        console.log("Respuesta /run:", data);

        if (data.error) {
            alert("Error: " + JSON.stringify(data.error));
            return;
        }

        if (!Array.isArray(data)) {
            alert("La API no devolvió una lista válida.");
            return;
        }

        renderTable(data);

    } catch (err) {
        console.error(err);
        alert("Error: " + err);
    }
});

// ---------------------------------------------
//   GENERAR TABLA DE RESULTADOS
// ---------------------------------------------
function renderTable(data) {
    const tableContainer = document.getElementById("resultsTable");
    tableContainer.innerHTML = "";

    if (data.length === 0) {
        tableContainer.innerHTML = "<p>No se encontraron datos.</p>";
        return;
    }

    const table = document.createElement("table");
    table.classList.add("data-table");

    const header = document.createElement("tr");
    header.innerHTML = `
        <th>Título del Post</th>
        <th>Comentario</th>
        <th>Likes</th>
        <th>URL del Post</th>
    `;
    table.appendChild(header);

    data.forEach(item => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${sanitize(item.postTitle || "")}</td>
            <td>${sanitize(item.text || "")}</td>
            <td>${sanitize(item.likesCount || "0")}</td>
            <td><a href="${item.facebookUrl}" target="_blank">Abrir</a></td>
        `;

        table.appendChild(row);
    });

    tableContainer.appendChild(table);
}

// ---------------------------------------------
//   LIMPIAR HTML INYECTADO
// ---------------------------------------------
function sanitize(str) {
    return String(str)
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
