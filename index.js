const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const VISIT_TOKEN = process.env.VISIT_TOKEN ;
const NTFY_TOPIC = process.env.NTFY_TOPIC ;

app.use(express.json());

const FILE = path.join(__dirname, "visits.json");

let lock = false;

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

function writeCounter(count) {
  try {
    fs.writeFileSync(FILE, JSON.stringify({ count }, null, 2));
  } catch (err) {
    console.error("Erreur écriture JSON:", err);
  }
}

// Route principale
app.get("/", async (req, res) => {
  while (lock) {
    await new Promise(r => setTimeout(r, 10));
  }

  lock = true;

  try {
    let count = readCounter();
    count++;
    writeCounter(count);

    const hostname = req.hostname;
    const port = req.socket.localPort;
    const serverIP = req.socket.localAddress;
    const clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Check if a valid token is present in the URL
    const token = req.query.token;
    const isValidToken = token && token === VISIT_TOKEN;

    const confirmationBanner = isValidToken ? `
      <div id="banner" style="
        border: 2px solid #dc2626;
        padding: 16px 20px;
        margin-bottom: 24px;
        border-radius: 4px;
        background: #fff5f5;
      ">
        <p style="margin: 0 0 12px 0; color: #b91c1c; font-weight: bold;">
          Message important
        </p>
        <p style="margin: 0 0 16px 0; color: #7f1d1d; line-height: 1.5;">
          Veuillez clicker sur le bouton ci-dessous aprés que vous terminerez votre inspection. Cela me notifier afin de supprimer les ressources sur Azure Cloud et stopper les couts associés. 
          Merci pour votre compréhension.
        </p>
        <button 
          id="confirmBtn"
          onclick="sendConfirmation('${token}')"
          style="
            background: #166534;
            color: white;
            border: none;
            padding: 10px 24px;
            font-size: 15px;
            border-radius: 4px;
            cursor: pointer;
          "
        >
          Notifier
        </button>
        <p id="confirmMsg" style="display:none; margin: 12px 0 0 0; color: #166534; font-weight: bold;">
          Notification envoyée. Merci beaucoup pour votre collaboration.
        </p>
      </div>

      <script>
        async function sendConfirmation(token) {
          const btn = document.getElementById('confirmBtn');
          btn.disabled = true;
          btn.style.background = '#999';
          btn.innerText = 'Envoi en cours...';

          try {
            const res = await fetch('/confirm/notify?token=' + token, { method: 'POST' });
            if (res.ok) {
              btn.style.display = 'none';
              document.getElementById('confirmMsg').style.display = 'block';
            } else {
              btn.innerText = 'Erreur - Reessayer';
              btn.disabled = false;
              btn.style.background = '#6b7280';
            }
          } catch (e) {
            btn.innerText = 'Erreur - Reessayer';
            btn.disabled = false;
            btn.style.background = '#6b7280';
          }
        }
      </script>
    ` : '';

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Compteur de visites</title>
          <style>
            body { font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
          </style>
        </head>
        <body>
          ${confirmationBanner}

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
          <hr>
          <p style="text-align: center; color: #64748b; font-size: 14px; margin-top: 18px;">
            Developpé par Younes Khoubaz - younes.khoubaz@uit.ac.ma
          </p>
        </body>
      </html>
    `);

  } finally {
    lock = false;
  }
});

// Notification route
app.post("/confirm/notify", async (req, res) => {
  const { token } = req.query;

  if (!token || token !== VISIT_TOKEN) {
    return res.status(403).json({ error: "Token invalide" });
  }

  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      body: "Le professeur a confirme sa visite sur l'application de container.",
      headers: {
        "Title": "Visite professeur confirmee - Container App",
        "Priority": "urgent",
        "Tags": "white_check_mark"
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erreur ntfy:", err);
    res.status(500).json({ error: "Erreur lors de l'envoi de la notification" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});