/**
 * RSVP por núcleo familiar.
 * Invitados = titular + resumen.
 * Personas = titular y acompañantes, cada uno con su estado.
 */

var SHEET_NAME = "Invitados";
var PEOPLE_SHEET = "Personas";
var TZ = "America/Caracas";
var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
var CODE_LEN = 6;
var HEADERS = ["Código", "Nombre", "Tipo", "Estado", "Actualizado", "Creado"];
var PEOPLE_HEADERS = ["Código", "Id", "Nombre", "Rol", "Estado", "Actualizado"];

var STATUS_SHEET = { pending: "Pendiente", yes: "Confirmado", no: "No asiste", partial: "Parcial" };
var VARIANT_SHEET = { completo: "Completo", iglesia: "Solo iglesia" };

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || "guest";
  var code = String(p.i || p.code || "").trim();
  var out;

  if (action === "guest") out = getGuest(code);
  else if (action === "rsvp") out = setRsvp(code, p.status, p.p || p.people || "");
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
    values.map(function (r) { return r.slice(0, HEADERS.length); })
  );
  applyStyles_(sh);
  ensurePeopleSheet_();
  for (var j = 1; j < values.length; j++) {
    if (!values[j][0]) continue;
    if (peopleOf_(String(values[j][0])).length) continue;
    appendPerson_(String(values[j][0]), "1", values[j][1], "Titular", fromSheetStatus_(values[j][3]));
  }
  applyPeopleStyles_(peopleSheet_());
}

function initSheet() {
  actualizarHoja();
}

function limpiarHoja() {
  var sh = sheet_();
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  applyStyles_(sh);
  var people = peopleSheet_();
  if (people.getLastRow() > 1) people.deleteRows(2, people.getLastRow() - 1);
  people.clearConditionalFormatRules();
  people.getRange(1, 1, 1, PEOPLE_HEADERS.length).setValues([PEOPLE_HEADERS]);
  applyPeopleStyles_(people);
}

function seedDemo() {
  return addGuest("Invitado especial", "completo", []);
}

function addGuestPrompt() {
  var ui = SpreadsheetApp.getUi();
  var nameBox = ui.prompt("Nombre del titular", "Ejemplo: Ana Pérez", ui.ButtonSet.OK_CANCEL);
  if (nameBox.getSelectedButton() !== ui.Button.OK) return;
  var name = String(nameBox.getResponseText() || "").trim();
  if (!name) {
    ui.alert("Escribe el nombre y apellido del titular.");
    return;
  }
  var typeBox = ui.prompt("Tipo de invitación", "completo o iglesia", ui.ButtonSet.OK_CANCEL);
  if (typeBox.getSelectedButton() !== ui.Button.OK) return;
  var variant = String(typeBox.getResponseText() || "completo").trim().toLowerCase();
  if (variant !== "iglesia") variant = "completo";
  var companions = [];
  while (true) {
    var extra = ui.prompt(
      "Acompañante " + (companions.length + 1),
      "Nombre y apellido. Déjalo vacío y pulsa Aceptar para terminar.",
      ui.ButtonSet.OK_CANCEL
    );
    if (extra.getSelectedButton() !== ui.Button.OK) break;
    var extraName = String(extra.getResponseText() || "").trim();
    if (!extraName) break;
    companions.push(extraName);
  }
  var result = addGuest(name, variant, companions);
  ui.alert("Invitación lista", result.url, ui.ButtonSet.OK);
}

function listInviteUrls() {
  var values = sheet_().getDataRange().getValues();
  var lines = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    var extras = peopleOf_(String(values[i][0]))
      .filter(function (p) { return p.role !== "titular"; })
      .map(function (p) { return p.name; });
    var label = values[i][1] || "(sin nombre)";
    if (extras.length) label += " (+ " + extras.join(", ") + ")";
    lines.push(label + "\nhttps://deverik-98.github.io/s-and-e/nos-casamos/" + values[i][0]);
  }
  SpreadsheetApp.getUi().alert(lines.length ? lines.join("\n\n") : "No hay invitados.");
}

