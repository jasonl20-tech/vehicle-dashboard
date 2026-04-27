/**
 * Ungefähre IATA-Positionen (Flughafen = Edge-/CDN-Referenzpunkt).
 * Koordinaten [lat, lng] für Leaflet.
 */
const IATA: Record<string, [number, number]> = {
  LHR: [51.47, -0.4543],
  LGW: [51.1537, -0.1821],
  STN: [51.886, 0.2389],
  CDG: [49.0097, 2.5479],
  ORY: [48.7233, 2.3794],
  FRA: [50.0379, 8.5622],
  MUC: [48.3538, 11.7861],
  DUS: [51.2895, 6.7668],
  AMS: [52.3105, 4.7683],
  BRU: [50.9014, 4.4844],
  ZRH: [47.4502, 8.5621],
  VIE: [48.1103, 16.5697],
  MAD: [40.4983, -3.5676],
  BCN: [41.2974, 2.0809],
  FCO: [41.8003, 12.2389],
  MXP: [45.6306, 8.7281],
  CPH: [55.618, 12.6508],
  ARN: [59.6498, 17.9307],
  OSL: [60.1975, 11.1004],
  DUB: [53.4213, -6.2701],
  WAW: [52.1657, 20.9671],
  PRG: [50.1008, 14.26],
  SIN: [1.3502, 103.994],
  NRT: [35.772, 140.3929],
  HND: [35.5494, 139.7798],
  ICN: [37.4602, 126.4407],
  HKG: [22.308, 113.9185],
  SYD: [-33.9461, 151.1772],
  IAD: [38.9531, -77.4565],
  JFK: [40.6413, -73.7781],
  EWR: [40.6895, -74.1745],
  ORD: [41.9742, -87.9073],
  DFW: [32.8998, -97.0403],
  LAX: [33.9416, -118.4085],
  SFO: [37.6213, -122.379],
  SEA: [47.4502, -122.3088],
  ATL: [33.6407, -84.4277],
  MIA: [25.7959, -80.287],
  YUL: [45.5017, -73.5673],
  YYZ: [43.6777, -79.6248],
  GRU: [-23.4356, -46.4731],
  DXB: [25.2528, 55.3644],
};

/**
 * IATA-Code (3 Buchst.) → [lat, lng] oder `null`.
 */
export function iataToLatLng(code: string): [number, number] | null {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return null;
  const ll = IATA[c];
  return ll ? [ll[0], ll[1]] : null;
}
