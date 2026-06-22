export function orderResourceIds(resourceIds: string[]): string[] {
  const unique = Array.from(new Set(resourceIds));
  return unique.sort(); 
}