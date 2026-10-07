export type CityAudioCue = { kind: 'button' } | {
  kind: 'weekly'; reportKey: string; netProfit: number; reducedMotion?: boolean; gameOver?: boolean;
};

const listeners = new Set<(cue: CityAudioCue) => void>();
const revealedReports = new Set<string>();

/** Presentation events only. Never creates a context, resumes audio, or queues a sound. */
export function emitCityAudioCue(cue: CityAudioCue): void {
  if (cue.kind === 'weekly') {
    if (!cue.reportKey || !Number.isFinite(cue.netProfit) || revealedReports.has(cue.reportKey)) return;
    // A muted/paused reveal is consumed too; enabling audio later cannot replay it.
    revealedReports.add(cue.reportKey);
    if (revealedReports.size > 200) revealedReports.delete(revealedReports.values().next().value!);
    if (cue.reducedMotion) return;
  }
  for (const listener of listeners) listener(cue);
}

export function subscribeCityAudioCues(listener: (cue: CityAudioCue) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
