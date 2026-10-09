import { DELIVERY_ZONE_GEO_DIRECTORY, calculateHaversineDistanceKm } from './branchGeoRouting';

export interface RealResolvedLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  displayName: string;
  streetOrBuilding: string;
  areaOrSuburb: string;
  cityOrTown: string;
  county: string;
  matchedDeliveryZone: string;
  source: 'BROWSER_GPS' | 'PLACE_SEARCH' | 'IP_GEOLOCATION';
}

export interface NominatimSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: {
    road?: string;
    building?: string;
    house_number?: string;
    Amenity?: string;
    amenity?: string;
    shop?: string;
    suburb?: string;
    neighbourhood?: string;
    residential?: string;
    quarter?: string;
     estate?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/**
 * Matches any real-world GPS coordinate or address to the closest VAAIRO service zone
 * while preserving the real-world street/suburb/city names.
 */
export function matchNearestDeliveryZoneFromRealCoords(
  lat: number,
  lng: number,
  areaLabel?: string
): string {
  let closestZone = DELIVERY_ZONE_GEO_DIRECTORY[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const z of DELIVERY_ZONE_GEO_DIRECTORY) {
    const dist = calculateHaversineDistanceKm(lat, lng, z.latitude, z.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestZone = z;
    }
  }

  if (areaLabel && areaLabel.trim()) {
    return areaLabel.trim();
  }
  return closestZone.label;
}

/**
 * Parses an OpenStreetMap Nominatim reverse/search response into a clean RealResolvedLocation.
 */
export function parseNominatimLocation(
  data: NominatimSearchResult,
  lat: number,
  lng: number,
  source: RealResolvedLocation['source'],
  accuracyMeters?: number
): RealResolvedLocation {
  const addr = data.address || {};
  const buildingOrAmenity = addr.building || addr.amenity || addr.shop || data.name || '';
  const roadPart = [addr.house_number, addr.road].filter(Boolean).join(' ');
  const suburbPart =
    addr.suburb ||
    addr.neighbourhood ||
    addr.residential ||
    addr.quarter ||
    addr.village ||
    '';
  const cityPart = addr.city || addr.town || addr.county || addr.state || 'Nairobi';
  const countyPart = addr.county || addr.state || cityPart;

  const streetParts = [buildingOrAmenity, roadPart]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  const rawDisplayParts = (data.display_name || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const streetOrBuilding =
    streetParts.length > 0
      ? streetParts.join(', ')
      : rawDisplayParts.slice(0, 2).join(', ') || `GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

  const areaOrSuburb =
    [suburbPart, cityPart]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ') ||
    rawDisplayParts.slice(1, 3).join(', ') ||
    cityPart;

  const matchedDeliveryZone = matchNearestDeliveryZoneFromRealCoords(
    lat,
    lng,
    areaOrSuburb ? `${areaOrSuburb}` : undefined
  );

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    accuracyMeters,
    displayName: data.display_name || `${streetOrBuilding}, ${areaOrSuburb}`,
    streetOrBuilding,
    areaOrSuburb,
    cityOrTown: cityPart,
    county: countyPart,
    matchedDeliveryZone,
    source
  };
}

/**
 * Reverse-geocodes exact GPS coordinates into a real street, suburb, and city address
 * using the server proxy (/api/location/reverse) with direct Nominatim fallback.
 */
export async function reverseGeocodeRealCoordinates(
  lat: number,
  lng: number,
  source: RealResolvedLocation['source'] = 'BROWSER_GPS',
  accuracyMeters?: number
): Promise<RealResolvedLocation> {
  try {
    const res = await fetch(
      `/api/location/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
    );
    if (res.ok) {
      const data = (await res.json()) as NominatimSearchResult;
      if (data && (data.display_name || data.address)) {
        return parseNominatimLocation(data, lat, lng, source, accuracyMeters);
      }
    }
  } catch {
    // Fallback to direct Nominatim call
  }

