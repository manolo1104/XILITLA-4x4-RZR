// Base de datos local — reservas.json + logs.json
// DATA_DIR puede configurarse en Railway para usar un volumen persistente

const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH  = path.join(DATA_DIR, 'reservas.json');
const LOG_PATH = path.join(DATA_DIR, 'logs.json');

function read(file)       { if (!fs.existsSync(file)) fs.writeFileSync(file, '[]'); return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, data){ fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function addLog(usuario, accion, details = '') {
  const logs = read(LOG_PATH);
  logs.unshift({ id: Date.now(), fecha: new Date().toISOString(), usuario, accion, details });
  write(LOG_PATH, logs.slice(0, 500));
}

function init() {
  read(DB_PATH); read(LOG_PATH);
  console.log(`✅ Base de datos lista → ${DB_PATH}`);
}

function getAll()    { return read(DB_PATH); }
function getById(id) { return read(DB_PATH).find(r => r.id === id) || null; }

function create(data, usuario) {
  const list = read(DB_PATH);
  list.push(data);
  write(DB_PATH, list);
  addLog(usuario, 'Reserva creada', `${data.client} · ${data.tour} · ${data.date}`);
  return data;
}

function update(id, data, usuario) {
  const list = read(DB_PATH);
  const idx  = list.findIndex(r => r.id === id);
  if (idx === -1) throw new Error(`Reserva ${id} no encontrada`);
  list[idx] = { ...list[idx], ...data };
  write(DB_PATH, list);
  addLog(usuario, 'Reserva editada', `${id} · ${list[idx].client} · ${list[idx].tour}`);
  return list[idx];
}

function remove(id, usuario) {
  const list = read(DB_PATH);
  const r    = list.find(x => x.id === id);
  if (!r) throw new Error(`Reserva ${id} no encontrada`);
  write(DB_PATH, list.filter(x => x.id !== id));
  addLog(usuario, 'Reserva eliminada', `${id} · ${r.client} · ${r.date}`);
  return r;
}

function getLogs()   { return read(LOG_PATH); }
function clearLogs() { write(LOG_PATH, []); }

module.exports = { init, getAll, getById, create, update, remove, getLogs, clearLogs, addLog };
