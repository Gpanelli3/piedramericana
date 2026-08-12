export type GeocodeObraResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export type GeocodeObraError = {
  message: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "PiedraAmericanaPresupuesto/1.0 (obra-geocode)";

/** Extrae lat/lng de URLs típicas de Google Maps / Maps. */
export function parseCoordsFromMapsUrl(input: string): GeocodeObraResult | null {
  const text = input.trim();
  if (!text) return null;

  // .../@-32.9397,-68.8252,17z
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, displayName: `${lat}, ${lng}` };
    }
  }

  // ?q=-32.9397,-68.8252  or  ?query=...
  try {
    const url = new URL(text);
    const q = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    const qMatch = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (qMatch) {
      const lat = Number(qMatch[1]);
      const lng = Number(qMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, displayName: `${lat}, ${lng}` };
      }
    }
    // /maps/place/.../data=...!3dLAT!4dLNG
    const dataMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (dataMatch) {
      const lat = Number(dataMatch[1]);
      const lng = Number(dataMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, displayName: `${lat}, ${lng}` };
      }
    }
  } catch {
    // no es URL válida; seguir con Nominatim
  }

  return null;
}

export function mapsUrlForCoords(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Geocodifica dirección de obra: primero intenta coords en URL de Maps,
 * si no, Nominatim (OSM).
 */
export async function geocodeObra(
  query: string,
): Promise<{ data: GeocodeObraResult | null; error: GeocodeObraError | null }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { data: null, error: { message: "Ingresá una dirección o un link de Maps." } };
  }

  const fromUrl = parseCoordsFromMapsUrl(trimmed);
  if (fromUrl) {
    return { data: fromUrl, error: null };
  }

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", trimmed);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });

    if (!res.ok) {
      return {
        data: null,
        error: { message: "No se pudo geocodificar la dirección. Probá de nuevo." },
      };
    }

    const json = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;

    const first = json[0];
    if (!first?.lat || !first?.lon) {
      return {
        data: null,
        error: { message: "No encontramos esa dirección. Probá ser más específico." },
      };
    }

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        data: null,
        error: { message: "La respuesta de geocode no es válida." },
      };
    }

    return {
      data: {
        lat,
        lng,
        displayName: first.display_name?.trim() || `${lat}, ${lng}`,
      },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: { message: "Error de red al buscar la dirección." },
    };
  }
}
