/** Original music and synthesized café sounds; no recordings or network requests. */
const BEAT = 60 / 78;
const BAR = BEAT * 4;
const CHORDS = [
  [48, 60, 64, 67, 71], [45, 60, 64, 67, 69],
  [41, 60, 64, 65, 69], [43, 60, 62, 67, 69],
  [38, 60, 62, 65, 69], [40, 59, 62, 64, 67],
  [41, 57, 60, 64, 69], [43, 59, 62, 67, 69],
];
const MELODY = [[76, 79], [76, 72], [77, 76], [74, 71], [74, 77], [76, 71], [72, 76], [74, 71]];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const level = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Safari can report `interrupted`, which older DOM typings omit. */
export type CityAudioContextState = AudioContextState | 'interrupted';
type SoundSource = OscillatorNode | AudioBufferSourceNode;

export class CityAudioEngine {
  private readonly master: GainNode;
  private readonly music: GainNode;
  private readonly ambience: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly roomBuffer: AudioBuffer;
  private readonly sources = new Set<SoundSource>();
  private readonly listeners = new Set<() => void>();
  private room: AudioBufferSourceNode | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private nextBar: number | null = null;
  private bar = 0;
  private volume = .6;
  private muted = false;
  private desired = false;
  private disposed = false;
  private revision = 0;

  constructor(private readonly context: AudioContext) {
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.music = context.createGain();
    this.ambience = context.createGain();
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = .015;
    this.compressor.release.value = .3;
    this.music.connect(this.master);
    this.ambience.connect(this.master);
    this.master.connect(this.compressor);
    this.compressor.connect(context.destination);
    this.roomBuffer = this.makeRoomBuffer();
    this.context.addEventListener('statechange', this.contextChanged);
  }

  get state(): CityAudioContextState { return this.context.state as CityAudioContextState; }
  get playing(): boolean { return !this.disposed && this.desired && this.state === 'running' && this.timer !== undefined; }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  setVolume(volume: number, muted: boolean) {
    if (this.disposed) return;
    this.volume = level(volume);
    this.muted = muted;
    this.updateMaster();
  }

  private updateMaster() {
    // The old squared curve made the default nearly inaudible on phone speakers.
    // Silence a requested pause even if the browser delays/rejects suspend().
    const audible = this.desired && this.state === 'running' && !this.muted;
    this.master.gain.setTargetAtTime(audible ? this.volume ** 1.2 : 0, this.context.currentTime, .025);
  }

  setMix(music: number, ambience: number) {
    if (this.disposed) return;
    this.music.gain.setTargetAtTime(level(music), this.context.currentTime, .035);
    this.ambience.gain.setTargetAtTime(level(ambience), this.context.currentTime, .035);
  }

  async setPlaying(playing: boolean): Promise<void> {
    if (this.disposed) return;
    this.desired = playing;
    this.updateMaster();
    const ticket = ++this.revision;
    if (!playing) {
      this.stopTimer();
      if (this.state !== 'closed' && this.state !== 'suspended') await this.context.suspend();
      return;
    }
    // This invocation occurs synchronously inside the tap handler on first start.
    // Do not defer resume() to an effect, timer or resolved promise on iOS.
    const resumed = this.context.resume();
    await resumed;
    if (this.disposed) return;
    if (ticket !== this.revision || !this.desired) {
      // A late resume must never undo an explicit pause.
      if (!this.desired && this.state === 'running') await this.context.suspend();
      return;
    }
    if (this.state !== 'running') throw new Error('Audio playback did not start');
    this.updateMaster();
    this.startScheduler();
    this.emit();
  }

  private readonly contextChanged = () => {
    if (this.disposed) return;
    this.updateMaster();
    if (this.desired && this.state === 'running') this.startScheduler();
    else this.stopTimer();
    this.emit();
  };

  private emit() { for (const listener of this.listeners) listener(); }

