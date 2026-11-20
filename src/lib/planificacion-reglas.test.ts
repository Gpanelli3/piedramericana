import { describe, expect, it } from "vitest";
import {
  avisoPromesa,
  claveDia,
  compararEventosDelDia,
  contarEntregasSinMarcar,
  esSinMarcar,
  horaHastaPorDefecto,
  motivoNoTildarEntrega,
  promesaVencida,
  puedeTildarEntrega,
  tipoEntregaDesdePayload,
  tipoEntregaDesdeServicios,
  validarHorario,
} from "@/lib/planificacion-reglas";

describe("tipoEntregaDesdeServicios", () => {
  it("colocación gana sobre entrega", () => {
    expect(tipoEntregaDesdeServicios({ mEntrega: true, mColocacion: true })).toBe("colocacion");
  });
  it("solo entrega = logística", () => {
    expect(tipoEntregaDesdeServicios({ mEntrega: true, mColocacion: false })).toBe("logistica");
  });
  it("sin servicios = retira en fábrica", () => {
    expect(tipoEntregaDesdeServicios({})).toBe("retira");
  });
});

describe("tipoEntregaDesdePayload", () => {
  it("lee los flags globales del presupuesto", () => {
    expect(tipoEntregaDesdePayload({ mEntregaGlobal: true, mColocacionGlobal: false })).toBe(
      "logistica",
    );
    expect(tipoEntregaDesdePayload({ mColocacionGlobal: true })).toBe("colocacion");
  });
  it("tolera payloads vacíos o raros", () => {
    expect(tipoEntregaDesdePayload(null)).toBe("retira");
    expect(tipoEntregaDesdePayload([])).toBe("retira");
    expect(tipoEntregaDesdePayload({ mEntregaGlobal: "true" })).toBe("retira");
  });
});

describe("validarHorario", () => {
  it("sin inicio es 'Sin hora'", () => {
    expect(validarHorario("", "11:00")).toEqual({ ok: true, horaDesde: null, horaHasta: null });
  });
  it("normaliza HH:MM:SS", () => {
    expect(validarHorario("9:00:00", "11:30:00")).toEqual({
      ok: true,
      horaDesde: "09:00",
      horaHasta: "11:30",
    });
  });
  it("rechaza fin anterior o igual al inicio", () => {
    expect(validarHorario("11:00", "11:00").ok).toBe(false);
    expect(validarHorario("11:00", "10:00").ok).toBe(false);
  });
  it("rechaza horas inválidas", () => {
    expect(validarHorario("25:00", null).ok).toBe(false);
    expect(validarHorario("10:00", "10:99").ok).toBe(false);
  });
});

describe("horaHastaPorDefecto", () => {
  it("suma 2 h a una entrega y 1 h a una medición", () => {
    expect(horaHastaPorDefecto("09:00", "entrega")).toBe("11:00");
    expect(horaHastaPorDefecto("09:30", "medicion")).toBe("10:30");
  });
  it("no pasa de las 23:59", () => {
    expect(horaHastaPorDefecto("23:00", "entrega")).toBe("23:59");
  });
});

describe("motivoNoTildarEntrega", () => {
  const base = { estado: "pending", etapa: "despacho", bloqueada: false, pausada: false };
  it("permite tildar una OT en despacho", () => {
    expect(puedeTildarEntrega(base)).toBe(true);
  });
  it("no deja tildar si sigue en taller", () => {
    expect(motivoNoTildarEntrega({ ...base, etapa: "produccion" })).toBe("Sigue en producción.");
    expect(motivoNoTildarEntrega({ ...base, etapa: "corte" })).toBe("Sigue en corte.");
  });
  it("no deja tildar bloqueadas, pausadas o ya entregadas", () => {
    expect(puedeTildarEntrega({ ...base, bloqueada: true })).toBe(false);
    expect(puedeTildarEntrega({ ...base, pausada: true })).toBe(false);
    expect(puedeTildarEntrega({ ...base, estado: "done" })).toBe(false);
  });
});

describe("entregas sin marcar", () => {
  const hoy = "2026-11-20";
  it("cuenta solo entregas pendientes de días pasados", () => {
    const eventos = [
      { tipo: "entrega", estado: "pendiente", fecha: "2026-11-19" },
      { tipo: "entrega", estado: "hecho", fecha: "2026-11-18" },
      { tipo: "entrega", estado: "pendiente", fecha: "2026-11-20" },
      { tipo: "tarea", estado: "pendiente", fecha: "2026-11-10" },
      { tipo: "entrega", estado: "cancelado", fecha: "2026-11-10" },
    ];
    expect(contarEntregasSinMarcar(eventos, hoy)).toBe(1);
  });
  it("hoy todavía no cuenta como sin marcar", () => {
    expect(esSinMarcar({ estado: "pendiente", fecha: hoy }, hoy)).toBe(false);
  });
});

describe("promesaVencida", () => {
  const hoy = "2026-11-20";
  it("agendada después de lo prometido", () => {
    expect(
      promesaVencida({ fechaPrometida: "2026-11-21T12:00:00Z", fechaAgendada: "2026-11-22", hoy }),
    ).toBe(true);
  });
  it("agendada a tiempo aunque la promesa sea hoy", () => {
    expect(promesaVencida({ fechaPrometida: "2026-11-20", fechaAgendada: "2026-11-20", hoy })).toBe(
      false,
    );
  });
  it("sin agendar y la promesa ya pasó", () => {
    expect(promesaVencida({ fechaPrometida: "2026-11-09", fechaAgendada: null, hoy })).toBe(true);
  });
  it("sin fecha prometida nunca vence", () => {
    expect(promesaVencida({ fechaPrometida: null, fechaAgendada: "2026-12-01", hoy })).toBe(false);
  });
});

describe("avisoPromesa", () => {
  const hoy = "2026-11-20";
  it("pide terminar si sigue en taller", () => {
    expect(avisoPromesa({ fechaPrometida: "2026-11-09", etapa: "produccion", hoy })).toBe(
      "(terminar) · se entregaba el 9/11",
    );
  });
  it("sin prefijo si ya está en despacho", () => {
    expect(avisoPromesa({ fechaPrometida: "2026-11-12T12:00:00.000Z", etapa: "despacho", hoy })).toBe(
      "se entregaba el 12/11",
    );
  });
  it("nada si la promesa es hoy o futura", () => {
    expect(avisoPromesa({ fechaPrometida: hoy, etapa: "corte", hoy })).toBeNull();
  });
});

describe("compararEventosDelDia", () => {
  it("sin hora primero, después por horario", () => {
    const evs = [
      { hora_desde: "11:00:00" },
      { hora_desde: null },
      { hora_desde: "09:00:00" },
    ];
    expect(evs.sort(compararEventosDelDia).map((e) => e.hora_desde)).toEqual([
      null,
      "09:00:00",
      "11:00:00",
    ]);
  });
});

describe("claveDia", () => {
  it("usa la fecha local", () => {
    expect(claveDia(new Date(2026, 10, 3, 23, 30))).toBe("2026-11-03");
  });
});
