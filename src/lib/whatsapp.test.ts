import { describe, expect, it } from "vitest";
import { digitosWhatsapp, urlWhatsapp } from "@/lib/whatsapp";

describe("urlWhatsapp", () => {
  it("abre el chat con un celular argentino ya internacional", () => {
    expect(urlWhatsapp("+54 9 381 654-6467")).toBe("https://wa.me/5493816546467");
  });

  it("agrega 54 9 cuando el número es local de 10 dígitos", () => {
    expect(digitosWhatsapp("381 495-4753")).toBe("5493814954753");
  });

  it("inserta el 9 móvil si falta en el código de país", () => {
    expect(digitosWhatsapp("+54 381 654-6467")).toBe("5493816546467");
  });

  it("saca el 15 y el 0 de un celular discado en formato nacional", () => {
    expect(digitosWhatsapp("0381 15 654-6467")).toBe("5493816546467");
    expect(digitosWhatsapp("011 15 1234-5678")).toBe("5491112345678");
  });

  it("no arma enlace si no hay un número usable", () => {
    expect(urlWhatsapp("")).toBeNull();
    expect(urlWhatsapp("sin tel")).toBeNull();
    expect(urlWhatsapp("123")).toBeNull();
  });
});
