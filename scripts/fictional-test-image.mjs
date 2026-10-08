import { deflateSync } from 'node:zlib';

// A valid blank 256×256 PNG for testing the connection without report data.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const contents = Buffer.concat([Buffer.from(name), data]);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(contents));
  return Buffer.concat([length, contents, checksum]);
}

export function fictionalTestImage() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(256, 0);
  header.writeUInt32BE(256, 4);
  header[8] = 8; // 8-bit RGB
  header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(256 * 3, 255)]);
  const pixels = Buffer.concat(Array.from({ length: 256 }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
