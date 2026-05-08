export type ClientePresupuestoMock = {
  id: string;
  nombre: string;
  contacto: string;
  tel: string;
  email: string;
  direccion: string;
};

/** Origen de la venta / contacto (obligatorio en sistema referencia). */
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

export const CLIENTES_PRESUPUESTO_MOCK: ClientePresupuestoMock[] = [
  {
    id: "cli-andreina",
    nombre: "Andreína López",
    contacto: "Arq. Andreína López",
    tel: "11 5566-7788",
    email: "andreina@ejemplo.com",
    direccion: "Av. Santa Fe 3200, CABA",
  },
  {
    id: "cli-marmol",
    nombre: "Mármoles del Sur S.A.",
    contacto: "Carlos Méndez",
    tel: "0345 412-3000",
    email: "compras@marmolesdelsur.com",
    direccion: "Ruta 9 km 45, Rosario",
  },
  {
    id: "cli-ferreteria",
    nombre: "Ferretería Industrial Norte",
    contacto: "Laura Paz",
    tel: "381 422-8899",
    email: "ventas@finorte.com.ar",
    direccion: "Mitre 1200, San Miguel de Tucumán",
  },
];
