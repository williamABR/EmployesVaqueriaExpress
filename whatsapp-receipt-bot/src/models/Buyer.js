const mongoose = require('mongoose');

/**
 * Comprador registrado por cedula.
 * La primera vez que aparece una cedula nueva, se guarda con nombre.
 * Las siguientes veces se busca por cedula y se reutiliza.
 */
const buyerSchema = new mongoose.Schema({
  cedula: { type: String, required: true, unique: true, trim: true },
  nombre: { type: String, required: true, trim: true },
  registradoPor: { type: String },   // telefono del empleado que lo registro primero
  registradoEn: { type: Date, default: Date.now },
});

buyerSchema.index({ cedula: 1 });

module.exports = mongoose.model('Buyer', buyerSchema);
