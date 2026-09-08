import type { RecordPair, SensorFrame } from "./types.ts";

export type RecordedCapture = RecordPair & {
  frame: SensorFrame;
  normals: Float32Array;
  labels: Uint8Array;
};
type Entry = { name: string; bytes: Uint8Array };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Small uncompressed USTAR writer. No network or archive dependency. */
export function encodeTar(entries: Entry[]): Uint8Array {
  const size = entries.reduce(
    (n, e) => n + 512 + Math.ceil(e.bytes.length / 512) * 512,
    1024,
  );
  const archive = new Uint8Array(size);
  let offset = 0;
  for (const { name, bytes } of entries) {
    if (encoder.encode(name).length > 99)
      throw new Error("Archive path is too long");
    const header = archive.subarray(offset, offset + 512);
    const put = (at: number, value: string) =>
      header.set(encoder.encode(value), at);
    put(0, name);
    put(100, "0000644\0");
    put(108, "0000000\0");
    put(116, "0000000\0");
    put(124, bytes.length.toString(8).padStart(11, "0") + "\0");
    put(136, "00000000000\0");
    header.fill(32, 148, 156);
    put(156, "0");
    put(257, "ustar\0");
    put(263, "00");
    put(
      148,
      header
        .reduce((sum, x) => sum + x, 0)
        .toString(8)
        .padStart(6, "0") + "\0 ",
    );
    archive.set(bytes, offset + 512);
    offset += 512 + Math.ceil(bytes.length / 512) * 512;
  }
  return archive;
}

/** Bounded parser used by the offline replay test; it never writes archive paths to disk. */
export function decodeTar(archive: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  for (let offset = 0; offset + 512 <= archive.length; ) {
    const h = archive.subarray(offset, offset + 512);
    if (h.every((x) => x === 0)) break;
    const string = (at: number, length: number) =>
      decoder
        .decode(h.subarray(at, at + length))
        .split("\0")[0]
        .trim();
    const checksum = h.reduce(
      (sum, value, i) => sum + (i >= 148 && i < 156 ? 32 : value),
      0,
    );
    if (checksum !== Number.parseInt(string(148, 8), 8))
      throw new Error("Invalid archive checksum");
    const name = string(0, 100),
      size = Number.parseInt(string(124, 12), 8);
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      offset + 512 + size > archive.length
    )
      throw new Error("Truncated archive");
    if (entries.has(name)) throw new Error("Duplicate archive entry");
    entries.set(name, archive.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export function floatBytes(values: Float32Array): Uint8Array {
  const bytes = new Uint8Array(values.length * 4),
    view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setFloat32(i * 4, value, true));
  return bytes;
}

export function readFloats(bytes: Uint8Array): Float32Array {
  if (bytes.length % 4) throw new Error("Invalid float plane");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Float32Array.from({ length: bytes.length / 4 }, (_, i) =>
    view.getFloat32(i * 4, true),
  );
}

export function encodeDataset(
  captures: RecordedCapture[],
  metadata: unknown,
): Uint8Array {
  const entries: Entry[] = [];
  const frames = captures.map((c, index) => {
    const prefix = `frames/${String(index).padStart(6, "0")}`;
    const files = {
      rgb: `${prefix}/rgb.rgba`,
      depth: `${prefix}/depth.f32`,
      normals: `${prefix}/normals.f32`,
      labels: `${prefix}/semantic.u8`,
    };
    entries.push(
      { name: files.rgb, bytes: c.frame.rgb },
      { name: files.depth, bytes: floatBytes(c.frame.depth) },
      { name: files.normals, bytes: floatBytes(c.normals) },
      { name: files.labels, bytes: c.labels },
    );
    const { rgb: _rgb, depth: _depth, ...frame } = c.frame;
    return { ...frame, files, truth: c.truth, estimate: c.estimate };
  });
  const manifest = {
    format: "vastness-rgbd-v1",
    byteOrder: "little-endian",
    rows: "top-to-bottom",
    rgb: "RGBA8",
    depth: "Float32 axial z; 0 invalid",
    normals: "Float32 XYZ, camera coordinates",
    labels: "Uint8 semantic truth",
    metadata,
    frames,
  };
  return encodeTar([
    { name: "manifest.json", bytes: encoder.encode(JSON.stringify(manifest)) },
    ...entries,
  ]);
}

export function decodeDataset(archive: Uint8Array): {
  captures: RecordedCapture[];
  metadata: unknown;
} {
  const entries = decodeTar(archive);
  const manifest = JSON.parse(decoder.decode(entries.get("manifest.json")));
  if (
    manifest.format !== "vastness-rgbd-v1" ||
    manifest.byteOrder !== "little-endian"
  )
    throw new Error("Unsupported dataset");
  const required = (name: string) => {
    const bytes = entries.get(name);
    if (!bytes) throw new Error(`Missing plane: ${name}`);
    return bytes;
  };
  const captures: RecordedCapture[] = manifest.frames.map(
    (
      m: {
        files: Record<string, string>;
        truth: RecordPair["truth"];
        estimate: RecordPair["estimate"];
      } & Omit<SensorFrame, "rgb" | "depth">,
    ) => {
      const { files, truth, estimate, ...meta } = m;
      const frame = {
        ...meta,
        rgb: required(files.rgb),
        depth: readFloats(required(files.depth)),
      };
      const normals = readFloats(required(files.normals)),
        labels = required(files.labels),
        pixels = frame.k.width * frame.k.height;
      if (
        frame.rgb.length !== pixels * 4 ||
        frame.depth.length !== pixels ||
        normals.length !== pixels * 3 ||
        labels.length !== pixels ||
        truth.id !== frame.id ||
        truth.timestamp !== frame.timestamp
      )
        throw new Error("Unsynchronized or malformed sensor frame");
      return { frame, normals, labels, truth, estimate };
    },
  );
  return { captures, metadata: manifest.metadata };
}
