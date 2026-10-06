/** Animation time excludes gaps while the scene is paused or the document is hidden. */
export class ActiveAnimationClock {
  private previous: number | undefined;
  private elapsed = 0;

  sample(timestamp: number): number {
    if (this.previous !== undefined) this.elapsed += Math.max(0, timestamp - this.previous);
    this.previous = timestamp;
    return this.elapsed;
  }

  pause() { this.previous = undefined; }
}
