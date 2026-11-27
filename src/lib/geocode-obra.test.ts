import { describe, expect, it } from "vitest";
import {
  esLinkCortoMaps,
  nombreLugarDesdeLink,
  parseCoordsFromMapsUrl,
  pareceLinkOCoordenadas,
} from "@/lib/geocode-obra";
import { normalizeOrdenesFromPayload } from "@/lib/presupuesto-payload-normalize";

describe("parseCoordsFromMapsUrl", () => {
  it("lee @lat,lng de URL de Maps", () => {
    const r = parseCoordsFromMapsUrl(
      "https://www.google.com/maps/place/Foo/@-32.9397,-68.8252,17z",
    );
    expect(r?.lat).toBeCloseTo(-32.9397, 4);
    expect(r?.lng).toBeCloseTo(-68.8252, 4);
  });

  it("lee q=lat,lng", () => {
    const r = parseCoordsFromMapsUrl("https://maps.google.com/?q=-32.9,-68.8");
    expect(r?.lat).toBeCloseTo(-32.9, 4);
    expect(r?.lng).toBeCloseTo(-68.8, 4);
  });

  it("devuelve null si no hay coords", () => {
    expect(parseCoordsFromMapsUrl("Rodriguez Peña, Godoy Cruz")).toBeNull();
    expect(parseCoordsFromMapsUrl("lugones 232")).toBeNull();
  });

  it("lee coordenadas sueltas", () => {
    const r = parseCoordsFromMapsUrl("-34.6160178, -68.3399915");
    expect(r?.lat).toBeCloseTo(-34.616, 3);
    expect(r?.lng).toBeCloseTo(-68.34, 3);
    expect(parseCoordsFromMapsUrl("-34.616 -68.34")?.lng).toBeCloseTo(-68.34, 3);
  });

  it("lee coords de /maps/search/ y de ll=", () => {
    expect(
      parseCoordsFromMapsUrl("https://www.google.com/maps/search/-34.616,+-68.34?entry=tts")?.lat,
    ).toBeCloseTo(-34.616, 3);
    expect(parseCoordsFromMapsUrl("https://maps.google.com/?ll=-34.6,-68.3")?.lng).toBeCloseTo(
      -68.3,
      3,
    );
  });

  it("en links de lugar usa el pin exacto y no el centro del mapa", () => {
    const link =
      "https://www.google.com/maps/place/Lugones+232,+M5600+San+Rafael,+Mendoza/@-34.6126,-68.3305,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-34.6160178!4d-68.3399915";
    const r = parseCoordsFromMapsUrl(link);
    expect(r?.lat).toBeCloseTo(-34.616, 3);
    expect(r?.lng).toBeCloseTo(-68.34, 3);
    expect(nombreLugarDesdeLink(link)).toBe("Lugones 232, M5600 San Rafael, Mendoza");
    expect(nombreLugarDesdeLink("https://www.google.com/maps/@-34.6,-68.3,15z")).toBeNull();
  });

  it("detecta links cortos y links/coords pegados", () => {
    expect(esLinkCortoMaps("https://maps.app.goo.gl/AbC123")).toBe(true);
    expect(esLinkCortoMaps("https://www.google.com/maps/@-34,-68,17z")).toBe(false);
    expect(pareceLinkOCoordenadas("https://maps.app.goo.gl/AbC123")).toBe(true);
    expect(pareceLinkOCoordenadas("-34.6, -68.3")).toBe(true);
    expect(pareceLinkOCoordenadas("San Martín 1450, Godoy Cruz")).toBe(false);
  });
});

describe("normalizeOrdenesFromPayload obra fields", () => {
  it("rellena defaults en OTs viejas sin campos de obra", () => {
    const [ot] = normalizeOrdenesFromPayload([
      {
        key: "ot1",
        titulo: "Cocina",
        items: [],
      },
    ]);
    expect(ot?.direccionObra).toBe("");
    expect(ot?.obraLat).toBeNull();
    expect(ot?.obraLng).toBeNull();
    expect(ot?.obraFormattedAddress).toBe("");
    expect(ot?.referenciaObra).toBe("");
    expect(ot?.planoAdjunto).toBeNull();
  });

  it("hidrata planoAdjunto válido", () => {
    const [ot] = normalizeOrdenesFromPayload([
      {
        key: "ot1",
        titulo: "Cocina",
        direccionObra: "Calle 1",
        obraLat: -32.9,
        obraLng: -68.8,
        obraFormattedAddress: "Calle 1, Mendoza",
        referenciaObra: "Lote 2",
        planoAdjunto: {
          name: "plano.pdf",
          mime: "application/pdf",
          storagePath: "planos/ot1/1-plano.pdf",
          size: 1000,
        },
        items: [],
      },
    ]);
    expect(ot?.direccionObra).toBe("Calle 1");
    expect(ot?.obraLat).toBe(-32.9);
    expect(ot?.referenciaObra).toBe("Lote 2");
    expect(ot?.planoAdjunto?.name).toBe("plano.pdf");
  });
});
