/**
 * Formatea el Sheet de respuestas con colores de clase WoW
 * y crea una pestaña "Resumen" con la distribución.
 *
 * 1. Abre el Google Sheet de respuestas → Extensiones → Apps Script
 * 2. Pega este código y ejecuta formatRosterSheet()
 */

var CLASS_COLORS = {
  'Death Knight': { bg: '#C41F3B', text: '#FFFFFF' },
  'Demon Hunter': { bg: '#A330C9', text: '#FFFFFF' },
  'Druid':        { bg: '#FF7D0A', text: '#FFFFFF' },
  'Evoker':       { bg: '#33937F', text: '#FFFFFF' },
  'Hunter':       { bg: '#ABD473', text: '#000000' },
  'Mage':         { bg: '#3FC7EB', text: '#000000' },
  'Monk':         { bg: '#00FF96', text: '#000000' },
  'Paladin':      { bg: '#F58CBA', text: '#000000' },
  'Priest':       { bg: '#D2D2D2', text: '#000000' },
  'Rogue':        { bg: '#FFF569', text: '#000000' },
  'Shaman':       { bg: '#0070DE', text: '#FFFFFF' },
  'Warlock':      { bg: '#8788EE', text: '#FFFFFF' },
  'Warrior':      { bg: '#C79C6E', text: '#000000' },
};

var ROLE_COLORS = {
  'Tank':   { bg: '#4488CC', text: '#FFFFFF' },
  'Healer': { bg: '#44CC44', text: '#000000' },
  'DPS':    { bg: '#CC4444', text: '#FFFFFF' },
};

function formatRosterSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    Logger.log('No hay respuestas todavía');
    return;
  }

  var headers = data[0];
  var pickCols = [];
  for (var c = 0; c < headers.length; c++) {
    if (String(headers[c]).indexOf('Clase y Spec') !== -1) {
      pickCols.push(c);
    }
  }

  Logger.log('Columnas encontradas: ' + pickCols.length);
  Logger.log('Filas de datos: ' + (data.length - 1));

  // ── Style header ────────────────────────────────────────────
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1a1a2e').setFontColor('#FFFFFF').setFontWeight('bold');

  // ── Counters ────────────────────────────────────────────────
  var classCounts = {};
  var classCountsAll = {};
  var roleCounts = { 'Tank': 0, 'Healer': 0, 'DPS': 0 };
  var specCounts = {};

  // ── Color each pick cell ────────────────────────────────────
  for (var r = 1; r < data.length; r++) {
    for (var p = 0; p < pickCols.length; p++) {
      var col = pickCols[p];
      var value = String(data[r][col] || '').trim();
      if (!value) continue;

      var className = value.split(' — ')[0].trim();
      var roleMatch = value.match(/\((Tank|Healer|DPS)\)/);
      var role = roleMatch ? roleMatch[1] : null;
      var specPart = value.split(' — ')[1];
      var specName = specPart ? specPart.replace(/\s*\(.*\)/, '').trim() : null;

      if (className && CLASS_COLORS[className]) {
        var colors = CLASS_COLORS[className];
        sheet.getRange(r + 1, col + 1)
          .setBackground(colors.bg)
          .setFontColor(colors.text)
          .setFontWeight('bold');

        classCountsAll[className] = (classCountsAll[className] || 0) + 1;

        if (p === 0) {
          classCounts[className] = (classCounts[className] || 0) + 1;
          if (role) roleCounts[role]++;
        }

        if (specName) {
          var fullSpec = className + ' ' + specName;
          specCounts[fullSpec] = (specCounts[fullSpec] || 0) + 1;
        }
      }
    }
  }

  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
  Logger.log('Colores aplicados. Creando resumen...');

  // ── Create or get "Resumen" sheet ───────────────────────────
  var summarySheet = ss.getSheetByName('Resumen');
  if (summarySheet) {
    summarySheet.clear();
  } else {
    summarySheet = ss.insertSheet('Resumen');
  }

  var totalResponses = data.length - 1;
  var row = 1;

  // ── Title ───────────────────────────────────────────────────
  summarySheet.getRange(row, 1).setValue('RESUMEN DE ROSTER — Pew Pew Kittens')
    .setBackground('#1a1a2e').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(14);
  row++;
  summarySheet.getRange(row, 1).setValue('Total respuestas: ' + totalResponses).setFontWeight('bold');
  row += 2;

  // ── Class distribution ──────────────────────────────────────
  summarySheet.getRange(row, 1).setValue('DISTRIBUCIÓN POR CLASE')
    .setBackground('#2d2d44').setFontColor('#FFFFFF').setFontWeight('bold');
  summarySheet.getRange(row, 2).setValue('Principal')
    .setBackground('#2d2d44').setFontColor('#FFFFFF').setFontWeight('bold');
  summarySheet.getRange(row, 3).setValue('Total (1-3)')
    .setBackground('#2d2d44').setFontColor('#FFFFFF').setFontWeight('bold');
  row++;

  var sortedClasses = Object.keys(CLASS_COLORS).sort(function(a, b) {
    return (classCounts[b] || 0) - (classCounts[a] || 0);
  });

  for (var i = 0; i < sortedClasses.length; i++) {
    var cls = sortedClasses[i];
    var primary = classCounts[cls] || 0;
    var all = classCountsAll[cls] || 0;
    var cc = CLASS_COLORS[cls];

    summarySheet.getRange(row, 1).setValue(cls)
      .setBackground(cc.bg).setFontColor(cc.text).setFontWeight('bold');
    summarySheet.getRange(row, 2).setValue(primary).setHorizontalAlignment('center');
    summarySheet.getRange(row, 3).setValue(all).setHorizontalAlignment('center');

    // Visual bar
    var barLen = totalResponses > 0 ? Math.round((primary / totalResponses) * 15) : 0;
    var bar = '';
    for (var b = 0; b < barLen; b++) bar += '█';
    for (var b2 = barLen; b2 < 15; b2++) bar += '░';
    summarySheet.getRange(row, 4).setValue(bar)
      .setFontFamily('Courier New').setFontColor(cc.bg);

    row++;
  }

  // ── Role distribution ───────────────────────────────────────
  row++;
  summarySheet.getRange(row, 1).setValue('DISTRIBUCIÓN POR ROL')
    .setBackground('#2d2d44').setFontColor('#FFFFFF').setFontWeight('bold');
  summarySheet.getRange(row, 2).setValue('Cantidad')
    .setBackground('#2d2d44').setFontColor('#FFFFFF').setFontWeight('bold');
  summarySheet.getRange(row, 3).setValue('Porcentaje')
    .setBackground('#2d2d44').setFontColor('#FFFFFF').setFontWeight('bold');
  row++;

  var roles = ['Tank', 'Healer', 'DPS'];
  for (var ri = 0; ri < roles.length; ri++) {
    var roleName = roles[ri];
    var count = roleCounts[roleName];
    var rc = ROLE_COLORS[roleName];
    var pct = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;

    summarySheet.getRange(row, 1).setValue(roleName)
      .setBackground(rc.bg).setFontColor(rc.text).setFontWeight('bold');
    summarySheet.getRange(row, 2).setValue(count).setHorizontalAlignment('center');
    summarySheet.getRange(row, 3).setValue(pct + '%').setHorizontalAlignment('center');

    var barLen2 = totalResponses > 0 ? Math.round((count / totalResponses) * 15) : 0;
    var bar2 = '';
    for (var b3 = 0; b3 < barLen2; b3++) bar2 += '█';
    for (var b4 = barLen2; b4 < 15; b4++) bar2 += '░';
    summarySheet.getRange(row, 4).setValue(bar2)
      .setFontFamily('Courier New').setFontColor(rc.bg);

    row++;
  }

  // ── Spec breakdown ──────────────────────────────────────────
  row++;
  summarySheet.getRange(row, 1).setValue('DESGLOSE POR SPEC')
    .setBackground('#2d2d44').setFontColor('#FFFFFF').setFontWeight('bold');
  summarySheet.getRange(row, 2).setValue('Cantidad')
    .setBackground('#2d2d44').setFontColor('#FFFFFF').setFontWeight('bold');
  row++;

  var specEntries = [];
  for (var spec in specCounts) {
    specEntries.push([spec, specCounts[spec]]);
  }
  specEntries.sort(function(a, b) { return b[1] - a[1]; });

  for (var si = 0; si < specEntries.length; si++) {
    var specName2 = specEntries[si][0];
    var specCount = specEntries[si][1];
    var parts = specName2.split(' ');
    var clsName = (parts[0] === 'Death' || parts[0] === 'Demon')
      ? parts[0] + ' ' + parts[1] : parts[0];
    var sc = CLASS_COLORS[clsName] || { bg: '#CCCCCC', text: '#000000' };

    summarySheet.getRange(row, 1).setValue(specName2)
      .setBackground(sc.bg).setFontColor(sc.text).setFontWeight('bold');
    summarySheet.getRange(row, 2).setValue(specCount).setHorizontalAlignment('center');
    row++;
  }

  // ── Auto-resize ─────────────────────────────────────────────
  summarySheet.autoResizeColumn(1);
  summarySheet.autoResizeColumn(2);
  summarySheet.autoResizeColumn(3);
  summarySheet.autoResizeColumn(4);

  Logger.log('Completado. ' + totalResponses + ' respuestas procesadas.');
}

function createTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) {
    if (triggers[t].getHandlerFunction() === 'formatRosterSheet') {
      ScriptApp.deleteTrigger(triggers[t]);
    }
  }
  ScriptApp.newTrigger('formatRosterSheet')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();
  Logger.log('Trigger creado.');
}
