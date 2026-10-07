/** Fictional game-map service buildings, not economic parcels or surveyed addresses. */
export const CITY_SERVICES = [
  { id: 'service-bank', kind: 'bank', label: '銀行', sign: 'BANK', x: -45, z: 38, width: 22, depth: 22, height: 12 },
  { id: 'service-exchange', kind: 'exchange', label: '証券市場', sign: 'STOCK EXCHANGE', x: -78, z: 60, width: 28, depth: 24, height: 18 },
] as const;
export type CityService = (typeof CITY_SERVICES)[number];
export function getCityService(id: string): CityService | undefined { return CITY_SERVICES.find(service => service.id === id); }
