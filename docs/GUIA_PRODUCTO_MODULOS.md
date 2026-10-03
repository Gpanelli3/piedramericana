# Guía de producto — MarmoGest (Piedra Americana)

Documento interno de especificación para construir el producto final.
Basado en: estado actual del sistema + lógica de referencia Cero Platform (Yerba Buena) + requerimientos del dueño.

**Regla de diseño:** conservar las vistas/UI propias. Imitar **lógicas y reglas de negocio**, no el look de Cero.

**Cómo usar este documento con un agente**

1. Elegí un módulo (`Mxx`).
2. Pegá al agente: el bloque del módulo completo + la sección «Reglas globales» + el «Flujo maestro».
3. Pedile que implemente solo las funcionalidades marcadas del sprint (por IDs `Mxx.Fy`).
4. Criterio de listo: cumple los «Criterios de aceptación» de cada funcionalidad sin romper el flujo maestro.

**Leyenda de estado**

| Tag | Significado |
|-----|-------------|
| `HECHO` | Ya existe y sirve como base |
| `PARCIAL` | Existe pero falta lógica o cobertura |
| `PENDIENTE` | Hay que construir |
| `LUEGO` | Producto final, pero no bloquea el núcleo |
| `NO` | Fuera de alcance (no copiar de Cero) |

---

## Reglas globales

1. **Un solo hilo de negocio:** Presupuesto → Venta → OT(s) → Producción → Entrega → Cobro.
2. **1 presupuesto aprobado genera 1 venta** y **N órdenes de trabajo** (una por artículo/OT del presupuesto).
3. **Dual moneda:** ARS y USD con tipo de cambio explícito en operaciones relevantes.
4. **Estados con reglas:** no se salta etapa si hay bloqueo (plata, bacha cliente, medidas, etc.).
5. **Trazabilidad:** toda acción importante deja quién / cuándo / desde qué entidad (presupuesto, venta, OT, pago).
6. **UI propia:** no rediseñar a estilo Cero; extender pantallas actuales.
7. **Cantera es diferencial propio:** mantenerla aunque Cero no la tenga igual.
8. **No priorizar:** asistente IA, recepción de stock con IA, liquidación AFIP formal.

---

## Flujo maestro (producto final)

```
Cliente / Lead
    ↓
Presupuesto (borrador → enviado → aprobado | rechazado | dormido)
    ↓ aprobar (+ seña opcional)
Venta (señado → en_medicion → en_produccion → finalizado → entregado)
    ↓ genera
OT × N  [puede nacer BLOQUEADA / Venta retenida]
    ↓
Técnica / Medición (+ planos + m² técnicos)
    ↓ desbloqueo (saldo / reglas)
Producción (corte → armado/producción)
    ↓
Logística / Despacho / Colocación
    ↓
Entregada + cobros hasta saldo 0
```

**Bloqueos típicos de una OT**

- Falta seña / falta saldo (regla de negocio configurable).
- «Bacha del cliente» sin registrar ingreso.
- Medidas no confirmadas.
- Marcada manualmente como bloqueada.
- Reposición / rotura en pausa.

---

## Mapa de módulos

| ID | Módulo | Prioridad producto |
|----|--------|--------------------|
| M01 | Dashboard / día a día | Alta |
| M02 | Clientes | Alta |
| M03 | CRM / seguimiento | Media |
| M04 | Presupuestos | Crítica |
| M05 | Ventas / caja comercial | Crítica |
| M06 | Órdenes de trabajo | Crítica |
| M07 | Vista taller / operario | Alta |
| M08 | Planos y mediciones | Alta |
| M09 | Stock (planchas / retazos) | Crítica |
| M10 | Bachas de clientes | Alta |
| M11 | Cantera | Media (propio) |
| M12 | Artículos y listas de precio | Alta |
| M13 | Materiales (maestro) | Alta |
| M14 | Proveedores y compras simples | Media |
| M15 | Finanzas (cuentas, movimientos, cheques) | Alta |
| M16 | Equipo (empleados, sueldos, adelantos) | Media / luego |
| M17 | Reportes | Media |
| M18 | Auth, roles y configuración | Alta |
| M19 | Búsqueda global y notificaciones | Media |

