function log(msg) {
    const logBox = document.getElementById("log");
    logBox.value += msg + "\n";
    logBox.scrollTop = logBox.scrollHeight;
}

async function loadComments() {
    const res = await fetch("/comments");
    const data = await res.json();
    renderRows(data);
}

function renderRows(rows) {
    const body = document.getElementById("comments-body");
    body.innerHTML = "";

    rows.forEach(r => {
        body.innerHTML += `
            <tr>
                <td>${r.postTitle}</td>
                <td>${r.text}</td>
                <td>${r.likesCount}</td>
                <td>${r.facebookUrl}</td>
            </tr>
        `;
    });
}

document.getElementById("scrapeBtn").onclick = async () => {
    const apiToken = apiToken.value;
    const facebookUrl = facebookUrl.value;
    const limitComments = limitComments.value;

    log("Scrape iniciado...");

    const res = await fetch("/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken, facebookUrl, limitComments })
    });

    const data = await res.json();

    if (!data.ok) return log("Error: " + data.error);

    renderRows(data.data);
    log("Scrape completado.");
};

document.getElementById("exportCsv").onclick = () => {
    const rows = [...document.querySelectorAll("#comments-body tr")];
    let csv = "postTitle,text,likesCount,facebookUrl\n";

    rows.forEach(row => {
        const cols = [...row.children].map(c => `"${c.innerText}"`).join(",");
        csv += cols + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "comments.csv";
    a.click();
};

loadComments();
