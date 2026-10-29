/**
 * TypesetOK (TOK) - E2E Test Suite CLI and Environment Helper
 *
 * Provides authoritative opaque-box execution helpers for tok-cli,
 * temporary file lifecycle management, PDF/X byte-level introspection,
 * ZIP/.tok structural inspection, and document model generation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, '..', '..');

let cachedTokCliPath = null;

export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generates a valid 26-character Crockford Base32 ULID compatible with tok-core NodeId.
 */
export function generateCrockfordUlid(seedTime = Date.now()) {
  let timeStr = '';
  let t = Math.max(0, Math.floor(seedTime));
  for (let i = 0; i < 10; i++) {
    const mod = t % 32;
    timeStr = CROCKFORD_ALPHABET[mod] + timeStr;
    t = Math.floor(t / 32);
  }
  let randStr = '';
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 32);
    randStr += CROCKFORD_ALPHABET[rand];
  }
  return timeStr + randStr;
}

/**
 * Discovers the authoritative tok-cli executable.
 */
export function findTokCli() {
  if (cachedTokCliPath && fs.existsSync(cachedTokCliPath)) {
    return cachedTokCliPath;
  }

  if (process.env.TOK_CLI_PATH && fs.existsSync(process.env.TOK_CLI_PATH)) {
    cachedTokCliPath = path.resolve(process.env.TOK_CLI_PATH);
    return cachedTokCliPath;
  }

  const binName = process.platform === 'win32' ? 'tok-cli.exe' : 'tok-cli';
  const candidates = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'tok_target', 'debug', binName) : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'tok_target', 'release', binName) : null,
    path.join(rootDir, 'target', 'debug', binName),
    path.join(rootDir, 'target', 'release', binName),
    path.join(rootDir, 'crates', 'target', 'debug', binName),
    path.join(rootDir, 'crates', 'target', 'release', binName),
    path.join(rootDir, 'dist', 'TypesetOK-v0.9.1-windows-x64', 'resources', 'bin', binName)
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedTokCliPath = path.resolve(candidate);
      return cachedTokCliPath;
    }
  }

  throw new Error(
    `tok-cli binary not found. Checked: ${candidates.join(', ')}. ` +
    'Please build with `cargo build -p tok-cli` or set TOK_CLI_PATH.'
  );
}

/**
 * Executes tok-cli with specified arguments and returns stdout, stderr, exit code, and duration.
 */
