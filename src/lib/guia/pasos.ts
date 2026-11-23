import type { WorkspaceTab } from "@/types/workspace";

/**
 * Textos de la guía de uso. Todo lo que dice el recorrido está acá:
 * para corregir una frase no hace falta tocar otra cosa.
 */

export type PasoGuia = {
  /** Selector del elemento a marcar. Sin selector, la burbuja aparece centrada. */
  elemento?: string;
  titulo: string;
  texto: string;
  lado?: "top" | "right" | "bottom" | "left";
  /** Puede no estar en pantalla (p. ej. una tabla vacía): no impide que la guía arranque sola. */
  opcional?: boolean;
};

/** Claves que se guardan en `usuarios.guias_vistas`. */
export const GUIA_BIENVENIDA = "bienvenida";
export const GUIA_GENERAL = "general";
export const guiaModuloClave = (tab: WorkspaceTab) => `modulo:${tab}`;

/** Una frase por módulo del menú lateral, en el orden en que aparecen. */
export const DESCRIPCION_MODULOS: Partial<Record<WorkspaceTab, { titulo: string; texto: string }>> = {
  dashboard: {
    titulo: "Dashboard",
    texto: "El resumen del día: ventas, trabajos en curso y lo que necesita tu atención.",
  },
  planificacion: {
    titulo: "Planificación",
    texto: "La agenda del taller: entregas, mediciones y tareas por día, por equipo o por mes.",
  },
  ventas: {
    titulo: "Presupuestos",
    texto: "Armás las cotizaciones con piedras, bachas y mano de obra. Desde acá se aprueban y pasan a venta.",
  },
  clientes: {
    titulo: "Clientes",
    texto: "Los datos de cada cliente y todo su historial de presupuestos y trabajos.",
  },
  administracion: {
    titulo: "Ventas",
    texto: "Caja y cuentas corrientes: lo cobrado, las señas y el saldo que falta cobrar de cada venta.",
  },
  medicion: {
    titulo: "Medición",
    texto: "Los presupuestos aprobados con seña llegan solos para medir en obra. Con las medidas confirmadas, pasan a producción.",
  },
  produccion: {
    titulo: "Órdenes de Trabajo",
    texto: "Cada trabajo aprobado, paso a paso: corte, producción, instalación y entrega.",
  },
  cantera: {
    titulo: "Cantera",
    texto: "El stock de bloques y material en cantera.",
  },
  stock: {
    titulo: "Stock",
    texto: "Placas, productos, bachas, pedazos y listas de precio del taller.",
  },
  proveedores: {
    titulo: "Proveedores",
    texto: "Tus proveedores y lo que les comprás.",
  },
  comercio_exterior: {
    titulo: "Comercio exterior",
    texto: "El seguimiento de importaciones (del pedido al depósito, con sus costos y papeles) y de exportaciones (hasta cobrarlas).",
  },
  finanzas: {
    titulo: "Finanzas",
    texto: "Movimientos, disponibilidad, gastos fijos, comisiones y flujo de caja.",
  },
  equipo: {
    titulo: "Equipo",
    texto: "Tus empleados: fichas, sueldos quincenales, adelantos, incentivos y vacaciones.",
  },
  reportes: {
    titulo: "Reportes",
    texto: "Números del negocio para ver cómo viene el mes y comparar.",
  },
  configuracion: {
    titulo: "Configuración",
    texto: "Quién ve qué (usuarios y permisos), los datos de la empresa que salen en los documentos y el dólar del día.",
  },
};

export function pasosRecorridoGeneral(nombre: string): PasoGuia[] {
  const modulos: PasoGuia[] = Object.entries(DESCRIPCION_MODULOS).map(([id, d]) => ({
    elemento: `[data-guia="nav-${id}"]`,
    titulo: d!.titulo,
    texto: d!.texto,
    lado: "right",
  }));
  return [
    {
      titulo: `¡Arrancamos, ${nombre}!`,
      texto: "Te vamos a mostrar dónde está cada cosa. Podés avanzar con las flechas del teclado y salir cuando quieras.",
    },
    {
      elemento: '[data-guia="nav"]',
      titulo: "El menú",
      texto: "Todos los módulos de la aplicación están acá. Pasando el mouse se despliega con los nombres.",
      lado: "right",
    },
    ...modulos,
    {
      elemento: '[data-guia="usuario"]',
      titulo: "Tu usuario",
      texto: "Con qué cuenta entraste y qué rol tenés.",
      lado: "right",
    },
    {
      elemento: '[data-guia="ayuda"]',
      titulo: "Volver a ver la guía",
      texto: "Si te olvidás de algo, desde acá repetís este recorrido o la guía de la pantalla en la que estés.",
      lado: "right",
    },
    {
      titulo: "¡Listo!",
      texto: "La primera vez que entres a cada módulo te vamos a mostrar sus botones principales, en pocos pasos.",
    },
  ];
}

