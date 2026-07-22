/** Origen de la venta / contacto (selector del wizard). */
export const ORIGEN_VENTA_OPCIONES = [
  { value: "", label: "Elegir origen…" },
  { value: "redes", label: "Redes sociales" },
  { value: "cliente-frecuente", label: "Cliente frecuente" },
  { value: "online", label: "Online / web" },
  { value: "recomendacion", label: "Recomendación" },
  { value: "pasacalle", label: "Pasacalle / showroom" },
  { value: "profesional", label: "Profesional / obra" },
  { value: "otro", label: "Otro" },
] as const;
