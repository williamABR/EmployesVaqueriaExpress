require('dotenv').config();
const express = require('express');
const { connectDB } = require('./db');
const webhookRouter = require('./routes/webhook');
const { initScheduler, sendWeeklyReport } = require('./services/scheduler');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/webhook', webhookRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// Endpoint para disparar el reporte manualmente sin esperar el lunes
// Uso: GET /report/weekly  (solo desde localhost o con una clave)
app.get('/report/weekly', async (req, res) => {
  const key = req.query.key;
  if (key !== process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  await sendWeeklyReport();
  res.json({ ok: true, message: 'Reporte enviado' });
});

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  initScheduler();
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
});
