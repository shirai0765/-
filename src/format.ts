/** Display only: never round a reputation up across an action threshold. */
export function formatReputation(value: number): string {
  return (Math.floor(value * 10) / 10).toFixed(1);
}
