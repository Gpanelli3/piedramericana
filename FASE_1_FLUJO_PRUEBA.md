# FASE 1 — Flujo de Prueba Básico

## ✅ Estado de la Base de Datos

### Migraciones Aplicadas
- ✅ `20260519162705` - Maestro de artículos dinámico + Listas de precio
- ✅ `20260519164215` - Flujo de medición + Lotes + Roles

### Tablas Creadas
1. **`articulos`** - Maestro de artículos (15 artículos seed)
2. **`listas_precio`** - Listas de precios (2 listas: GENERAL y ARQUITECTOS)
3. **`listas_precio_items`** - Precios por artículo por lista (30 precios)
4. **`usuario_roles`** - Roles operativos granulares por usuario

### Columnas Agregadas
- **`ventas`**: 
  - `fecha_confirmacion_medidas`
  - `confirmado_por`
  - `notas_medicion`
  
- **`ordenes_trabajo`**: 
  - `medidas_confirmadas`
  - `fecha_medidas_confirmadas`
  
- **`remito_lines`**: 
  - `lote_codigo`
  
- **`chapas_inventario`**: 
  - `lote_codigo`

### Nuevos Estados de Venta
- Estado **`en_medicion`** agregado al enum `venta_estado`

### Funciones RPC Disponibles
1. `get_articulos_con_precios(p_lista_precio_id uuid)` - Obtener artículos con precios de una lista
2. `tiene_rol(p_rol rol_operativo)` - Verificar si el usuario tiene un rol específico
3. `mis_roles()` - Obtener todos los roles del usuario autenticado

### Roles Operativos Disponibles
- `vendedor`
- `medidor`
- `cortador`
- `produccion`
- `instalador`
- `reparador`
- `administracion`
- `admin`

---

## 🧪 Flujo de Prueba Completo - Fase 1

### Prerequisitos
1. Tener el servidor de desarrollo ejecutándose: `npm run dev`
2. Usuario autenticado en el sistema
3. Base de datos Supabase conectada

---

### 📋 Prueba 1: Maestro de Artículos Dinámico

**Objetivo:** Verificar que el sistema use artículos de la base de datos en lugar de mocks.

#### Pasos:
1. **Navegar al wizard de presupuesto**
   - Ir a Presupuestos → Nuevo Presupuesto
   
2. **Llegar al paso de "Órdenes de Trabajo"**
   - Completar el paso "Cliente" (nombre, teléfono, dirección)
   - Click en "Siguiente"
   
3. **Agregar ítems a una OT**
   - Click en "Agregar ítem"
   - Verificar que aparezcan los artículos desde la base de datos:
     - Mesada y alzada (M2)
     - Zócalo (ML)
     - Bacha integrada — mano de obra (UNI)
     - etc.

#### ✅ Validaciones:
- [ ] Los artículos se cargan desde la base de datos (no son hardcoded)
- [ ] Se muestran 15 artículos diferentes
- [ ] Cada artículo muestra correctamente su unidad (M2/ML/UNI)
- [ ] Los precios se obtienen de la lista seleccionada

---

### 💰 Prueba 2: Múltiples Listas de Precios

**Objetivo:** Verificar que se puedan usar diferentes listas de precios con precios distintos.

#### Pasos:
1. **Iniciar un presupuesto con Lista General**
   - En el wizard, seleccionar lista: "Lista general (público)"
   - Agregar ítem: "Mesada y alzada" (2.5m × 0.6m = 1.5 m²)
   - Verificar precio: **USD 85/m²** → Total: USD 127.50

2. **Iniciar otro presupuesto con Lista Arquitectos**
   - Nuevo presupuesto
   - Seleccionar lista: "Arquitectos y diseñadores"
   - Agregar el mismo ítem: "Mesada y alzada" (1.5 m²)
   - Verificar precio: **USD 72/m²** → Total: USD 108.00

#### ✅ Validaciones:
- [ ] El selector de lista de precios aparece en el wizard
- [ ] Se muestran 2 opciones: "Lista general (público)" y "Arquitectos y diseñadores"
- [ ] Los precios cambian según la lista seleccionada
- [ ] Diferencia de ~15% entre las dos listas
- [ ] El presupuesto muestra la moneda correcta (USD)

---

### 📏 Prueba 3: Flujo de Medición (Estado Intermedio)

