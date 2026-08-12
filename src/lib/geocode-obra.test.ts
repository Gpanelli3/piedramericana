import { describe, expect, it } from "vitest";
import { parseCoordsFromMapsUrl } from "@/lib/geocode-obra";
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