  try {
    const directUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1&zoom=18`;
    const directRes = await fetch(directUrl, {
      headers: { 'Accept-Language': 'en' }
    });
    if (directRes.ok) {
      const data = (await directRes.json()) as NominatimSearchResult;
      if (data && (data.display_name || data.address)) {
        return parseNominatimLocation(data, lat, lng, source, accuracyMeters);
      }
    }
  } catch {
    // Fallback below
  }

  const fallbackZone = matchNearestDeliveryZoneFromRealCoords(lat, lng);
  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    accuracyMeters,
    displayName: `Live GPS Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)}) — ${fallbackZone}`,
    streetOrBuilding: `Pinned GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    areaOrSuburb: fallbackZone,
    cityOrTown: 'Nairobi',
    county: 'Nairobi',
    matchedDeliveryZone: fallbackZone,
    source
  };
}

/**
 * Searches real-world streets, buildings, estates, and towns via OpenStreetMap Nominatim.
 */
export async function searchRealPlaces(
  query: string,
  countryCode: string = 'ke'
): Promise<RealResolvedLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const res = await fetch(
      `/api/location/search?q=${encodeURIComponent(trimmed)}&countrycodes=${encodeURIComponent(countryCode)}`
    );
    if (res.ok) {
      const items = (await res.json()) as NominatimSearchResult[];
      if (Array.isArray(items) && items.length > 0) {
        return items.map(item =>
          parseNominatimLocation(
            item,
            Number(item.lat),
            Number(item.lon),
            'PLACE_SEARCH'
          )
        );
      }
    }
  } catch {
    // Fallback to direct Nominatim search
  }

  try {
    const directUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&addressdetails=1&limit=8&countrycodes=${encodeURIComponent(countryCode)}`;
    const directRes = await fetch(directUrl, {
      headers: { 'Accept-Language': 'en' }
    });
    if (directRes.ok) {
      const items = (await directRes.json()) as NominatimSearchResult[];
      if (Array.isArray(items)) {
        return items.map(item =>
          parseNominatimLocation(
            item,
            Number(item.lat),
            Number(item.lon),
            'PLACE_SEARCH'
          )
        );
      }
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Detects the customer's real-world location using:
 * 1. Primary: Browser High-Accuracy HTML5 Geolocation API + OpenStreetMap Reverse Geocoding
 * 2. Fallback: Live IP Geolocation + OpenStreetMap Reverse Geocoding (if GPS is blocked in iframe)
 */
export async function detectUserRealWorldLocation(): Promise<RealResolvedLocation> {
  const getBrowserPosition = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      });
    });

  try {
    const pos = await getBrowserPosition();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const acc = Math.round(pos.coords.accuracy || 0);
    return await reverseGeocodeRealCoordinates(lat, lng, 'BROWSER_GPS', acc);
  } catch {
    // If browser GPS is blocked by iframe permissions, use live IP geolocation + reverse geocoding
    try {
      const ipRes = await fetch('/api/location/ip');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        const lat = Number(ipData.latitude);
        const lng = Number(ipData.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          return await reverseGeocodeRealCoordinates(lat, lng, 'IP_GEOLOCATION');
        }
      }
    } catch {
      // ignore
    }
    throw new Error('Could not detect real location automatically. Please search your street or estate below.');
  }
}

/**
 * Generates an OpenStreetMap interactive embed URL centered on the real coordinates with a marker pin.
 */
export function buildOpenStreetMapEmbedUrl(lat: number, lng: number, zoomDelta: number = 0.008): string {
  const minLon = (lng - zoomDelta).toFixed(6);
  const minLat = (lat - zoomDelta).toFixed(6);
  const maxLon = (lng + zoomDelta).toFixed(6);
  const maxLat = (lat + zoomDelta).toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}

/**
 * Generates a direct OpenStreetMap full-view link for a real coordinate pin.
 */
export function buildOpenStreetMapDirectUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=17/${lat.toFixed(6)}/${lng.toFixed(6)}`;
}
