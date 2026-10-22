export function preferenceTerms(value: string): string[] {
  const seen = new Set<string>();
  return value.split(',').map(x => x.trim()).filter(x => {
    const key = x.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function togglePreference(value: string, choice: string): string {
  const terms = preferenceTerms(value);
  return (terms.some(x => x.toLowerCase() === choice.toLowerCase())
    ? terms.filter(x => x.toLowerCase() !== choice.toLowerCase()) : [...terms, choice]).join(', ');
}
export function nextMilestone<T extends {completed:boolean; stage:number|null}>(items:T[]): T | undefined {
  return items.filter(x => !x.completed).sort((a,b) => (a.stage ?? Infinity) - (b.stage ?? Infinity))[0];
}
