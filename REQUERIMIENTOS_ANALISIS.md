# Piedra Americana (MarmoGest) — Análisis de Requerimientos

> Documento generado a partir del análisis de 9 transcripciones de audio con el cliente,
> cruzado con el estado actual del repositorio (`piedramericana`).
>
> Fecha: 19/05/2026

---

## Resumen ejecutivo

El sistema actual cubre un flujo base de **Presupuesto → Venta → Producción (Kanban OT)**, con módulos de **Stock** (chapas, remitos, recortes) y **Cantera** (lotes por kg, conversiones). Las transcripciones revelan **8 módulos nuevos o ampliaciones significativas** que el cliente necesita para reemplazar la operatoria manual actual y unificar lo mejor de OtFlex (gestión de marmolería) con Señales (contabilidad/administración) en un solo sistema.

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Ya existe en el código actual |
| 🔧 | Existe parcialmente, requiere mejoras |
| 🆕 | Módulo o funcionalidad completamente nueva |
| ⚡ | Prioridad alta según el cliente |

---

## MÓDULO 1 — PRESUPUESTOS

### Estado actual ✅
- Wizard por pasos: Cliente → Órdenes de trabajo → Logística → Confirmación
- Soporte ARS / USD con cotización mixta
- Cálculo de m² (alto × ancho), desperdicio, descuento global
- Artículos mock (mesada, alzada, biselado, frentín, bacha MO)
- Tipos de colocación (bajo/sobre/al ras mesada)
- Modelos de bacha precargados
- Vista de impresión

### Requerimientos nuevos o mejoras

#### 1.1 — Maestro de artículos dinámico 🔧⚡
**Origen:** Transcripción 6 — "para vos poder cargarle el nombre necesitas habérselo ingresado"
- **Situación actual:** Artículos hardcodeados en `presupuesto-articulos-mock.ts` (6 ítems fijos).
- **Requerido:** CRUD completo de artículos en Supabase. Cada artículo debe tener: código, descripción, unidad (M2/ML/UNI), si calcula material, medida estándar m², precio por lista.
- **Regla de negocio:** Al dar de alta un material nuevo (ej: "Piedra Boreal"), debe quedar disponible inmediatamente para presupuestar.

#### 1.2 — Múltiples listas de precios 🆕⚡
**Origen:** Transcripción 6 — "tener distintas listas de precios… una general, después para arquitectos y diseñadores"
- Lista general (público)
- Lista para arquitectos/diseñadores (con descuento incorporado)
- Los precios varían por mes → versionado o fecha de vigencia
- **Situación actual:** `LISTAS_PRECIO_MOCK` tiene 2 listas hardcodeadas sin precios reales asociados.
- **Requerido:** Tabla `listas_precio` con relación a artículos y precios vigentes. Selector en el wizard de presupuesto.

#### 1.3 — Ítems detallados en la OT del presupuesto 🔧⚡
**Origen:** Transcripción 6 — "en los ítems va cargando si es mesada sola, si lleva alzada, zócalo, pata, si el cliente nos compra la bacha o la trae él"
- **Requerido:** Cada OT debe permitir agregar N líneas con artículos diferenciados: mesada, alzada, zócalo, pata, bacha (propia o del cliente).
- **Situación actual:** El wizard ya soporta múltiples líneas por OT (`items: LineaItemOT[]`), pero los artículos disponibles son mock. La lógica de "bacha del cliente vs. nuestra" no está modelada.
- **Nuevo campo sugerido:** `bacha_origen: "cliente" | "propia" | "sin"` en la línea de ítem o en la OT.

#### 1.4 — MEC (Medición + Envío + Colocación) por ítem vs. global 🔧
**Origen:** Transcripción 6 — "el MEC está aplicado a cada ítem o al presupuesto en general?"
- **Situación actual:** MEC se maneja globalmente (`mMedicionGlobal`, `mEntregaGlobal`, `mColocacionGlobal` en el payload) y también por OT (`mMedicion`, `mEntrega`, `mColocacion` en `OrdenTrabajoWizard`).
- **Requerido:** El cliente lo aplica hoy al presupuesto en general, pero necesitan la opción de excluir MEC por ítem/OT específica con una observación (ej: "Mesa redonda no incluye MEC").
- **Precio del MEC:** Se calcula a mano hoy. A futuro automatizar.

