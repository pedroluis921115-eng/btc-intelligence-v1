# BTC Intelligence — Plan de optimización V2

**Objetivo:** perfeccionar funciones existentes. BTCUSDT, Android PWA, R$0, GitHub Pages, sin órdenes reales ni otros proyectos.

**Regla:** VERDE = modificación implementada, probada y publicada; ROJO = pendiente (incluye trabajos parciales). No atribuir precisión predictiva a señales descriptivas.

**Bloque A1:** publicado en commit `6ae0a81`; pruebas automatizadas originales, comprobación móvil real 390×844. No reabrirlo sin motivo técnico.

**Bloque A2:** controles de velas Bybit cerradas y OI consecutivo alineados en 5m/15m/30m/1h/4h; agrupación de liquidez por bandas, clasificación relativa tamaño/persistencia/distancia y separación de precio en vivo entre exchanges. Pruebas específicas: `node tests/v2_a2_alignment_zones.test.cjs` (35 casos) y `node tests/v2_a2_mobile_live.cjs` (navegador móvil con fuentes reales).

## Libro de órdenes y bloqueos
- 🟢 01 Agrupar liquidez en bandas contiguas próximas por lado, sumando importes visibles de Bybit sin tratarlos como una orden única. Rangos y umbrales visibles en pantalla.
- 🔴 02 Medir cambios de volumen de muros.
- 🔴 03 Reconocer apariciones repetidas.
- 🔴 04 Umbrales relativos al libro para todos los detectores. **Parcial:** la clasificación de zonas agrupadas ya usa una mediana del importe de niveles visibles y suelo US$180.000, pero los detectores individuales siguen con umbrales fijos.
- 🟢 05 Prioridad relativa de muros y zonas mediante tamaño, permanencia observada y distancia al precio; índice comparativo, nunca probabilidad de resistencia.

## Mapa de calor
- 🔴 06 Escala de precios adaptable.
- 🔴 07 Conservar referencias históricas con desplazamientos del precio.
- 🔴 08 Contraste de intensidades.
- 🔴 09 Intervalos temporales claramente legibles.
- 🔴 10 Optimización de renderizado y batería Android.

## Rupturas
- 🟢 11 No atribuir rupturas a muros eliminados o reducidos bajo el umbral. Incluye seguimiento de antigüedad de *importe suficiente* y preservación de claves exactas de precio del exchange.
- 🔴 12 Diferenciar cruce de cierre de vela.
- 🔴 13 Seguimiento de retesteo de nivel.
- 🔴 14 Umbral ajustado a volatilidad.
- 🔴 15 Deduplicación avanzada de movimientos.

## Grandes operaciones y liquidaciones
- 🔴 16 Secuencias frente a transacciones aisladas.
- 🔴 17 Agresión frente a desplazamiento resultante.
- 🔴 18 Alertas relativas al volumen habitual.
- 🔴 19 Ventanas y acumulados separados.
- 🔴 20 Deduplicación y orden temporal de eventos.

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

**Estado tras A2:** 7 ítems completamente terminados / 40 propuestos (17,5%); 33 pendientes. El ítem #04 es parcial y permanece ROJO. Los avances se marcarán verdes únicamente tras publicación y verificación. No se considera que una puntuación de prioridad sea probabilidad de éxito.
