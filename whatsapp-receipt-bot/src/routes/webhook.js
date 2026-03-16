const express = require('express');
const router = express.Router();

const { analyzeReceipt } = require('../services/claude');
const { sendMessage, sendAdminApprovalMessage, formatPendingMessage } = require('../services/whatsapp');
const { saveReceipt } = require('../services/receiptService');
const Employee = require('../models/Employee');
const Receipt = require('../models/Receipt');
const Buyer = require('../models/Buyer');
const Session = require('../models/Session');

// ── Helpers ──────────────────────────────────────────────────

function isValidCedula(str) {
  // Cedula colombiana: 6 a 10 digitos numericos
  return /^\d{6,10}$/.test(str.trim());
}

async function upsertSession(telefono, state, pendingData) {
  await Session.findOneAndUpdate(
    { telefono },
    { telefono, state, pendingData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function translateStatus(s) {
  return { pending: 'pendiente', approved: 'aprobado', rejected: 'rechazado' }[s] || s;
}

// ── GET /webhook — verificacion Meta ────────────────────────

router.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verificado');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ── POST /webhook — mensajes entrantes ──────────────────────

router.post('/', async (req, res) => {
  res.sendStatus(200);
  try {
    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages?.length) return;

    const msg = messages[0];
    const from = msg.from;

    if (from === process.env.ADMIN_PHONE) {
      await handleAdminMessage(msg, from);
      return;
    }

    const empleado = await Employee.findOne({ telefono: from, activo: true });
    if (!empleado) {
      await sendMessage(from, 'Tu numero no esta registrado. Contacta al administrador.');
      return;
    }

    const session = await Session.findOne({ telefono: from });

    if (session?.state === 'WAITING_CEDULA') {
      await handleCedulaResponse(msg, from, empleado, session);
      return;
    }

    if (session?.state === 'WAITING_BUYER_NAME') {
      await handleBuyerNameResponse(msg, from, empleado, session);
      return;
    }

    if (msg.type === 'image') {
      await handleImageMessage(msg, from, empleado);
    } else {
      await sendMessage(from, `Hola ${empleado.nombre}! Enviame la foto del tiquete.`);
    }
  } catch (err) {
    console.error('Error webhook:', err);
  }
});

// ── Flujo 1: imagen recibida ─────────────────────────────────

async function handleImageMessage(msg, from, empleado) {
  const mediaId = msg.image.id;
  await sendMessage(from, 'Leyendo tu tiquete...');

  let datos;
  try {
    datos = await analyzeReceipt(mediaId);
  } catch (err) {
    console.error('Error Claude:', err);
    await sendMessage(from, 'No pude procesar la imagen. Intenta con mejor iluminacion.');
    return;
  }

  if (!datos.exito) {
    await sendMessage(from, `No pude leer el tiquete: ${datos.razon}\nEnvia una foto mas clara.`);
    return;
  }

  if (empleado.requiresBuyerName) {
    // Guardar tiquete en sesion y pedir cedula
    await upsertSession(from, 'WAITING_CEDULA', { datos, imageId: mediaId });
    const fmt = (n) => n?.toLocaleString('es-CO') ?? '0';
    await sendMessage(
      from,
      `Tiquete leido:\nLugar: ${datos.establecimiento || 'Sin nombre'}\nTotal: $${fmt(datos.total)} ${datos.moneda || 'COP'}\n\nEscribe la *cedula* de quien hizo la compra:`
    );
    return;
  }

  // Empleado personal: el mismo es el comprador
  await finalizeSave({ empleado: { nombre: empleado.nombre, telefono: from }, comprador: null, datos, imageId: mediaId, from });
}

// ── Flujo 2: empleado responde con cedula ────────────────────

async function handleCedulaResponse(msg, from, empleado, session) {
  if (msg.type !== 'text') {
    await sendMessage(from, 'Escribe el numero de cedula de quien hizo la compra.');
    return;
  }

  const input = msg.text.body.trim();

  if (!isValidCedula(input)) {
    await sendMessage(from, 'Cedula invalida. Debe tener entre 6 y 10 digitos numericos.\nIntenta de nuevo:');
    return;
  }

  const cedula = input.trim();
  const { datos, imageId } = session.pendingData;

  // Buscar si la cedula ya esta registrada
  const buyerExistente = await Buyer.findOne({ cedula });

  if (buyerExistente) {
    // Cedula conocida: guardar directo sin preguntar nombre
    await Session.deleteOne({ telefono: from });
    await finalizeSave({
      empleado: { nombre: empleado.nombre, telefono: from },
      comprador: { cedula, nombre: buyerExistente.nombre },
      datos,
      imageId,
      from,
    });
    return;
  }

  // Cedula nueva: guardar cedula en sesion y pedir nombre
  await upsertSession(from, 'WAITING_BUYER_NAME', { datos, imageId, cedula });
  await sendMessage(from, `Cedula ${cedula} no esta registrada.\nEscribe el *nombre completo* de esta persona:`);
}

// ── Flujo 3: empleado responde con nombre (cedula nueva) ─────

async function handleBuyerNameResponse(msg, from, empleado, session) {
  if (msg.type !== 'text') {
    await sendMessage(from, 'Escribe el nombre completo de la persona.');
    return;
  }

  const nombre = msg.text.body.trim();
  if (nombre.length < 3) {
    await sendMessage(from, 'El nombre es muy corto. Escribe nombre y apellido:');
    return;
  }

  const { datos, imageId, cedula } = session.pendingData;
  await Session.deleteOne({ telefono: from });

  // Registrar comprador nuevo
  await Buyer.create({ cedula, nombre, registradoPor: from });
  console.log(`Nuevo comprador registrado: ${nombre} (${cedula})`);

  await finalizeSave({
    empleado: { nombre: empleado.nombre, telefono: from },
    comprador: { cedula, nombre },
    datos,
    imageId,
    from,
  });
}

// ── Guardar tiquete y notificar ──────────────────────────────

async function finalizeSave({ empleado, comprador, datos, imageId, from }) {
  let receipt;
  try {
    receipt = await saveReceipt({ empleado, comprador, datos, imageId });
  } catch (err) {
    if (err.message === 'DUPLICATE') {
      await sendMessage(from, `Este tiquete ya fue registrado el ${err.registradoEn} — estado: ${translateStatus(err.status)}. No se guardo de nuevo.`);
      return;
    }
    console.error('Error guardando:', err);
    await sendMessage(from, 'Error al guardar. Intenta de nuevo.');
    return;
  }

  await sendMessage(from, formatPendingMessage(datos, empleado.nombre, comprador?.nombre));
  await sendAdminApprovalMessage(receipt);
  console.log(`Tiquete ${receipt._id} pendiente — ${empleado.nombre} $${datos.total}`);
}

// ── Admin: botones y texto ───────────────────────────────────

async function handleAdminMessage(msg, from) {

  // Respuesta de boton (Aprobar / Rechazar)
  if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
    const btnId = msg.interactive.button_reply.id;

    if (btnId.startsWith('APPROVE_')) {
      await approveReceipt(btnId.replace('APPROVE_', ''), from);
      return;
    }
    if (btnId.startsWith('REJECT_')) {
      const id = btnId.replace('REJECT_', '');
      await upsertSession(from, 'WAITING_REJECT_NOTE', { pendingRejectId: id });
      await sendMessage(from, `Escribe el motivo del rechazo:`);
      return;
    }
  }

  if (msg.type === 'text') {
    const text = msg.text.body.trim();

    // Admin respondiendo motivo de rechazo
    const session = await Session.findOne({ telefono: from, state: 'WAITING_REJECT_NOTE' });
    if (session) {
      const id = session.pendingData.pendingRejectId;
      await Session.deleteOne({ telefono: from });
      await rejectReceipt(id, from, text);
      return;
    }

    // Comandos manuales de texto (fallback por si los botones no cargan)
    const approveMatch = text.match(/^APROBAR\s+([a-f0-9]{24})/i);
    if (approveMatch) { await approveReceipt(approveMatch[1], from); return; }

    const rejectMatch = text.match(/^RECHAZAR\s+([a-f0-9]{24})\s*(.*)?$/i);
    if (rejectMatch) { await rejectReceipt(rejectMatch[1], from, rejectMatch[2] || ''); return; }

    const pending = await Receipt.countDocuments({ status: 'pending' });
    await sendMessage(from, `Admin activo. Tiquetes pendientes: ${pending}\nUsa los botones de cada tiquete para aprobar o rechazar.`);
  }
}

async function approveReceipt(id, adminPhone) {
  const receipt = await Receipt.findById(id);
  if (!receipt) { await sendMessage(adminPhone, `No encontre el tiquete.`); return; }
  if (receipt.status !== 'pending') {
    await sendMessage(adminPhone, `Este tiquete ya fue ${translateStatus(receipt.status)}.`);
    return;
  }
  receipt.status = 'approved';
  receipt.revisadoEn = new Date();
  await receipt.save();

  const fmt = (n) => n?.toLocaleString('es-CO') ?? '0';
  await sendMessage(adminPhone, `Aprobado: ${receipt.establecimiento} — $${fmt(receipt.total)} ${receipt.moneda}`);
  await sendMessage(receipt.empleado.telefono, `Tu tiquete fue APROBADO.\n${receipt.establecimiento} — $${fmt(receipt.total)} ${receipt.moneda}`);
  console.log(`Tiquete ${id} aprobado`);
}

async function rejectReceipt(id, adminPhone, motivo) {
  const receipt = await Receipt.findById(id);
  if (!receipt) { await sendMessage(adminPhone, `No encontre el tiquete.`); return; }
  if (receipt.status !== 'pending') {
    await sendMessage(adminPhone, `Este tiquete ya fue ${translateStatus(receipt.status)}.`);
    return;
  }
  receipt.status = 'rejected';
  receipt.adminNota = motivo || 'Sin motivo';
  receipt.revisadoEn = new Date();
  await receipt.save();

  const fmt = (n) => n?.toLocaleString('es-CO') ?? '0';
  await sendMessage(adminPhone, `Rechazado: ${receipt.establecimiento} — $${fmt(receipt.total)}\nMotivo: ${receipt.adminNota}`);
  await sendMessage(receipt.empleado.telefono, `Tu tiquete fue RECHAZADO.\n${receipt.establecimiento} — $${fmt(receipt.total)}\nMotivo: ${receipt.adminNota}`);
  console.log(`Tiquete ${id} rechazado`);
}

module.exports = router;