#### 1.5 — Observaciones por ítem y por OT 🔧
**Origen:** Transcripción 6 — "en la parte de comentarios escribimos el detalle"
- Hoy escriben en un campo libre: "2.24 × 0.61 zócalo"
- **Requerido:** Campo de observaciones por cada línea de ítem y por cada OT, visible en el presupuesto impreso.

#### 1.6 — Origen del cliente (canal de venta) 🔧
**Origen:** Transcripción 7 — "origen, si es un conector, un show, un WhatsApp, Instagram, referido"
- **Situación actual:** Existe `origenVentas` en el payload del presupuesto (string libre).
- **Requerido:** Convertir a selector con opciones predefinidas: Showroom, WhatsApp, Instagram, Referido, Arquitecto, Otro. Para estadísticas de adquisición.

#### 1.7 — Cotización en dólares para señas 🔧⚡
**Origen:** Transcripción 2 — "el señales tenés que pasarlo todo a peso… está bueno que el cliente diga mira te sale 200 dólares"
- **Situación actual:** El presupuesto ya soporta ARS/USD. Las señas en `ventas_pagos` tienen campo `moneda`.
- **Verificar:** Que el flujo completo (seña, cobros parciales, saldo) soporte correctamente operaciones mixtas ARS/USD con tipo de cambio.

---

## MÓDULO 2 — VENTAS Y COBROS

### Estado actual ✅
- Flujo: aprobado_sin_sena → señado → en_producción → finalizado → entregado
- Registro de pagos con monto, moneda, método, fecha
- Cálculo de saldo y % seña

### Requerimientos nuevos o mejoras

#### 2.1 — Flujo de aprobación clarificado 🔧⚡
**Origen:** Transcripción 7 — "cuando el cliente seña, ahí pasa a aprobado… producción arranca cuando vuelven las medidas"
- **Flujo real descubierto:**
  1. Presupuesto aproximado (pendiente)
  2. Cliente seña → presupuesto pasa a "aprobado" + se crea venta
  3. Se coordina medición en obra (5-10 días)
  4. Medidor va, toma medidas reales
  5. Vendedor corrobora → si hay diferencias, se ajusta presupuesto y se informa al cliente
  6. Cliente cancela saldo (o acuerda 50/50 contra entrega)
  7. Vendedor entrega la OT a producción → **recién acá arranca producción**
- **Situación actual:** Al registrar primera seña se crea automáticamente la OT y pasa a producción. Falta el paso intermedio de medición/confirmación.
- **Requerido:** Nuevo estado intermedio entre "señado" y "en_produccion": **"en_medicion"** o similar. La OT no debe pasar a corte hasta que el vendedor confirme medidas.

#### 2.2 — Seguimiento post-presupuesto (mini-CRM) 🆕
**Origen:** Transcripción 9 — "al cliente que todavía no confirmó el presupuesto, entre los 5 y 10 días le mandó un mensajito"
- **Requerido:** Vista de presupuestos pendientes con fecha de último contacto. Alerta o recordatorio a los 5-10 días. Registro de seguimiento (fecha, nota, resultado).
- No es un CRM completo, es seguimiento de presupuestos sin confirmar.

#### 2.3 — Comisiones para arquitectos/referentes 🆕
**Origen:** Transcripción 6 — "trabajamos con ciertos arquitectos que si te dan la obra le das un 5% de comisión"
- **Requerido:**
  - Tabla de referentes/arquitectos con % de comisión asignado
  - Al crear presupuesto, asignar referente (oculto al cliente)
  - Ejemplo: cliente tiene 10% descuento, 5% es comisión del arquitecto
  - Liquidación de comisiones por período
  - **Regla clave:** El cliente NO debe ver la comisión del arquitecto en el presupuesto.