**Objetivo:** Verificar el nuevo flujo donde la OT no pasa a producción hasta confirmar medidas.

#### Flujo Completo:

**PASO 1: Crear Presupuesto**
1. Crear presupuesto aproximado con medidas estimadas
   - Cliente: "María González"
   - Teléfono: "2612345678"
   - OT 1: Mesada cocina 3.0 × 0.6 (estimado)
   - Material: Piedra Boreal
   - Estado inicial: **"pendiente"**

**PASO 2: Registrar Seña (Cliente aprueba)**
1. Cliente aprueba y seña 30%
2. Ir a "Ventas" → Encontrar el presupuesto
3. Registrar pago: 30% en efectivo
4. **Verificar estado:** Debe cambiar a **"señado"** (no "en_produccion")

**PASO 3: Coordinar Medición**
1. Vendedor coordina medición en obra
2. Se asigna medidor (puede ser el mismo vendedor u otro usuario)
3. **Estado:** Sigue en "señado", esperando medición

**PASO 4: Medidor va a Obra**
1. Medidor llega a la obra y toma medidas reales
2. Resultado: 3.10 × 0.65 (hay una diferencia)
3. Medidor ingresa al sistema (mobile o desktop)
4. **Estado:** Cambia a **"en_medicion"**

**PASO 5: Vendedor Confirma Medidas**
1. Vendedor ve que hay medición pendiente
2. Revisa diferencias:
   - Original: 3.0 × 0.6 = 1.80 m²
   - Real: 3.10 × 0.65 = 2.02 m² (+12%)
3. Ajusta el presupuesto con medidas reales
4. Informa al cliente la diferencia de precio
5. Cliente confirma/cancela saldo
6. **Vendedor marca "Medidas confirmadas"**
7. **Estado:** Cambia a **"en_produccion"**
8. La OT aparece automáticamente en el Kanban de producción

#### ✅ Validaciones:
- [ ] Estado "señado" → no crea OT en producción inmediatamente
- [ ] Nuevo estado "en_medicion" funciona correctamente
- [ ] Campos `fecha_confirmacion_medidas` y `confirmado_por` se guardan
- [ ] Campo `notas_medicion` permite guardar observaciones del medidor
- [ ] Solo después de "confirmar medidas" la OT pasa a producción
- [ ] La columna `medidas_confirmadas` en OT se marca como `true`

---

### 📦 Prueba 4: Registro de Lotes en Stock

**Objetivo:** Verificar que las chapas y remitos se puedan marcar con código de lote.

#### Pasos:

**PASO 1: Crear Remito con Lote**
1. Ir a Stock → Remitos → Nuevo Remito
2. Proveedor: "Mármoles del Sur"
3. Agregar línea:
   - Material: Piedra Boreal
   - Cantidad: 10 chapas
   - Dimensiones: 3.20 × 1.80
   - **Lote: "BOREAL-2024-05"**
4. Guardar remito
5. El sistema debe crear 10 chapas en `chapas_inventario`

**PASO 2: Verificar Chapas con Lote**
1. Ir a Stock → Chapas
2. Filtrar por material "Piedra Boreal"
3. Verificar que las 10 chapas tengan `lote_codigo = "BOREAL-2024-05"`

**PASO 3: Crear Segundo Remito con Otro Lote**
1. Nuevo remito del mismo material
2. **Lote: "BOREAL-2024-06"** (lote diferente)
3. Agregar 8 chapas

**PASO 4: Consultar Stock por Lote**
1. Ver stock disponible agrupado por lote
2. Debe mostrar:
   - BOREAL-2024-05: 10 chapas disponibles
   - BOREAL-2024-06: 8 chapas disponibles

#### ✅ Validaciones:
- [ ] Campo `lote_codigo` existe en `remito_lines`
- [ ] Campo `lote_codigo` existe en `chapas_inventario`
- [ ] Al crear remito con lote, las chapas heredan el lote
- [ ] Se puede filtrar y buscar por lote
- [ ] El sistema alerta si se intentan mezclar lotes en una OT (futuro)

---

### 👤 Prueba 5: Roles Granulares

**Objetivo:** Verificar que los usuarios pueden tener múltiples roles operativos.

#### Pasos:

**PASO 1: Asignar Roles a Usuario**
1. Como admin, ir a Configuración → Usuarios
2. Seleccionar un usuario "Juan Pérez"
3. Asignar roles:
   - [x] Vendedor
   - [x] Medidor
   - [x] Instalador
