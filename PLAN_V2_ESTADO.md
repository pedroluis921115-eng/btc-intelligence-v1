# BTC Intelligence — Plan de optimización V2

**Objetivo:** perfeccionar funciones existentes. BTCUSDT, Android PWA, R$0, GitHub Pages, sin órdenes reales ni otros proyectos.

**Regla:** VERDE = modificación implementada, probada y publicada; ROJO = pendiente (incluye trabajos parciales). No atribuir precisión predictiva a señales descriptivas.

**Bloque A1:** pruebas automatizadas: `node tests/v2_precision.test.cjs` (11 casos). Comprobación integrada adicional con navegador 390×844 y fuentes públicas reales. Esta lista se actualizará cuando se publique cada bloque.

## Libro de órdenes y bloqueos
- 🔴 01 Agrupar liquidez por zonas contiguas.
- 🔴 02 Medir cambios de volumen de muros.
- 🔴 03 Reconocer apariciones repetidas.
- 🔴 04 Umbrales relativos al libro.
- 🔴 05 Priorizar muros por tamaño, persistencia y proximidad de manera calibrada.

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
- 🔴 21 Alineación temporal completa entre precio y OI. **Avance comprobado:** el historial OI ya no convierte huecos de 5 min en incrementos, ni muestra porcentajes sobre registros no consecutivos o atrasados; queda pendiente validar la alineación completa con el precio.
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

**Estado tras A1:** 4 ítems completamente terminados / 40 propuestos; 36 pendientes, uno (#21) parcialmente mejorado pero aún ROJO. Los ítems no finalizados no se consideran aprobados por el simple hecho de que exista alguna función parecida en V1.