#### 2.4 — Ajuste de presupuesto post-medición 🆕
**Origen:** Transcripción 7 — "presupuesté 3×1 y las medidas reales son 3.10×1.5, corrijo la diferencia"
- **Requerido:** Posibilidad de editar un presupuesto aprobado (ajustar medidas reales) y generar la diferencia para informar al cliente. Historial de versiones del presupuesto.

---

## MÓDULO 3 — PRODUCCIÓN (OT / Kanban)

### Estado actual ✅
- Kanban con etapas: medición → corte → producción → despacho
- Pausa/reanudación de OT
- Sincronización de estado con venta
- Creación automática de OT al registrar primera seña

### Requerimientos nuevos o mejoras

#### 3.1 — Orden de trabajo por triplicado (digitalizada) 🔧⚡
**Origen:** Transcripción 1 — "órdenes que se hacen a mano por triplicado: cortador, producción, instalación"
- **Situación actual:** Una sola OT digital. No hay diferenciación de la información que ve cada rol.
- **Requerido:** La OT debe tener vistas diferenciadas:
  - **Vista cortador:** material, medidas exactas, tipo de corte, dibujo/croquis
  - **Vista producción:** pulido, pegado, terminación
  - **Vista instalación:** dirección, contacto cliente, piezas a instalar, observaciones de obra
- A futuro: el cortador en una tablet ve su cola de trabajo.

#### 3.2 — Automatización del paso vendedor → producción ⚡
**Origen:** Transcripción 7 — "que directamente acá, viste la parte de producción… el vendedor ya la pueda aprobar y le aparece al Vale"
- **Requerido:** Cuando el vendedor marca "medidas confirmadas" + cliente canceló/confirmó, la OT aparece automáticamente en el Kanban de producción para Valentino (sin papel).
- **Situación actual:** Ya existe la lógica de `crearJobOtSiAusente`, pero se gatilla con la seña, no con la confirmación de medidas.

#### 3.3 — Registro de retazos desde corte 🆕
**Origen:** Transcripción 7 — "el cortador cuando tenga un retazo te anota y ya te aparece acá [stock]"
- **Requerido:** Desde la vista del cortador, al terminar un corte, registrar qué retazos quedaron (material, lote, dimensiones). Esos retazos se dan de alta automáticamente en stock de chapas con estado "Disponible".
- **Relación:** Se conecta con el módulo de Stock (chapas_inventario + stock_scraps).

#### 3.4 — Medición en obra digital (futuro) 🆕
**Origen:** Transcripción 7 — "el medidor llega, ve las diferencias y directamente carga acá"
- **Visión futura:** App mobile o tablet donde el medidor:
  - Carga medidas reales (con detalle de falsa escuadra, mochetas, diferencias por punta)
  - Dibuja croquis (a futuro con stylus / integración CAD)
  - Las medidas llegan al vendedor en tiempo real con alerta de diferencias
- **Prioridad:** Baja para MVP. Alta para v2.
- **Para MVP:** Input simple desde celular con las medidas numéricas y foto del croquis a mano.

---

## MÓDULO 4 — STOCK (Marmolería — Chapas y Placas)

### Estado actual ✅
- `chapas_inventario`: bulto, material, largo, ancho, estado (Disponible/Reservada)
- `remitos` + `remito_lines`: ingreso con proveedor, material, cantidad, dimensiones, precio
- `stock_scraps`: registro de recortes
- RPC `create_remito_with_slabs`
- Vista: recortes por material, historial de remitos, disponibilidad

### Requerimientos nuevos o mejoras

#### 4.1 — Registro de lotes obligatorio 🔧⚡
**Origen:** Transcripción 8 — "no se pueden mezclar los lotes… identificar que esto es de un lote anterior"
- **Situación actual:** `chapas_inventario` tiene `remito_line_id` (trazabilidad al remito) pero NO tiene campo de lote explícito.
- **Requerido:**
  - Campo `lote` (string/código) en `chapas_inventario` y en `remito_lines`
  - Al presupuestar/asignar material, mostrar de qué lote viene
  - Al consultar retazos, saber el lote de origen
  - **Regla crítica:** No se mezclan lotes porque el veteado/color varía. El sistema debe alertar si se intenta combinar piezas de lotes distintos en una misma OT.

