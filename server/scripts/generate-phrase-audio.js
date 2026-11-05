/**
 * Génération des audios malgaches des phrases utiles avec MMS-TTS (Meta).
 *
 * Modèle : facebook/mms-tts-mlg (version ONNX quantifiée ~38 Mo)
 * Licence : CC-BY-NC 4.0 — usage pédagogique / démonstration universitaire.
 *
 * Utilisation :
 *   node scripts/generate-phrase-audio.js --id 3        (une phrase, régénération)
 *   node scripts/generate-phrase-audio.js --missing     (seulement les phrases sans audio)
 *   node scripts/generate-phrase-audio.js --all         (toutes les phrases)
 *   node scripts/generate-phrase-audio.js --all --force (tout régénérer)
 *
 * Le script est lancé dans un processus séparé par l'API : la mémoire du modèle
 * ONNX est ainsi libérée après la génération, sans alourdir le serveur Express.
 */

const path = require('path');
const fs = require('fs');

// Évite de réappliquer le seed des lieux pendant une simple génération audio.
process.env.KIOSK_SKIP_PLACES_SEED = '1';
const db = require('../src/db/database');

const MODEL_ID = process.env.MMS_TTS_MODEL || 'elloza/mms-tts-mlg-onnx';
const RESULT_MARKER = '__KIOSK_TTS_RESULT__';

const audioDir = path.resolve(__dirname, '../uploads/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

function encodeWav(float32Audio, sampleRate) {
  const numSamples = float32Audio.length;

  // Normalisation douce pour une écoute confortable sur le kiosque.
  let peak = 0;
  for (let i = 0; i < numSamples; i += 1) {
    const value = Math.abs(float32Audio[i]);
    if (value > peak) peak = value;
  }
  const gain = peak > 0 ? Math.min(0.95 / peak, 4) : 1;

  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Taille du bloc fmt
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Audio[i] * gain));
    buffer.writeInt16LE(Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), offset);
    offset += bytesPerSample;
  }

  return buffer;
}

function parseArgs(argv) {
  const args = new Set(argv);
  const idIndex = argv.indexOf('--id');
  return {
    id: idIndex >= 0 ? parseInt(argv[idIndex + 1], 10) : null,
    all: args.has('--all'),
    missing: args.has('--missing') || !args.has('--all'),
    force: args.has('--force')
  };
}

function removeAudioFile(audioKey) {
  if (!audioKey) return;
  const filename = path.basename(audioKey);
  const filePath = path.join(audioDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(`[MMS] Impossible de supprimer ${filename}:`, err.message);
    }
  }
}

async function generate() {
  const options = parseArgs(process.argv.slice(2));
  let rows = [];

  if (Number.isInteger(options.id)) {
    const row = db.prepare('SELECT * FROM phrases WHERE id = ?').get(options.id);
    if (!row) throw new Error(`Phrase introuvable (id ${options.id}).`);
    rows = [row];
  } else {
    rows = db.prepare('SELECT * FROM phrases ORDER BY sort_order ASC, id ASC').all();
    if (!options.all && !options.force) {
      rows = rows.filter((row) => !row.audio_key);
    }
  }

  if (rows.length === 0) {
    console.log(`${RESULT_MARKER}${JSON.stringify({ ok: true, generated: [], skipped: true })}`);
    db.close();
    return;
  }

  console.log(`[MMS] ${rows.length} phrase(s) à générer avec ${MODEL_ID}`);
  console.log('[MMS] Chargement du modèle (téléchargement unique ~38 Mo si absent)...');

  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = path.resolve(__dirname, '../.cache');
  env.allowLocalModels = false;

  const synthesizer = await pipeline('text-to-speech', MODEL_ID, { dtype: 'q8' });
  console.log('[MMS] Modèle chargé.');

  const updatePhrase = db.prepare(
    'UPDATE phrases SET audio_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  );

  const generated = [];

  for (const row of rows) {
    const text = (row.text_mg || '').trim();
    if (!text) continue;

    console.log(`[MMS] Synthèse #${row.id} : ${text}`);
    const result = await synthesizer(text);
    const audio = result.audio || result;
    const samplingRate = result.sampling_rate || 16000;

    if (!audio || typeof audio.length !== 'number' || audio.length === 0) {
      throw new Error(`Sortie audio vide pour la phrase #${row.id}.`);
    }

    const filename = `phrase-${row.id}-${Date.now()}.wav`;
    const filePath = path.join(audioDir, filename);
    fs.writeFileSync(filePath, encodeWav(audio, samplingRate));

    const audioKey = `/uploads/audio/${filename}`;
    updatePhrase.run(audioKey, row.id);
    removeAudioFile(row.audio_key);

    generated.push({
      id: row.id,
      audio_key: audioKey,
      duration_seconds: Number((audio.length / samplingRate).toFixed(2))
    });
    console.log(`[MMS] ✓ #${row.id} -> ${filename} (${(audio.length / samplingRate).toFixed(2)} s)`);
  }

  console.log(`${RESULT_MARKER}${JSON.stringify({ ok: true, generated })}`);
  db.close();
}

generate()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[MMS] Erreur :', err && err.stack ? err.stack : err);
    try {
      console.log(`${RESULT_MARKER}${JSON.stringify({ ok: false, error: err.message || String(err) })}`);
    } catch {}
    try {
      db.close();
    } catch {}
    process.exit(1);
  });