  private startScheduler() {
    if (this.timer !== undefined) return;
    if (this.nextBar === null) this.nextBar = this.context.currentTime + .04;
    if (!this.room) this.startRoom();
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 100);
  }

  private track(source: SoundSource, nodes: AudioNode[]) {
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (source === this.room) this.room = null;
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  }

  private tone(frequency: number, start: number, duration: number, amplitude: number, destination: GainNode, pad = false) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = pad ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = pad ? 1350 : 3800;
    filter.Q.value = .3;
    const attack = pad ? .45 : Math.min(.012, duration / 4);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amplitude, start + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, amplitude * .15), start + duration * .8);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(destination);
    this.track(oscillator, [filter, gain]);
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }

  private makeRoomBuffer() {
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * 8), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x6c616665, low = 0, middle = 0;
    for (let i = 0; i < data.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const white = ((seed >>> 0) / 0xffffffff) * 2 - 1;
      low = low * .98 + white * .02;
      middle = middle * .85 + white * .15;
      const seconds = i / this.context.sampleRate;
      // Broadband room texture has mid frequencies audible through small speakers.
      const movement = .72 + .16 * Math.sin(seconds * Math.PI / 2) + .12 * Math.sin(seconds * Math.PI);
      const seam = Math.min(1, i / (this.context.sampleRate * .06), (data.length - 1 - i) / (this.context.sampleRate * .06));
      data[i] = (middle * 1.8 + low * 2 + white * .08) * movement * seam;
    }
    return buffer;
  }

  private startRoom() {
    const source = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.roomBuffer; source.loop = true;
    highpass.type = 'highpass'; highpass.frequency.value = 170;
    lowpass.type = 'lowpass'; lowpass.frequency.value = 1450;
    gain.gain.value = .18;
    source.connect(highpass); highpass.connect(lowpass); lowpass.connect(gain); gain.connect(this.ambience);
    this.room = source;
    this.track(source, [highpass, lowpass, gain]);
    source.start(this.context.currentTime);
  }

  private coffee(start: number, duration: number) {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.roomBuffer; source.playbackRate.value = 1.7;
    filter.type = 'bandpass'; filter.frequency.value = 1550; filter.Q.value = .8;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(.32, start + .18);
    gain.gain.setValueAtTime(.23, start + duration - .22);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.ambience);
    this.track(source, [filter, gain]);
    source.start(start, .4); source.stop(start + duration + .02);
  }

  private cup(start: number) {
    // Three short resonances distinguish ceramic clinks from the music and room.
    [1480, 2310, 3240].forEach((frequency, i) => this.tone(frequency, start + i * .009, .36 - i * .07, .13 / (i + 1), this.ambience));
    this.tone(1120, start + .19, .17, .045, this.ambience);
  }

  private schedule() {
    if (this.disposed || !this.desired || this.state !== 'running' || this.nextBar === null) return;
    // Skip a throttled backlog rather than playing missed cups/notes all at once.
    while (this.nextBar < this.context.currentTime - .1) { this.nextBar += BAR; this.bar++; }
    while (this.nextBar < this.context.currentTime + 1.2) {
      const index = this.bar % CHORDS.length;
      const chord = CHORDS[index];
      chord.slice(1).forEach(note => this.tone(hz(note), this.nextBar!, BAR + .6, .05, this.music, true));
      this.tone(hz(chord[0] + 12), this.nextBar, BAR * .8, .14, this.music);
      MELODY[index].forEach((note, i) => this.tone(hz(note), this.nextBar! + BEAT * (i === 0 ? .5 : 2.25), BEAT * 1.45, .12, this.music));
      this.cup(this.nextBar + .16 + (this.bar % 3) * .31);
      if (this.bar % 3 === 0) this.coffee(this.nextBar + .6, 1.65);
      this.nextBar += BAR;
      this.bar++;
    }
  }

  private stopTimer() { if (this.timer !== undefined) clearInterval(this.timer); this.timer = undefined; }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true; this.desired = false; this.revision++; this.stopTimer();
    this.context.removeEventListener('statechange', this.contextChanged);
    this.listeners.clear();
    for (const source of this.sources) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect();
    }
    this.sources.clear(); this.room = null;
    this.master.disconnect(); this.music.disconnect(); this.ambience.disconnect(); this.compressor.disconnect();
    if (this.state !== 'closed') await this.context.close();
  }
}