---

# M01 — Dashboard / día a día

**Para qué existe:** ser el punto de entrada diario: qué urge, qué está vencido, qué cobrar, qué recontactar.

### M01.F1 — KPIs operativos `PARCIAL`
- **Qué:** contadores de OTs activas, urgentes (entrega ≤ N días), vencidas, entregadas del mes.
- **Por qué:** el taller vive por fechas, no por montos.
- **Aceptación:** números reales desde OTs; click lleva al listado filtrado.

### M01.F2 — Presupuestos dormidos `PENDIENTE`
- **Qué:** listado top de presupuestos sin movimiento hace X días (enviados/pendientes).
- **Por qué:** recuperar ventas quietas.
- **Aceptación:** muestra cliente, obra, monto, días dormido; acción «abrir / recontactar».

### M01.F3 — Próximas entregas `PENDIENTE`
- **Qué:** OTs con entrega en los próximos 7 días, con etapa actual.
- **Aceptación:** ordenadas por fecha; link a OT.

### M01.F4 — Avisos / bloqueos `PENDIENTE`
- **Qué:** OTs bloqueadas, ventas sin seña, bachas de cliente pendientes.
- **Aceptación:** lista accionable, no decorativa.

### M01.F5 — Resumen financiero rápido `PARCIAL`
- **Qué:** disponible ARS/USD (cuando exista M15) + accesos a registrar cobro.
- **Aceptación:** no inventar saldos; si finanzas no está, mostrar cobros pendientes de ventas.

---

# M02 — Clientes

**Para qué existe:** maestro único de clientes; no solo un campo dentro del presupuesto.

### M02.F1 — CRUD clientes `PARCIAL`
- **Qué:** alta/edición: nombre, teléfono, email, dirección, notas, origen.
- **Estado hoy:** se crea desde presupuesto.
- **Aceptación:** módulo listable + buscable; presupuesto elige cliente existente.

### M02.F2 — Ficha de cliente `PENDIENTE`
- **Qué:** ver presupuestos, ventas, OTs y saldo asociados.
- **Aceptación:** desde la ficha se navega a cada entidad.

### M02.F3 — Contactos de obra `PARCIAL`
- **Qué:** contacto que recibe la obra (puede diferir del cliente facturable).
- **Aceptación:** presupuesto/venta guardan contacto + teléfono.

---

# M03 — CRM / seguimiento

**Para qué existe:** no perder leads ni presupuestos enviados.

### M03.F1 — Recontactos `PENDIENTE`
- **Qué:** cola de personas/presupuestos a recontactar con fecha y motivo.
- **Aceptación:** estados vencido / pendiente; marcar hecho.

### M03.F2 — Origen de captación `PARCIAL`
- **Qué:** Showroom, WhatsApp, Instagram, Referido, Arquitecto, Otro.
- **Aceptación:** obligatorio o recomendado al crear presupuesto; usable en reportes.

### M03.F3 — Leads vs clientes `LUEGO`
- **Qué:** distinguir lead aún no cliente.
- **Aceptación:** se puede convertir lead → cliente sin duplicar.

---

# M04 — Presupuestos

**Para qué existe:** cotizar obras de marmolería con materiales, piezas, servicios y reglas del rubro.

### M04.F1 — Estados del presupuesto `PARCIAL`
- **Estados producto final:** `borrador` → `enviado` → `aprobado` | `rechazado` | `dormido`.
- **Hoy:** pendiente / aprobado / rechazado.
- **Aceptación:** transiciones claras; «dormido» automático o manual tras X días sin avance.

### M04.F2 — Wizard / carga de presupuesto `HECHO` + mejoras
- **Qué:** cliente, obra, dirección, vendedor, origen, moneda, lista de precio, OTs, ítems, logística/MEC.
- **Aceptación:** guardar borrador; validar datos mínimos antes de enviar.

