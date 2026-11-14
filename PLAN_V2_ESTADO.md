# BTC Intelligence — Plan de optimización V2

**Objetivo:** perfeccionar funciones existentes. BTCUSDT, Android PWA, R$0, GitHub Pages, sin órdenes reales ni otros proyectos.

**Regla:** VERDE = modificación implementada, probada y publicada; ROJO = pendiente (incluye trabajos parciales). No atribuir precisión predictiva a señales descriptivas.

**Bloque A1:** publicado en commit `6ae0a81`; pruebas automatizadas originales, comprobación móvil real 390×844. No reabrirlo sin motivo técnico.

**Bloque A2:** controles de velas Bybit cerradas y OI consecutivo alineados en 5m/15m/30m/1h/4h; agrupación de liquidez por bandas, clasificación relativa tamaño/persistencia/distancia y separación de precio en vivo entre exchanges. Pruebas específicas: `node tests/v2_a2_alignment_zones.test.cjs` (35 casos) y `node tests/v2_a2_mobile_live.cjs` (navegador móvil con fuentes reales).

**Bloque A3 (14/11/2026):** registro de aumentos/disminuciones del tamaño visible de cada nivel, memoria acotada, reapariciones del **nivel** de precio (no de una orden identificada), y umbrales por lado basados en percentil 90 de notional visible ×2,5 con límites US$80.000–850.000. Política común para clasificación, rupturas, alertas de aparición, reducción y zonas. Pruebas: `node tests/v2_a3_walls.test.cjs` (23 casos) y `node tests/v2_a3_mobile.cjs` (datos reales Android 390×844). Validación prolongada seguirá pendiente.

**Bloque B — mapa de calor (14/11/2026):** escala vertical adaptable a los precios absolutos de las muestras y al precio actual; agrupación temporal de libros sin proyectar cantidades antiguas sobre precios nuevos; bandas compras/ventas simultáneas; intensidad relativa logarítmica con percentil 90; marcas de hora local y huecos sin interpolar; compresión por precio, 160 buckets por lado, máximo 72 muestras/6 minutos, no capturar cuando la página está oculta, transformaciones de canvas sin escalados acumulativos y reutilización de dimensiones. Pruebas: `node tests/v2_heatmap.test.cjs` (20 casos) y `node tests/v2_heatmap_mobile.cjs` (390×844 con Bybit/otros componentes reales). No se ha medido duración de batería ni validado Android prolongadamente; #39 continúa ROJO.

**Bloque C — rupturas (14/11/2026):** #12 cruce de operaciones separado del cierre confirmado/rechazado de una vela Bybit cerrada en el marco elegido (se exige la vela siguiente; si hay fallback Binance, no se confirma); #13 retesteo observado con prueba de acercamiento al nivel y reacción posterior sin confundirlo con cierre; #14 umbral de desplazamiento relativo al rango medio de 3–4 velas cerradas, acotado entre 0,04% y 0,35%, bloqueado si falta evidencia; #15 deduplicación de cruces cercanos de la misma dirección durante 5 minutos por tolerancia relativa al precio y al umbral, con historial limitado y contadores de suprimidos. Pruebas focales: `node tests/v2_breakouts_c.test.cjs` (27 casos). Integración: `node tests/v2_breakouts_mobile.cjs` (390×844, 5 temporalidades, feeds Bybit/Binance, 0 errores JavaScript). Las comprobaciones de cierre y retesteo se hicieron también con eventos simulados; **no se valida todavía fiabilidad predictiva ni sesiones prolongadas**.

**Bloque D — operaciones, flujo y liquidaciones (14/11/2026):** #16 rachas de ejecuciones grandes del mismo lado separadas de prints aislados (máximo 12 s entre ejecuciones y diferencia relativa de precios ≤0,06%, sin atribuir operador); #17 presión agresora frente a desplazamiento real entre primera y última operación de la misma ventana de 90 s; #18 referencia de importe relativo por percentil 95 de las operaciones de 5 min, actualizada como máximo cada 5 s, con mínimos y manteniendo la configuración manual de alertas individuales como suelo; #19 ventanas independientes 90 s, 5 min y sesión (CVD y liquidaciones recibidas), con aviso de pérdida de cobertura y límites de memoria; #20 trades deduplicados por ID único de Bybit, secuencia temporal ordenada y precio en vivo protegido frente a entregas atrasadas, liquidaciones deduplicadas **solo aproximadamente** por huella de campos porque no existe identificador público único. Pruebas focales: `node tests/v2_flow_d.test.cjs` (27 casos). Integración: `node tests/v2_flow_mobile.cjs` (viewport móvil 390×844, datos BTCUSDT, 0 errores JS; más de 1000 operaciones reales recibidas; no se observaron liquidaciones reales durante la prueba corta). Pruebas de liquidaciones y de secuencias significativas reproducidas con datos sintéticos; no se garantiza precisión predictiva ni se confunde con pruebas prolongadas en Android físico (#39 ROJO).

## Libro de órdenes y bloqueos
- 🟢 01 Agrupar liquidez en bandas contiguas próximas por lado, sumando importes visibles de Bybit sin tratarlos como una orden única. Rangos y umbrales visibles en pantalla.
- 🟢 02 Registrar incrementos y reducciones relevantes de liquidez visible, importes antes/después y acumulados observados por nivel, con historial limitado y panel de evolución.
- 🟢 03 Detectar reapariciones de niveles previamente desaparecidos dentro de la sesión, con duración de ausencia y volumen visible; no atribuir identidad a órdenes ni operadores.
- 🟢 04 Umbrales adaptables por lado según percentil 90 de importe por nivel (×2,5), acotados entre US$80.000 y US$850.000; aplicados a nivel relevante, activación de rupturas, reducciones, alertas y zonas agregadas. Se mantienen límites de edad y proximidad para evitar falsas señales.
- 🟢 05 Prioridad relativa de muros y zonas mediante tamaño, permanencia observada y distancia al precio; índice comparativo, nunca probabilidad de resistencia.

