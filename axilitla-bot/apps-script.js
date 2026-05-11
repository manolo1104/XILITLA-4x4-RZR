// ══════════════════════════════════════════════════════════════════
// INSTRUCCIONES PARA INSTALAR EN GOOGLE SHEETS:
//
// 1. Abre tu Google Sheet de reservas
// 2. En el menú superior: Extensiones → Apps Script
// 3. Borra todo lo que hay y pega TODO este código
// 4. Haz clic en el ícono de guardar (💾)
// 5. En el menú: Implementar → Nueva implementación
// 6. Tipo: App web
// 7. Ejecutar como: Yo (tu cuenta de Google)
// 8. Quién tiene acceso: Cualquier usuario
// 9. Haz clic en "Implementar"
// 10. Autoriza los permisos que te pida
// 11. COPIA la URL que aparece y pégala en tu archivo .env
//     como APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
// ══════════════════════════════════════════════════════════════════

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Reservas');

  try {
    switch (action) {
      case 'getAll':
        return jsonResponse(getAll(sheet));
      case 'getBooking':
        return jsonResponse(getBooking(sheet, e.parameter.folio));
      case 'nextFolio':
        return jsonResponse({ folio: getNextFolio(sheet) });
      case 'create':
        return jsonResponse(createBooking(sheet, e.parameter));
      case 'confirm':
        return jsonResponse(confirmBooking(sheet, e.parameter.folio));
      default:
        return jsonResponse({ error: 'Acción no reconocida: ' + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach(function(h, i) {
    var val = row[i];
    if (val instanceof Date) {
      val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      val = val !== undefined && val !== null ? val.toString() : '';
    }
    obj[h] = val;
  });
  return obj;
}

function getAll(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1)
    .filter(function(row) { return row[0]; })
    .map(function(row) { return rowToObj(headers, row); });
}

function getBooking(sheet, folio) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var row = data.slice(1).find(function(r) { return r[0] === folio; });
  if (!row) return null;
  return rowToObj(headers, row);
}

function getNextFolio(sheet) {
  var data = sheet.getDataRange().getValues();
  var folios = data.slice(1)
    .map(function(r) { return r[0] ? r[0].toString() : ''; })
    .filter(function(f) { return f.startsWith('AX-'); })
    .map(function(f) { return parseInt(f.replace('AX-', ''), 10); })
    .filter(function(n) { return !isNaN(n); });

  var next = folios.length > 0 ? Math.max.apply(null, folios) + 1 : 1;
  return 'AX-' + String(next).padStart(3, '0');
}

function createBooking(sheet, p) {
  var folio = getNextFolio(sheet);
  var row = [
    folio,
    p.fecha,
    p.cliente,
    p.vehiculo_id,
    p.ruta,
    p.duracion,
    p.hora_inicio,
    p.hora_fin,
    '$' + parseInt(p.precio).toLocaleString(),
    p.personas,
    'Pendiente de pago',
    '',
    p.telefono
  ];
  sheet.appendRow(row);
  return { folio: folio, success: true };
}

function confirmBooking(sheet, folio) {
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === folio) { rowIndex = i; break; }
  }
  if (rowIndex === -1) return { error: 'Folio no encontrado: ' + folio };

  var sheetRow = rowIndex + 1; // 1-indexed
  sheet.getRange(sheetRow, 11).setValue('Confirmada'); // Columna K = Estado

  return getBooking(sheet, folio);
}