4. Guardar

**PASO 2: Verificar con RPC `mis_roles()`**
```sql
SELECT * FROM mis_roles();
-- Debe devolver: vendedor, medidor, instalador
```

**PASO 3: Verificar Permisos con `tiene_rol()`**
```sql
SELECT tiene_rol('vendedor'::rol_operativo); -- true
SELECT tiene_rol('cortador'::rol_operativo); -- false
```

**PASO 4: Navegación Condicional**
1. Iniciar sesión como "Juan Pérez"
2. Verificar que el menú muestre:
   - ✅ Presupuestos (vendedor)
   - ✅ Mediciones (medidor)
   - ✅ Instalaciones (instalador)
   - ❌ Kanban Producción (no tiene rol produccion)
   - ❌ Reclamos (no tiene rol reparador)

#### ✅ Validaciones:
- [ ] Tabla `usuario_roles` existe y funciona
- [ ] Un usuario puede tener múltiples roles
- [ ] Función `mis_roles()` devuelve todos los roles del usuario
- [ ] Función `tiene_rol()` valida correctamente
- [ ] Los admin tienen todos los roles implícitamente
- [ ] RLS protege las operaciones según los roles

---

## 🔄 Flujo Completo End-to-End

### Escenario: "Mesada de cocina para María González"

