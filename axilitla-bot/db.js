// Base de datos local — reservas.json + logs.json

const fs = require('fs');
const path = require('path');
const { RUTAS, VEHICULOS } = require('./data');

const DB_PATH   = path.join(__dirname, 'reservas.json');
const LOGS_PATH = path.join(__dirname, 'logs.json');

// ── Archivos ──────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '[]');
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
function loadLogs() {
  if (!fs.existsSync(LOGS_PATH)) fs.writeFileSync(LOGS_PATH, '[]');
  return JSON.parse(fs.readFileSync(LOGS_PATH, 'utf8'));
}
function saveLogs(data) {
  fs.writeFileSync(LOGS_PATH, JSON.stringify(data, null, 2));
}

// ── Bitácora ──────────────────────────────────────────────
function addLog(usuario, accion, folio = '', detalles = '') {
  const logs = loadLogs();
  logs.unshift({ id: Date.now(), fecha: new Date().toISOString(), usuario, accion, folio, detalles });
  saveLogs(logs.slice(0, 500));
}
function getLogs() { return loadLogs(); }

// ── Init ──────────────────────────────────────────────────
function initSheets() {
  loadDB(); loadLogs();
  console.log('✅ Base de datos local lista (reservas.json)');
}

// ── Folio ─────────────────────────────────────────────────
function getNextFolio() {
  const nums = loadDB()
    .map(r => r.folio).filter(f => f?.startsWith('AX-'))
    .map(f => parseInt(f.replace('AX-', ''), 10)).filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `AX-${String(next).padStart(3, '0')}`;
}

// ── Disponibilidad ────────────────────────────────────────
function checkAvailability(fecha, vehiculoId, horaInicio, duracion) {
  const horaFin = horaInicio + duracion;
  return !loadDB().some(r => {
    if (r.fecha !== fecha || r.vehiculoId !== vehiculoId || r.estado === 'Cancelada') return false;
    const [h, m] = (r.horaInicio || '09:00').split(':').map(Number);
    const rHI = h + m / 60;
    const rHF = rHI + (parseFloat(r.duracion) || 2);
    return !(horaFin <= rHI || horaInicio >= rHF);
  });
}

// ── Crear reserva ─────────────────────────────────────────
function createBooking(booking) {
  const reservas = loadDB();
  const folio    = getNextFolio();
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
  saveDB(reservas);
  addLog('Bot (WhatsApp)', 'Reserva creada', folio, `Cliente: ${booking.cliente} | Ruta: ${booking.ruta}`);
  return folio;
}

// ── Consultas ─────────────────────────────────────────────
function getAllBookings()       { return loadDB(); }
function getBookingByFolio(folio) {
  return loadDB().find(r => r.folio === folio) || null;
}

// ── Confirmar ─────────────────────────────────────────────
function confirmBooking(folio, usuario = 'Sistema') {
  const reservas = loadDB();
  const idx = reservas.findIndex(r => r.folio === folio);
  if (idx === -1) throw new Error(`Folio ${folio} no encontrado`);
  reservas[idx].estado       = 'Confirmada';
  reservas[idx].confirmadoEn  = new Date().toISOString();
  reservas[idx].confirmadoPor = usuario;
  saveDB(reservas);
  addLog(usuario, 'Confirmación', folio, `Reserva confirmada por ${usuario}`);
  return reservas[idx];
}

// ── Cancelar ──────────────────────────────────────────────
function cancelBooking(folio, usuario = 'Sistema') {
  const reservas = loadDB();
  const idx = reservas.findIndex(r => r.folio === folio);
  if (idx === -1) throw new Error(`Folio ${folio} no encontrado`);
  reservas[idx].estado      = 'Cancelada';
  reservas[idx].canceladoEn  = new Date().toISOString();
  reservas[idx].canceladoPor = usuario;
  saveDB(reservas);
  addLog(usuario, 'Cancelación', folio, `Reserva cancelada por ${usuario}`);
  return reservas[idx];
}

module.exports = {
  initSheets, getNextFolio, checkAvailability,
  createBooking, getAllBookings, getBookingByFolio,
  confirmBooking, cancelBooking, getLogs, addLog
};