### M04.F3 — Estructura 1 presupuesto → N OTs → N subítems `HECHO` / `PARCIAL`
- **Qué:** cada OT tiene material + líneas (mesada, zócalo, bacha, perforación, etc.).
- **Aceptación:** al aprobar, se generan N OTs reales de producción.

### M04.F4 — Cálculos de medida y precio `HECHO`
- **Qué:** m² / ML / UNI, desperdicio, descuentos, totales, equivalentes ARS/USD, toneladas estimadas si aplica.
- **Aceptación:** total coherente en pantalla e impresión.

### M04.F5 — MEC (Medición / Envío / Colocación) `PARCIAL`
- **Qué:** servicios togglables; precio global (y exclusión por OT si hace falta).
- **Regla:** el descuento comercial **no come MEC** (como en Cero).
- **Aceptación:** PDF/impresión separa materiales vs servicios MEC.

### M04.F6 — Flags de obra `PENDIENTE`
- **Qué:**
  - `lleva_bacha_cliente` → la OT queda retenida/bloqueada hasta registrar bacha.
  - `piedra_la_pone_cliente` → no cobra material.
- **Aceptación:** el flag persiste a la OT y afecta producción/cobro.

### M04.F7 — Versiones de presupuesto `PENDIENTE`
- **Qué:** V1, V2… al renegociar sin perder historial.
- **Aceptación:** se puede ver versión anterior; la vigente es una sola.

### M04.F8 — Adjunto de cotización `PENDIENTE`
- **Qué:** subir plano/PDF/captura «con qué se cotizó».
- **Aceptación:** archivo asociado al presupuesto; visible después.

### M04.F9 — Modo comparación de materiales `LUEGO`
- **Qué:** variantes lado a lado sin total único, para mostrar opciones al cliente.
- **Aceptación:** no confunde el total del presupuesto formal.

### M04.F10 — Flete por distancia `LUEGO`
- **Qué:** km taller→obra (mapa o manual) para sugerir envío.
- **Aceptación:** se puede override manual.

### M04.F11 — Aprobar / rechazar / enviar `PARCIAL`
- **Qué:** enviar al cliente, aprobar con total y seña, rechazar.
- **Aceptación:** aprobar crea/actualiza venta y dispara generación de OTs según reglas.

### M04.F12 — Impresión / PDF `PARCIAL`
- **Qué:** documento claro: cliente, obra, secciones, MEC, descuentos, totales.
- **Aceptación:** listo para mandar al cliente.

### M04.F13 — Listado, filtros, export `PARCIAL`
- **Qué:** todos / aprobados / dormidos / rechazados; buscar; ordenar; export.
- **Aceptación:** filtros útiles para vendedor.

---

# M05 — Ventas / caja comercial

**Para qué existe:** administrar la venta viva después de aprobar presupuesto: plata, etapas comerciales, vínculo con OTs.

### M05.F1 — Alta de venta desde presupuesto aprobado `HECHO`
- **Aceptación:** no hay venta huérfana sin presupuesto (salvo regla futura explícita).

### M05.F2 — Estados de venta `HECHO` / `PARCIAL`
- **Estados:** `senado` → `en_medicion` → `en_produccion` → `finalizado` → `entregado`.
- **Hoy:** la seña deja la venta en `en_medicion`. Pasa a `en_produccion` cuando el vendedor envía a producción (OT sale de medición a corte).
- **A completar:** mapear «venta retenida» cuando hay bloqueo aunque exista seña.

### M05.F3 — Cobros / seña / saldo `HECHO`
- **Qué:** registrar pagos (`ventas_pagos`), ver cobrado %, saldo.
- **Aceptación:** seña crea venta y OTs; **no** manda a producción. Producción exige seña + medición resuelta + envío del vendedor.

### M05.F4 — KPIs de caja comercial `HECHO` / `PARCIAL`
- **Qué:** ventas aprobadas, por cobrar, sin seña.
- **Aceptación:** click a listados filtrados.

