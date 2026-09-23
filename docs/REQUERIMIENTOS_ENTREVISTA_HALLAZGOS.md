# Documento de requerimientos

Entrevista de hallazgos y arreglos — Piedra Americana

**Fecha:** 20/09/2026  
**Participantes:** Cintia y Francisco (dueños), Valentino (empleado), administrativa  
**Fuente:** dos audios de la misma reunión (entrevista completa)

La lista de arriba es **todo lo que se habló**: lo que ya está en el sistema y se mostró, más lo que pidieron cambiar.  
Al final está la sección **solo con lo que hay que agregar, mejorar o modificar**.

---

## 1. Clientes

1. Al crear un cliente rápido desde el presupuesto, cargar: **dirección, teléfono, contacto y email**.
2. Ver el **historial completo del cliente**: saldo (pesos y dólares), cobrado, presupuestos y OTs abiertas.
3. Ese historial es especialmente útil cuando el cliente es **arquitecto**.
4. En el cliente, poder marcar si es **agente de retención** y el **porcentaje** (ejemplo: 5% o 10%).

---

## 2. Presupuestos

5. Cada presupuesto nuevo entra siempre en **Pendientes**. Después pasa a aprobado o rechazado.
6. Poder **editar** el presupuesto y guardar **versiones**.
7. Incluir **dirección de obra** y **referencia de obra**.
8. Poder **adjuntar** cotización, foto o plano (escaneo o foto).
9. Tener una **fecha estimada de entrega** (no obligatoria).
10. Un presupuesto puede tener **varias OT** (ejemplo: OT cocina, OT baño).
11. Cada OT es **un trabajo**, no una pieza. Adentro puede haber 1, 2 o muchas piezas.
12. En cada pieza cargar: medidas, faldón, inglete (metro lineal), corte, terminación de canto, perforación, zócalo, bacha, herrería y mano de obra.
13. Los precios salen de la **lista de precios del producto**, no de la chapa.
14. Hoy tienen **una sola lista de venta** y hacen descuentos distintos según el caso.
15. Además hace falta una **lista de precios para arquitectos**.
16. Unidades de medida: **m², metro lineal, unidad, pieza, kilo y tonelada**.
17. Medición, entrega y colocación se pueden sumar al presupuesto (o no).
18. Poder aplicar **descuento** y ver un resumen claro: trabajo, pieza, tamaño, servicios y total.
19. Descargar / imprimir el presupuesto.
20. Poder mezclar monedas: **producto en dólares e instalación en pesos**, con el **tipo de cambio del día**.

---

## 3. Medición y paso a producción

21. La **medición es parte de la venta**, no de la producción.
22. Flujo normal: el cliente trae medidas → se arma el presupuesto → si hay seña/aprobación, se coordina la medición.
23. Casi nunca coinciden las medidas. Hoy cargan una **OT nueva** por la diferencia. Lo correcto: **editar la misma OT**, que actualice el presupuesto y se cobre el extra.
24. Al editar: corregir medidas, ajustar precio y **subir el plano** (dibujo de Johnny / foto / PDF).
25. El vendedor marca **listo para medir**. Valentino coordina y cambia el estado: **pendiente de medir → medido**. El **vendedor** es quien manda a producción, no Valentino.
26. Hace falta un panel: **qué hay para medir esta semana**.
27. En el **90%** no miden si el presupuesto no está aprobado. En el **10%** sí: poder mandar a medición **aunque el presupuesto siga pendiente**.
28. Si el cliente ya trae la medida final (ejemplo: mesada de 1 × 2), **saltar medición** y pasar directo a producción.
29. **Nunca hay producción sin seña.**
30. Lo que ve Valentino al arrancar el día: **solo lo que ya está para producir** (medidas confirmadas + presupuesto aprobado + seña).
31. El plano, por ahora, se **adjunta**. A futuro (no ahora) se podría conectar con la app de planos de Luz.

---

## 4. Ventas y cobros

