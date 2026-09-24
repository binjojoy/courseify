// Generate simple PNG icons for PWA without external deps
// Uses raw PNG binary format (minimal PNG: solid color square with 'C' text isn't possible without canvas,
// but we can create valid solid-color PNGs using pure Node.js)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, r, g, b) {
  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk - raw scanlines
  const rawRow = Buffer.alloc(1 + size * 3);
  rawRow[0] = 0; // filter none
  for (let x = 0; x < size; x++) {
    rawRow[1 + x * 3] = r;
    rawRow[1 + x * 3 + 1] = g;
    rawRow[1 + x * 3 + 2] = b;
  }
  const rows = [];
  for (let y = 0; y < size; y++) rows.push(rawRow);
  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

function crc32(buf) {
  const table = makeCrcTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let _crcTable = null;
function makeCrcTable() {
  if (_crcTable) return _crcTable;
  _crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    _crcTable[n] = c;
  }
  return _crcTable;
}

const outDir = path.join(__dirname, 'public');

// Indigo/violet color: #6366f1 = rgb(99, 102, 241)
const png192 = createPNG(192, 99, 102, 241);
fs.writeFileSync(path.join(outDir, 'icon-192.png'), png192);
console.log('Written public/icon-192.png');

const png512 = createPNG(512, 99, 102, 241);
fs.writeFileSync(path.join(outDir, 'icon-512.png'), png512);
console.log('Written public/icon-512.png');
