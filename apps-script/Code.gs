/**
 * Hoja + Web App para RSVP de S&E.
 *
 * La web sigue usando yes/no/pending.
 * En la hoja todo se guarda en español.
 *
 * Enlaces: https://deverik-98.github.io/s-and-e/nos-casamos/CODIGO
 */

var SHEET_NAME = "Invitados";
var TZ = "America/Caracas";
var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
var CODE_LEN = 6;
var HEADERS = ["Código", "Nombre", "Tipo", "Estado", "Actualizado", "Creado"];

var STATUS_SHEET = { pending: "Pendiente", yes: "Confirmado", no: "No asiste" };
var VARIANT_SHEET = { completo: "Completo", iglesia: "Solo iglesia" };

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || "guest";
  var code = String(p.i || p.code || "").trim();
  var out;

  if (action === "guest") out = getGuest(code);
  else if (action === "rsvp") out = setRsvp(code, fromSheetStatus_(p.status));
  else out = { ok: false, error: "unknown_action" };

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function actualizarHoja() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  ss.setSpreadsheetLocale("es_VE");
  var sh = sheet_();
  var lastCol = Math.max(sh.getLastColumn(), HEADERS.length);
  var lastRow = Math.max(sh.getLastRow(), 1);
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values.length) values = [[]];

  values[0] = HEADERS.slice();
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    row[2] = toSheetVariant_(row[2]);
    row[3] = toSheetStatus_(fromSheetStatus_(row[3]));
    row[4] = formatCaracas_(row[4]);
    row[5] = formatCaracas_(row[5]);
  }

  sh.getRange(1, 1, values.length, HEADERS.length).setValues(
    values.map(function (row) { return row.slice(0, HEADERS.length); })
  );
  applyStyles_(sh);
}

function initSheet() {
  actualizarHoja();
}

function limpiarHoja() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  applyStyles_(sh);
}

function seedDemo() {
  return addGuest("Invitado especial", "completo");
}

function addGuestPrompt() {
  var ui = SpreadsheetApp.getUi();
  var nameBox = ui.prompt("Nombre del invitado", "Ejemplo: Ana Pérez", ui.ButtonSet.OK_CANCEL);
  if (nameBox.getSelectedButton() !== ui.Button.OK) return;
  var name = String(nameBox.getResponseText() || "").trim();
  if (!name) {
    ui.alert("Escribe un nombre.");
    return;
  }
  var typeBox = ui.prompt("Tipo de invitación", "completo o iglesia", ui.ButtonSet.OK_CANCEL);
  if (typeBox.getSelectedButton() !== ui.Button.OK) return;
  var variant = String(typeBox.getResponseText() || "completo").trim().toLowerCase();
  if (variant !== "iglesia") variant = "completo";
  var result = addGuest(name, variant);
  ui.alert("Invitación lista", result.url, ui.ButtonSet.OK);
}

function listInviteUrls() {
  var values = sheet_().getDataRange().getValues();
  var lines = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    lines.push((values[i][1] || "(sin nombre)") + "\nhttps://deverik-98.github.io/s-and-e/nos-casamos/" + values[i][0]);
  }
  SpreadsheetApp.getUi().alert(lines.length ? lines.join("\n\n") : "No hay invitados.");
}

function addGuest(name, variant) {
  var sh = sheet_();
  var code = uniqueCode_();
  var now = new Date();
  sh.appendRow([
    code,
    name,
    toSheetVariant_(variant || "completo"),
    toSheetStatus_("pending"),
    "",
    formatCaracas_(now),
  ]);
  applyStyles_(sh);
  paintRow_(sh, sh.getLastRow(), "pending");
  return {
    ok: true,
    code: code,
    url: "https://deverik-98.github.io/s-and-e/nos-casamos/" + code,
  };
}

function getGuest(code) {
  var row = find_(code);
  if (!row) return { ok: false, error: "not_found" };
  return {
    ok: true,
    name: row.name,
    variant: row.variant,
    status: row.status,
  };
}

