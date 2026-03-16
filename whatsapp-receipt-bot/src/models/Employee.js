const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  // Número con código de país sin +  ej: 573001234567
  telefono: { type: String, required: true, unique: true },
  cargo: { type: String, default: 'Empleado' },
  activo: { type: Boolean, default: true },

  /**
   * requiresBuyerName: true  → el bot siempre pregunta quién hizo la compra
   *                   false → el empleado mismo es el comprador
   *
   * Útil para celulares compartidos (caja, bodega) donde
   * diferentes personas pueden usar el mismo teléfono.
   */
  requiresBuyerName: { type: Boolean, default: false },

  registradoEn: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Employee', employeeSchema);
