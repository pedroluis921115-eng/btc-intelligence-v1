# BTC Intelligence — cierre funcional del asistente manual V4 (16/11/2026)

## Objetivo
Una sola PWA gratuita BTCUSDT para consultar manualmente desde Chrome en celular o escritorio de Windows, sin órdenes, claves privadas, servidor residente, AI local ni modificación a otros proyectos. La web solo conecta y actualiza fuentes mientras está abierta.

## Funciones terminadas técnicamente
1. Icono BTC Intelligence en el escritorio Windows, ventana de Chrome separada, perfil dedicado sin modo en segundo plano.
2. Radar 4H/1H/15M/5M con velas CERRADAS, rechazo de huecos, fuentes y marcas temporales; nivel superior/inferior de estructura calculado a partir de velas cerradas.
3. Confluencias descriptivas: 4H+1H alineados, 15M alineado, ruptura de cierre 5M, flujo Bybit válido y referencia estructural cercana. La ausencia de datos u oposición mantiene el estado sin confirmación. Cinco comprobaciones no representan una probabilidad, confianza ni ventaja.
4. Contexto complementario OI+precio temporalmente alineados (si disponible) y órdenes L2 de Bybit (si libro vigente); las liquidaciones teóricas permanecen claramente etiquetadas.
5. Alertas de confluencia SOLO dentro de la ventana abierta: activación opcional, deduplicación por vela, enfriamiento de 15 minutos y límites de memoria. NO push, NO avisos si la web está cerrada.
6. Planificador manual de tamaño LONG/SHORT BTCUSDT lineal USDT: capital, riesgo porcentual, entrada, stop, objetivo, costes y relación neta. Al cambiar un dato se invalida el cálculo antiguo.
7. Simulador aritmético de parciales y nuevo stop del resto. Ninguna orden se envía.
8. Diario local de operaciones CERRADAS: PAPER/REAL separados; propio/trader en vivo/mixto; P&L neto según entrada, salida, cantidad y costes introducidos manualmente; tasa de aciertos, factor beneficio, media y DD aproximado por cierres; exportación/importación JSON deduplicada y validada, hasta 500 registros.
9. Diseño móvil y escritorio; primera posición del mapa OI original preservada, con acceso directo al radar en resumen rápido.

## Límites y riesgos explícitos
- **NO se ha demostrado ventaja predictiva ni rentabilidad** del checklist. Las confluencias sirven para ordenar el análisis, no para disparar órdenes.
- La prueba Android de uso prolongado y la experiencia real del usuario están pendientes de validación física; no se inventa un PASS.
- No hay sincronización de diario entre móvil y el perfil de escritorio. Exportar JSON permite conservar y trasladar el historial. Borrar datos del navegador puede eliminar el diario local.
- Los avisos no funcionan con la aplicación cerrada. No requiere residentes ni monitorización continua.
- Las cifras del diario dependen de lo escrito por el usuario; no se extrae historial del exchange.
- El planificador supone contratos lineales USDT: omite funding, mantenimiento y liquidación forzada; las comisiones y slippage son configurables.
- Bybit y Binance pueden estar restringidos o temporalmente fuera de servicio; no se rellenan datos sintéticos en producción.
- Oro y otras monedas NO se agregan a este proyecto; BTCUSDT sigue siendo el foco.
- No se tocan SCALP AI, QuantLab Fund V12 ni BTC Signal Engine.

## Pruebas de aceptación
- Ejecutar: python scripts/run_manual_v4_tests.py
- Verificar HTML, manifest, service worker, scripts, CSS e identidad de versión publicada: node scripts/verify-deploy.mjs
- Verificar REST reales 4/4 temporalidades HTTPS: node tests/manual_assistant_v3_live_browser.cjs --public (otras fuentes bloqueadas deliberadamente en esa prueba aislada).
- Verificar apertura/cierre del perfil Chrome dedicado y RAM: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test_desktop_shortcut_shutdown.ps1; el script cierra SOLO la ventana con perfil dedicado que él mismo inicia, y no toca el resto del Chrome.
- NUNCA declarar VERDE de rentabilidad, señales ganadoras ni Android físico sin observaciones posteriores válidas.

## Estado de cierre
Las pruebas técnicas y el despliegue se documentan por separado, con el commit final y salida pública. No hay trabajo funcional previo a la primera revisión del usuario si ambos verifican PASS; la validación de utilidad requiere observar decisiones y operaciones prospectivas, no más código.
