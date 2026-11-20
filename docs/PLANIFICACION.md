# Módulo Planificación

Agenda para organizar **entregas/colocaciones, mediciones y tareas manuales**, inspirada en el planificador de Cero. Va en el sidebar debajo de Dashboard (`?ws=planificacion`).

Decisiones tomadas (20/11/2026):

| Tema | Decisión |
|---|---|
| Qué muestra (v1) | Entregas/colocaciones, mediciones y tareas manuales. Producción queda afuera. |
| Tipo de entrega | Se deduce del presupuesto, editable por OT. |
| Detalle al agendar | Día + rango horario + empleados asignados. |
| Asignación | Empleados sueltos (uno o más por tarea), sin cuadrillas guardadas. |
| Cola lateral | Todas las OTs no entregadas (corte, producción, despacho). |
| Marcar entrega | Tilde por OT. La venta pasa a `entregado` cuando todas sus OTs están hechas (esa regla ya existe en `ventas-api.ts`). |
| Armar salida / hoja de ruta | Segunda etapa. |

---

## 1. De dónde vienen los datos

### Lo que ya existe

- **`ordenes_trabajo.fecha_programada`** (solo día): sale de `fechaEntrega` de la OT en el wizard, o de `logistica.fechaEntrega` del presupuesto como respaldo. Es la **fecha prometida al cliente**.
- **`ordenes_trabajo.etapa`**: `medicion → corte → produccion → despacho`. "Instalaciones" = `despacho`.
- **`ordenes_trabajo.estado = 'done'`**: OT entregada (`marcarOtEntregada`).
- **`presupuesto_mediciones`**: `fecha_programada`, `medido_por`, `estado` (`listo_para_medir`, `medido`…).
- **Payload del presupuesto**: `mEntregaGlobal` y `mColocacionGlobal` (servicios cargados), dirección de obra por OT y teléfono.
- **`empleados`**: nombre, teléfono y rol operativo (instalador, medidor…).

### Lo que falta y se agrega

1. **Tipo de entrega por OT**: columna nueva `ordenes_trabajo.tipo_entrega`.
2. **Hora y personas**: la fecha prometida no alcanza; hace falta el turno agendado de verdad.
3. **Tareas sueltas** que no son OTs.

Separamos dos fechas:
- **Fecha prometida** = `fecha_programada` (lo que se le dijo al cliente). No se toca al agendar.
- **Fecha agendada** = el evento del planificador (día + hora + empleados).

Así la tarjeta puede mostrar "se entregaba el 9/11" cuando lo agendado (o lo no agendado) ya pasó la promesa.

---

## 2. Modelo de datos (una migración)

```sql
-- Tipo de entrega por OT
alter table ordenes_trabajo
  add column tipo_entrega text not null default 'retira'
    check (tipo_entrega in ('retira','logistica','colocacion')),
  add column entregada_en timestamptz;

-- Agenda única
create table planificacion_eventos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrega','medicion','tarea')),
  ot_id uuid references ordenes_trabajo(id) on delete cascade,
  medicion_id uuid references presupuesto_mediciones(id) on delete cascade,
  venta_id uuid references ventas(id) on delete set null,
  fecha date not null,
  hora_desde time,          -- null = "Sin hora"
  hora_hasta time,
  titulo text,              -- solo tareas
  direccion text,           -- solo tareas (las otras la toman de la OT)
  notas text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','hecho','cancelado')),
  hecho_en timestamptz,
  hecho_por uuid references usuarios(id),
  created_by uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (tipo = 'entrega'  and ot_id is not null) or
    (tipo = 'medicion' and medicion_id is not null) or
    (tipo = 'tarea'    and titulo is not null)
  )
);
-- Una sola entrega pendiente por OT y una sola medición pendiente por medición
create unique index on planificacion_eventos (ot_id) where tipo = 'entrega' and estado = 'pendiente';
create unique index on planificacion_eventos (medicion_id) where tipo = 'medicion' and estado = 'pendiente';

create table planificacion_evento_empleados (
  evento_id uuid references planificacion_eventos(id) on delete cascade,
  empleado_id uuid references empleados(id) on delete cascade,
  primary key (evento_id, empleado_id)
);
```

RLS con las mismas políticas que `ordenes_trabajo`.

