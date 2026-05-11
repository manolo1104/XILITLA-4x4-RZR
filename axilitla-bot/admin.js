// Panel administrativo — Axilitla 4x4

require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const PDFDoc   = require('pdfkit');
const {
  getAllBookings, getBookingByFolio,
  confirmBooking, cancelBooking, getLogs
} = require('./db');
const { DATOS_BANCO } = require('./data');

const app  = express();
const PORT = 3000;

const USUARIOS = { Manolo: 'RZR2026' };

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'axilitla4x4-admin-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  if (req.session.usuario) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ── Auth ──────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  if (USUARIOS[usuario] && USUARIOS[usuario] === password) {
    req.session.usuario = usuario;
    res.json({ ok: true, usuario });
  } else {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  req.session.usuario
    ? res.json({ usuario: req.session.usuario })
    : res.status(401).json({ error: 'No autorizado' });
});

// ── Reservas ──────────────────────────────────────────────
app.get('/api/reservas', auth, (req, res) => {
  res.json(getAllBookings().reverse());
});

app.post('/api/confirmar/:folio', auth, (req, res) => {
  try {
    const r = confirmBooking(req.params.folio, req.session.usuario);
    res.json({ ok: true, reserva: r });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/cancelar/:folio', auth, (req, res) => {
  try {
    const r = cancelBooking(req.params.folio, req.session.usuario);
    res.json({ ok: true, reserva: r });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Bitácora ──────────────────────────────────────────────
app.get('/api/logs', auth, (req, res) => {
  res.json(getLogs());
});

// ── PDF ───────────────────────────────────────────────────
app.get('/api/pdf/:folio', auth, (req, res) => {
  const b = getBookingByFolio(req.params.folio);
  if (!b) return res.status(404).json({ error: 'Reserva no encontrada' });

  const doc = new PDFDoc({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Axilitla4x4-${b.folio}.pdf"`);
  doc.pipe(res);

  const W     = 595.28;
  const GREEN = '#1F6B1F';
  const DARK  = '#1A1A1A';
  const MUTED = '#555555';
  const STRIPE= '#F0F7F0';
  const AMBER = '#D97706';

  // Cabecera verde
  doc.rect(0, 0, W, 85).fill(GREEN);
  doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('AXILITLA 4X4', 50, 18);
  doc.fillColor('#AADDAA').fontSize(10).font('Helvetica')
     .text('Aventuras Off-Road  |  Xilitla, San Luis Potosí, México', 50, 50);

  let y = 100;

  // Título + folio
  doc.fillColor(GREEN).fontSize(16).font('Helvetica-Bold')
     .text('CONFIRMACION DE RESERVA', 50, y, { align: 'center', width: W - 100 });
  y += 26;
  doc.rect(W / 2 - 70, y, 140, 32).fill(AMBER);
  doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
     .text(b.folio, W / 2 - 70, y + 7, { align: 'center', width: 140 });
  y += 50;

  // Función para secciones de tabla
  function tabla(titulo, filas, startY) {
    doc.rect(50, startY, W - 100, 22).fill(GREEN);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text(titulo, 60, startY + 6);
    let ry = startY + 22;
    filas.forEach(([etiqueta, valor], i) => {
      if (i % 2 === 0) doc.rect(50, ry, W - 100, 20).fill(STRIPE);
      doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(etiqueta, 60, ry + 5);
      doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text(valor || '—', 220, ry + 5);
      ry += 20;
    });
    return ry + 8;
  }

  // Fecha legible
  let fechaFmt = b.fecha;
  try {
    const [yr, mo, dy] = b.fecha.split('-').map(Number);
    fechaFmt = new Date(yr, mo - 1, dy).toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    fechaFmt = fechaFmt.charAt(0).toUpperCase() + fechaFmt.slice(1);
  } catch {}

  y = tabla('DATOS DEL CLIENTE', [
    ['Nombre',    b.cliente],
    ['Telefono',  b.telefono],
    ['Estado',    b.estado],
  ], y);

  y = tabla('DETALLES DEL TOUR', [
    ['Fecha',          fechaFmt],
    ['Hora de salida', b.horaInicio],
    ['Hora de regreso',b.horaFin],
    ['Vehiculo',       b.vehiculoNombre || b.vehiculoId],
    ['Ruta',           b.ruta],
    ['Duracion',       `${b.duracion} horas`],
    ['Personas',       b.personas],
    ['Total a pagar',  b.precio],
  ], y);

  y = tabla('PAGO (transferencia / deposito)', [
    ['Banco',              DATOS_BANCO.banco],
    ['Titular',            DATOS_BANCO.titular],
    ['Numero de cuenta',   DATOS_BANCO.cuenta],
    ['CLABE interbancaria',DATOS_BANCO.clabe],
    ['Concepto',           b.folio],
  ], y);

  // Recomendaciones
  doc.rect(50, y, W - 100, 22).fill(GREEN);
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text('RECOMENDACIONES', 60, y + 6);
  y += 22;
  const recos = [
    'Llegar 15 minutos antes de la hora de salida',
    'Ropa que puedas ensuciar y zapatos cerrados (sin sandalias)',
    'Llevar agua y protector solar',
    'Cargar la camara o celular para las fotos',
    'La ubicacion exacta se confirma el dia anterior'
  ];
  recos.forEach((r, i) => {
    if (i % 2 === 0) doc.rect(50, y, W - 100, 18).fill(STRIPE);
    doc.fillColor(DARK).fontSize(9).font('Helvetica').text(`•  ${r}`, 60, y + 4);
    y += 18;
  });

  y += 16;
  // Pie
  doc.rect(0, y, W, 36).fill(GREEN);
  doc.fillColor('white').fontSize(10).font('Helvetica')
     .text('Nos vemos pronto para la aventura!  —  Axilitla 4x4, Xilitla S.L.P.', 50, y + 12, {
       align: 'center', width: W - 100
     });

  doc.end();
});

// ── Arranque ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('===========================================');
  console.log('  Axilitla 4x4 — Panel Administrativo');
  console.log(`  http://localhost:${PORT}`);
  console.log('===========================================');
  console.log('');
});
