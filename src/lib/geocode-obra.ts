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

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

function coordsValidas(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Links cortos de Google Maps: no traen la ubicación en el texto. */
export function esLinkCortoMaps(input: string): boolean {
  return /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(input.trim());
}

/** ¿Lo pegado parece un link de mapas o coordenadas (y no una dirección escrita)? */
export function pareceLinkOCoordenadas(input: string): boolean {
  const t = input.trim();
  return /^https?:\/\//i.test(t) || parseCoordsFromMapsUrl(t) !== null;
}

function resultado(lat: number, lng: number): GeocodeObraResult | null {
  return coordsValidas(lat, lng) ? { lat, lng, displayName: `${lat}, ${lng}` } : null;
}

/**
 * Nombre del lugar en un link de Google Maps (/maps/place/NOMBRE/...), que
 * suele ser la dirección: "Lugones 232, M5600 San Rafael, Mendoza".
 */
export function nombreLugarDesdeLink(input: string): string | null {
  const m = input.trim().match(/\/maps\/place\/([^/@?]+)/);
  if (!m) return null;
  let nombre: string;
  try {
    nombre = decodeURIComponent(m[1]!.replace(/\+/g, " ")).trim();
  } catch {
    return null;
  }
  if (!nombre || /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(nombre)) return null;
  return nombre;
}

/** Extrae lat/lng de URLs típicas de Google Maps / Maps, o de coordenadas sueltas. */
export function parseCoordsFromMapsUrl(input: string): GeocodeObraResult | null {
  const text = input.trim();
  if (!text) return null;

  // Coordenadas sueltas: "-34.6160, -68.3400" o "-34.6160 -68.3400"
  const plano = text.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (plano) return resultado(Number(plano[1]), Number(plano[2]));

  // /maps/search/-34.61,+-68.34  o  /maps/place/-34.61,-68.34
  const enRuta = text.match(/\/(?:search|place|dir)\/(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/);
  if (enRuta) {
    const r = resultado(Number(enRuta[1]), Number(enRuta[2]));
    if (r) return r;
  }

  // Pin exacto del lugar: ...!3dLAT!4dLNG (va antes que @, que es el centro del mapa)
  const pin = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) {
    const r = resultado(Number(pin[1]), Number(pin[2]));
    if (r) return r;
  }

  // ?q=-32.9397,-68.8252  o  ?ll= / ?query= / ?destination=
  try {
    const url = new URL(text);
    const q =
      url.searchParams.get("q") ??
      url.searchParams.get("query") ??
      url.searchParams.get("ll") ??
      url.searchParams.get("destination") ??
      "";
    const qMatch = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (qMatch) {
      const r = resultado(Number(qMatch[1]), Number(qMatch[2]));
      if (r) return r;
    }
  } catch {
    // no es URL válida
  }

  // .../@-32.9397,-68.8252,17z  (centro del mapa: último recurso)
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) return resultado(Number(atMatch[1]), Number(atMatch[2]));

  return null;
}

/**
 * Dirección legible y corta para unas coordenadas ("Lugones 232, San Rafael").
 * Devuelve null si no se pudo resolver; las coordenadas igual sirven.
 */
export async function direccionDesdeCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    const a = json.address ?? {};
    const calle = [a.road ?? a.pedestrian ?? a.footway ?? a.residential, a.house_number]
      .filter(Boolean)
      .join(" ");
    const ciudad = a.city ?? a.town ?? a.village ?? a.county;
    // Sin calle, solo la ciudad no sirve como dirección de obra: usar el
    // comienzo de la dirección completa (número, calle, barrio…).
    if (!calle) {
      const partes = (json.display_name ?? "").split(",").map((p) => p.trim()).filter(Boolean);
      return partes.slice(0, 3).join(", ") || null;
    }
    return [calle, ciudad].filter(Boolean).join(", ");
  } catch {
    return null;
  }
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

  if (esLinkCortoMaps(trimmed)) {
    return {
      data: null,
      error: {
        message:
          "Ese link corto no trae la ubicación. Abrilo en el navegador y copiá el link completo de la barra.",
      },
    };
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
