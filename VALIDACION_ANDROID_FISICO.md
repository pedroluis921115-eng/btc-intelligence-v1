# BTC Intelligence V2 — validación #39 en Android físico

**Estado:** HOLD hasta observación directa en el teléfono. Un navegador Puppeteer con viewport 390×844 y 320×780 NO acredita el dispositivo, batería ni continuidad real.

## Sesión de validación (una sola ronda)

1. Abrir la versión publicada desde HTTPS en Chrome Android, con Internet real. Mantenerla en primer plano aproximadamente **45 minutos**. Registrar hora de inicio, hora final y versión visible. No instalar herramientas ni ejecutar órdenes.
2. Comprobar al inicio, a mitad y al final que precio BTCUSDT, libro Bybit y Binance se actualizan con sus estados de vigencia independientes, que las alertas y el resumen superior siguen visibles y que se puede abrir el mapa de calor y el gráfico OI sin bloqueo. No exigir la llegada de liquidaciones, que pueden no ocurrir.
3. Cambiar a otra aplicación durante **10–15 minutos** y volver a BTC Intelligence. Verificar que los datos atrasados se etiquetan como tales, que las conexiones se reanudan cuando vuelve a primer plano y que no se inventa actividad durante la suspensión.
4. Anotar cualquier congelamiento, cierre de pestaña, recarga forzada, aviso engañoso de VIGENTE durante desconexión o pérdida excesiva de batería. Anotar la variación de batería antes/después y uso aproximado de pantalla, si el sistema lo permite, sin confundirla con causalidad precisa.
5. Repetir una vez con Wi-Fi/datos móviles alternando solo si hay condiciones normales para hacerlo. Si se interrumpe, conservar el fallo y no declarar un PASS.

## PASS / HOLD

**PASS** exclusivamente si la prueba se realizó en Android físico y deja evidencia fechada (capturas al inicio/final y después de recuperar el primer plano, junto con los incidentes y porcentaje de batería disponible). Sin bloqueos persistentes, sin datos viejos etiquetados como actuales y con restablecimiento visible. La capacidad de continuar en segundo plano NO es requisito: esta PWA no envía notificaciones en segundo plano.

**HOLD** si falta evidencia del teléfono real o si hay cierres, reconexión errónea, datos viejos presentados como actuales, cuelgues o degradación de uso relevante. El resultado puede requerir corregir el código y repetir únicamente la prueba fallida.

## Condiciones de uso

BTCUSDT · Android · GitHub Pages · R$0 · solo lectura · cero órdenes reales. No afecta SCALP AI, QuantLab ni otros proyectos.
