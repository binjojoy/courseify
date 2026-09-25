// Generate Courseify's branded PWA icons without external dependencies.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk - a blue gradient with a book and play mark.
  const pixels = Buffer.alloc(size * size * 4);
  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const index = (y * size + x) * 4;
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = color[3] ?? 255;
  };
  const insideTriangle = (x, y, a, b, c) => {
    const area = (p, q, r) => Math.abs((p[0] * (q[1] - r[1]) + q[0] * (r[1] - p[1]) + r[0] * (p[1] - q[1])) / 2);
    return Math.abs(area(a, b, c) - area([x, y], b, c) - area(a, [x, y], c) - area(a, b, [x, y])) < 1;
  };
  const center = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const blend = y / size;
      setPixel(x, y, [30 - Math.round(blend * 10), 94 - Math.round(blend * 30), 210 - Math.round(blend * 45), 255]);
    }
  }
  for (let y = size * 0.28; y < size * 0.72; y++) {
    const curve = Math.pow((y - center) / (size * 0.24), 2) * size * 0.06;
    for (let x = size * 0.17 + curve; x < size * 0.83 - curve; x++) {
      setPixel(Math.floor(x), Math.floor(y), x < center ? [248, 250, 252, 255] : [219, 234, 254, 255]);
    }
  }
  const a = [center - size * 0.05, size * 0.39];
  const b = [center + size * 0.1, center];
  const c = [center - size * 0.05, size * 0.61];
  for (let y = size * 0.38; y < size * 0.63; y++) {
    for (let x = center - size * 0.08; x < center + size * 0.12; x++) {
      if (insideTriangle(x, y, a, b, c)) setPixel(Math.floor(x), Math.floor(y), [29, 78, 216, 255]);
    }
  }
  const rows = [];
  for (let y = 0; y < size; y++) {
    const rawRow = Buffer.alloc(1 + size * 4);
    rawRow[0] = 0;
    pixels.copy(rawRow, 1, y * size * 4, (y + 1) * size * 4);
    rows.push(rawRow);
  }
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

const png192 = createPNG(192);
fs.writeFileSync(path.join(outDir, 'icon-192.png'), png192);
console.log('Written public/icon-192.png');

const png512 = createPNG(512);
fs.writeFileSync(path.join(outDir, 'icon-512.png'), png512);
console.log('Written public/icon-512.png');
