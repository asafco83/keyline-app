import { describe, it, expect } from 'vitest';
import { crc32, makeZip, readZip } from '../src/io/zip';

const enc = new TextEncoder(),
  dec = new TextDecoder();

describe('zip (.SVGcinema container)', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips stored and deflated entries', async () => {
    const big = 'svgcinema '.repeat(2000);
    const bin = new Uint8Array(256).map((_, i) => i);
    const blob = await makeZip([
      { name: 'manifest.json', data: enc.encode('{"format":"svgcinema-project"}'), compress: true },
      { name: 'project.json', data: enc.encode(big), compress: true },
      { name: 'assets/a1.bin', data: bin, compress: false },
    ]);
    const z = await readZip(await blob.arrayBuffer());
    expect(z.names).toEqual(['manifest.json', 'project.json', 'assets/a1.bin']);
    expect(JSON.parse(await z.text('manifest.json')).format).toBe('svgcinema-project');
    expect(await z.text('project.json')).toBe(big);
    expect(Array.from(await z.get('assets/a1.bin'))).toEqual(Array.from(bin));
    expect(await z.get('missing.txt')).toBeNull();
  });

  it('actually compresses repetitive data', async () => {
    const data = enc.encode('a'.repeat(50000));
    const blob = await makeZip([{ name: 'x.txt', data, compress: true }]);
    expect(blob.size).toBeLessThan(5000);
  });

  it('rejects files that are not zips', async () => {
    await expect(readZip(enc.encode('not a zip at all').buffer)).rejects.toThrow();
  });

  it('keeps UTF-8 names intact', async () => {
    const blob = await makeZip([{ name: 'assets/שמש.svg', data: enc.encode('<svg/>'), compress: false }]);
    const z = await readZip(await blob.arrayBuffer());
    expect(z.names[0]).toBe('assets/שמש.svg');
    expect(dec.decode(await z.get('assets/שמש.svg'))).toBe('<svg/>');
  });
});