```
┌──────────────────────────────────────────────────────────────┐
│  1. PRESUPUESTO                                              │
│  ────────────────────────────────────────────────────────── │
│  • Vendedor: Franco                                          │
│  • Cliente: María González                                   │
│  • Lista: Arquitectos (es referida por un arquitecto)        │
│  • Material: Piedra Boreal                                   │
│  • Artículos:                                                │
│    - Mesada y alzada: 3.0 × 0.6 = 1.8 m² @ USD 72/m² = $129.60 │
│    - Zócalo: 3.0 ml @ USD 30/ml = $90                       │
│    - Bacha MO: 1 uni @ USD 38 = $38                         │
│  • MEC: USD 80                                               │
│  • Total: USD 337.60                                         │
│  • Estado: pendiente                                         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  2. SEÑA (30%)                                               │
│  ────────────────────────────────────────────────────────── │
│  • Cliente seña USD 100 en efectivo                          │
│  • Estado: señado ✅                                          │
│  • Saldo pendiente: USD 237.60                               │
│  • ⚠️ OT NO se crea todavía en producción                    │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  3. MEDICIÓN EN OBRA                                         │
│  ────────────────────────────────────────────────────────── │
│  • Se coordina medición (5-10 días después)                  │
│  • Medidor: Carlos (tiene rol "medidor")                     │
│  • Va a obra, toma medidas reales:                           │
│    - Medida real: 3.10 × 0.65 = 2.02 m² (no 1.8 m²)        │
│  • Medidor ingresa datos al sistema                          │
│  • Notas: "Hay columna, requiere corte en L"                │
│  • Estado: en_medicion ✅                                     │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  4. VENDEDOR CONFIRMA MEDIDAS                                │
│  ────────────────────────────────────────────────────────── │
│  • Vendedor Franco ve diferencia:                            │
│    - Estimado: 1.8 m² → USD 129.60                          │
│    - Real: 2.02 m² → USD 145.44 (+12%)                      │
│  • Diferencia: USD 15.84                                     │
│  • Franco llama a María, informa diferencia                  │
│  • María acepta                                              │
│  • Franco marca "Medidas confirmadas" ✅                      │
│  • Estado: en_produccion ✅                                   │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  5. PRODUCCIÓN (Kanban)                                      │
│  ────────────────────────────────────────────────────────── │
│  • La OT aparece automáticamente en Kanban                   │
│  • Valentino (rol: produccion) ve la OT                      │
│  • Material: Piedra Boreal, Lote: BOREAL-2024-05            │
│  • Sistema reserva 1 chapa del lote                          │
│  • OT pasa por: corte → producción → despacho               │
│  • Se registran retazos: 0.80 × 0.60 → vuelve a stock       │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  6. ENTREGA E INSTALACIÓN                                    │
│  ────────────────────────────────────────────────────────── │
│  • Cliente cancela saldo: USD 253.44 (237.60 + 15.84)       │
│  • Instalador: Carlos (mismo que hizo medición)              │
│  • Instalación completa                                      │
│  • Estado: entregado ✅                                       │
│  • Trazabilidad: chapa #123, lote BOREAL-2024-05            │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Datos de Prueba (Seed)

### Artículos Disponibles (15 total)
```
MES-ALZ   | Mesada y alzada              | M2  | $85 (gral) / $72 (arq)
MES-ASA   | Mesada de asador             | M2  | $80 / $68
MES-BAÑ   | Mesada de baño               | M2  | $75 / $64
ZOC-ML    | Zócalo                       | ML  | $35 / $30
BIS-ML    | Biselado                     | ML  | $40 / $34
BACH-MO   | Bacha integrada MO           | UNI | $45 / $38
BACH-INS  | Instalación bacha cliente    | UNI | $30 / $25
PAT-UNI   | Pata de isla                 | UNI | $25 / $21
... (7 más)
```

### Listas de Precio (2)
```
GENERAL     | Lista general (público)        | USD
ARQUITECTOS | Arquitectos y diseñadores      | USD (~15% desc)
```

---

## 🐛 Checklist de Verificación Final

### Base de Datos
- [x] Migraciones aplicadas correctamente
- [x] 15 artículos seed cargados
- [x] 2 listas de precios con 30 precios
- [x] Estado "en_medicion" agregado al enum
- [x] Columnas de medición en `ventas` y `ordenes_trabajo`
- [x] Columnas de lote en `remito_lines` y `chapas_inventario`
- [x] Tabla `usuario_roles` creada
- [x] Funciones RPC disponibles

### Frontend (verificar implementación)
- [ ] Wizard usa artículos desde BD (reemplazar mocks)
- [ ] Selector de lista de precios funcional
- [ ] Flujo de medición implementado (3 estados)
- [ ] Campos de lote en formulario de remitos
- [ ] Gestión de roles de usuario en configuración
- [ ] Vista de mediciones pendientes
- [ ] Botón "Confirmar medidas" en ventas

### Backend/Lógica
- [ ] RPC `get_articulos_con_precios()` funcionando
- [ ] Transiciones de estado correctas: señado → en_medicion → en_produccion
- [ ] Validación de lotes (no mezclar en misma OT)
- [ ] RLS por roles funcionando

---

## 📝 Próximos Pasos (Post-Prueba)

Una vez validado el flujo básico de Fase 1:

1. **Conectar Frontend con nuevas tablas**
   - Reemplazar `presupuesto-articulos-mock.ts` con query a BD
   - Agregar selector de lista de precio al wizard
   - Implementar vista de mediciones pendientes

2. **Implementar estados de medición en UI**
   - Agregar estado visual "en_medición" en listado de ventas
   - Crear botón "Confirmar medidas" 
   - Formulario de carga de medidas (medidor)

3. **Gestión de lotes en stock**
   - Agregar campo lote en formulario de remitos
   - Mostrar lote en listado de chapas
   - Alertas de mezcla de lotes

4. **Sistema de roles en UI**
   - Navegación condicional según roles
   - Formulario de asignación de roles a usuarios
   - Verificación de permisos en componentes

---

**Última actualización:** 02/10/2026 — medición como módulo de venta

---

## Medición y paso a producción (oct 2026)

Tabla `presupuesto_mediciones` (una fila por presupuesto). La seña ya **no** manda a producción.

### Recorrido manual

1. **Flujo normal:** aprobar presupuesto → cargar seña → en Presupuestos, «Listo para medir» (fecha opcional) → en Medición, confirmar medidas → «Enviar a producción». La OT aparece en Producción (corte), no antes.
2. **Medición con presupuesto pendiente:** desde Presupuestos pendientes, «Listo para medir» sin seña. Valentino confirma medidas. «Enviar a producción» debe decir **Falta la seña** (y/o que no está aprobado).
3. **Saltar medición:** «Saltar medición» con motivo (cliente ya trajo la medida). Con seña y aprobado, el vendedor envía a producción.
4. **Bloqueo:** intentar avanzar una OT de medición a corte sin seña o sin medir: el sistema bloquea con el motivo.
5. **Editar medidas con OT ya creada:** desde el detalle de OT, editar medidas versiona el presupuesto (V2+) y actualiza el total.
6. **Datos migrados:** OTs que ya estaban en corte/producción siguen en Producción. Las que estaban en Técnica aparecen en Medición como listo para medir (o medido si ya tenían medidas confirmadas).