32. Al aprobar, poder cargar **seña**: monto, moneda, fecha, forma de pago (transferencia, cheque, tarjeta, Mercado Pago) y una nota.
33. Registrar **varios pagos** después (parciales).
34. Ver claro: **total, cobrado y saldo pendiente**.
35. Ver **por cobrar en dólares y en pesos**.
36. Filtrar ventas/cobros **por rango de fechas**.
37. Filtrar **por vendedor**, para que cada uno haga el seguimiento de sus clientes.
38. Exportar el listado a **PDF / Excel / imprimir**.

---

## 5. Stock, retazos y roturas

39. El stock les importa: hacen **conteo cada 15 días**.
40. Stock y lista de precios son cosas distintas.
41. Hay **dos stocks**: productos que fabrican ellos (adoquines, granzas, etc.) y **chapas**, que se descuentan por las OT.
42. Al presupuestar **no eligen chapa**. Trackear cada chapa completa hoy les resulta difícil; se puede dejar, pero no lo van a usar mucho.
43. Sí hace falta **alertar si un retazo puede servir** para el trabajo (ejemplo: hay un pedazo de 1 m × 80 cm y se vende una mesada de 80 × 60).
44. Poder **cargar retazos a mano**, aunque no se sepa de qué chapa salieron.
45. **Problema actual de roturas:** cortan, se rompe (en corte, instalación o viaje), vuelven a cortar y no lo cargan. El stock queda mal.
46. Marcar **rotura de chapa** o **rotura de pieza/mesada**, con motivo.
47. **Bloquear** el pedazo roto (no darle de baja de una). Queda asociado al cliente/trabajo.
48. Ver un listado de **pedazos bloqueados** para recortar cuando haga falta.
49. Poder **dar de baja un pedazo igual** (reposición): que **descuente stock** y **no le sume precio al cliente**.
50. Quedar registrado **de qué trabajo y de qué cliente** se rompió.
51. Avisar cuando **no queda más** de un material (ejemplo: se acabó el granito negro).

---

## 6. Ingreso de chapas

52. Ingresar por **remito**: proveedor, fecha, origen (nacional / importado / cantera), número de remito, material, lote, precio.
53. Cada placa tiene **número de serie**. El lote arranca con un **número de bulto inicial** y sigue en secuencia.
54. En una tirada las placas suelen ser del **mismo tamaño**. A veces varían un poco (3,6 vs 3,8). Dejar las dos opciones: medidas iguales o distintas.
55. Guardar: cantidad de placas, metros de cada una y **m² totales**.
56. Poder **imprimir un rótulo** apenas llega la placa. El que trae de fábrica se pierde con el agua y la máquina.
57. Exportar stock a **CSV** y ver historial de remitos.
58. Si el material no existe, **crearlo en el momento**.

---

## 7. Cantera

59. Ingreso: proveedor, fecha, remito, observación y líneas (material + kilos/toneladas).
60. Ver por lote: **bruto ingresado, procesado y stock neto**.
61. Procesar: elegir el lote, cuántos kilos se consumen y **qué producto sale** (adoquines, granzas, piedritas, etc.), en unidad, m², metro lineal o kilo.
62. Eso **descuenta la piedra** y **suma el producto al stock**.
63. El producto tiene que salir del **catálogo / lista de precios**, no escribir el nombre a mano.
64. Algunos materiales se manejan en **kilo/tonelada**, otros en **m²**.
65. Pedirles el **listado de productos** (adoquines por color, granzas, etc.) por Excel.

---

## 8. Bachas

66. En el presupuesto marcar: **si lleva bacha**, **tipo**, **por arriba o por abajo**, y si es **nuestra o del cliente**.
67. Tener **stock de bachas**. Lugo las compra y las da de alta.
68. Poder **asignar una bacha del stock a una OT**.
69. Si la bacha la trae el cliente, también entra a stock pero **con el nombre del cliente**. No se puede vender (ejemplo: Q70 de Escallones).
70. Pasa mucho: la OT ya está en producción y **el cliente todavía no trajo la bacha**. En el rótulo tiene que decir **bacha pendiente**.
71. El vendedor se encarga de pedírsela. Cuando llega, **producción** cambia pendiente → asignada y elige la bacha del stock.
72. Hasta que no esté la bacha, el trabajo **queda parado** en perforación.

---

## 9. Producción y taller

