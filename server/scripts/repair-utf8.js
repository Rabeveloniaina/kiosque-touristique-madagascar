/**
 * One-off repair for legacy text values corrupted by the old unconditional
 * latin1 -> utf8 conversion (which produced U+FFFD replacement characters).
 *
 * Usage:
 *   node scripts/repair-utf8.js --dry-run   # show what would change
 *   node scripts/repair-utf8.js             # apply the repairs
 *
 * The database is backed up beforehand by the caller (see README / deploy notes).
 */

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '../kiosk.db'));
db.pragma('journal_mode = WAL');

const REPLACEMENT_CHAR = '\uFFFD';
const DRY_RUN = process.argv.includes('--dry-run');

const repairs = [
  {
    table: 'ads',
    id: 1,
    field: 'subtitle_fr',
    match: 'patrimoine class\uFFFD',
    value: "Un joyau d'architecture et de patrimoine classé"
  },
  {
    table: 'ads',
    id: 2,
    field: 'title_fr',
    match: 'Th\uFFFD de Sahambavy',
    value: 'La Plantation de Thé de Sahambavy'
  },
  {
    table: 'ads',
    id: 2,
    field: 'subtitle_fr',
    match: 'D\uFFFDgustation',
    value: 'Dégustation et balade au bord du lac paisible'
  },
  {
    table: 'ads',
    id: 2,
    field: 'badge',
    match: '\uFFFD 20 min du centre',
    value: 'À 20 min du centre'
  },
  {
    table: 'ads',
    id: 3,
    field: 'subtitle_fr',
    match: 'l\uFFFDmurien dor\uFFFD',
    value: 'Observez le lémurien doré dans son sanctuaire naturel'
  },
  {
    table: 'ads',
    id: 10,
    field: 'badge',
    match: '\uFFFD d\uFFFDcouvrir',
    value: 'À découvrir'
  },
  {
    table: 'places',
    id: 'kiosk_manakara_1793710040664_88',
    field: 'desc_fr',
    match: '\uFFFDtablissement r\uFFFDpertori\uFFFD',
    value: 'Établissement répertorié à Manakara sur OpenStreetMap & Google Maps.'
  },
  {
    table: 'places',
    id: 'kiosk_manakara_1793710040664_88',
    field: 'itinerary_steps',
    match: 'Situ\uFFFD \uFFFD Antemoro Hotel',
    value: "Situé à Antemoro Hotel, Manakara. Suivre l'itinéraire GPS."
  },
  {
    table: 'places',
    id: 'kiosk_manakara_1793710040665_924',
    field: 'desc_fr',
    match: '\uFFFDtablissement r\uFFFDpertori\uFFFD',
    value: 'Établissement répertorié à Manakara sur OpenStreetMap & Google Maps.'
  },
  {
    table: 'places',
    id: 'kiosk_manakara_1793710040665_924',
    field: 'itinerary_steps',
    match: 'Situ\uFFFD \uFFFD 2nd Avenue',
    value: "Situé à 2nd Avenue, Manakara. Suivre l'itinéraire GPS."
  }
];

function scanForCorruption() {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => row.name);

  let total = 0;
  for (const table of tables) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    let count = 0;
    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (typeof value === 'string' && value.includes(REPLACEMENT_CHAR)) count += 1;
      }
    }
    if (count > 0) console.log(`  ${table}: ${count} valeur(s) encore corrompue(s)`);
    total += count;
  }
  return total;
}

function main() {
  console.log(DRY_RUN ? '[REPAIR] Mode simulation (aucune écriture).' : '[REPAIR] Application des corrections.');

  let applied = 0;
  let skipped = 0;

  const apply = db.transaction(() => {
    for (const repair of repairs) {
      const { table, id, field } = repair;
      const select = db.prepare(`SELECT ${field} AS value FROM ${table} WHERE id = ?`);
      const update = db.prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`);
      const row = select.get(id);

      if (!row) {
        console.warn(`  [ABSENT] ${table}#${id} — ligne introuvable, ignorée.`);
        skipped += 1;
        continue;
      }

      const current = row.value || '';
      if (!current.includes(REPLACEMENT_CHAR)) {
        console.log(`  [PROPRE] ${table}#${id}.${field} — déjà correct.`);
        skipped += 1;
        continue;
      }

      if (!current.includes(repair.match)) {
        console.warn(`  [ATTENTION] ${table}#${id}.${field} — contenu inattendu, non modifié :`);
        console.warn(`             ${JSON.stringify(current)}`);
        skipped += 1;
        continue;
      }

      if (!DRY_RUN) update.run(repair.value, id);
      console.log(`  [${DRY_RUN ? 'SIMULÉ' : 'CORRIGÉ'}] ${table}#${id}.${field} → ${JSON.stringify(repair.value)}`);
      applied += 1;
    }
  });

  apply();

  console.log(`\n[REPAIR] ${applied} valeur(s) ${DRY_RUN ? 'à corriger' : 'corrigée(s)'}, ${skipped} ignorée(s).`);

  if (!DRY_RUN) {
    console.log('\n[REPAIR] Vérification finale :');
    const remaining = scanForCorruption();
    if (remaining === 0) {
      console.log('  ✅ Aucun caractère U+FFFD restant dans la base.');
    } else {
      console.error(`  ❌ ${remaining} valeur(s) contiennent encore U+FFFD.`);
      process.exitCode = 1;
    }
  }
}

try {
  main();
} finally {
  db.close();
}
