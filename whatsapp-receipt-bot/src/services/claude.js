const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Extrae datos de tiquetes colombianos. JSON solo, sin texto extra.`;

const USER_PROMPT = `Tiquete colombiano. Solo JSON sin texto adicional:
{"establecimiento":"nombre completo del negocio tal como aparece","numeroPedido":null,"fechaTiquete":null,"total":0,"moneda":"COP","exito":true}
numeroPedido: numero despues de # o Pedido: o Factura: o similar, o null si no hay.
Si no es tiquete: {"exito":false,"razon":""}`;

async function downloadWhatsAppImage(mediaId) {
  const urlRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  const urlData = await urlRes.json();
  if (!urlData.url) throw new Error('No se pudo obtener URL de la imagen');

  const imgRes = await fetch(urlData.url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  if (!imgRes.ok) throw new Error('No se pudo descargar la imagen');

  const buffer = await imgRes.arrayBuffer();
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: imgRes.headers.get('content-type') || 'image/jpeg',
    url: urlData.url,
  };
}

async function analyzeReceipt(mediaId) {
  const { base64, mimeType, url } = await downloadWhatsAppImage(mediaId);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: USER_PROMPT },
      ],
    }],
  });

  const text = response.content[0].text.trim();
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Claude no devolvio JSON valido: ' + text);
  }

  return { ...parsed, imagenUrl: url };
}

module.exports = { analyzeReceipt };