function setRsvp(code, status) {
  status = fromSheetStatus_(status);
  if (!STATUS_SHEET[status]) return { ok: false, error: "bad_status" };
  var row = find_(code);
  if (!row) return { ok: false, error: "not_found" };
  var sh = sheet_();
  sh.getRange(row.index, 4, 1, 2)
    .setNumberFormat("@")
    .setValues([[
      toSheetStatus_(status),
      status === "pending" ? "" : formatCaracas_(new Date()),
    ]]);
  paintRow_(sh, row.index, status);
  return {
    ok: true,
    name: row.name,
    variant: row.variant,
    status: status,
  };
}

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  return sh;
}

function find_(code) {
  if (!code) return null;
  var values = sheet_().getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === code) {
      return {
        index: i + 1,
        name: values[i][1],
        variant: fromSheetVariant_(values[i][2]),
        status: fromSheetStatus_(values[i][3]),
      };
    }
  }
  return null;
}

function uniqueCode_() {
  var existing = {};
  var values = sheet_().getDataRange().getValues();
  for (var i = 1; i < values.length; i++) existing[String(values[i][0])] = true;
  var code;
  do {
    code = randomCode_();
  } while (existing[code]);
  return code;
}

function randomCode_() {
  var out = "";
  var bytes = Utilities.getUuid().replace(/-/g, "");
  for (var i = 0; i < CODE_LEN; i++) {
    var n = parseInt(bytes.substr(i * 2, 2), 16);
    out += ALPHABET.charAt(n % ALPHABET.length);
  }
  return out;
}

function fromSheetStatus_(value) {
  var raw = String(value || "").trim().toLowerCase();
  if (raw === "yes" || raw === "confirmado") return "yes";
  if (raw === "no" || raw === "no asiste") return "no";
  return "pending";
}

function fromSheetVariant_(value) {
  var raw = String(value || "").trim().toLowerCase();
  if (raw === "iglesia" || raw === "solo iglesia") return "iglesia";
  return "completo";
}

function toSheetStatus_(status) {
  return STATUS_SHEET[status] || STATUS_SHEET.pending;
}

function toSheetVariant_(variant) {
  return VARIANT_SHEET[fromSheetVariant_(variant)];
}

function toDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value;
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatCaracas_(value) {
  var date = toDate_(value);
  if (!date) return "";
  return Utilities.formatDate(date, TZ, "dd/MM/yyyy h:mm a")
    .replace("AM", "a. m.")
    .replace("PM", "p. m.");
}

function paintRow_(sh, index, status) {
  var colors = { yes: "#d9ead3", no: "#f4cccc", pending: "#fff2cc" };
  sh.getRange(index, 1, 1, HEADERS.length).setBackground(colors[status] || "#fff2cc");
}

function applyStyles_(sh) {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  var lastRow = Math.max(sh.getMaxRows(), 2);
  sh.getRange(1, 1, 1, HEADERS.length)
    .setFontFamily("Arial")
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0A2A6B")
    .setHorizontalAlignment("center");
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 32);
  sh.setColumnWidths(1, 1, 110);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 130);
  sh.setColumnWidth(4, 130);
  sh.setColumnWidth(5, 170);
  sh.setColumnWidth(6, 170);
  sh.getRange(2, 5, lastRow - 1, 2).setNumberFormat("@");
  sh.getRange(2, 1, lastRow - 1, HEADERS.length)
    .setFontFamily("Arial")
    .setVerticalAlignment("middle");

  var data = sh.getRange(2, 1, lastRow - 1, HEADERS.length);
  sh.setConditionalFormatRules([
    rule_('=$D2="Confirmado"', data, "#d9ead3"),
    rule_('=$D2="yes"', data, "#d9ead3"),
    rule_('=$D2="No asiste"', data, "#f4cccc"),
    rule_('=$D2="no"', data, "#f4cccc"),
    rule_('=$D2="Pendiente"', data, "#fff2cc"),
    rule_('=$D2="pending"', data, "#fff2cc"),
  ]);
}

function rule_(formula, range, color) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula)
    .setBackground(color)
    .setRanges([range])
    .build();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Invitación S&E")
    .addItem("Añadir invitado", "addGuestPrompt")
    .addItem("Ver enlaces", "listInviteUrls")
    .addItem("Crear invitado de prueba", "seedDemo")
    .addItem("Actualizar hoja (español y estilos)", "actualizarHoja")
    .addItem("Limpiar invitados", "limpiarHoja")
    .addToUi();
}
