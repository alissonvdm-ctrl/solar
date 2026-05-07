export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
  const dLat = toRad(p2.latitude - p1.latitude);
  const dLng = toRad(p2.longitude - p1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.latitude)) *
      Math.cos(toRad(p2.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

export function polygonArea(points: GeoPoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const xi = toRad(points[i].longitude) * EARTH_RADIUS * Math.cos(toRad(points[i].latitude));
    const yi = toRad(points[i].latitude) * EARTH_RADIUS;
    const xj = toRad(points[j].longitude) * EARTH_RADIUS * Math.cos(toRad(points[j].latitude));
    const yj = toRad(points[j].latitude) * EARTH_RADIUS;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2);
}

export function polygonPerimeter(points: GeoPoint[]): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    perimeter += haversineDistance(points[i], points[j]);
  }
  return perimeter;
}

export function boundingBoxDimensions(points: GeoPoint[]): {
  width: number;
  length: number;
} {
  if (points.length < 2) return { width: 0, length: 0 };

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const length = haversineDistance(
    { latitude: minLat, longitude: (minLng + maxLng) / 2 },
    { latitude: maxLat, longitude: (minLng + maxLng) / 2 }
  );

  const width = haversineDistance(
    { latitude: (minLat + maxLat) / 2, longitude: minLng },
    { latitude: (minLat + maxLat) / 2, longitude: maxLng }
  );

  return {
    width: Math.round(width * 10) / 10,
    length: Math.round(length * 10) / 10,
  };
}

export function polygonCentroid(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
  return { latitude: lat, longitude: lng };
}

export function formatDistance(meters: number): string {
  if (meters < 1) return `${(meters * 100).toFixed(0)} cm`;
  if (meters < 100) return `${meters.toFixed(1)} m`;
  return `${meters.toFixed(0)} m`;
}

export function formatArea(sqMeters: number): string {
  if (sqMeters < 1) return `${(sqMeters * 10000).toFixed(0)} cm²`;
  return `${sqMeters.toFixed(1)} m²`;
}