73. El marmolero **no usa el sistema**. La oficina carga. El taller trabaja con el **plano impreso**.
74. Valentino necesita un **rótulo claro** (no menús escondidos). Al toque tiene que ver:
    - cliente y dirección
    - ambiente
    - material
    - medidas
    - plano (el de Johnny)
    - si lleva bacha, tipo, propia o del cliente, si ya la trajo
    - si lleva zócalo
    - NAFE (lo van a cargar ellos; preguntan mucho)
75. Un clic tiene que abrir el **plano**.
76. Después del corte se trabaja con **piezas**, no con m². Los m² sirven **solo para stock**.
77. Agregar **más filtros** en producción.
78. Definir si la OT avanza **entera por etapas** o **por partes / piezas**.
79. Pedir una **OT real** de ellos para copiar el formato de corte.

---

## 10. Proveedores

80. Datos: nombre, razón social, rubro (placas naturales, industriales, piedra por kilo, otros), origen, CUIT, condición IVA, contacto, teléfono, email, dirección, localidad, provincia, código postal y notas.

---

## 11. Comercio exterior

81. **Importación** por etapas: orden de compra → embarque → tránsito → aduana → nacionalizada → depósito.
82. No hace falta cargar todo al principio: se completa después.
83. Datos: proveedor, descripción, país, orden de compra, fechas, monto, factura, transporte, BL/AWB, llegada estimada y real, despachante y notas.
84. Pestañas de **costos** (mercadería, seguro, flete, etc.), **documentos** (factura provisoria/definitiva, despacho, packing list) y, si sirve, **ingreso de stock**.
85. Los documentos se suben como hoy: **carpetas con PDF / imágenes**.
86. **Exportación** (pedido de Fran): misma base, pero con **datos del cliente**, **datos del banco** (dónde entra el pago) y factura. El BL lo maneja el cliente; algunos documentos se usan y otros no.
87. Separar importación y exportación.

---

## 12. Finanzas

88. Centralizar toda la plata de la app: cobros de OT, pagos a proveedores, ingresos y egresos extra, y **dónde está la plata** (efectivo, transferencia, cheque, tarjeta; pesos y dólares).
89. Poder mover plata **entre cajas** (ejemplo: comprar dólares).
90. Cargar un ingreso o un gasto **que no sea de una OT ni de un proveedor**.
91. Adjuntar **comprobante** (PDF) al movimiento.
92. **Tarjeta de crédito:** se cobra hoy y se acredita después (aprox. 7 días). Poder marcar, de los pendientes de tarjeta, **cuánto realmente ingresó** (a veces cobran 10 y acreditan 7).
93. El banco **no se conecta solo**. Ellos revisan el banco todos los días. El sistema registra lo que ellos marcan.
94. A futuro (no ahora): leer un extracto PDF/Excel con IA. Cuesta plata y es difícil relacionar “quién transfirió” con “a quién se facturó”.
95. **Retenciones:** si el cliente es agente de retención, al cobrar por transferencia o cheque se descuenta el %. En efectivo, no. El recibo tiene que mostrar la retención. Se puede ajustar al registrar el pago.

---

## 13. Empleados y gastos

96. Liquidaciones, adelantos e incentivos de empleados.
97. También pagar a **no empleados** (contador, redes, etc.).
98. Cargar **gastos de la empresa**: alquileres, luz, gas, impuestos y lo que haya que liquidar.

---

## 14. Reportes

99. Lo cobrado, por cobrar y vencimientos.
100. Desperdicios.
101. Comercial: presupuestos del mes, por día, ticket promedio, etapas y materiales.

---

## Para que ellos entreguen

- Un **listado de productos** (adoquines por color, granzas, etc.) por Excel.
- Una **OT real** de corte, para copiar el formato.
- Las opciones de **NAFE** que usan hoy.

---

# Qué hay que agregar / mejorar / modificar

Solo lo que falta o hay que cambiar. Lo que ya anda (ficha de cliente, presupuesto, seña, cobros, cantera, remitos, proveedores, importación, reportes, etc.) no se repite acá.

---

## 1. Clientes

- Marcar si el cliente es **agente de retención** y con qué **porcentaje**.

---

## 2. Presupuestos

- Completar unidades: además de m² / metro lineal / unidad, poder vender en **pieza, kilo y tonelada**.
- Hacer real la **moneda mixta**: producto en dólares e instalación en pesos, con el **tipo de cambio del día** (hoy está a medias).