### M05.F5 — Relación venta ↔ N OTs `PARCIAL`
- **Qué:** una venta agrupa todas las OTs del presupuesto.
- **Aceptación:** desde venta se ven OTs; desde OT se ve saldo de la venta.

### M05.F6 — Marcar entregado `HECHO`
- **Aceptación:** solo cuando corresponde operativamente (OTs listas o regla acordada).

---

# M06 — Órdenes de trabajo

**Para qué existe:** unidad real de fabricación y seguimiento en taller.

### M06.F1 — Generación automática desde venta/seña `HECHO`
- **Aceptación:** cada OT del presupuesto vira a `ordenes_trabajo` con material, medidas, cliente.

### M06.F2 — Pipeline de etapas (producto final) `PARCIAL`
Etapas objetivo:

| Etapa | Significado |
|-------|-------------|
| `venta_retenida` | Frenada por regla (plata/bacha/dato) |
| `medicion` | Visita / medidas (módulo Medición, no pestaña de Producción) |
| `produccion` | Fabricación (corte/armado) |
| `logistica` | Despacho / colocación |
| `entregada` | Cerrada |

Hoy: kanban de Producción `corte → produccion → despacho`. La medición es un módulo aparte.

### M06.F3 — Subestados de OT `PARCIAL`
- `activa` | `bloqueada` | `vencida` | `pausada` (rotura/reproceso) | `done` | `cancelled`.
- **Aceptación:** bloqueada no avanza de etapa; nota interna obligatoria al bloquear.

### M06.F4 — Fechas y SLA `PENDIENTE`
- **Qué:** ingreso, fecha compromiso de entrega, días restantes/atraso.
- **Aceptación:** urgentes/vencidas se calculan solos.

### M06.F5 — M² venta / técnico / aprobado `PENDIENTE`
- **Qué:** tres valores de superficie a lo largo del flujo.
- **Aceptación:** se registran en técnica; diferencias visibles.

### M06.F6 — Detalle de OT `PARCIAL`
- **Qué:** ítems de pieza, material, archivos, saldo venta, estado, historial, reposición.
- **Aceptación:** acciones: cambiar etapa, bloquear, marcar reposición.

### M06.F7 — Agrupar por venta `PENDIENTE`
- **Qué:** listado OTs agrupado por venta (como Cero).
- **Aceptación:** expandir venta muestra sus OTs.

### M06.F8 — Rotura / reproceso `HECHO` / `PARCIAL`
- **Qué:** pausar y descontar stock.
- **Mejora:** elegir chapa/lote concreto, no solo match por texto.

### M06.F9 — Reposición `PENDIENTE`
- **Qué:** marcar OT como reposición ligada a OT/venta origen.
- **Aceptación:** no ensucia métricas de venta nueva (o se reporta aparte).

---

# M07 — Vista taller / operario

**Para qué existe:** pantalla simple para el piso: qué cortar / armar / despachar hoy.

### M07.F1 — Cola por etapa `PARCIAL`
- **Qué:** tabs Corte / Armado / Logística / Con problemas, ordenada por entrega.
- **Aceptación:** cuenta por tab; abrir OT en un toque.

### M07.F2 — Avance guiado de etapa `PENDIENTE`
- **Qué:** flujo corto: trabajo → (foto opcional) → listo; confirma y vuelve a la cola.
- **Aceptación:** al terminar corte, pasa a armado (o etapa siguiente definida).

### M07.F3 — Registrar material/lote usado `PENDIENTE`
- **Qué:** búsqueda opcional de material o lote al cortar.
- **Aceptación:** queda trazado en la OT; puede descontar/reservar stock.

### M07.F4 — Problemas / pausas `PARCIAL`
- **Qué:** cola «con problemas» para roturas y bloqueos.
- **Aceptación:** visible para supervisión.

---

# M08 — Planos y mediciones