export async function execTokCli(args, options = {}) {
  const cliPath = findTokCli();
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(cliPath, args, {
      windowsHide: true,
      cwd: options.cwd || rootDir,
      env: { ...process.env, ...options.env }
    });

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn tok-cli: ${err.message}`));
    });

    proc.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      resolve({
        code,
        stdout,
        stderr,
        durationMs,
        args
      });
    });
  });
}

/**
 * Creates a unique temporary file path and registers cleanup on process exit.
 */
const tempFilesToClean = new Set();
export function createTempPath(prefix = 'tok_e2e_', ext = '.tmp') {
  const filename = `${prefix}${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const fullPath = path.join(os.tmpdir(), filename);
  tempFilesToClean.add(fullPath);
  return fullPath;
}

export function cleanupTempFiles() {
  for (const file of tempFilesToClean) {
    try {
      if (fs.existsSync(file)) {
        fs.rmSync(file, { force: true, recursive: true });
      }
    } catch (_) {}
  }
  tempFilesToClean.clear();
}

process.on('exit', () => {
  cleanupTempFiles();
});

// Helper to load TypeScript module on the fly via esbuild
let esbuildMod = null;
export async function loadTs(relPath) {
  esbuildMod ||= await import('esbuild');
  const outfile = createTempPath('tok_ts_bundle_', '.mjs');
  esbuildMod.buildSync({
    entryPoints: [path.join(rootDir, relPath)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
    logLevel: 'silent',
  });
  try {
    return await import(pathToFileURL(outfile).href);
  } finally {
    try {
      fs.rmSync(outfile, { force: true });
      tempFilesToClean.delete(outfile);
    } catch (_) {}
  }
}

/**
 * Introspects PDF structure and PrePress PageBoxes.
 */
export function inspectPdf(filePathOrBuffer) {
  const buffer = Buffer.isBuffer(filePathOrBuffer)
    ? filePathOrBuffer
    : fs.readFileSync(filePathOrBuffer);

  const text = buffer.toString('latin1');

  const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const hasEof = text.includes('%%EOF');
  const hasPdfXVersion = text.includes('/GTS_PDFXVersion');
  const hasOutputIntents = text.includes('/OutputIntents');
  const hasMediaBox = text.includes('/MediaBox');
  const hasBleedBox = text.includes('/BleedBox');
  const hasTrimBox = text.includes('/TrimBox');
  const hasToUnicode = text.includes('/ToUnicode');

  // Extract PageBox values if present
  const extractBox = (boxName) => {
    const re = new RegExp(`\\/${boxName}\\s*\\[\\s*([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s*\\]`, 'i');
    const match = text.match(re);
    if (match) {
      return {
        x1: parseFloat(match[1]),
        y1: parseFloat(match[2]),
        x2: parseFloat(match[3]),
        y2: parseFloat(match[4]),
        width: Math.abs(parseFloat(match[3]) - parseFloat(match[1])),
        height: Math.abs(parseFloat(match[4]) - parseFloat(match[2]))
      };
    }
    return null;
  };

  return {
    byteLength: buffer.length,
    isPdf,
    hasEof,
    hasPdfXVersion,
    hasOutputIntents,
    hasMediaBox,
    hasBleedBox,
    hasTrimBox,
    hasToUnicode,
    mediaBox: extractBox('MediaBox'),
    bleedBox: extractBox('BleedBox'),
    trimBox: extractBox('TrimBox')
  };
}

/**
 * Parses ZIP/.tok package structure at byte level.
 */
export function inspectZipPackage(filePathOrBuffer) {
  const buffer = Buffer.isBuffer(filePathOrBuffer)
    ? filePathOrBuffer
    : fs.readFileSync(filePathOrBuffer);

  let offset = 0;
  const entries = [];

  // Parse Local File Headers (signature 0x04034b50)
  while (offset + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      break;
    }

    const versionNeeded = buffer.readUInt16LE(offset + 4);
    const flags = buffer.readUInt16LE(offset + 6);
    const compression = buffer.readUInt16LE(offset + 8);
    const modTime = buffer.readUInt16LE(offset + 10);
    const modDate = buffer.readUInt16LE(offset + 12);
    const crc32 = buffer.readUInt32LE(offset + 14);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    const nameOffset = offset + 30;
    const name = buffer.subarray(nameOffset, nameOffset + nameLen).toString('utf-8');
    const dataOffset = nameOffset + nameLen + extraLen;
    const rawData = buffer.subarray(dataOffset, dataOffset + compressedSize);

    let decompressed = null;
    if (compression === 0) {
      decompressed = rawData;
    } else if (compression === 8) {
      try {
        decompressed = zlib.inflateRawSync(rawData);
      } catch (_) {}
    }

    entries.push({
      name,
      crc32,
      compression,
      compressedSize,
      uncompressedSize,
      decompressed
    });

    offset = dataOffset + compressedSize;
  }

  const hasManifest = entries.some((e) => e.name === 'manifest.json');
  const hasDocument = entries.some((e) => e.name === 'document.json');

  let manifestObj = null;
  let documentObj = null;

  const manifestEntry = entries.find((e) => e.name === 'manifest.json');
  if (manifestEntry && manifestEntry.decompressed) {
    try {
      manifestObj = JSON.parse(manifestEntry.decompressed.toString('utf-8'));
    } catch (_) {}
  }

  const documentEntry = entries.find((e) => e.name === 'document.json');
  if (documentEntry && documentEntry.decompressed) {
    try {
      documentObj = JSON.parse(documentEntry.decompressed.toString('utf-8'));
    } catch (_) {}
  }

  return {
    totalBytes: buffer.length,
    entryCount: entries.length,
    entries,
    hasManifest,
    hasDocument,
    manifest: manifestObj,
    document: documentObj
  };
}

export function defaultParagraphStyles() {
  const cmykBlack = { DeviceCmyk: { c: 0, m: 0, y: 0, k: 1 } };
  return [
    {
      id: 'style-gemara-main',
      name: 'גמרא ראשי',
      font_family: 'Frank Ruhl Libre',
      font_weight: 700,
      font_size_pt: 13.5,
      line_height_pt: 20.9,
      space_before_pt: 0.0,
      space_after_pt: 2.0,
      first_line_indent_pt: 0.0,
      alignment: 'Justified',
      ahalterm_stretch: 'AutoVariable',
      color: cmykBlack,
      keep_with_next: false,
      orphan_control: 2,
      widow_control: 2
    },
    {
      id: 'style-rashi-body',
      name: 'רש״י',
      font_family: 'Noto Rashi Hebrew',
      font_weight: 400,
      font_size_pt: 10.5,
      line_height_pt: 15.5,
      space_before_pt: 0.0,
      space_after_pt: 2.0,
      first_line_indent_pt: 0.0,
      alignment: 'Justified',
      ahalterm_stretch: 'AutoVariable',
      color: cmykBlack,
      keep_with_next: false,
      orphan_control: 2,
      widow_control: 2
    },
    {
      id: 'style-tosafot-body',
      name: 'תוספות',
      font_family: 'Noto Rashi Hebrew',
      font_weight: 400,
      font_size_pt: 10.5,
      line_height_pt: 15.5,
      space_before_pt: 0.0,
      space_after_pt: 2.0,
      first_line_indent_pt: 0.0,
      alignment: 'Justified',
      ahalterm_stretch: 'AutoVariable',
      color: cmykBlack,
      keep_with_next: false,
      orphan_control: 2,
      widow_control: 2
    },
    {
      id: 'style-footnotes',
      name: 'הערות ומסורת',
      font_family: 'Frank Ruhl Libre',
      font_weight: 400,
      font_size_pt: 9.0,
      line_height_pt: 12.6,
      space_before_pt: 0.0,
      space_after_pt: 1.5,
      first_line_indent_pt: 0.0,
      alignment: 'Justified',
      ahalterm_stretch: 'AutoVariable',
      color: cmykBlack,
      keep_with_next: false,
      orphan_control: 2,
      widow_control: 2
    },
    {
      id: 'normal',
      name: 'גוף הטקסט רגיל',
      font_family: 'Frank Ruhl Libre',
      font_weight: 400,
      font_size_pt: 11.0,
      line_height_pt: 14.5,
      space_before_pt: 0.0,
      space_after_pt: 2.0,
      first_line_indent_pt: 0.0,
      alignment: 'Justified',
      ahalterm_stretch: 'AutoVariable',
      color: cmykBlack,
      keep_with_next: false,
      orphan_control: 2,
      widow_control: 2
    },
    {
      id: 'default-body',
      name: 'גוף הטקסט',
      font_family: 'Frank Ruhl Libre',
      font_weight: 400,
      font_size_pt: 11.0,
      line_height_pt: 14.5,
      space_before_pt: 0.0,
      space_after_pt: 2.0,
      first_line_indent_pt: 0.0,
      alignment: 'Justified',
      ahalterm_stretch: 'AutoVariable',
      color: cmykBlack,
      keep_with_next: false,
      orphan_control: 2,
      widow_control: 2
    }
  ];
}

/**
 * Creates a valid DocumentRoot JSON structure conforming strictly to tok-core.
 */
export function buildDocumentRoot({
  title = 'מסמך בדיקה',
  author = 'TypesetOK E2E',
  templateType = 'prose',
  flows = {},
  documentSettings = {}
} = {}) {
  const sectionFlows = [];
  const isMultiFlow = Boolean(flows.gemara || flows.rashi || flows.tosafot);
  const effectiveTemplate = isMultiFlow ? 'gemara' : templateType;

  for (const [flowKey, paras] of Object.entries(flows)) {
    let flowId = flowKey;
    let flowType = 'Main';

    if (flowKey === 'gemara') {
      flowId = effectiveTemplate === 'prose' ? 'main' : 'gemara';
      flowType = 'Main';
    } else if (flowKey === 'rashi') {
      flowId = 'rashi';
      flowType = 'CommentA';
    } else if (flowKey === 'tosafot') {
      flowId = 'tosafot';
      flowType = 'CommentB';
    } else if (flowKey === 'notes') {
      flowId = 'notes';
      flowType = 'Footnote';
    } else if (flowKey === 'main') {
      flowId = 'main';
      flowType = 'Main';
    }

    const pNodes = (paras || []).map((p, idx) => {
      const text = typeof p === 'string' ? p : p.text || '';
      const styleId = (typeof p === 'object' && p.styleId) ? p.styleId
        : flowKey === 'rashi' ? 'style-rashi-body'
        : flowKey === 'tosafot' ? 'style-tosafot-body'
        : flowKey === 'notes' ? 'style-footnotes'
        : flowKey === 'gemara' ? 'style-gemara-main'
        : 'normal';
      const pId = (typeof p === 'object' && p.id) ? p.id : generateCrockfordUlid();

      return {
        id: pId,
        index: 'a' + idx.toString(36).padStart(5, '0'),
        style_id: styleId,
        text,
        style_patches: []
      };
    });

    sectionFlows.push({
      id: flowId,
      flow_type: flowType,
      paragraphs: pNodes
    });
  }

  if (sectionFlows.length === 0) {
    sectionFlows.push({
      id: effectiveTemplate === 'prose' ? 'main' : 'gemara',
      flow_type: 'Main',
      paragraphs: []
    });
  }

  return {
    id: generateCrockfordUlid(),
    metadata: {
      title,
      author,
      progression: 'Rtl',
      primary_language: 'he',
      schema_version: '1.0',
      document_settings: {
        pageWidthPt: 595.28,
        pageHeightPt: 841.89,
        marginTopPt: 56.7,
        marginBottomPt: 56.7,
        marginInnerPt: 56.7,
        marginOuterPt: 56.7,
        ...documentSettings
      }
    },
    paragraph_styles: defaultParagraphStyles(),
    character_styles: [],
    sections: [
      {
        id: generateCrockfordUlid(),
        name: title,
        page_style: 'chapter-first',
        flows: sectionFlows
      }
    ]
  };
}
