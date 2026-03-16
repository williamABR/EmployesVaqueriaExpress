const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  empleado: {
    nombre: { type: String, required: true },
    telefono: { type: String, required: true },
  },
  comprador: {
    cedula: { type: String, default: null },
    nombre: { type: String, default: null },
  },
  establecimiento: String,
  numeroPedido: { type: String, default: null }, // numero # del tiquete
  fechaTiquete: String,
  total: { type: Number, required: true },
  moneda: { type: String, default: 'COP' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  adminNota: { type: String, default: null },
  receiptHash: { type: String, unique: true, required: true },
  imagenUrl: String,
  imageId: String,
  mes: String,
  registradoEn: { type: Date, default: Date.now },
  revisadoEn: { type: Date, default: null },
});

receiptSchema.index({ 'empleado.telefono': 1 });
receiptSchema.index({ 'comprador.cedula': 1 });
receiptSchema.index({ mes: 1 });
receiptSchema.index({ status: 1 });
receiptSchema.index({ registradoEn: -1 });

module.exports = mongoose.model('Receipt', receiptSchema);
