import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityAudioAssetError, loadCityAudioAssets } from '../src/audio/CityAudioAssets';
import type { CityAudioAssetConfig } from '../src/audio/CityAudioAssets';

const first = 'audio/external-v080/bgm/lounge.m4a';
const second = 'audio/external-v080/bgm/lounge.mp3';
const buffer = () => ({ duration: 2, length: 96_000, numberOfChannels: 2 } as AudioBuffer);
const config = (paths = [first]): CityAudioAssetConfig => ({ music: { variants: paths.map(path => ({ path, loopStart: .05, loopEnd: 1.95 })) } });
function decoder() {
  const decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => buffer());
  return { decodeAudioData, context: { decodeAudioData } as unknown as AudioContext };
}
beforeEach(() => {
  vi.stubGlobal('document', { baseURI: 'https://example.test/-/?v=0.9.0' });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('reviewed bundled audio assets', () => {
  it('tries an existing alternative codec in the same context and preserves the Pages prefix', async () => {
    const { context, decodeAudioData } = decoder();
    decodeAudioData.mockRejectedValueOnce(new Error('Unsupported codec'));
    const assets = await loadCityAudioAssets(context, config([first, second]), new AbortController().signal);
    expect(assets.music.loopStart).toBe(.05);
    expect(assets.music.loopEnd).toBe(1.95);
    expect(decodeAudioData).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      'https://example.test/-/' + first, 'https://example.test/-/' + second,
    ]);
  });

  it('rejects invalid loop coordinates instead of starting a broken loop', async () => {
    const { context } = decoder();
    const invalid: CityAudioAssetConfig = { music: { variants: [{ path: first, loopStart: 1, loopEnd: 3 }] } };
    await expect(loadCityAudioAssets(context, invalid, new AbortController().signal)).rejects.toBeInstanceOf(CityAudioAssetError);
  });

  it('discards an unabortable late decode and does not try another codec after cancellation', async () => {
    const { context, decodeAudioData } = decoder();
    const controller = new AbortController();
    let complete!: (value: AudioBuffer) => void;
    let started!: () => void;
    const decoding = new Promise<void>(done => { started = done; });
    decodeAudioData.mockImplementation(() => { started(); return new Promise(done => { complete = done; }); });
    const loaded = loadCityAudioAssets(context, config([first, second]), controller.signal);
    const rejected = expect(loaded).rejects.toMatchObject({ name: 'AbortError' });
    await decoding;
    controller.abort(); complete(buffer());
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it('rejects off-origin and traversal paths before any request', async () => {
    const { context } = decoder();
    for (const path of ['https://remote.test/sound.m4a', 'audio/external-v080/bgm/../sfx/sound.wav']) {
      await expect(loadCityAudioAssets(context, config([path]), new AbortController().signal)).rejects.toBeInstanceOf(CityAudioAssetError);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a decoded pack that exceeds its memory budget', async () => {
    const { context, decodeAudioData } = decoder();
    decodeAudioData.mockResolvedValue({ duration: 60, length: 9_000_000, numberOfChannels: 2 } as AudioBuffer);
    await expect(loadCityAudioAssets(context, config(), new AbortController().signal)).rejects.toBeInstanceOf(CityAudioAssetError);
  });
});
