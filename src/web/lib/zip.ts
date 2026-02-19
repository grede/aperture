/**
 * Minimal ZIP (store-only) builder for server-side bulk downloads.
 */

interface ZipEntry {
  name: string;
  data: Buffer;
  modifiedAt?: Date;
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let i = 0; i < 8; i++) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    const tableIndex = (crc ^ buffer[i]) & 0xff;
    crc = (CRC32_TABLE[tableIndex] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sanitizeEntryName(name: string): string {
  return name
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
}

function toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { dosDate, dosTime };
}

/**
 * Create ZIP archive bytes for the given file entries.
 */
export function createZipBuffer(entries: ZipEntry[]): Buffer {
  const uniqueNames = new Set<string>();
  const localFileParts: Buffer[] = [];
  const centralDirParts: Buffer[] = [];

  let offset = 0;

  for (const entry of entries) {
    const originalName = sanitizeEntryName(entry.name);
    if (!originalName) {
      continue;
    }

    let name = originalName;
    let suffix = 1;
    while (uniqueNames.has(name)) {
      const dotIndex = originalName.lastIndexOf('.');
      if (dotIndex > 0) {
        name = `${originalName.slice(0, dotIndex)}-${suffix}${originalName.slice(dotIndex)}`;
      } else {
        name = `${originalName}-${suffix}`;
      }
      suffix++;
    }
    uniqueNames.add(name);

    const nameBuffer = Buffer.from(name, 'utf8');
    const dataBuffer = entry.data;
    const checksum = crc32(dataBuffer);
    const { dosDate, dosTime } = toDosDateTime(entry.modifiedAt ?? new Date());
    const generalPurposeFlag = 0x0800; // UTF-8 filenames

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(generalPurposeFlag, 6);
    localHeader.writeUInt16LE(0, 8); // compression method: store
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18); // compressed size
    localHeader.writeUInt32LE(dataBuffer.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    const localPart = Buffer.concat([localHeader, nameBuffer, dataBuffer]);
    localFileParts.push(localPart);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed to extract
    centralHeader.writeUInt16LE(generalPurposeFlag, 8);
    centralHeader.writeUInt16LE(0, 10); // compression method: store
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralDirParts.push(Buffer.concat([centralHeader, nameBuffer]));
    offset += localPart.length;
  }

  const centralDirOffset = offset;
  const centralDirectory = Buffer.concat(centralDirParts);
  const centralDirSize = centralDirectory.length;

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4); // disk number
  endRecord.writeUInt16LE(0, 6); // central dir disk number
  endRecord.writeUInt16LE(centralDirParts.length, 8); // entries on disk
  endRecord.writeUInt16LE(centralDirParts.length, 10); // total entries
  endRecord.writeUInt32LE(centralDirSize, 12);
  endRecord.writeUInt32LE(centralDirOffset, 16);
  endRecord.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localFileParts, centralDirectory, endRecord]);
}
