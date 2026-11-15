# Mejora de lectura de mapa de calor BTC V2 — 14/11/2026

**Objetivo:** que el mapa de calor de liquidez real y los muros principales se comprendan en pocos segundos desde Samsung Android. Cambios exclusivamente visuales y de presentación; no cambia señales, estimación de liquidaciones, BTCUSDT, API, órdenes ni laboratorio de probabilidades.

**Cambios realizados:** el panel de Bybit L2 aparece inmediatamente bajo el resumen principal, inicialmente abierto en nuevas instalaciones (respeta estados persistidos). Presenta tres bloques con el precio BTC actual, mayor muro vendedor arriba y mayor muro comprador abajo, más el importe visible y la distancia porcentual. Las bandas históricas mantienen precios absolutos y huecos temporales, ahora con mayor altura e intensidad visual. Línea amarilla contrastada y etiqueta de precio actual; marcadores de muros solamente en el extremo más reciente (no se dibujan hacia el pasado). Muestras de 5 segundos y máximo 6 minutos como antes. La compra aparece verde, venta roja, precio amarillo. El resumen y las etiquetas se vacían al perder frescura del libro (≤12 s) o del precio (≤20 s).

**Restricciones científicas:** las bandas representan órdenes pasivas observadas en Bybit L2, solo 200 niveles por lado y 1,3% de distancia al precio. No representan liquidaciones ejecutadas ni estimadas, probabilidad de subida o de bajada, órdenes garantizadas ni acción de una ballena específica. No se infieren cotizaciones históricas durante la página cerrada. Los muros pueden desaparecer o cambiar.

**Verificación:** 19/19 prueba focal de conexión/alertas; 31/31 regresión adversarial de WebSockets; test móvil real del flujo existente en Chromium 390 y 320px, desconexión y recuperación; test focal independiente del nuevo mapa en Chromium móvil 390 y 320px, con precio y muros observados, tratamiento de libro obsoleto, lectura y sin desbordamiento horizontal. El contador formal de 40 mejoras V2 permanece inalterado: mejora #39 de validación prolongada Android físico no se considera certificada por pruebas emuladas.

**Versionado:** v2-liquidity-readable-20261114, con caché Service Worker nuevo; este archivo solo documenta claridad de lectura.

Si las cifras difieren al instante del precio principal, se deben a la recepción asincrónica de operaciones vs. libro de órdenes. El estado de frescura controla los rótulos.