#### 4.2 — Trazabilidad placa → OT → cliente 🆕⚡
**Origen:** Transcripción 6 — "que vos sepas qué placas te quedaron ahí y de qué lotes son"
- **Requerido:** Cuando se consume una placa para una OT, registrar:
  - Qué placa se usó (id de chapa)
  - De qué lote era
  - Para qué OT / cliente
  - Qué retazo quedó
- Consulta inversa: dado un cliente, qué placas se usaron.

#### 4.3 — Reserva de material al aprobar presupuesto 🆕
- **Requerido:** Al confirmar medidas y pasar a producción, reservar las placas necesarias (cambiar estado a "Reservada" con referencia a la OT). Evitar que se vendan a otro cliente.

#### 4.4 — Ingreso de placas importadas e industriales 🔧
**Origen:** Transcripción 8 — "las planchas que vienen de afuera, las que son industriales, vienen por lotes"
- **Requerido:** Mismo flujo que naturales: remito + lote + dimensiones. Diferenciar origen (nacional vs. importado) para cruce con módulo de comercio exterior.

---

## MÓDULO 5 — CANTERA (Piedra Natural)

### Estado actual ✅
- `lotes_cantera`: material, kg restante/inicial, proveedor, dimensiones
- `conversiones_materiales`: padre→hijo, kg padre por m² hijo
- `materials`: material_kind (marmol / otra_piedra / agglomerado_otro), peso_por_m2_kg, bulk_stock_kg
- RPC `register_cantera_ingreso`
- Vista: ingreso de lotes, conversiones

### Requerimientos nuevos o mejoras

#### 5.1 — Proceso completo: ingreso bruto → procesamiento → productos 🔧⚡
**Origen:** Transcripción 2 y 8 — "llega un camión de 28 toneladas… de esa misma piedra salen distintos productos"
- **Flujo real:**
  1. Llega camión con pesada (ej: 28.000 kg de piedra matizada)
  2. Se registra ingreso con pesada del camión, proveedor, comprobante/factura
  3. Se procesa la piedra: de los 28.000 kg se producen N productos distintos
  4. Se da de baja X kg de bruto y se da de alta Y m² de cada producto
- **Productos posibles de la misma piedra:**
  - Pirca abierta (m²)
  - Piedra re cuadrada / matizada (m²)
  - Adoquín 10×10 (unidades o m²)
  - Lajas irregulares (m²)
  - Caja abierta
- **Situación actual:** La estructura de `lotes_cantera` + `conversiones_materiales` soporta el concepto, pero falta:
  - Registro de pesada de camión
  - Interfaz de "procesamiento" (baja kg bruto → alta m² productos)
  - Trazabilidad de qué lote bruto generó qué productos
- **Encargado:** Jorge (encargado de piedra) hace esto hoy en planilla Excel.

#### 5.2 — Orígenes múltiples de piedra 🔧
**Origen:** Transcripción 2 — "tenemos canteras propias en San Rafael y compramos a canteras del resto del país"
- Cantera propia San Rafael: llega en bruto, se procesa acá
- Proveedores San Luis: algunas listas para vender, otras en bruto
- **Requerido:** Diferenciar origen (cantera propia vs. proveedor externo) en el lote. Registro de compra con factura/comprobante.

#### 5.3 — Trabajo a pedido vs. stock 🔧
**Origen:** Transcripción 2 — "trabajamos mucho a pedido, no alcanzamos a tener stock"
- **Requerido:** La piedra se procesa mayormente a demanda. El sistema debe soportar:
  - Registro de pedido → asignación de lote bruto → procesamiento → despacho
  - No siempre hay stock de productos terminados

---

## MÓDULO 6 — COMERCIO EXTERIOR (Importaciones) 🆕⚡

### Estado actual
No existe. Hoy lo manejan con el sistema "Señales" como un proveedor más, sin diferenciación.

### Requerimientos

