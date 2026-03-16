const WHATSAPP_API = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

async function callAPI(body) {
  const res = await fetch(WHATSAPP_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error('WhatsApp API error:', await res.text());
}

async function sendMessage(to, text) {
  await callAPI({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
}

async function sendInteractiveButtons(to, { header, body, footer, buttons }) {
  await callAPI({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(header ? { header: { type: 'text', text: header } } : {}),
      body: { text: body },
      ...(footer ? { footer: { text: footer } } : {}),
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

function formatPendingMessage(datos, nombreEmpleado, nombreComprador) {
  const fmt = (n) => n?.toLocaleString('es-CO') ?? '0';
  const quienCompro = nombreComprador || nombreEmpleado;
  let msg = `Tiquete enviado al administrador\n\n`;
  msg += `Empleado: ${nombreEmpleado}\n`;
  msg += `Comprador: ${quienCompro}\n`;
  msg += `Lugar: ${datos.establecimiento || 'No identificado'}\n`;
  if (datos.fechaTiquete) msg += `Fecha: ${datos.fechaTiquete}\n`;
  msg += `Total: $${fmt(datos.total)} ${datos.moneda || 'COP'}`;
  msg += `\n\nRecibieras confirmacion cuando el administrador lo revise.`;
  return msg;
}

async function sendAdminApprovalMessage(receipt) {
  const fmt = (n) => n?.toLocaleString('es-CO') ?? '0';
  const comprador = receipt.comprador?.nombre || receipt.empleado.nombre;
  const cedula = receipt.comprador?.cedula ? ` (CC ${receipt.comprador.cedula})` : '';
  const hora = receipt.registradoEn
    ? receipt.registradoEn.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
    : 'ahora';

  const body =
    `${receipt.empleado.nombre} registro una compra de *${comprador}*${cedula}\n\n` +
    `Lugar: ${receipt.establecimiento || 'No identificado'}\n` +
    (receipt.fechaTiquete ? `Fecha tiquete: ${receipt.fechaTiquete}\n` : '') +
    `Registrado: ${hora}\n\n` +
    `Total: *$${fmt(receipt.total)} ${receipt.moneda}*`;

  const id = receipt._id.toString();

  await sendInteractiveButtons(process.env.ADMIN_PHONE, {
    header: 'Nueva solicitud de compra',
    body,
    footer: `ID: ${id}`,
    buttons: [
      { id: `APPROVE_${id}`, title: 'Aprobar' },
      { id: `REJECT_${id}`,  title: 'Rechazar' },
    ],
  });
}

module.exports = { sendMessage, sendInteractiveButtons, sendAdminApprovalMessage, formatPendingMessage };
