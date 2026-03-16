const Receipt = require('../models/Receipt');
const { buildReceiptHash } = require('../utils/hash');

async function saveReceipt({ empleado, comprador, datos, imageId }) {
  const ahora = new Date();

  // LOG para depurar — muestra lo que Claude extrajo
  console.log('=== DATOS EXTRAIDOS POR CLAUDE ===');
  console.log('establecimiento:', datos.establecimiento);
  console.log('numeroPedido   :', datos.numeroPedido);
  console.log('total          :', datos.total);
  console.log('==================================');

  const hash = buildReceiptHash({
    establecimiento: datos.establecimiento,
    total: datos.total,
    numeroPedido: datos.numeroPedido || null,
    fechaHoraRegistro: ahora,
  });

  console.log('Hash generado  :', hash);

  const existe = await Receipt.findOne({ receiptHash: hash });
  if (existe) {
    const fecha = existe.registradoEn.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    console.log('DUPLICADO detectado — registrado el:', fecha);
    throw Object.assign(new Error('DUPLICATE'), { registradoEn: fecha, status: existe.status });
  }

  const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

  const receipt = new Receipt({
    empleado,
    comprador: comprador
      ? { cedula: comprador.cedula, nombre: comprador.nombre }
      : { cedula: null, nombre: null },
    establecimiento: datos.establecimiento,
    numeroPedido: datos.numeroPedido || null,
    fechaTiquete: datos.fechaTiquete,
    total: datos.total,
    moneda: datos.moneda || 'COP',
    imagenUrl: datos.imagenUrl,
    imageId,
    receiptHash: hash,
    mes,
    status: 'pending',
  });

  await receipt.save();
  return receipt;
}

module.exports = { saveReceipt };
