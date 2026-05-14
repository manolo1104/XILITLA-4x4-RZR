// Panel administrativo — Sorprendente Tour

require('dotenv').config();
const express       = require('express');
const cookieSession = require('cookie-session');
const path          = require('path');
const PDFDoc        = require('pdfkit');
const db            = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

const USUARIOS = { Manolo: 'RZR2026' };

const TOUR_DURATIONS = {
  'Ruta Nanacatli':  2,
  'Ruta Miradores':  3,
  'Ruta Nacimiento': 4,
  'Ruta Tranidad':   4,
  'Ruta Trinidad':   4,
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'sorprendente-tour-2026'],
  maxAge: 8 * 60 * 60 * 1000
}));
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  if (req.session?.usuario) return next();
  res.status(401).json({ error: 'No autorizado' });
}

const genId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// ── Auth ──────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  if (USUARIOS[usuario] && USUARIOS[usuario] === password) {
    req.session.usuario = usuario;
    db.addLog(usuario, 'Inicio de sesión', `Sesión iniciada por ${usuario}`);
    res.json({ ok: true, usuario });
  } else {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
});

app.post('/api/logout', (req, res) => {
  db.addLog(req.session?.usuario || '?', 'Cierre de sesión', '');
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  req.session?.usuario
    ? res.json({ usuario: req.session.usuario })
    : res.status(401).json({ error: 'No autorizado' });
});

// ── Reservas — CRUD ───────────────────────────────────────
app.get('/api/reservas', auth, (req, res) => {
  res.json(db.getAll());
});

app.post('/api/reservas', auth, (req, res) => {
  const data = { ...req.body, id: genId() };
  const r = db.create(data, req.session.usuario);
  res.json({ ok: true, reserva: r });
});

app.put('/api/reservas/:id', auth, (req, res) => {
  try {
    const r = db.update(req.params.id, req.body, req.session.usuario);
    res.json({ ok: true, reserva: r });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/reservas/:id', auth, (req, res) => {
  try {
    const r = db.remove(req.params.id, req.session.usuario);
    res.json({ ok: true, reserva: r });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Bitácora ──────────────────────────────────────────────
app.get('/api/logs', auth, (req, res) => {
  res.json(db.getLogs());
});

app.delete('/api/logs', auth, (req, res) => {
  db.clearLogs();
  db.addLog(req.session.usuario, 'Bitácora limpiada', '');
  res.json({ ok: true });
});

// ── PDF ───────────────────────────────────────────────────
app.get('/api/pdf/:id', auth, (req, res) => {
  const b = db.getById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Reserva no encontrada' });

  const folio    = 'RES-' + b.id.slice(-4).toUpperCase();
  const duration = TOUR_DURATIONS[b.tour] || 2;
  const [h, m]   = (b.hour || '09:00').split(':').map(Number);
  const end      = `${String(h + duration).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  function fmtDateLong(dateStr) {
    const [y,mo,d] = dateStr.split('-').map(Number);
    const dt     = new Date(y, mo - 1, d);
    const days   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${days[dt.getDay()]} ${d} de ${months[mo-1]} de ${y}`;
  }

  const doc = new PDFDoc({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="SorprendenteTour-${folio}.pdf"`);
  doc.pipe(res);

  const W      = 595.28;
  const GREEN  = '#1B3A2A';
  const DARK   = '#2D1B0E';
  const MUTED  = '#8a7e72';
  const STRIPE = '#F4FAF5';
  const AMBER  = '#C4703A';

  // Cabecera
  doc.rect(0, 0, W, 85).fill(GREEN);
  doc.fillColor('#E8B87A').fontSize(24).font('Helvetica-Bold').text('Sorprendente Tour', 50, 18);
  doc.fillColor('rgba(255,255,255,0.6)').fontSize(10).font('Helvetica')
     .text('Aventuras Off-Road  |  Xilitla, San Luis Potosi, Mexico', 50, 50);

  let y = 100;
  doc.fillColor(GREEN).fontSize(16).font('Helvetica-Bold')
     .text('CONFIRMACION DE RESERVA', 50, y, { align: 'center', width: W - 100 });
  y += 26;
  doc.rect(W / 2 - 70, y, 140, 32).fill(AMBER);
  doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
     .text(folio, W / 2 - 70, y + 7, { align: 'center', width: 140 });
  y += 50;

  function tabla(titulo, filas, startY) {
    doc.rect(50, startY, W - 100, 22).fill(GREEN);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text(titulo, 60, startY + 6);
    let ry = startY + 22;
    filas.forEach(([lbl, val], i) => {
      if (i % 2 === 0) doc.rect(50, ry, W - 100, 20).fill(STRIPE);
      doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(lbl, 60, ry + 5);
      doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text(String(val || '—'), 220, ry + 5);
      ry += 20;
    });
    return ry + 8;
  }

  y = tabla('DATOS DEL CLIENTE', [
    ['Nombre',   b.client],
    ['Telefono', b.phone || '—'],
    ['Estado',   b.status],
  ], y);

  y = tabla('DETALLES DEL TOUR', [
    ['Fecha',           fmtDateLong(b.date)],
    ['Hora de salida',  b.hour],
    ['Hora de regreso', end],
    ['Vehiculo',        b.vehicle],
    ['Recorrido',       b.tour],
    ['Duracion',        `${duration} horas`],
    ['Personas',        String(b.persons)],
    ['Total a pagar',   `$${Number(b.price).toLocaleString('es-MX')} MXN`],
  ], y);

  if (b.notes) {
    y = tabla('NOTAS', [['Notas', b.notes]], y);
  }

  doc.rect(50, y, W - 100, 22).fill(GREEN);
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text('RECOMENDACIONES', 60, y + 6);
  y += 22;
  [
    'Llegar 15 minutos antes de la hora de salida',
    'Ropa que puedas ensuciar y zapatos cerrados (sin sandalias)',
    'Llevar agua y protector solar',
    'Cargar la camara o celular para las fotos',
    'La ubicacion exacta se confirma el dia anterior'
  ].forEach((r, i) => {
    if (i % 2 === 0) doc.rect(50, y, W - 100, 18).fill(STRIPE);
    doc.fillColor(DARK).fontSize(9).font('Helvetica').text(`•  ${r}`, 60, y + 4);
    y += 18;
  });

  y += 14;
  doc.rect(0, y, W, 36).fill(GREEN);
  doc.fillColor('white').fontSize(10).font('Helvetica')
     .text('Nos vemos pronto para la aventura!  —  Sorprendente Tour, Xilitla S.L.P.', 50, y + 12, {
       align: 'center', width: W - 100
     });

  db.addLog(req.session.usuario, 'PDF generado', `${folio} · ${b.client}`);
  doc.end();
});

// ── Arranque ──────────────────────────────────────────────
db.init();
app.listen(PORT, () => {
  console.log('');
  console.log('==========================================');
  console.log('  Sorprendente Tour — Panel Admin');
  console.log(`  http://localhost:${PORT}`);
  console.log('==========================================');
  console.log('');
});
