/**
 * Google Apps Script - Genera un Google Form para elegir clase/spec en la guild.
 * Cada miembro puede elegir entre 1 y 3 clases con su spec en un solo envío.
 *
 * Instrucciones:
 * 1. Ve a https://script.google.com → Nuevo proyecto
 * 2. Borra el código que viene por defecto
 * 3. Pega TODO este código
 * 4. Dale a ▶ Ejecutar (selecciona createRosterForm)
 * 5. Autoriza los permisos cuando te lo pida
 * 6. Mira el log (Ver → Registros de ejecución) para ver los links
 */

function createRosterForm() {
  // ── Class + Spec combos ─────────────────────────────────────────
  const CLASS_SPECS = {
    'Death Knight':  ['Blood (Tank)', 'Frost (DPS)', 'Unholy (DPS)'],
    'Demon Hunter':  ['Havoc (DPS)', 'Vengeance (Tank)'],
    'Druid':         ['Balance (DPS)', 'Feral (DPS)', 'Guardian (Tank)', 'Restoration (Healer)'],
    'Evoker':        ['Augmentation (DPS)', 'Devastation (DPS)', 'Preservation (Healer)'],
    'Hunter':        ['Beast Mastery (DPS)', 'Marksmanship (DPS)', 'Survival (DPS)'],
    'Mage':          ['Arcane (DPS)', 'Fire (DPS)', 'Frost (DPS)'],
    'Monk':          ['Brewmaster (Tank)', 'Mistweaver (Healer)', 'Windwalker (DPS)'],
    'Paladin':       ['Holy (Healer)', 'Protection (Tank)', 'Retribution (DPS)'],
    'Priest':        ['Discipline (Healer)', 'Holy (Healer)', 'Shadow (DPS)'],
    'Rogue':         ['Assassination (DPS)', 'Outlaw (DPS)', 'Subtlety (DPS)'],
    'Shaman':        ['Elemental (DPS)', 'Enhancement (DPS)', 'Restoration (Healer)'],
    'Warlock':       ['Affliction (DPS)', 'Demonology (DPS)', 'Destruction (DPS)'],
    'Warrior':       ['Arms (DPS)', 'Fury (DPS)', 'Protection (Tank)'],
  };

  // Build flat list: "Warrior - Arms (DPS)", "Warrior - Fury (DPS)", etc.
  const allOptions = [];
  for (const [cls, specs] of Object.entries(CLASS_SPECS)) {
    for (const spec of specs) {
      allOptions.push(cls + ' — ' + spec);
    }
  }

  // ── Members ─────────────────────────────────────────────────────
  const members = [
    'Auba', 'Brewzlee', 'Casadich', 'Chillss', 'Dlenian',
    'Galartxu', 'Inkail', 'Kraven', 'Misifuu', 'Vheissu',
    'Zohg', 'Zoila', 'Zreox', 'Ásthar'
  ];

  // ── Create form ─────────────────────────────────────────────────
  const form = FormApp.create('Pew Pew Kittens - Elige tu Clase');
  form.setDescription(
    'Elige entre 1 y 3 clases que te gustaría jugar.\n\n' +
    '• La opción 1 es obligatoria (tu preferencia principal)\n' +
    '• Las opciones 2 y 3 son opcionales (si no lo tienes claro)\n\n' +
    'Solo puedes enviar el formulario UNA vez, así que piénsalo bien.'
  );
  form.setAllowResponseEdits(true);
  form.setLimitOneResponsePerUser(false);
  form.setConfirmationMessage('Respuesta guardada. Si necesitas cambiar algo, usa el link de edición que te aparece.');

  // ── Nombre ──────────────────────────────────────────────────────
  const nameItem = form.addListItem();
  nameItem.setTitle('Tu personaje')
    .setHelpText('Selecciona tu nombre. Si no apareces, elige "Otro" y escríbelo abajo.')
    .setRequired(true)
    .setChoices([
      ...members.map(m => nameItem.createChoice(m)),
      nameItem.createChoice('Otro')
    ]);

  form.addTextItem()
    .setTitle('Si elegiste "Otro", escribe tu nombre aquí')
    .setRequired(false);

  // ── Opción 1 (obligatoria) ──────────────────────────────────────
  form.addSectionHeaderItem()
    .setTitle('Opción 1 (principal)')
    .setHelpText('Tu clase/spec preferida. Esta es obligatoria.');

  const pick1 = form.addListItem();
  pick1.setTitle('Clase y Spec - Opción 1')
    .setRequired(true)
    .setChoices(allOptions.map(o => pick1.createChoice(o)));

  // ── Opción 2 (opcional) ─────────────────────────────────────────
  form.addSectionHeaderItem()
    .setTitle('Opción 2 (opcional)')
    .setHelpText('Si tienes otra clase que también te mola, ponla aquí.');

  const pick2 = form.addListItem();
  pick2.setTitle('Clase y Spec - Opción 2')
    .setRequired(false)
    .setChoices(allOptions.map(o => pick2.createChoice(o)));

  // ── Opción 3 (opcional) ─────────────────────────────────────────
  form.addSectionHeaderItem()
    .setTitle('Opción 3 (opcional)')
    .setHelpText('Una tercera alternativa si aún no lo tienes claro.');

  const pick3 = form.addListItem();
  pick3.setTitle('Clase y Spec - Opción 3')
    .setRequired(false)
    .setChoices(allOptions.map(o => pick3.createChoice(o)));

  // ── Notas ───────────────────────────────────────────────────────
  form.addTextItem()
    .setTitle('Notas (opcional)')
    .setHelpText('Ej: "puedo ir healer si hace falta", "depende de lo que falte"...')
    .setRequired(false);

  // ── Crear Sheet vinculado ───────────────────────────────────────
  const ss = SpreadsheetApp.create('Pew Pew Kittens - Roster Picks');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ── Output links ────────────────────────────────────────────────
  Logger.log('══════════════════════════════════════════════════');
  Logger.log('TODO CREADO:');
  Logger.log('');
  Logger.log('FORM (comparte este link en Discord):');
  Logger.log(form.getPublishedUrl());
  Logger.log('');
  Logger.log('FORM (para editarlo tu):');
  Logger.log(form.getEditUrl());
  Logger.log('');
  Logger.log('SHEET (respuestas):');
  Logger.log(ss.getUrl());
  Logger.log('══════════════════════════════════════════════════');
}