#### 6.1 — Seguimiento de importación completo
**Origen:** Transcripción 3 y 9 — "cuando la mercadería se nacionaliza… todo lo previo no tenemos donde cargarlo"
- **Flujo:**
  1. **Orden de compra** al proveedor exterior (país de origen, monto en USD)
  2. **Factura provisoria** del proveedor
  3. **Embarque** (fecha de carga, medio de transporte, datos del flete)
  4. **Tránsito** (fecha estimada de llegada: 30-90 días según destino)
  5. **Llegada al país** → Despachante de aduanas
  6. **Despacho / Nacionalización** (documento de despacho con derechos e impuestos)
  7. **Factura definitiva**
  8. Mercadería disponible en depósito → ingresa a stock

#### 6.2 — Registro de costos de importación
**Origen:** Transcripción 9 — "cuánto sale el despachante, el flete, los derechos, los impuestos"
- Valor FOB de la mercadería
- Flete internacional
- Seguro
- Derechos de importación
- Impuestos (IVA importación, ingresos brutos, percepciones)
- Gastos de despachante
- **Costo total puesto en país** (landed cost)
- IVA a favor recuperable (crédito fiscal)

#### 6.3 — Documentos asociados
- Factura provisoria (archivo adjunto)
- Factura definitiva
- Despacho de aduanas
- BL (Bill of Lading) / AWB
- Packing list

#### 6.4 — Vista de mercadería en tránsito
**Origen:** Transcripción 3 — "suponete que estés en una oficina en otro lugar, tendrías que tener forma simple de saber por dónde va"
- Dashboard con importaciones activas, estado, fecha estimada de llegada
- Alertas de vencimiento/demoras

---

## MÓDULO 7 — RECLAMOS Y POSTVENTA 🆕⚡

### Estado actual
No existe. Hoy lo manejan por WhatsApp y se les pasan reclamos.

### Requerimientos

#### 7.1 — Registro de reclamos
**Origen:** Transcripción 8 — "hacer un apartado de reclamos para saber qué pasó"
- **Campos:**
  - Cliente (vinculado a la OT/presupuesto original)
  - Fecha del reclamo
  - Motivo categorizado (para agrupar): piquete, junta despegada, bacha mal pegada, medida incorrecta, rotura, otro
  - Descripción libre (qué pasó exactamente)
  - Material afectado (traído de la OT original)
  - Pieza afectada (cuál de los ítems de la OT: mesada, alzada, zócalo, etc.)
  - Responsable asignado
  - Estado: pendiente → en proceso → resuelto
  - Fecha de resolución
  - Costo del reclamo (si requiere material nuevo)

#### 7.2 — Impacto en stock y cuenta corriente
**Origen:** Transcripción 8 — "ese material tiene que descontarse del stock… la cuenta corriente del cliente tiene que quedar a cero"
- Si el reclamo requiere material nuevo → descontar del stock
- Si el error es de la empresa → no se cobra al cliente
- La cuenta corriente del cliente debe reflejar esto (nota de crédito interna o ajuste)
- **Función de "represupuestación parcial":** generar una mini-OT de reparación vinculada al reclamo

#### 7.3 — Estadísticas de reclamos ⚡
**Origen:** Transcripción 8 — "cuántos reclamos tuvimos por mes, qué nos ha pasado, por qué"
- Cantidad de reclamos por mes
- Agrupados por motivo
- Tiempos promedio de resolución
- Objetivos/SLA: "un piquete se resuelve en 2 días, una bacha despegada en 1 día"
- Evolución mensual (tendencia)
- Tasa de reclamos vs. trabajos entregados

#### 7.4 — Comunicación al reparador
**Origen:** Transcripción 8 — "qué material es, de qué pieza, es muy prolijo que llegue el barelero y sepa qué tiene que hacer"
- Vista mobile para el reparador con: dirección, cliente, material, pieza, tipo de reclamo, foto si hay
- Roles: medidor, instalador, reparador (pueden ser la misma persona, pero puestos distintos)

---

## MÓDULO 8 — CONTABILIDAD BÁSICA (Cobros / Egresos / Sueldos) 🆕

### Estado actual
Solo existe `ventas_pagos` para registrar cobros de señas/cancelaciones.