---

## 3. Medición y paso a producción

- Sacar la medición de producción. Es **parte de la venta**.
- Panel: **qué hay para medir esta semana**.
- Flujo:
  1. El vendedor marca **listo para medir**.
  2. Valentino coordina y pasa **pendiente → medido**.
  3. El **vendedor** (no Valentino) manda a producción.
- Poder mandar a medición **aunque el presupuesto siga pendiente** (el 10% de los casos).
- Producción tiene que mostrar **solo lo listo para producir**: medidas confirmadas + aprobado + seña. Hoy la seña ya manda a producción.
- Seguir pudiendo **saltar la medición** si el cliente ya trae la medida final.

---

## 4. Ventas y cobros

- Filtro por **rango de fechas** (ejemplo: del 1 al 30).
- Filtro claro **por vendedor** (hoy se busca por texto, no hay un filtro dedicado).

---

## 5. Stock, retazos y roturas

- **Alerta** si un retazo de stock puede servir para un trabajo.
- Distinguir **rotura de chapa** vs **rotura de pieza/mesada**, con motivo.
- **Bloquear** el pedazo roto (no darle de baja de una) y asociarlo al cliente/OT.
- Listado de **pedazos bloqueados** para recortar.
- Aviso cuando **se acaba un material**.
- La reposición sin cobrarle al cliente **ya está**; hay que engancharla a este flujo de rotura.

---

## 6. Ingreso de chapas

- **Imprimir un rótulo** de cada placa apenas llega.
- Exportar también el **historial de remitos** (hoy el CSV es del stock de planchas).

---

## 8. Bachas

- En el presupuesto marcar: **si lleva**, **tipo**, **por arriba o por abajo**, **nuestra o del cliente**.
- Poder **asignar una bacha del stock a una OT**.
- Si la trae el cliente: entra a stock **con el nombre del cliente** y **no se puede vender**.
- En el rótulo de producción: **bacha pendiente** si todavía no la trajo.
- Hasta que no esté la bacha, el trabajo **queda parado** en perforación.
- El vendedor pide la bacha; **producción** la marca cuando llega.

---

## 9. Producción y taller

- Armar un **rótulo claro** (sin menús escondidos): cliente, dirección, ambiente, material, medidas, plano, bacha, zócalo, NAFE.
- Un clic abre el **plano**.
- Agregar **NAFE** (ellos pasan las opciones).
- Más filtros, si hace falta, cuando usen la diaria.
- Definir si la OT avanza **entera** o **por pieza**.
- Después del corte, trabajar con **piezas** (los m² quedan solo para stock).

---

## 11. Comercio exterior

- Armar **exportación** (aparte de importación): datos del cliente, datos del banco y factura. El BL lo maneja el cliente.

---

## 12. Finanzas

- Adjuntar **comprobante PDF** al movimiento.
- **Tarjeta:** se cobra hoy, se acredita después (~7 días). Poder tildar los pendientes y cargar **cuánto ingresó de verdad** (a veces cobran 10 y acreditan 7).
- **Retenciones** al cobrar: si el cliente es agente y paga transferencia/cheque, descontar el %. En efectivo, no. El recibo lo tiene que mostrar. Se puede ajustar al registrar el pago.
- No conectar el banco. No meter IA de extractos ahora.

---

## 13. Empleados y gastos

- **Incentivos** (hoy está vacío).
- Pagar a **no empleados** (contador, redes, etc.).
- Gastos fijos de la empresa (alquiler, luz, gas, impuestos) de forma más clara. Hoy se cargan como egresos sueltos en finanzas.

---

## No se toca (ya está o lo dijeron que no)

- Ficha e historial de cliente.
- Alta rápida de cliente.
- Wizard de presupuesto, versiones, MEC, descuento, impresión.
- Editar la misma OT después de medir y cobrar la diferencia.
- Seña, pagos parciales, saldo pesos/dólares.
- Cantera (ingreso y procesamiento).
- Remitos de chapas (serie, lote, medidas iguales/distintas).
- Proveedores.
- Importación.
- Reportes.
- Conexión con el banco ni chatbot de extractos.