**Para qué existe:** guardar la verdad técnica de la obra antes/durante fabricar.

### M08.F1 — Confirmar medición `HECHO`
- **Qué:** módulo Medición ligado al presupuesto (`presupuesto_mediciones`).
- **Flujo:** vendedor marca listo para medir (o salta con motivo) → medidor confirma medidas → vendedor envía a producción.
- **Aceptación:** sin medición resuelta + seña + presupuesto aprobado, no se puede pasar a corte. Se puede pedir medición con el presupuesto pendiente.

### M08.F2 — Repositorio de planos por OT/obra `PENDIENTE`
- **Qué:** subir/ver planos, croquis, PDFs, fotos de medida.
- **Aceptación:** versionado simple (fecha + usuario).

### M08.F3 — Notas técnicas `PARCIAL`
- **Qué:** notas de medición visibles en taller.
- **Aceptación:** no las ve el cliente final.

---

# M09 — Stock (planchas / retazos)

**Para qué existe:** saber qué piedra hay, en qué medida, y qué se puede comprometer a OTs.

### M09.F1 — Catálogo + inventario de chapas `HECHO`
- **Qué:** materiales, chapas con medidas, m², estado Disponible/Reservada.
- **Aceptación:** listado usable y filtrable.

### M09.F2 — Remitos de ingreso `HECHO`
- **Qué:** remito proveedor + líneas + alta de chapas en transacción.
- **Aceptación:** no duplicar bultos; historial con detalle.
- **Dos modos de medidas (por línea):**
  - **Medidas iguales** — sintético/estándar (ej. China): cantidad + un L×A → N chapas idénticas.
  - **Medidas distintas** — artesanal/natural del lote: lista de L×A por placa → N chapas con medidas propias.
- **Reglas:** lote obligatorio en ambos modos; origen (`nacional` / `importado` / `cantera` / `otro`) es independiente del modo de medidas.

### M09.F3 — Vista agregada por material `PARCIAL`
- **Qué:** planchas, m² disp., m² retazo, # retazos, costo.
- **Aceptación:** una fila por material con totales reales.

### M09.F4 — Retazos / recortes `PARCIAL` (jul 2026)
- **Hecho:** reingreso desde Stock + alta medible al consumir corte (L×A, lote origen, estado Disponible).
- **Falta:** UI dedicada del cortador en tablet.

### M09.F5 — Reserva / asignación a OT `PARCIAL` (jul 2026)
- **Hecho:** reservar/liberar chapa a OT (`ot_reserva_id`), alerta mezcla de lotes, consumo → `Usada`, rotura → `Baja` con motivo.
- **Hecho:** al pasar a producción → `requiere_reserva_stock` + sugerencia de chapas por material/lote (confirmación humana).
- **Hecho:** historial de movimientos por OT + placas en ficha de cobros/venta.
- **Hecho:** lote obligatorio en remitos nuevos + origen nacional/importado/cantera/otro.

### M09.F6 — Carga manual de planchas `PENDIENTE` / fuera de sprint jul 2026
- Default: ingreso vía remito. Alta sin remito queda para después.

### M09.F7 — Piedras a pedir `PENDIENTE`
- **Qué:** demanda comprometida por OTs activas vs stock disponible.
- **Aceptación:** lista de materiales faltantes con m² faltante.

### M09.F8 — Recepción con IA `NO`
- Fuera de alcance del producto base.

---

# M10 — Bachas de clientes

**Para qué existe:** controlar bachas que trae el cliente (cuello de botella típico).

### M10.F1 — Registro de bacha de cliente `PENDIENTE`
- **Qué:** alta ligada a cliente/OT/venta: modelo, foto, fecha ingreso, ubicación.
- **Aceptación:** al registrar, desbloquea OTs que esperaban bacha.

### M10.F2 — Listado bachas pendientes / en taller / usadas `PENDIENTE`
- **Aceptación:** estados claros; búsqueda por cliente u OT.