**Relleno de `tipo_entrega`** para las OTs existentes, desde el payload del presupuesto:
- `mColocacionGlobal = true` → `colocacion`
- si no, `mEntregaGlobal = true` → `logistica`
- si no → `retira`

Al crear OTs nuevas (`ensureOtsParaPresupuesto`) se aplica la misma regla. Después se puede cambiar desde la tarjeta o desde el detalle de la OT.

Colores (como Cero): retira en fábrica = gris azulado, logística = azul oscuro, colocación = naranja.

---

## 3. Reglas

### Cola "OTs activas" (panel izquierdo)
- OTs con `venta_id`, `estado` distinto de `done`/`cancelled`, `etapa` distinta de `medicion`, **sin evento de entrega pendiente**.
- Se agrupan por venta: arrastrar la cabecera agenda **todas** las OTs de la venta; clic despliega las OTs.
- Cada tarjeta: etapa (Corte / Producción / Logística), número de presupuesto, cliente, trabajo, material, m², dirección, teléfono, quién midió.
- Aviso **"(terminar) · se entregaba el 9/11"** si la fecha prometida ya pasó y la OT no está en despacho.
- Orden: antigüedad en la cola o fecha prometida; búsqueda por obra, OT o cliente; filtro por tipo de entrega y etapa.
- También entran las **mediciones `listo_para_medir`** sin evento (tarjeta "Medición").

### Agendar
- Soltar en una franja horaria → evento con `hora_desde` y por defecto 2 h de duración (configurable).
- Soltar en "Sin hora" → evento sin horario.
- Mover un evento = cambiar fecha/hora. Volver a la cola = cancelar el evento.
- Agendar una medición también escribe `presupuesto_mediciones.fecha_programada`, para que el módulo Medición siga mostrando lo mismo.

### Marcar como hecho (tilde en la tarjeta)
- **Entrega**: solo si la OT está en `despacho` y no está bloqueada ni pausada; si no, el tilde aparece deshabilitado con el motivo ("Sigue en producción"). Al tildar:
  1. evento → `hecho`, `hecho_en`, `hecho_por`;
  2. OT → `estado = done`, `entregada_en = now()` (se reutiliza `marcarOtEntregada`);
  3. si todas las OTs de la venta están hechas → venta `entregado` (regla existente).
- **Medición**: el tilde abre el flujo de medición que ya existe (confirmar medidas); el evento queda hecho cuando la medición pasa a `medido`.
- **Tarea**: tilde simple.

### "X entregas sin marcar" (botón rojo del header)
Eventos de entrega `pendiente` con fecha anterior a hoy. Al hacer clic lista esas entregas para tildarlas o reagendarlas.

---

## 4. Pantalla

- **Header**: filtros Todos / Entregas / Medición / Tareas · Nueva tarea · Días / Mes / Equipos · cantidad de días (1 a 7) · navegación de fechas con "+N en otros días".
- **Vista Días**: una columna por día, carril "Sin hora" arriba y grilla horaria 07:00–19:00.
- **Vista Equipos**: una columna por empleado asignado en el día elegido (sirve para ver quién está libre).
- **Vista Mes**: calendario con cantidad de trabajos por día; clic abre ese día.
- **Tarjeta del evento**: tipo y color, cliente, venta · presupuesto · OT, trabajo, material, dirección, teléfono y contacto, empleados asignados, horario; acciones tilde y ver (abre `OtDetalleDialog`).
- **Nueva tarea**: título, fecha, horario, empleados, dirección, notas, venta opcional.
- **Configuración**: horario laboral de la grilla y duración por defecto según tipo.

Drag and drop: hoy no hay librería instalada; se suma `@dnd-kit/core` (liviana, funciona con teclado y touch).

---

## 5. Etapas de implementación

1. **Base**: migración, tipos, `planificacion-api.ts` y reglas puras con tests (`planificacion-reglas.ts`: tipo de entrega desde payload, "se puede tildar", "sin marcar", vencida respecto de la promesa).
2. **Vista Días + cola**: sidebar y ruta, cola con búsqueda y filtros, arrastrar y soltar, mover y desagendar.
3. **Cierre**: tilde de entregas y tareas, botón "sin marcar", Nueva tarea, vistas Mes y Equipos.
4. **Después**: Armar salida (viaje con orden de paradas y hoja de ruta imprimible) y planificación de producción.
