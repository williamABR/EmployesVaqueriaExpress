/**
 * Reporte mensual de gastos por empleado.
 * Uso: node scripts/report.js [YYYY-MM] [--pendientes|--aprobados|--rechazados]
 *
 * Ejemplos:
 *   node scripts/report.js
 *   node scripts/report.js 2026-03
 *   node scripts/report.js 2026-03 --aprobados
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Receipt = require('../src/models/Receipt');

const STATUS_LABEL = { pending: 'PENDIENTE', approved: 'APROBADO', rejected: 'RECHAZADO' };

async function main() {
  const mes = process.argv[2]?.match(/^\d{4}-\d{2}$/)
    ? process.argv[2]
    : new Date().toISOString().slice(0, 7);

  const flagArg = process.argv.find((a) => a.startsWith('--'));
  const statusFilter = flagArg
    ? { '--pendientes': 'pending', '--aprobados': 'approved', '--rechazados': 'rejected' }[flagArg]
    : null;

  await mongoose.connect(process.env.MONGODB_URI);

  const query = { mes };
  if (statusFilter) query.status = statusFilter;

  const registros = await Receipt.find(query).sort({ registradoEn: -1 });

  if (!registros.length) {
    console.log(`\nSin registros para ${mes}${statusFilter ? ` (${statusFilter})` : ''}`);
    await mongoose.disconnect();
    return;
  }

  const porEmpleado = {};
  registros.forEach((r) => {
    const key = r.empleado.nombre;
    if (!porEmpleado[key]) porEmpleado[key] = { tiquetes: [], total: 0 };
    porEmpleado[key].tiquetes.push(r);
    porEmpleado[key].total += r.total;
  });

  const fmt = (n) => `$${(n || 0).toLocaleString('es-CO')}`;
  const totalGeneral = registros.reduce((s, r) => s + r.total, 0);
  const titulo = statusFilter ? ` — solo ${STATUS_LABEL[statusFilter]}` : '';

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  REPORTE ${mes}${titulo}`);
  console.log(`${'═'.repeat(55)}\n`);

  for (const [nombre, datos] of Object.entries(porEmpleado)) {
    console.log(`👤 ${nombre}  (${datos.tiquetes.length} tiquete${datos.tiquetes.length > 1 ? 's' : ''})`);
    datos.tiquetes.forEach((r) => {
      const fecha = r.registradoEn.toLocaleDateString('es-CO');
      const comprador = r.comprador?.nombre ? ` [${r.comprador.nombre}]` : '';
      const estado = STATUS_LABEL[r.status] || r.status;
      const lugar = (r.establecimiento || 'Sin nombre').padEnd(22).slice(0, 22);
      console.log(`   ${fecha}  ${lugar}  ${fmt(r.total).padStart(12)}  ${estado}${comprador}`);
    });
    console.log(`   ${'─'.repeat(52)}`);
    console.log(`   SUBTOTAL: ${fmt(datos.total)}\n`);
  }

  console.log(`${'═'.repeat(55)}`);
  console.log(`  TOTAL GENERAL: ${fmt(totalGeneral)}`);
  console.log(`  Tiquetes: ${registros.length} | Pendientes: ${registros.filter((r) => r.status === 'pending').length} | Aprobados: ${registros.filter((r) => r.status === 'approved').length} | Rechazados: ${registros.filter((r) => r.status === 'rejected').length}`);
  console.log(`${'═'.repeat(55)}\n`);

  await mongoose.disconnect();
}

main().catch(console.error);