### M10.F3 — Flag en presupuesto/OT `PENDIENTE`
- Ver M04.F6 — debe alimentar este módulo.

---

# M11 — Cantera

**Para qué existe:** ingreso a granel y procesamiento a producto (diferencial propio).

### M11.F1 — Ingreso de lotes (kg/t) `HECHO`
### M11.F2 — Procesar lote → productos `HECHO`
### M11.F3 — Conversiones de rendimiento `PARCIAL`
- **Mejora:** validar rendimiento esperado, no solo hint.
### M11.F4 — Integración con stock de productos `HECHO` / `PARCIAL`
- **Aceptación:** lo procesado impacta stock usable en ventas/taller.

---

# M12 — Artículos y listas de precio

**Para qué existe:** qué se vende (mesada, zócalo, bacha, etc.) y a qué precio según lista.

### M12.F1 — CRUD artículos `HECHO`
### M12.F2 — Listas de precio + ítems `PARCIAL`
- **Falta:** UI completa para administrar listas y precios vigentes.
- **Aceptación:** crear lista, cargar precios, vigencias; presupuesto elige lista.

### M12.F3 — Artículos con precio en wizard `HECHO` / `PARCIAL`
- **Aceptación:** no depender de mocks.

### M12.F4 — Bachas por línea → modelo `PENDIENTE`
- **Qué:** selector dependiente (línea/serie → modelo con precio).
- **Aceptación:** al elegir bacha puede sugerir perforación vinculada.

---

# M13 — Materiales (maestro)

**Para qué existe:** piedra/placa como materia prima con familia, proveedor, costo y precio venta.

### M13.F1 — Alta de materiales `HECHO` / `PARCIAL`
- Campos objetivo: nombre, espesor, familia, proveedor, grupo, unidad, costo, moneda, activo.
### M13.F2 — Fórmula o regla de precio venta `LUEGO`
- Ejemplo Cero: `venta = costo × factor × (1+IVA)` — solo si el dueño lo quiere; si no, precio manual/lista.
### M13.F3 — Usar material en presupuesto y stock `HECHO`

---

# M14 — Proveedores y compras simples

**Para qué existe:** de quién entra la piedra y con qué remito.

### M14.F1 — CRUD proveedores `HECHO` / `PARCIAL`
### M14.F2 — Remitos asociados `HECHO`
### M14.F3 — Cuenta corriente proveedor / OC formales `LUEGO`
- No bloquea el MVP operativo.

---

# M15 — Finanzas

**Para qué existe:** libro **interno** de plata del taller: registrar ingresos/egresos ARS/USD sin conectar bancos ni APIs externas.

**Regla de producto (jul 2026):**
- Siempre indicar **cómo se paga / cómo entra** la plata: `efectivo` | `transferencia` | `cheque` | `tarjeta`.
- Los “destinos” son cajones derivados del método + moneda (no se eligen a mano en cobros).
- **Plata de procesos normales NO se carga a mano en Finanzas:** trabajo / seña / cobro de venta → módulo Ventas; pago de boleta / compra / insumos → proceso de compras (cuando exista el cableado). El botón “Ajuste manual” es solo para excepciones fuera de proceso.
- No open banking / no saldo bancario real.
- Mercado Pago en cobros imputa al cajón Transferencia.

### M15.F1 — Saldos por forma de pago `PARCIAL` (jul 2026)
- **Hecho:** cajones Efectivo / Transferencia / Cheque / Tarjeta × moneda; vista `v_saldos_cuentas`; UI “Por forma de pago”.
- **Falta:** alta/edición de cajones desde UI (no prioritario).

### M15.F2 — Movimientos `PARCIAL` (jul 2026)
- **Hecho:** `metodo` obligatorio en `movimientos_caja`; cobro de venta → movimiento `trabajo` con método; transferencia entre cajones; ajuste manual (excepciones).
- **Falta:** egresos automáticos desde compras/remitos/boletas (proceso, no carga manual en Finanzas).

