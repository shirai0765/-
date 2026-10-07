export type CityAudioSound = 'button' | 'weeklyProfit' | 'weeklyNeutral' | 'weeklyLoss' | 'cup' | 'coffee';
export interface CityAudioAssetVariant { path: string; loopStart?: number; loopEnd?: number }
export interface CityAudioAsset { variants: readonly CityAudioAssetVariant[]; gain?: number }
export interface CityAudioAssetConfig {
  music: CityAudioAsset;
  ambience?: CityAudioAsset;
  sounds?: Partial<Record<CityAudioSound, CityAudioAsset>>;
}
export interface DecodedCityAudioAsset { buffer: AudioBuffer; loopStart: number; loopEnd: number; gain: number }
export interface DecodedCityAudioAssets {
  music: DecodedCityAudioAsset;
  ambience?: DecodedCityAudioAsset;
  sounds: Partial<Record<CityAudioSound, DecodedCityAudioAsset>>;
}

/** Reviewed original CC0 track; compressed variants share the verified 44.1 kHz period. */
export const CITY_AUDIO_ASSETS: CityAudioAssetConfig = {
  music: {
    variants: [
      { path: 'audio/external-v080/bgm/cafe-lounge.mp3', loopStart: 0, loopEnd: 2_016_000 / 44_100 },
      { path: 'audio/external-v080/bgm/cafe-lounge.ogg', loopStart: 0, loopEnd: 2_016_000 / 44_100 },
    ],
    gain: 1,
  },
};

export class CityAudioAssetError extends Error {
  constructor() { super('Audio assets could not be loaded'); this.name = 'CityAudioAssetError'; }
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Audio loading cancelled', 'AbortError');
}

async function loadAsset(context: AudioContext, asset: CityAudioAsset, signal: AbortSignal): Promise<DecodedCityAudioAsset> {
  for (const variant of asset.variants) {
    checkAbort(signal);
    try {
      // These are reviewed bundled paths, including the Pages subdirectory.
      if (!/^audio\/external-v080\/(bgm|sfx)\/[a-zA-Z0-9_./-]+\.(m4a|mp3|wav|ogg)$/.test(variant.path)
        || variant.path.split('/').some(part => part === '..' || part === '.')) throw new CityAudioAssetError();
      const response = await fetch(new URL(variant.path, document.baseURI), { signal });
      if (!response.ok) throw new CityAudioAssetError();
      const bytes = await response.arrayBuffer();
      checkAbort(signal);
      if (bytes.byteLength > 8 * 1024 * 1024) throw new CityAudioAssetError();
      const buffer = await context.decodeAudioData(bytes);
      checkAbort(signal); // decodeAudioData itself cannot be aborted.
      const loopStart = variant.loopStart ?? 0;
      const requestedEnd = variant.loopEnd ?? buffer.duration;
      // decodeAudioData resamples to the context rate; its length can round down one sample.
      const sampleTolerance = Number.isFinite(buffer.sampleRate) && buffer.sampleRate > 0 ? 1 / buffer.sampleRate : 0;
      const loopEnd = Math.min(requestedEnd, buffer.duration);
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 120
        || buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2
        || !Number.isFinite(loopStart) || !Number.isFinite(requestedEnd)
        || loopStart < 0 || loopEnd <= loopStart || requestedEnd > buffer.duration + sampleTolerance) throw new CityAudioAssetError();
      const gain = asset.gain ?? 1;
      if (!Number.isFinite(gain) || gain < 0 || gain > 1) throw new CityAudioAssetError();
      return { buffer, loopStart, loopEnd, gain };
    } catch {
      checkAbort(signal);
      // A second *existing* encoding may decode where the first is unsupported.
    }
  }
  throw new CityAudioAssetError();
}

/** Decode into the already gesture-unlocked context; no second context or remote source. */
export async function loadCityAudioAssets(context: AudioContext, config: CityAudioAssetConfig, signal: AbortSignal): Promise<DecodedCityAudioAssets> {
  const sounds = Object.entries(config.sounds ?? {}) as [CityAudioSound, CityAudioAsset][];
  const [music, ambience, decodedSounds] = await Promise.all([
    loadAsset(context, config.music, signal),
    config.ambience ? loadAsset(context, config.ambience, signal) : Promise.resolve(undefined),
    Promise.all(sounds.map(async ([name, asset]) => [name, await loadAsset(context, asset, signal)] as const)),
  ]);
  checkAbort(signal);
  const buffers = [music, ...(ambience ? [ambience] : []), ...decodedSounds.map(([, asset]) => asset)];
  if (buffers.reduce((bytes, asset) => bytes + asset.buffer.length * asset.buffer.numberOfChannels * 4, 0) > 64 * 1024 * 1024) throw new CityAudioAssetError();
  return { music, ambience, sounds: Object.fromEntries(decodedSounds) };
}
