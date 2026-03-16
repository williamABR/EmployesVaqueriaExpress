/**
 * Registra o actualiza empleados en MongoDB.
 * Uso: node scripts/seedEmployees.js
 *
 * requiresBuyerName: true  → el bot preguntará quién hizo la compra
 *                   false  → el empleado mismo es el comprador
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Employee = require('../src/models/Employee');

// ─── EDITA ESTA LISTA CON TUS EMPLEADOS ────────────────────
const EMPLEADOS = [
  // Celulares personales: el empleado es quien compra
  { nombre: 'Carlos Martínez', telefono: '573001234567', cargo: 'Mesero',          requiresBuyerName: false },
  { nombre: 'Ana Rodríguez',   telefono: '573009876543', cargo: 'Cocinera',         requiresBuyerName: false },
  // Celular compartido (caja): puede ser cualquier persona quien compra
  { nombre: 'Caja Principal',  telefono: '573005551234', cargo: 'Caja Compartida',  requiresBuyerName: true  },
  { nombre: 'Bodega',          telefono: '573004445678', cargo: 'Bodega Compartida',requiresBuyerName: true  },
];
// ───────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB...\n');

  for (const emp of EMPLEADOS) {
    const doc = await Employee.findOneAndUpdate(
      { telefono: emp.telefono },
      emp,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const tag = emp.requiresBuyerName ? '(pide nombre comprador)' : '';
    console.log(`✅ ${doc.nombre} — ${doc.telefono} ${tag}`);
  }

  console.log('\n✅ Empleados sincronizados correctamente');
  await mongoose.disconnect();
}

main().catch(console.error);
