// Base de datos — usa Vercel KV en producción, JSON local en desarrollo

const fs   = require('fs');
const path = require('path');
const { RUTAS, VEHICULOS } = require('./data');

const USE_KV   = !!process.env.KV_REST_API_URL;
const DB_PATH  = path.join(__dirname, 'reservas.json');
const LOG_PATH = path.join(__dirname, 'logs.json');

// ── Almacenamiento ────────────────────────────────────────
async function readKey(key, def = []) {
  if (USE_KV) {
    const { kv } = require('@vercel/kv');
    return (await kv.get(key)) ?? def;
  }
  const file = key === 'reservas' ? DB_PATH : LOG_PATH;
  if (!fs.existsSync(file)) return def;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function writeKey(key, value) {
  if (USE_KV) {
    const { kv } = require('@vercel/kv');
    await kv.set(key, value);
    return;
  }
  const file = key === 'reservas' ? DB_PATH : LOG_PATH;
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// ── Bitácora ──────────────────────────────────────────────
async function addLog(usuario, accion, folio = '', detalles = '') {
  const logs = await readKey('logs');
  logs.unshift({ id: Date.now(), fecha: new Date().toISOString(), usuario, accion, folio, detalles });
  await writeKey('logs', logs.slice(0, 500));
}
async function getLogs() { return readKey('logs'); }

// ── Init ──────────────────────────────────────────────────
async function initSheets() {
  await readKey('reservas');
  await readKey('logs');
  console.log(`✅ Base de datos lista (${USE_KV ? 'Vercel KV' : 'archivo local'})`);
}

// ── Folio ─────────────────────────────────────────────────
async function getNextFolio() {
  const reservas = await readKey('reservas');
  const nums = reservas
    .map(r => r.folio).filter(f => f?.startsWith('AX-'))
    .map(f => parseInt(f.replace('AX-', ''), 10)).filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `AX-${String(next).padStart(3, '0')}`;
}

// ── Disponibilidad ────────────────────────────────────────
async function checkAvailability(fecha, vehiculoId, horaInicio, duracion) {
  const reservas = await readKey('reservas');
  const horaFin  = horaInicio + duracion;
  return !reservas.some(r => {
    if (r.fecha !== fecha || r.vehiculoId !== vehiculoId || r.estado === 'Cancelada') return false;
    const [h, m] = (r.horaInicio || '09:00').split(':').map(Number);
    const rHI = h + m / 60;
    const rHF = rHI + (parseFloat(r.duracion) || 2);
    return !(horaFin <= rHI || horaInicio >= rHF);
  });
}

// ── Crear ─────────────────────────────────────────────────
async function createBooking(booking) {
  const reservas = await readKey('reservas');
  const folio    = await getNextFolio();
  const duracion = RUTAS[booking.ruta]?.duracion || 2;
  const horaFin  = booking.horaInicio + duracion;
  const fmt      = h => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`;
  const vehiculoNombre = booking.vehiculoNombre ||
    VEHICULOS.find(v => v.id === booking.vehiculoId)?.nombre || booking.vehiculoId;

  const nueva = {
    folio,
    fecha:         booking.fecha,
    cliente:       booking.cliente,
    vehiculoId:    booking.vehiculoId,
    vehiculoNombre,
    ruta:          booking.ruta,
    duracion:      String(duracion),
    horaInicio:    fmt(booking.horaInicio),
    horaFin:       fmt(horaFin),
    precio:        `$${Number(booking.precio).toLocaleString('es-MX')}`,
    personas:      String(booking.personas),
    estado:        'Pendiente de pago',
    notas:         '',
    telefono:      booking.telefono,
    creadoEn:      new Date().toISOString()
  };

  reservas.push(nueva);
  await writeKey('reservas', reservas);
  await addLog('Bot (WhatsApp)', 'Reserva creada', folio, `Cliente: ${booking.cliente} | Ruta: ${booking.ruta}`);
  return folio;
}

// ── Consultas ─────────────────────────────────────────────
async function getAllBookings()          { return readKey('reservas'); }
async function getBookingByFolio(folio) {
  return (await readKey('reservas')).find(r => r.folio === folio) || null;
}

// ── Confirmar ─────────────────────────────────────────────
async function confirmBooking(folio, usuario = 'Sistema') {
  const reservas = await readKey('reservas');
  const idx = reservas.findIndex(r => r.folio === folio);
  if (idx === -1) throw new Error(`Folio ${folio} no encontrado`);
  reservas[idx].estado       = 'Confirmada';
  reservas[idx].confirmadoEn  = new Date().toISOString();
  reservas[idx].confirmadoPor = usuario;
  await writeKey('reservas', reservas);
  await addLog(usuario, 'Confirmación', folio, `Confirmada por ${usuario}`);
  return reservas[idx];
}

// ── Cancelar ──────────────────────────────────────────────
async function cancelBooking(folio, usuario = 'Sistema') {
  const reservas = await readKey('reservas');
  const idx = reservas.findIndex(r => r.folio === folio);
  if (idx === -1) throw new Error(`Folio ${folio} no encontrado`);
  reservas[idx].estado      = 'Cancelada';
  reservas[idx].canceladoEn  = new Date().toISOString();
  reservas[idx].canceladoPor = usuario;
  await writeKey('reservas', reservas);
  await addLog(usuario, 'Cancelación', folio, `Cancelada por ${usuario}`);
  return reservas[idx];
}

module.exports = {
  initSheets, getNextFolio, checkAvailability,
  createBooking, getAllBookings, getBookingByFolio,
  confirmBooking, cancelBooking, getLogs, addLog
};