function addGuest(name, variant, companions) {
  var sh = sheet_();
  var code = uniqueCode_();
  var now = formatCaracas_(new Date());
  sh.appendRow([code, name, toSheetVariant_(variant || "completo"), STATUS_SHEET.pending, "", now]);
  applyStyles_(sh);
  paintRow_(sh, sh.getLastRow(), "pending");
  appendPerson_(code, "1", name, "Titular", "pending");
  var extras = companions || [];
  for (var i = 0; i < extras.length; i++) {
    if (!extras[i]) continue;
    appendPerson_(code, String(i + 2), extras[i], "Acompañante", "pending");
  }
  applyPeopleStyles_(peopleSheet_());
  CacheService.getScriptCache().remove("g:" + code);
  return {
    ok: true,
    code: code,
    url: "https://deverik-98.github.io/s-and-e/nos-casamos/" + code,
  };
}

function getGuest(code) {
  var cache = CacheService.getScriptCache();
  var key = "g:" + code;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var row = find_(code);
  if (!row) return { ok: false, error: "not_found" };
  var party = peopleOf_(code);
  if (!party.length) {
    party = [{ id: "1", name: row.name, role: "titular", status: row.status }];
  }
  var out = {
    ok: true,
    name: row.name,
    variant: row.variant,
    status: familyStatus_(party),
    party: party.map(function (p) {
      return { id: p.id, name: p.name, role: p.role, status: p.status };
    }),
  };
  cache.put(key, JSON.stringify(out), 180);
  return out;
}

function setRsvp(code, status, peopleRaw) {
  var family = find_(code);
  if (!family) return { ok: false, error: "not_found" };
  var party = peopleOf_(code);
  if (!party.length) {
    appendPerson_(code, "1", family.name, "Titular", "pending");
    party = peopleOf_(code);
  }
  if (peopleRaw) {
    var map = parsePeople_(peopleRaw);
    for (var i = 0; i < party.length; i++) {
      if (map[party[i].id]) party[i].status = map[party[i].id];
    }
  } else {
    var next = fromSheetStatus_(status);
    if (!STATUS_SHEET[next]) return { ok: false, error: "bad_status" };
    for (var j = 0; j < party.length; j++) party[j].status = next;
  }
  persistParty_(party);
  var summary = familyStatus_(party);
  sheet_().getRange(family.index, 4, 1, 2).setNumberFormat("@").setValues([[
    toSheetStatus_(summary),
    summary === "pending" ? "" : formatCaracas_(new Date()),
  ]]);
  paintRow_(sheet_(), family.index, summary);
  CacheService.getScriptCache().remove("g:" + code);
  return getGuest(code);
}

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function peopleSheet_() {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(PEOPLE_SHEET) || ss.insertSheet(PEOPLE_SHEET);
}

function ensurePeopleSheet_() {
  var sh = peopleSheet_();
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, PEOPLE_HEADERS.length).setValues([PEOPLE_HEADERS]);
  } else {
    sh.getRange(1, 1, 1, PEOPLE_HEADERS.length).setValues([PEOPLE_HEADERS]);
  }
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

function peopleOf_(code) {
  var sh = peopleSheet_();
  if (sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== String(code)) continue;
    out.push({
      index: i + 1,
      id: String(values[i][1] || out.length + 1),
      name: values[i][2],
      role: String(values[i][3] || "").toLowerCase().indexOf("titular") >= 0 ? "titular" : "acompanante",
      status: fromSheetStatus_(values[i][4]),
    });
  }
  return out;
}

function appendPerson_(code, id, name, role, status) {
  var sh = ensurePeopleSheet_();
  sh.appendRow([
    code,
    id,
    name,
    role,
    toSheetStatus_(status),
    status === "pending" ? "" : formatCaracas_(new Date()),
  ]);
  paintPeopleRow_(sh, sh.getLastRow(), status);
}

