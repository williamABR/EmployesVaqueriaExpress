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
  // Celular compartido (caja): puede ser cualquier persona quien compra
  { nombre: 'William Baquero',  telefono: '573204897354', cargo: 'Admin',  requiresBuyerName: true  },
  { nombre: 'Angela M Baquero',          telefono: '673204253763', cargo: 'Admin',requiresBuyerName: true  },
  { nombre: 'Angela Rojas',          telefono: '573105560904', cargo: 'Admin',requiresBuyerName: true  },
  { nombre: 'Juan Baquero',          telefono: '573106982440', cargo: 'Admin',requiresBuyerName: true  },
  { nombre: 'Gabriela Baquero',          telefono: '573024193509', cargo: 'Admin',requiresBuyerName: true  },

  { nombre: 'Alejandro',          telefono: '573046501881', cargo: 'Empleado',requiresBuyerName: true  },
  { nombre: 'Karen',          telefono: '573007876555', cargo: 'Empleado',requiresBuyerName: true  },
  { nombre: 'Dayana Mora',          telefono: '573054488098', cargo: 'Empleado',requiresBuyerName: true  },
  { nombre: 'Jimena',          telefono: '573125293479', cargo: 'Empleado',requiresBuyerName: true  },
  { nombre: 'David',          telefono: '573115082943', cargo: 'Empleado',requiresBuyerName: true  },

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
