const crypto = require('crypto');

/**
 * Hash de deduplicacion:
 *
 * PRIORIDAD 1 - solo el numeroPedido tal como viene ("06-842")
 *   Es unico por si mismo, no necesita combinarse con nada mas.
 *
 * PRIORIDAD 2 - establecimiento + total + minuto de registro
 *   Fallback cuando el tiquete no tiene numero de pedido.
 */
function buildReceiptHash({ establecimiento, total, numeroPedido, fechaHoraRegistro }) {
  let base;

  if (numeroPedido) {
    base = numeroPedido.toString().trim();
  } else {
    const lugar = (establecimiento || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const minuto = (fechaHoraRegistro instanceof Date ? fechaHoraRegistro : new Date())
      .toISOString()
      .slice(0, 16);
    base = `${lugar}|${String(total)}|${minuto}`;
  }

  console.log('Hash base:', base);
  return crypto.createHash('sha256').update(base).digest('hex');
}

module.exports = { buildReceiptHash };