### M15.F3 — Cierre de caja del día `LUEGO`
- API/tabla existen; UI de cierre por cuenta se sacó (ruido). Reintroducir solo si el dueño lo pide como arqueo de fin de día.

### M15.F4 — Cheques `PENDIENTE`
- Recibidos / propios; estados (en cartera, depositado, rechazado, cobrado).
- Link opcional a presupuesto/venta.
- **Aceptación:** cartera + historial; reingresar rechazado.

### M15.F5 — Disponibilidad consolidada `PENDIENTE`
- **Qué:** vista «dónde está la plata».
- **Aceptación:** suma cajas, bancos, cheques, tarjetas por moneda.

### M15.F6 — Comisiones vendedor `LUEGO`
- Sobre ventas/cobranzas según regla del dueño.

### M15.F7 — Facturación fiscal AFIP `LUEGO` / según dueño
- Hoy hay tablas `invoices` sin UI. Tratar como fase posterior salvo pedido explícito.

---

# M16 — Equipo

**Para qué existe:** gente, roles de pago, adelantos (control interno, no liquidación AFIP).

### M16.F1 — Empleados `PENDIENTE` / tablas existentes sin UI
- Rol (operario, vendedor, técnico, chofer…), periodicidad, registrado/mixto, activo.
### M16.F2 — Sueldos (control) `LUEGO`
### M16.F3 — Adelantos `LUEGO`
- Nota Cero: control interno, no liquidación AFIP.

---

# M17 — Reportes

**Para qué existe:** detectar trabas y planificar.

### M17.F1 — OTs trabadas > N días `PENDIENTE`
### M17.F2 — m² de materiales comprometidos en OTs activas `PENDIENTE`
### M17.F3 — Cobranzas / ventas por vendedor `PENDIENTE`
### M17.F4 — Export Excel/PDF `PARCIAL` (jul 2026)
- **Hecho:** export CSV ventas, cobros y remitos/compras desde UI.
- **Falta:** Excel/PDF formal, reportes agregados con filtros.

---

# M18 — Auth, roles y configuración

### M18.F1 — Login Supabase `HECHO`
### M18.F2 — Roles operativos y menú por rol `HECHO`
- vendedor, medidor, cortador, produccion, instalador, reparador, administracion, admin.
### M18.F3 — Configuración de empresa `PENDIENTE`
- Datos taller, dirección (para flete futuro), moneda default, TC default, % seña sugerida, días para «dormido», días urgente.
### M18.F4 — Parámetros de pipeline `PENDIENTE`
- Qué desbloquea cada etapa (seña, saldo, medición, bacha).

---

# M19 — Búsqueda global y notificaciones

### M19.F1 — Buscar presupuesto / OT / cliente `PENDIENTE`
### M19.F2 — Notificaciones básicas `LUEGO`
- Vencidas, sin seña, bacha pendiente.
### M19.F3 — Asistente IA tipo Cero `NO`

---

## Orden de implementación recomendado (para vos)

Usar esto como sprints al hablarle al agente.

### Fase A — Núcleo vendible (lo que el dueño siente como “sistema de marmolería”)
1. **M04** completar estados, flags bacha/piedra, MEC/descuento, PDF.
2. **M05/M06** pipeline OT + venta retenida/bloqueos + fechas entrega + m² técnicos.
3. **M08** planos/archivos mínimos por OT.
4. **M07** vista taller usable en piso.
5. **M02** módulo clientes + ficha.

### Fase B — Stock de verdad
6. **M09** agregados, reserva a OT, carga manual, piedras a pedir.
7. **M10** bachas de clientes.
8. **M12/M13** admin listas de precio y materiales redondo.

### Fase C — Plata y control
9. **M15** cuentas, movimientos, cierre caja, cheques.
10. **M01/M03** dashboard + dormidos + recontactos.
11. **M17** reportes clave.

### Fase D — Extra
12. **M11** endurecer cantera.
13. **M16** equipo/adelantos.
14. Flete, comparación, comisiones, facturación fiscal.

---