const titulo = (t: string, texto: string): PasoGuia => ({
  elemento: '[data-guia="modulo-titulo"]',
  titulo: t,
  texto,
  lado: "bottom",
});

/** Mini-guías: aparecen la primera vez que se entra a cada módulo. */
export const GUIAS_MODULO: Partial<Record<WorkspaceTab, PasoGuia[]>> = {
  dashboard: [
    {
      elemento: '[data-guia="dashboard-saludo"]',
      titulo: "Tu resumen",
      texto: "Lo primero que ves al entrar: cómo viene el día.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="dashboard-accesos"]',
      titulo: "Accesos rápidos",
      texto: "Lo que más se usa, a un click: nuevo presupuesto, presupuestos dormidos, cobros y stock.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="dashboard-operacion"]',
      titulo: "Operación",
      texto: "Los números que importan hoy. Tocando cada tarjeta vas directo a ese listado.",
      lado: "top",
    },
  ],
  planificacion: [
    titulo("Planificación", "La agenda del taller: entregas, mediciones y tareas."),
    {
      elemento: '[aria-label="Qué mostrar"]',
      titulo: "Qué ver",
      texto: "Filtrá para ver todo junto, solo entregas o solo mediciones.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="accion-principal"]',
      titulo: "Nueva tarea",
      texto: "Agendá cualquier tarea que no sea una entrega o una medición.",
      lado: "bottom",
    },
    {
      elemento: '[aria-label="Vista"]',
      titulo: "Días, Equipos o Mes",
      texto: "Cambiá cómo se ve la agenda: por días, por equipo de trabajo o el mes completo.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="planificacion-cola"]',
      titulo: "Por agendar",
      texto: "Lo que todavía no tiene fecha. Arrastralo a un día para agendarlo.",
      lado: "right",
      opcional: true,
    },
  ],
  ventas: [
    titulo(
      "Presupuestos",
      "Todas tus cotizaciones. En el menú, dentro de Presupuestos, tenés Nuevo, Todos, Aprobados y Dormidos.",
    ),
    {
      elemento: '[data-guia="buscar"]',
      titulo: "Buscar y filtrar",
      texto: "Por número, cliente o teléfono. Al lado podés filtrar por vendedor, cliente o fecha, y ordenar.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="lista"]',
      titulo: "Cada presupuesto",
      texto: "Tocando uno ves el resumen. Desde ahí lo editás, lo aprobás con la seña o lo rechazás.",
      lado: "top",
      opcional: true,
    },
  ],
  clientes: [
    titulo("Clientes", "Tu cartera de clientes."),
    {
      elemento: '[data-guia="buscar"]',
      titulo: "Buscar",
      texto: "Por nombre, contacto o teléfono, con filtros por vendedor.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="accion-principal"]',
      titulo: "Nuevo cliente",
      texto: "Cargás sus datos una vez y después lo elegís al presupuestar.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="lista"]',
      titulo: "La ficha del cliente",
      texto: "Tocando uno ves sus datos y todo su historial.",
      lado: "top",
      opcional: true,
    },
  ],
  administracion: [
    titulo("Ventas", "La caja y las cuentas corrientes de cada venta aprobada."),
    {
      elemento: '[data-guia="exportar"]',
      titulo: "Exportar",
      texto: "Bajá el listado en Excel o PDF, o imprimilo.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="buscar"]',
      titulo: "Buscar",
      texto: "Por obra, cliente o etapa, con filtros por vendedor y fecha.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="lista"]',
      titulo: "Cobros",
      texto: "Cada venta con lo cobrado y lo que falta. Tocala para registrar un cobro.",
      lado: "top",
      opcional: true,
    },
  ],
  medicion: [
    titulo(
      "Medición",
      "Acá llegan solos los trabajos para medir en obra. No hace falta cargarlos: vienen de Presupuestos.",
    ),
    {
      elemento: '[data-guia="medicion-para-medir"]',
      titulo: "Para medir",
      texto:
        "Cuando un presupuesto se aprueba y el cliente deja la seña, la obra aparece acá, agrupada por semana. Tocala para ver los datos de la obra y cargar las medidas reales.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="medicion-conformidad"]',
      titulo: "Esperando conformidad",
      texto:
        "Si al medir cambia el importe, la obra queda acá esperando al vendedor: él lo confirma con el cliente desde Presupuestos y, cuando acepta, pasa a producción.",
      lado: "bottom",
      opcional: true,
    },
    {
      elemento: '[data-guia="medicion-confirmadas"]',
      titulo: "Confirmadas",
      texto:
        "Con las medidas confirmadas (y el precio aceptado, si cambió), el trabajo pasa solo a Órdenes de Trabajo para cortar. Acá queda el historial.",
      lado: "top",
    },
  ],
  produccion: [
    titulo("Órdenes de Trabajo", "Cada trabajo aprobado y medido, desde el corte hasta la entrega."),
    {
      elemento: '[data-guia="produccion-etapas"]',
      titulo: "Etapas",
      texto:
        "Cuántas órdenes hay en cada etapa. Tocá una tarjeta para ver solo esas. También están en el menú, dentro de Órdenes de Trabajo.",
      lado: "bottom",
    },
  ],
  cantera: [
    titulo("Cantera", "El material que entra de cantera y lo que se procesa."),
    {
      elemento: '[data-guia="accion-principal"]',
      titulo: "Nuevo ingreso",
      texto: "Registrá un lote que llega de cantera.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="cantera-procesar"]',
      titulo: "Procesar",
      texto: "Descontá los kg que se consumen y elegí del listado los productos que salieron: adoquines, lajas, granzas…",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="cantera-kpis"]',
      titulo: "Totales",
      texto: "Lo ingresado, lo procesado y lo que queda disponible.",
      lado: "bottom",
    },
  ],
  stock: [
    titulo("Stock", "Todo el material del taller, ordenado en secciones."),
    {
      elemento: '[data-guia="accion-principal"]',
      titulo: "Ingreso por remito",
      texto: "Cuando llegan placas, las cargás desde el remito del proveedor y se suman solas al stock.",
      lado: "bottom",
      opcional: true,
    },
    {
      elemento: '[data-guia="stock-exportar"]',
      titulo: "Exportar",
      texto: "Bajá el stock de placas en una planilla (CSV) para abrir en Excel.",
      lado: "bottom",
      opcional: true,
    },
    {
      elemento: '[data-guia="stock-mas"]',
      titulo: "Más opciones",
      texto: "El historial de remitos cargados, los nombres de materiales y la carga de recortes que quedan de un corte.",
      lado: "bottom",
      opcional: true,
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-placas"]',
      titulo: "Placas",
      texto: "Las placas en stock agrupadas por material. Buscá un material y tocalo para ver cada placa con sus medidas.",
      lado: "bottom",
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-productos"]',
      titulo: "Productos",
      texto: "Lo que se maneja por unidades o metros: adoquines, lajas, granzas y demás productos. Tocá uno para ver cuánto hay disponible.",
      lado: "bottom",
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-bloqueados"]',
      titulo: "Pedazos bloqueados",
      texto: "Placas o pedazos que se rompieron y quedaron apartados de un trabajo. Desde acá los reemplazás por otra placa.",
      lado: "bottom",
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-bachas"]',
      titulo: "Bachas",
      texto: "El inventario de bachas: las del taller y las que trae cada cliente para su obra.",
      lado: "bottom",
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-listas"]',
      titulo: "Listas de precio",
      texto: "El precio de cada material y producto. Es lo que toma el presupuesto al cotizar.",
      lado: "bottom",
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-trabajos"]',
      titulo: "Trabajos",
      texto: "La mano de obra con su precio: cortes, pulidos, colocación… Se suman al presupuesto junto con el material.",
      lado: "bottom",
    },
  ],
  proveedores: [
    titulo("Proveedores", "Tus proveedores de material y servicios."),
    {
      elemento: '[data-guia="buscar"]',
      titulo: "Buscar",
      texto: "Por nombre, CUIT o localidad. Al lado filtrás por rubro.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="accion-principal"]',
      titulo: "Nuevo proveedor",
      texto: "Cargás sus datos de contacto y rubro.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="lista"]',
      titulo: "Ficha del proveedor",
      texto: "Tocando uno ves y editás sus datos.",
      lado: "top",
      opcional: true,
    },
  ],
  comercio_exterior: [
    titulo(
      "Comercio exterior",
      "El seguimiento de lo que se compra afuera (importaciones) y lo que se vende afuera (exportaciones), desde el pedido hasta que llega o se cobra.",
    ),
    {
      elemento: '[role="tab"][aria-controls$="-content-importaciones"]',
      titulo: "Importaciones",
      texto: "Cada compra al exterior: mercadería, proveedor, país y en qué etapa está.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="comex-resumen"]',
      titulo: "De un vistazo",
      texto:
        "Cuántas importaciones están en curso, cuáles están demoradas (pasó la fecha estimada y todavía no llegaron) y cuándo es la próxima llegada. Tocá una tarjeta para filtrar.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="comex-estado"]',
      titulo: "Etapas",
      texto:
        "Cada importación avanza por: Orden de compra → Embarque → En tránsito → En aduana → Nacionalizada → En depósito. Filtrá por etapa desde acá.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="accion-principal"]',
      titulo: "Nueva importación",
      texto:
        "Cargás la mercadería, el proveedor, el monto en dólares, el medio de transporte y las fechas. Lo que falte se completa a medida que avanza.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="lista"]',
      titulo: "La ficha de cada importación",
      texto:
        "Tocando una entrás a su ficha: los costos (mercadería, flete, seguro, impuestos, despachante) para saber cuánto cuesta puesta acá, los documentos (factura, BL, packing list, despacho) y el ingreso al stock cuando llega.",
      lado: "top",
      opcional: true,
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-exportaciones"]',
      titulo: "Exportaciones",
      texto:
        "Lo que se vende al exterior, con su cliente y factura. Avanza por: Pedido → Facturada → Embarcada → Cobrada.",
      lado: "bottom",
    },
  ],
  finanzas: [
    titulo("Finanzas", "La plata de la empresa."),
    {
      elemento: '[data-guia="pestanas"]',
      titulo: "Secciones",
      texto:
        "Resumen, movimientos, cuentas con proveedores, disponibilidad, comisiones, flujo de caja y gastos fijos.",
      lado: "bottom",
    },
  ],
  reportes: [
    {
      elemento: '[data-guia="buscar"]',
      titulo: "Buscar",
      texto: "Encontrá cualquier presupuesto u obra por número, obra o cliente.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="reportes-resumen"]',
      titulo: "Reportes en vivo",
      texto:
        "Los números del negocio se actualizan solos. Más abajo: conversión, tiempos por etapa y materiales más usados.",
      lado: "bottom",
    },
  ],
  configuracion: [
    titulo("Configuración", "Lo que define cómo funciona la aplicación para todos. Solo lo cambia un administrador."),
    {
      elemento: '[role="tab"][aria-controls$="-content-usuarios"]',
      titulo: "Usuarios y permisos",
      texto:
        "Cada persona que entra a la app. Tocando una elegís sus roles (vendedor, medidor, producción…), que definen qué módulos le aparecen, o la hacés administradora.",
      lado: "bottom",
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-empresa"]',
      titulo: "Datos de la empresa",
      texto: "Razón social, CUIT, dirección y contacto. Salen solos en el presupuesto y en el comprobante de cobros.",
      lado: "bottom",
    },
    {
      elemento: '[role="tab"][aria-controls$="-content-cotizacion"]',
      titulo: "Cotización",
      texto: "El dólar del día. Todos los presupuestos nuevos arrancan con este valor; conviene actualizarlo cada mañana.",
      lado: "bottom",
    },
  ],
  equipo: [
    {
      elemento: '[data-guia="modulo-titulo"]',
      titulo: "Equipo",
      texto: "Acá manejás todo lo de tu gente. En el menú, dentro de Equipo, están Empleados, Sueldos, Adelantos, Incentivos y No empleados.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="equipo-buscar"]',
      titulo: "Buscar",
      texto: "Encontrá a alguien por nombre, DNI o puesto.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="equipo-nuevo"]',
      titulo: "Nuevo empleado",
      texto: "Cargás sus datos y el sueldo base. Con eso, su sueldo de cada mes se arma solo.",
      lado: "bottom",
    },
    {
      elemento: '[data-guia="equipo-tabla"]',
      titulo: "La ficha de cada empleado",
      texto: "Tocando una fila abrís su ficha: adelantos, sueldos y pagos, vacaciones y documentos del legajo.",
      lado: "top",
      opcional: true,
    },
  ],
};