### Requerimientos

#### 8.1 — Registro de ingresos y egresos generales 🆕⚡
**Origen:** Transcripción 9 — "cobros y egresos, o sea para llevar todo, súper importante"
- Ingresos: cobros de ventas (ya existe), otros ingresos
- Egresos: pagos a proveedores, gastos operativos, fletes, etc.
- Categorización de movimientos
- Balance general por período

#### 8.2 — Módulo de sueldos y empleados 🆕
**Origen:** Transcripción 9 — "lo que gana cada uno por mes, los extras, comisiones, horas extras"
- **Empleados:** datos básicos, puesto, fecha de ingreso
- **Componentes del sueldo:**
  - Sueldo base
  - Comisiones por ventas/instalaciones
  - Horas extras
  - Trabajos de instalación extra
  - Fletes
  - Adelantos/viáticos
- **Forma de pago:**
  - Día 15: pago en efectivo (parte informal)
  - Día 30: parte en banco (con cargas sociales) + resto en efectivo
- **Cargas sociales:** aportes patronales, percepciones (ej: percepción 6%, SIPA)
- **Liquidación mensual:** detalle de cada concepto → total a pagar
- **Estadística:** "cuánto nos está saliendo realmente toda la nómina"

#### 8.3 — Facturación electrónica (ARCA/AFIP) 🆕
**Origen:** Transcripción 9 — "estaría bueno hacerlo de acá… tener la opción"
- ~60-70% de los clientes se facturan
- Factura con CUIT o DNI del cliente
- Integración con ARCA (ex AFIP) para factura electrónica
- Opción de elegir qué facturar y qué no
- **Prioridad:** Media-alta. Puede empezar como generación del comprobante y evolucionar a integración directa con el web service de ARCA.

---

## MÓDULO 9 — ESTADÍSTICAS Y REPORTES 🆕⚡

### Estado actual
No existe módulo de estadísticas.

### Requerimientos
**Origen:** Transcripción 8 y 9 — "estadística de todo… metros cuadrados entregados por mes, producidos, vendido, cobrado, reclamos"

- m² presupuestados por mes
- m² vendidos (aprobados) por mes
- m² producidos / entregados por mes
- Ventas totales (ARS/USD) por período
- Cobros realizados vs. saldo pendiente
- Reclamos por mes, por tipo, tiempos de resolución
- Origen de clientes (canal de adquisición)
- Comisiones generadas por arquitecto/referente
- Costo de nómina mensual
- Importaciones en tránsito / costos de importación
- **Formato:** Dashboard con gráficos (Recharts ya está instalado)

---

## MÓDULO 10 — USUARIOS, ROLES Y ACCESO MOBILE 🔧

### Estado actual ✅
- Tabla `usuarios` con roles: admin, staff, sales
- Auth con Supabase
- RLS habilitado (políticas abiertas actualmente)

### Requerimientos

#### 10.1 — Roles granulares 🆕⚡
**Origen:** Transcripción 7 — "usuario para ciertas cosas y otros para otras cosas"
- **Vendedor:** presupuestos, seguimiento de clientes, aprobación post-medición
- **Medidor:** carga medidas en obra (mobile)
- **Cortador:** ve su cola de cortes, registra retazos
- **Producción (Valentino):** gestiona Kanban OT, asigna trabajos
- **Instalador:** ve trabajos a instalar, marca como instalado
- **Reparador:** ve reclamos asignados
- **Administración:** cobros, egresos, sueldos, comisiones
- **Admin:** acceso total
- **Regla:** Una persona puede tener múltiples roles (ej: el mismo empleado es medidor + instalador + reparador)

#### 10.2 — Acceso mobile 🆕
**Origen:** Transcripción 3 — "el Fran que a veces está en la calle puede presupuestar"
- Presupuestar desde el celular
- Medidor carga medidas desde obra
- Instalador/reparador ve sus tareas
- **Situación actual:** Tauri (app escritorio). Para mobile se necesita versión web responsive o PWA.

---

