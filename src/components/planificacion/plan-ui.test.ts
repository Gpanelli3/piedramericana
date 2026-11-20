import { describe, expect, it } from "vitest";
import {
  HORA_INICIO,
  PX_POR_HORA,
  columnasSolapadas,
  horaDesdeOffset,
  posicionEvento,
} from "@/components/planificacion/plan-ui";

describe("horaDesdeOffset", () => {
  it("redondea a la media hora", () => {
    expect(horaDesdeOffset((9 - HORA_INICIO) * PX_POR_HORA + 10)).toBe("09:00");
    expect(horaDesdeOffset((9 - HORA_INICIO) * PX_POR_HORA + PX_POR_HORA * 0.4)).toBe("09:30");
  });
  it("no se sale de la grilla", () => {
    expect(horaDesdeOffset(-50)).toBe(`${String(HORA_INICIO).padStart(2, "0")}:00`);
    expect(horaDesdeOffset(99_999)).toBe("19:30");
  });
});

describe("posicionEvento", () => {
  it("ubica y dimensiona según el horario", () => {
    expect(posicionEvento("09:00:00", "11:00:00")).toEqual({
      top: (9 - HORA_INICIO) * PX_POR_HORA,
      height: 2 * PX_POR_HORA,
    });
  });
  it("sin fin dura una hora", () => {
    expect(posicionEvento("10:00", null).height).toBe(PX_POR_HORA);
  });
});

describe("columnasSolapadas", () => {
  const ev = (id: string, d: string, h: string) => ({ id, hora_desde: d, hora_hasta: h });

  it("eventos separados ocupan todo el ancho", () => {
    const r = columnasSolapadas([ev("a", "09:00", "10:00"), ev("b", "10:00", "11:00")]);
    expect(r.get("a")).toEqual({ col: 0, cols: 1 });
    expect(r.get("b")).toEqual({ col: 0, cols: 1 });
  });

  it("dos que se pisan se reparten el ancho", () => {
    const r = columnasSolapadas([ev("a", "09:00", "11:00"), ev("b", "10:00", "12:00")]);
    expect(r.get("a")).toEqual({ col: 0, cols: 2 });
    expect(r.get("b")).toEqual({ col: 1, cols: 2 });
  });

  it("reutiliza la columna que se libera dentro del grupo", () => {
    const r = columnasSolapadas([
      ev("a", "09:00", "12:00"),
      ev("b", "09:00", "10:00"),
      ev("c", "10:00", "11:00"),
    ]);
    expect(r.get("b")?.col).toBe(r.get("c")?.col);
    expect(r.get("a")?.cols).toBe(2);
  });
});