## Mapa de calor
- 🟢 06 Escala vertical adaptable al rango de precios absolutos de las capturas, con margen para cambios rápidos de BTC.
- 🟢 07 Cada muestra conserva su nivel absoluto: no se trasladan concentraciones antiguas cuando se mueve el precio actual; ventanas sin reconstrucción ficticia.
- 🟢 08 Intensidad logarítmica relativa al percentil 90 y representación de ambas direcciones en una banda de precio cuando coexisten.
- 🟢 09 Posicionamiento de muestras según timestamps reales y etiquetas de hora local; huecos sin observaciones quedan vacíos y se señalan.
- 🟢 10 Optimización de recursos Android: muestreo solo en primer plano y con libro reciente, muestras comprimidas y acotadas, redibujo sin reiniciar tamaño del canvas salvo cambio real de dimensiones. **No implica medición experimental de ahorro de batería** (pendiente #39).

## Rupturas
- 🟢 11 No atribuir rupturas a muros eliminados o reducidos bajo el umbral. Incluye seguimiento de antigüedad de *importe suficiente* y preservación de claves exactas de precio del exchange.
- 🟢 12 Separa cruce intravela de vela Bybit realmente cerrada, con estado independiente confirmado/rechazado/pendiente/no verificable y temporalidad fijada al cruzar.
- 🟢 13 Sigue acercamiento al nivel cruzado y reacción posterior durante 4 minutos; muestra retesteo pendiente, tocado, rebote observado, fallido o no verificable tras desconexión. Es lectura descriptiva, no predicción.
- 🟢 14 Usa rango relativo medio de 3–4 velas Bybit CERRADAS del marco elegido, umbral acotado entre 0,04% y 0,35%; si no hay velas válidas no se crean cruces y no se usa Binance como respaldo para confirmación.
- 🟢 15 Agrupa cruces del mismo lado y precios cercanos en ventana de 5 min con tolerancia relativa a precio y umbral, sin suprimir niveles alejados; prioridad al muro activo mayor, contador de duplicados y memoria acotada.

## Grandes operaciones y liquidaciones
- 🟢 16 Distingue rachas de ≥3 operaciones grandes del mismo lado próximas en tiempo y precio de ejecuciones grandes aisladas; muestra valor, número y desplazamiento, sin identificar operadores.
- 🟢 17 Compara compras/ventas agresivas con desplazamiento entre primera y última operación del **mismo intervalo de 90 s**, mostrando rango y umbral contextual para posible absorción, sin certificar órdenes ocultas.
- 🟢 18 Referencia adaptativa de grandes operaciones según percentil 95 del tamaño de prints en 5 min con mínimas de seguridad, actualizada como máximo cada 5 s para evitar consumo excesivo. El umbral individual configurable por el usuario sigue siendo suelo; las rachas usan mínimo propio adaptable.
- 🟢 19 Flujos separados para 90 s, 5 min y CVD de sesión; liquidaciones 90 s, 5 min y acumulados de eventos recibidos durante la sesión, sin extrapolar periodos desconectados, con límites de memoria indicados.
- 🟢 20 Dedup de trades mediante el campo único Bybit `i` y validación de timestamps; eventos atrasados no retroceden el precio actual y las ventanas ordenan por momento de ejecución. Liquidaciones usan huella aproximada T/S/p/v (la fuente no proporciona ID único; dos eventos idénticos podrían confundirse).

## OI, funding y sentimiento
- 🟢 21 Comparación precio–OI con dos muestras consecutivas de OI y vela Bybit cerrada exactamente correspondiente, comprobada en 5m/15m/30m/1h/4h. Se rechazan velas abiertas, huecos, resultados atrasados o de otro exchange; zonas hipotéticas históricas también ancladas a intervalos cerrados. Datos descriptivos, no inferencia causal.
- 🔴 22 Calibración de cambios relevantes de OI.
- 🔴 23 Semántica de funding actual/pagado/futuro.
- 🔴 24 Interpretación conjunta del sentimiento horario.
- 🔴 25 Fecha y vigencia de todos los campos.

## Binance contra Bybit
- 🟢 26 Comparación de varias concentraciones entre los 20 niveles, no solo máximo por lado.
- 🔴 27 Normalización adicional entre exchanges (precio de referencia y microestructura).
- 🟢 28 Tolerancia relativa de precio (0,035%, mínimo US$10) en vez de ±US$20 constante.
- 🔴 29 Persistencia de niveles compartidos.
- 🟢 30 Separación de datos recientes y desfase entre fuentes (máximo 5 s para coincidencias).

## Alertas y Android
- 🔴 31 Prioridad de alertas.
- 🔴 32 Antirrepetición de muro/evento.
- 🔴 33 Resumen superior.
- 🔴 34 Secciones plegables.
- 🔴 35 Reconexiones y reanudación.

## Rendimiento y validación
- 🔴 36 Vigencia de todos los flujos por separado.
- 🔴 37 Reducir cálculos ocultos.
- 🔴 38 Reproducción adversarial de eventos reales y de prueba.
- 🔴 39 Validación prolongada de sesiones Android.
- 🔴 40 Comprobación automática de publicación.

**Estado tras Bloque D:** 24 ítems completamente terminados / 40 propuestos (60%); 16 pendientes. VERDE = implementado, probado focalmente y publicado. El resultado no significa acierto predictivo ni validación económica. Seguimiento continuo, reconexiones prolongadas y pruebas en Android físico (#35, #39) siguen ROJAS.