function persistParty_(party) {
  var sh = peopleSheet_();
  var now = formatCaracas_(new Date());
  for (var i = 0; i < party.length; i++) {
    var p = party[i];
    if (!p.index) continue;
    sh.getRange(p.index, 5, 1, 2).setNumberFormat("@").setValues([[
      toSheetStatus_(p.status),
      p.status === "pending" ? "" : now,
    ]]);
    paintPeopleRow_(sh, p.index, p.status);
  }
}

function parsePeople_(raw) {
  var map = {};
  String(raw || "").split("|").forEach(function (part) {
    var bits = part.split(":");
    if (bits.length < 2) return;
    map[String(bits[0])] = fromSheetStatus_(bits[1]);
  });
  return map;
}

function familyStatus_(party) {
  if (!party.length) return "pending";
  var yes = 0;
  var no = 0;
  var pending = 0;
  for (var i = 0; i < party.length; i++) {
    if (party[i].status === "yes") yes++;
    else if (party[i].status === "no") no++;
    else pending++;
  }
  if (yes === party.length) return "yes";
  if (no === party.length) return "no";
  if (pending === party.length) return "pending";
  return "partial";
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
  if (raw === "no" || raw === "no asiste" || raw === "no asisten") return "no";
  if (raw === "partial" || raw === "parcial") return "partial";
  return "pending";
}

function fromSheetVariant_(value) {
  var raw = String(value || "").trim().toLowerCase();
  if (raw === "iglesia" || raw === "solo iglesia") return "iglesia";
  return "completo";
}

function toSheetStatus_(status) {
  if (status === "no") return "No asiste";
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
  var colors = { yes: "#d9ead3", no: "#f4cccc", pending: "#fff2cc", partial: "#fce5cd" };
  sh.getRange(index, 1, 1, HEADERS.length).setBackground(colors[status] || "#fff2cc");
}

function paintPeopleRow_(sh, index, status) {
  var colors = { yes: "#d9ead3", no: "#f4cccc", pending: "#fff2cc", partial: "#fce5cd" };
  sh.getRange(index, 1, 1, PEOPLE_HEADERS.length).setBackground(colors[status] || "#fff2cc");
}

function applyStyles_(sh) {
  SpreadsheetApp.getActive().setSpreadsheetTimeZone(TZ);
  var lastRow = Math.max(sh.getMaxRows(), 2);
  sh.getRange(1, 1, 1, HEADERS.length)
    .setFontFamily("Arial")
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0A2A6B")
    .setHorizontalAlignment("center");
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 32);
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 130);
  sh.setColumnWidth(4, 130);
  sh.setColumnWidth(5, 170);
  sh.setColumnWidth(6, 170);
  sh.getRange(2, 5, lastRow - 1, 2).setNumberFormat("@");
  var data = sh.getRange(2, 1, lastRow - 1, HEADERS.length);
  sh.setConditionalFormatRules([
    rule_('=$D2="Confirmado"', data, "#d9ead3"),
    rule_('=$D2="No asiste"', data, "#f4cccc"),
    rule_('=$D2="Parcial"', data, "#fce5cd"),
    rule_('=$D2="Pendiente"', data, "#fff2cc"),
  ]);
}

function applyPeopleStyles_(sh) {
  var lastRow = Math.max(sh.getMaxRows(), 2);
  sh.getRange(1, 1, 1, PEOPLE_HEADERS.length)
    .setFontFamily("Arial")
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0A2A6B")
    .setHorizontalAlignment("center");
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 50);
  sh.setColumnWidth(3, 220);
  sh.setColumnWidth(4, 130);
  sh.setColumnWidth(5, 130);
  sh.setColumnWidth(6, 170);
  sh.getRange(2, 6, lastRow - 1, 1).setNumberFormat("@");
  var data = sh.getRange(2, 1, lastRow - 1, PEOPLE_HEADERS.length);
  sh.setConditionalFormatRules([
    rule_('=$E2="Confirmado"', data, "#d9ead3"),
    rule_('=$E2="No asiste"', data, "#f4cccc"),
    rule_('=$E2="Pendiente"', data, "#fff2cc"),
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
