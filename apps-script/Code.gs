/**
 * Hoja + Web App para RSVP de S&E.
 *
 * 1. Crea una hoja en Drive y pega este archivo en Extensiones > Apps Script.
 * 2. En el desplegable de funciones elige initSheet (no doGet) y pulsa Ejecutar.
 * 3. Implementar > Nueva implementación > Aplicación web
 *    - Ejecutar como: yo
 *    - Quién tiene acceso: Cualquier persona
 * 4. Copia la URL de la app en js/config.js → scriptUrl
 *
 * Enlaces: https://deverik-98.github.io/s-and-e/nos-casamos/CODIGO
 * El código es opaco (no correlativo) y corto.
 */

var SHEET_NAME = "Invitados";
var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
var CODE_LEN = 6;
var HEADERS = ["code", "name", "variant", "status", "updated_at", "created_at"];

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || "guest";
  var code = String(p.i || p.code || "").trim();
  var out;

  if (action === "guest") out = getGuest(code);
  else if (action === "rsvp") out = setRsvp(code, p.status);
  else out = { ok: false, error: "unknown_action" };

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function initSheet() {
  var sh = sheet_();
  sh.clear();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sh.setFrozenRows(1);
}

function seedDemo() {
  return addGuest("Invitado especial", "completo");
}

function addGuest(name, variant) {
  var sh = sheet_();
  var code = uniqueCode_();
  var now = new Date().toISOString();
  sh.appendRow([code, name, variant || "completo", "pending", "", now]);
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
    variant: row.variant || "completo",
    status: row.status || "pending",
  };
}

function setRsvp(code, status) {
  var allowed = { yes: true, no: true, pending: true };
  if (!allowed[status]) return { ok: false, error: "bad_status" };
  var row = find_(code);
  if (!row) return { ok: false, error: "not_found" };
  var sh = sheet_();
  sh.getRange(row.index, 4, 1, 2).setValues([[status, new Date().toISOString()]]);
  return {
    ok: true,
    name: row.name,
    variant: row.variant || "completo",
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
        variant: values[i][2],
        status: values[i][3],
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Invitación S&E")
    .addItem("Inicializar hoja", "initSheet")
    .addItem("Crear invitado de prueba", "seedDemo")
    .addToUi();
}
