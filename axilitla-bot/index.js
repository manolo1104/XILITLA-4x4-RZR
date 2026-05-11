// Axilitla 4x4 — WhatsApp Bot Principal

require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { initSheets, getBookingByFolio, confirmBooking } = require('./db');
const { processMessage } = require('./agent');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'axilitla4x4' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  }
});

// ══════════════════════════════════════════
// EVENTOS DE CONEXIÓN
// ══════════════════════════════════════════

client.on('qr', (qr) => {
  console.clear();
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('   🏎️  AXILITLA 4X4 — WhatsApp Bot 🌿   ');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('📱 Escanea este código con tu WhatsApp:');
  console.log('   (Abre WhatsApp → ⋮ → Dispositivos vinculados → Vincular dispositivo)');
  console.log('');
  qrcode.generate(qr, { small: true });
  console.log('');
  console.log('⏳ Esperando que escanees el QR...');
  console.log('');
});

client.on('authenticated', () => {
  console.log('🔐 Sesión autenticada correctamente.');
});

client.on('ready', () => {
  console.log('');
  console.log('✅ ¡Bot conectado y listo!');
  console.log('');
  console.log('📋 COMANDOS DISPONIBLES (escríbelos desde TU WhatsApp):');
  console.log('   /confirma AX-001  → Confirma esa reserva y notifica al cliente');
  console.log('   /status           → Verifica que el bot esté activo');
  console.log('   /help             → Muestra los comandos disponibles');
  console.log('');
  console.log('🤖 El bot está atendiendo clientes automáticamente.');
  console.log('   Presiona Ctrl+C para apagar el bot.');
  console.log('');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Error de autenticación:', msg);
  console.log('   Borra la carpeta .wwebjs_auth y vuelve a ejecutar el bot.');
});

client.on('disconnected', (reason) => {
  console.log('⚠️  Bot desconectado:', reason);
  console.log('   Vuelve a ejecutar: node index.js');
});

// ══════════════════════════════════════════
// MENSAJES ENTRANTES (de clientes)
// ══════════════════════════════════════════

client.on('message', async (msg) => {
  if (msg.isGroupMsg || msg.from === 'status@broadcast') return;

  const from = msg.from;
  const body = msg.body?.trim();

  if (!body) return;

  console.log(`📨 Cliente [${from}]: ${body.substring(0, 60)}`);

  try {
    const response = await processMessage(from, body);
    await client.sendMessage(from, response);
  } catch (error) {
    console.error(`❌ Error procesando mensaje de ${from}:`, error.message);
    await client.sendMessage(
      from,
      'Lo siento, tuve un problema técnico momentáneo. Por favor escribe de nuevo en un momento. 🙏'
    );
  }
});

// ══════════════════════════════════════════
// COMANDOS DEL DUEÑO (mensajes enviados desde TU teléfono)
// ══════════════════════════════════════════

client.on('message_create', async (msg) => {
  if (!msg.fromMe) return;

  const body = msg.body?.trim();
  if (!body) return;

  if (body.startsWith('/confirma ')) {
    const folio = body.replace('/confirma ', '').trim().toUpperCase();
    await handleConfirma(msg, folio);
    return;
  }

  if (body === '/status') {
    await msg.reply('✅ Bot activo y funcionando correctamente. 🤖');
    return;
  }

  if (body === '/help') {
    await msg.reply(
      '*Comandos del bot Axilitla 4x4:*\n\n' +
      '*/confirma AX-001* → Confirma la reserva y manda mensaje automático al cliente\n' +
      '*/status* → Verifica que el bot esté activo\n' +
      '*/help* → Muestra esta ayuda\n\n' +
      '_Escribe el comando en cualquier chat de tu WhatsApp._'
    );
    return;
  }
});

// ══════════════════════════════════════════
// LÓGICA DE CONFIRMACIÓN
// ══════════════════════════════════════════

async function handleConfirma(msg, folio) {
  console.log(`🎯 Procesando confirmación: ${folio}`);

  try {
    const booking = await getBookingByFolio(folio);

    if (!booking) {
      await msg.reply(`❌ No encontré ninguna reserva con el folio *${folio}*.\nRevisa que el folio sea correcto (ej: AX-007).`);
      return;
    }

    if (booking.estado === 'Confirmada') {
      await msg.reply(`ℹ️ La reserva *${folio}* ya estaba confirmada previamente.`);
      return;
    }

    // Actualizar en Google Sheets
    await confirmBooking(folio);

    const clienteNombre = booking.cliente || 'Cliente';
    const fecha = formatFecha(booking.fecha);
    const vehiculo = booking.vehiculo || '';
    const ruta = booking.ruta || '';
    const horaInicio = booking.horaInicio || '';
    const duracion = booking.duracion || '';
    const precio = booking.precio || '';
    const personas = booking.personas || '';
    const telefono = booking.telefono || '';

    const confirmMsg =
      `🎉 *¡Tu reserva está CONFIRMADA!*\n\n` +
      `Hola *${clienteNombre}*, ¡todo listo! Prepárate para vivir una aventura increíble en Xilitla. 🌿🏔️\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Folio:* ${folio}\n` +
      `📅 *Fecha:* ${fecha}\n` +
      `⏰ *Hora de salida:* ${horaInicio}\n` +
      `🏎️ *Vehículo:* ${vehiculo}\n` +
      `🗺️ *Ruta:* ${ruta}\n` +
      `⏱️ *Duración:* ${duracion} horas\n` +
      `👥 *Personas:* ${personas}\n` +
      `💰 *Total:* ${precio}\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📍 *Punto de encuentro:*\n` +
      `Axilitla 4x4, Xilitla, S.L.P.\n` +
      `_(Te mandamos la ubicación exacta el día anterior)_\n\n` +
      `✅ *Recomendaciones para el día del tour:*\n` +
      `• Llega *15 minutos antes*\n` +
      `• Ropa que puedas ensuciar\n` +
      `• Zapatos cerrados (sin sandalias)\n` +
      `• Agua y protector solar\n` +
      `• Carga tu cámara 📷\n\n` +
      `¡Nos vemos pronto para la aventura! 🤙`;

    // Enviar al cliente
    if (telefono) {
      const clientPhone = telefono.includes('@c.us') ? telefono : `${telefono}@c.us`;
      await client.sendMessage(clientPhone, confirmMsg);
      await msg.reply(`✅ Reserva *${folio}* confirmada.\n📲 Mensaje enviado a *${clienteNombre}* (${telefono})`);
    } else {
      await msg.reply(
        `✅ Reserva *${folio}* confirmada en la hoja.\n\n` +
        `⚠️ No hay teléfono guardado. Copia este mensaje y envíalo manualmente:\n\n` +
        confirmMsg
      );
    }

    console.log(`✅ Reserva ${folio} confirmada para ${clienteNombre}`);

  } catch (error) {
    console.error('❌ Error en /confirma:', error.message);
    await msg.reply(`❌ Error al confirmar: ${error.message}`);
  }
}

function formatFecha(fecha) {
  if (!fecha) return 'Por confirmar';
  try {
    const [year, month, day] = fecha.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return fecha;
  }
}

// ══════════════════════════════════════════
// ARRANQUE
// ══════════════════════════════════════════

async function start() {
  console.log('');
  console.log('🚀 Iniciando Axilitla 4x4 Bot...');
  console.log('');

  await initSheets();
  client.initialize();
}

start().catch(err => {
  console.error('❌ Error al iniciar:', err.message);
  process.exit(1);
});
