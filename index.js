const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const FILE = path.join(__dirname, "visits.json");

// Mutex simpleedd
let lock = false;

// Lire compteur
function readCounter() {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, JSON.stringify({ count: 0 }));
    }
    const data = fs.readFileSync(FILE);
    return JSON.parse(data).count;
  } catch (err) {
    console.error("Erreur lecture JSON:", err);
    return 0;
  }
}

// Écrire compteur
function writeCounter(count) {
  try {
    fs.writeFileSync(FILE, JSON.stringify({ count }, null, 2));
  } catch (err) {
    console.error("Erreur écriture JSON:", err);
  }
}

// Route principale
app.get("/", async (req, res) => {
  // Attente si une écriture est en cours
  while (lock) {
    await new Promise(r => setTimeout(r, 10));
  }

  lock = true;

  try {
    let count = readCounter();
    count++;
    writeCounter(count);

    // Infos serveur
    const hostname = req.hostname;
    const port = req.socket.localPort;
    const serverIP = req.socket.localAddress;

    // IP client (utile derrière proxy Azure)
    const clientIP =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    res.send(`
      <h2>Compteur de visites</h2>
      <p><strong>Nombre de visites :</strong> ${count}</p>
      <hr>
      <h3>Informations serveur</h3>
      <p><strong>Hostname :</strong> ${hostname}</p>
      <p><strong>Port :</strong> ${port}</p>
      <p><strong>IP serveur :</strong> ${serverIP}</p>
      <hr>
      <h3>Informations client</h3>
      <p><strong>IP client :</strong> ${clientIP}</p>
    `);

  } finally {
    lock = false;
  }
});

// Démarrage serveur
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});