## MAPA DE RELACIONES ENTRE MÓDULOS

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ PRESUPUESTO │────▸│    VENTA     │────▸│  PRODUCCIÓN  │
│  (wizard)   │     │  (cobros)    │     │  (Kanban OT) │
└──────┬──────┘     └──────┬───────┘     └──────┬───────┘
       │                   │                    │
       │ lista precios     │ comisiones         │ retazos
       │ artículos         │ facturación        │ consumo placas
       ▼                   ▼                    ▼
┌──────────────┐   ┌──────────────┐    ┌──────────────┐
│   MAESTRO    │   │ CONTABILIDAD │    │    STOCK     │
│  ARTÍCULOS   │   │ (ing/egr)    │    │  (chapas)    │
└──────────────┘   └──────┬───────┘    └──────┬───────┘
                          │                    │
                          │ sueldos            │ lotes
                          │ importaciones      │ remitos
                          ▼                    ▼
                   ┌──────────────┐    ┌──────────────┐
                   │   SUELDOS    │    │   CANTERA    │
                   │ (empleados)  │    │  (piedra)    │
                   └──────────────┘    └──────────────┘

┌──────────────┐   ┌──────────────┐    ┌──────────────┐
│  COMERCIO    │──▸│    STOCK     │    │  RECLAMOS    │
│  EXTERIOR    │   │  (ingreso)   │    │  POSTVENTA   │
└──────────────┘   └──────────────┘    └──────┬───────┘
                                              │
                                              │ impacto stock
                                              │ impacto cc
                                              ▼
                                       ┌──────────────┐
                                       │ ESTADÍSTICAS │
                                       │  (dashboard) │
                                       └──────────────┘
```

---

## PRIORIZACIÓN SUGERIDA

### Fase 1 — Core operativo (inmediato)
1. Maestro de artículos dinámico (reemplazar mocks)
2. Múltiples listas de precios
3. Flujo de medición (estado intermedio entre seña y producción)
4. Registro de lotes obligatorio en stock
5. Roles y permisos básicos

### Fase 2 — Gestión completa
6. Reclamos y postventa
7. Comisiones de arquitectos
8. Procesamiento de cantera (baja kg → alta m²)
9. Estadísticas y dashboard
10. Seguimiento post-presupuesto (mini-CRM)

### Fase 3 — Administración y finanzas
11. Cobros e ingresos/egresos generales
12. Comercio exterior (importaciones)
13. Módulo de sueldos/empleados
14. Facturación electrónica (ARCA)

### Fase 4 — Digitalización avanzada
15. Acceso mobile / PWA
16. Medición en obra digital (tablet con croquis)
17. Vista de cortador en tablet
18. Integración con planos CAD

---

## TABLAS NUEVAS SUGERIDAS (Supabase)

| Tabla | Módulo | Descripción |
|-------|--------|-------------|
| `articulos` | Presupuestos | Maestro de artículos (reemplaza mock) |
| `listas_precio` | Presupuestos | Cabecera de lista de precios |
| `listas_precio_items` | Presupuestos | Precio por artículo por lista |
| `referentes` | Ventas | Arquitectos/referentes con % comisión |
| `comisiones` | Ventas | Registro de comisiones generadas |
| `seguimiento_presupuestos` | Ventas | Log de contactos a presupuestos pendientes |
| `importaciones` | Comercio ext. | Cabecera de importación |
| `importacion_gastos` | Comercio ext. | Desglose de costos (flete, derechos, etc.) |
| `importacion_documentos` | Comercio ext. | Archivos adjuntos por importación |
| `reclamos` | Postventa | Cabecera de reclamo |
| `reclamo_seguimiento` | Postventa | Log de acciones sobre el reclamo |
| `movimientos_caja` | Contabilidad | Ingresos y egresos generales |
| `empleados` | Sueldos | Datos del empleado |
| `liquidaciones` | Sueldos | Liquidación mensual |
| `liquidacion_conceptos` | Sueldos | Detalle de cada concepto |
| `roles_permisos` | Usuarios | Permisos granulares por rol |

---

*Documento vivo — se actualiza con cada iteración de relevamiento.*