## Plantilla para pedirle un módulo al agente

Copiá y completá:

```text
Trabajá SOLO el módulo Mxx — <nombre> de docs/GUIA_PRODUCTO_MODULOS.md.

Contexto:
- Respetar UI/patrones actuales del repo (no copiar UI de Cero).
- No romper el flujo maestro Presupuesto → Venta → OT → Producción → Cobro.
- Leer código existente del módulo antes de inventar tablas nuevas.

Alcance de este sprint:
- Implementar: Mxx.F? , Mxx.F?
- Fuera de alcance: ...

Entregar:
1) cambios de schema/migración si hace falta
2) API/hooks
3) UI mínima en pantallas existentes
4) checklist de criterios de aceptación cumplidos
```

---

## Pedidos julio 2026 (lista del dueño)

Matriz de brechas frente al estado del código al 31/07/2026. Usar tags de la leyenda global.

| Pedido | Estado hoy | Tag producto | Módulo / notas |
|--------|------------|--------------|----------------|
| Informes financieros | KPIs saldos/cobros en Ventas | `PARCIAL` | M01.F5, M17 |
| Informes contables (registración / resultado) | No hay asientos ni P&L | `NO` | Fuera de núcleo — ERP contable |
| Plan de cuentas | No existe | `NO` | Fuera de núcleo |
| Informes de caja | Solo caja comercial de ventas | `PARCIAL` | M15.F3 |
| Conciliación bancaria | No existe | `NO` | Fuera de núcleo |
| Export informes compras | Remitos sin export | `PENDIENTE` → sprint exports | M14 + M17.F4 |
| Export informes ventas | Ventas sin export | `PENDIENTE` → sprint exports | M17.F3/F4 |
| Sección insumos | Solo línea de costo en presupuesto | `NO` | Producto aparte (consumibles taller) |
| Consumos / bajas de stock | Rotura, cantera, recortes | `PARCIAL` | M09 |
| Inventario físico / ajustes | Listado chapas, sin conteo | `PENDIENTE` | Extensión M09 |
| Altas por producción | Cantera → producto; no OT → chapa | `PARCIAL` | M11 |
| Ventas/compras por establecimiento | Sin maestro sucursales | `NO` | Multi-sucursal aparte |
| Transferencia de fondos | Solo método de cobro al cliente | `PENDIENTE` → M15 liviano | M15.F1/F2 |
| Cobros con tarjeta | Registro en cobro; sin liquidación | `PARCIAL` | M05.F3 hecho; liquidación `LUEGO` |

### Priorización acordada (jul 2026)

1. **Sprint exports** — CSV ventas + CSV remitos/compras (valor rápido).
2. **M15 liviano** — cuentas, movimientos, transferencias, cierre de caja, cuenta destino en cobro.
3. **Stock** — consumos/bajas formales + inventario físico simple (M09).
4. **Negociar / fase posterior** — plan de cuentas, conciliación, insumos, multi-establecimiento, liquidación tarjeta.

### Qué no hacer todavía

- No abrir módulo contable completo por “faltan informes contables”.
- No mezclar caja comercial de ventas con caja física sin modelo de cuentas (M15).
- No tratar `branch_code` del remito como multi-sucursal.
- No conectar bancos / open banking / saldo real de cuenta bancaria — Finanzas es libro interno.
- No pedir “cuenta destino” aparte del método de pago: el método define el cajón.

---

## Relación con otros docs

| Doc | Rol |
|-----|-----|
| `REQUERIMIENTOS_ANALISIS.md` | Pedidos del dueño desde audios (mayo 2026) |
| `FASE_1_FLUJO_PRUEBA.md` | Pruebas del flujo ya implementado |
| `docs/GUIA_PRODUCTO_MODULOS.md` | **Spec viva del producto final + briefing por módulo para agentes** |

Cuando haya conflicto: priorizar esta guía para alcance de producto; contrastar con `REQUERIMIENTOS_ANALISIS.md` si el dueño pidió algo explícito distinto.
