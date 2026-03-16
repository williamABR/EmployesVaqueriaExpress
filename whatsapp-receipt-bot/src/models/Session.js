const mongoose = require('mongoose');

/**
 * Estados posibles:
 *  WAITING_CEDULA       -> se proceso el tiquete, esperando cedula del comprador
 *  WAITING_BUYER_NAME   -> cedula nueva, esperando nombre del comprador
 *  WAITING_REJECT_NOTE  -> admin toco Rechazar, esperando motivo
 */
const sessionSchema = new mongoose.Schema({
  telefono: { type: String, required: true, unique: true },
  state: {
    type: String,
    enum: ['WAITING_CEDULA', 'WAITING_BUYER_NAME', 'WAITING_REJECT_NOTE'],
    required: true,
  },
  pendingData: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now, expires: 1800 }, // TTL 30 min
});

module.exports = mongoose.model('Session', sessionSchema);
