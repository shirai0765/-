/** Original eight-bar ambient composition. No samples, recordings or external requests. */
const BEAT = 60 / 72;
const BAR = BEAT * 4;
const CHORDS = [
  [48, 60, 64, 67, 71], [45, 60, 64, 67, 69],
  [41, 60, 64, 65, 69], [43, 60, 62, 67, 69],
  [38, 60, 62, 65, 69], [40, 59, 62, 64, 67],
  [41, 57, 60, 64, 69], [43, 59, 62, 67, 69],
];
const MELODY = [[76, 79], [76, 72], [77, 76], [74, 71], [74, 77], [76, 71], [72, 76], [74, 71]];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A paused context preserves the musical timeline; resuming never creates a second score. */
export class CityAudioEngine {
  private readonly master: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly voices = new Set<OscillatorNode>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private nextBar = 0;
  private bar = 0;
  private desired = false;
  private disposed = false;

  constructor(private readonly context: AudioContext) {
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -22;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = .03;
    this.compressor.release.value = .4;
    this.master.connect(this.compressor);
    this.compressor.connect(context.destination);
  }

  setVolume(volume: number, muted: boolean) {
    if (this.disposed) return;
    const value = muted ? 0 : Math.max(0, Math.min(1, volume)) ** 2;
    this.master.gain.setTargetAtTime(value, this.context.currentTime, .08);
  }

  async setPlaying(playing: boolean): Promise<void> {
    if (this.disposed) return;
    this.desired = playing;
    if (!playing) {
      this.stopTimer();
      await this.context.suspend();
      return;
    }
    // Called directly from a user gesture on the first play; no deferred creation/resume.
    await this.context.resume();
    if (this.disposed) return;
    if (!this.desired) { await this.context.suspend(); return; }
    if (this.context.state !== 'running') throw new Error('Audio playback did not start');
    if (!this.nextBar) this.nextBar = this.context.currentTime + .12;
    this.schedule();
    if (this.timer === undefined) this.timer = setInterval(() => this.schedule(), 100);
  }

  private note(midi: number, start: number, duration: number, amplitude: number, pad = false) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = pad ? 'triangle' : 'sine';
    oscillator.frequency.value = hz(midi);
    filter.type = 'lowpass';
    filter.frequency.value = pad ? 1250 : 1800;
    filter.Q.value = .3;
    const attack = pad ? .9 : .12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amplitude, start + attack);
    gain.gain.setValueAtTime(amplitude * .8, start + duration * .55);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(this.master);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect(); filter.disconnect(); gain.disconnect();
    };
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }

  private schedule() {
    if (this.disposed || !this.desired || this.context.state !== 'running') return;
    // If the host throttled timers without a visibility event, skip missed bars,
    // rather than firing a backlog of notes together.
    while (this.nextBar < this.context.currentTime - .1) { this.nextBar += BAR; this.bar++; }
    while (this.nextBar < this.context.currentTime + 1.2) {
      const index = this.bar % CHORDS.length;
      const chord = CHORDS[index];
      chord.slice(1).forEach(note => this.note(note, this.nextBar, BAR + 1.3, .035, true));
      this.note(chord[0], this.nextBar, BAR * .9, .095);
      MELODY[index].forEach((note, i) => this.note(note, this.nextBar + BEAT * (i === 0 ? 1 : 2.75), BEAT * 1.6, .065));
      this.nextBar += BAR;
      this.bar++;
    }
  }

  private stopTimer() { if (this.timer !== undefined) clearInterval(this.timer); this.timer = undefined; }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true; this.desired = false; this.stopTimer();
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    this.voices.clear();
    this.master.disconnect(); this.compressor.disconnect();
    if (this.context.state !== 'closed') await this.context.close();
  }
}
