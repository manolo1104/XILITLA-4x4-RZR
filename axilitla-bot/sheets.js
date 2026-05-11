// Conexión con Google Sheets usando Service Account

const { google } = require('googleapis');
const { RUTAS } = require('./data');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_TAB = 'RZR'; // Nombre de la pestaña de reservas

let sheetsClient;

async function initSheets() {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  console.log('✅ Google Sheets conectado correctamente');
}

async function getAllRows() {
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A2:M`
  });
  return res.data.values || [];
}

async function getNextFolio() {
  const rows = await getAllRows();
  const folios = rows
    .map(r => r[0])
    .filter(f => f && f.toString().startsWith('AX-'))
    .map(f => parseInt(f.replace('AX-', ''), 10))
    .filter(n => !isNaN(n));

  const next = folios.length > 0 ? Math.max(...folios) + 1 : 1;
  return `AX-${String(next).padStart(3, '0')}`;
}

async function checkAvailability(fecha, vehiculoId, horaInicio, duracion) {
  const rows = await getAllRows();
  const horaFin = horaInicio + duracion;

  const conflicts = rows.filter(r => {
    if (!r[0]) return false;                   // sin folio
    if (r[1] !== fecha) return false;           // diferente fecha
    if (r[3] !== vehiculoId) return false;      // diferente vehículo
    if (r[10] === 'Cancelada') return false;    // cancelada no bloquea

    // Parsear hora inicio guardada (formato "09:00")
    const parts = (r[6] || '09:00').split(':');
    const rHI = parseInt(parts[0] || 0) + (parseInt(parts[1] || 0) / 60);
    const rDur = parseFloat(r[5]) || 2;
    const rHF = rHI + rDur;

    return !(horaFin <= rHI || horaInicio >= rHF);
  });

  return conflicts.length === 0;
}

async function createBooking(booking) {
  const folio = await getNextFolio();
  const duracion = RUTAS[booking.ruta]?.duracion || 2;
  const horaFin = booking.horaInicio + duracion;

  const fmtHora = (h) =>
    `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

  const row = [
    folio,
    booking.fecha,
    booking.cliente,
    booking.vehiculoId,
    booking.ruta,
    String(duracion),
    fmtHora(booking.horaInicio),
    fmtHora(horaFin),
    `$${Number(booking.precio).toLocaleString('es-MX')}`,
    String(booking.personas),
    'Pendiente de pago',
    '',
    booking.telefono
  ];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:M`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [row] }
  });

  return folio;
}

async function getBookingByFolio(folio) {
  const rows = await getAllRows();
  const row = rows.find(r => r[0] === folio);
  if (!row) return null;

  return {
    folio:     row[0]  || '',
    fecha:     row[1]  || '',
    cliente:   row[2]  || '',
    vehiculo:  row[3]  || '',
    ruta:      row[4]  || '',
    duracion:  row[5]  || '',
    horaInicio:row[6]  || '',
    horaFin:   row[7]  || '',
    precio:    row[8]  || '',
    personas:  row[9]  || '',
    estado:    row[10] || '',
    notas:     row[11] || '',
    telefono:  row[12] || ''
  };
}

async function confirmBooking(folio) {
  const rows = await getAllRows();
  const idx = rows.findIndex(r => r[0] === folio);
  if (idx === -1) throw new Error(`Folio ${folio} no encontrado`);

  const sheetRow = idx + 2; // +1 encabezado, +1 base-1

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!K${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [['Confirmada']] }
  });

  return getBookingByFolio(folio);
}

module.exports = {
  initSheets,
  getNextFolio,
  checkAvailability,
  createBooking,
  getBookingByFolio,
  confirmBooking
};
