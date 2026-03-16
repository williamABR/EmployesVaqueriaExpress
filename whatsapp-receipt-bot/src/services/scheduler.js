const cron = require('node-cron');
const Receipt = require('../models/Receipt');
const { sendMessage } = require('./whatsapp');

async function sendWeeklyReport() {
  try {
    const ahora = new Date();
    const lunes = new Date(ahora);
    lunes.setDate(ahora.getDate() - 7);
    lunes.setHours(0, 0, 0, 0);

    const domingo = new Date(ahora);
    domingo.setHours(23, 59, 59, 999);

    const tiquetes = await Receipt.find({
      status: 'approved',
      registradoEn: { $gte: lunes, $lte: domingo },
    });

    const fmt = (n) => n.toLocaleString('es-CO');
    const fechaInicio = lunes.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    const fechaFin = domingo.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

    if (!tiquetes.length) {
      await sendMessage(
        process.env.ADMIN_PHONE,
        `📊 *Reporte semanal ${fechaInicio} - ${fechaFin}*\n\nNo hubo tiquetes aprobados esta semana.`
      );
      return;
    }

    // Agrupar por empleado: total gastado + cantidad de tiquetes enviados
    const porEmpleado = {};
    tiquetes.forEach((t) => {
      const nombre = t.empleado.nombre;
      if (!porEmpleado[nombre]) porEmpleado[nombre] = { total: 0, cantidad: 0 };
      porEmpleado[nombre].total += t.total;
      porEmpleado[nombre].cantidad += 1;
    });

    // Ordenar por cantidad de solicitudes (quien mas envia primero)
    const ordenados = Object.entries(porEmpleado)
      .sort(([, a], [, b]) => b.cantidad - a.cantidad);

    const totalGeneral = ordenados.reduce((s, [, v]) => s + v.total, 0);
    const totalSolicitudes = tiquetes.length;

    let msg = `📊 *Reporte semanal ${fechaInicio} - ${fechaFin}*\n`;
    msg += `_Solo tiquetes aprobados — ordenado por solicitudes_\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    ordenados.forEach(([nombre, datos], i) => {
      const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
      msg += `${emoji} *${nombre}*\n`;
      msg += `   Solicitudes: ${datos.cantidad}\n`;
      msg += `   Total: $${fmt(datos.total)}\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📋 Total solicitudes: ${totalSolicitudes}\n`;
    msg += `💰 *Total general: $${fmt(totalGeneral)}*`;

    await sendMessage(process.env.ADMIN_PHONE, msg);
    console.log(`Reporte semanal enviado — ${ordenados.length} empleados, ${totalSolicitudes} tiquetes`);
  } catch (err) {
    console.error('Error enviando reporte semanal:', err);
  }
}

function initScheduler() {
  // Todos los lunes a las 8:00 AM Colombia (UTC-5 = 13:00 UTC)
  cron.schedule('0 13 * * 1', () => {
    console.log('Ejecutando reporte semanal...');
    sendWeeklyReport();
  });

  console.log('Scheduler activo — reporte semanal todos los lunes a las 8:00 AM');
}

module.exports = { initScheduler, sendWeeklyReport };
