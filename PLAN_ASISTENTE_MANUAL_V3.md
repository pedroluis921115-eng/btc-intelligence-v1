# BTC Intelligence V3 - Asistente manual ligero (16/11/2026)

## Contrato
Se mantiene la MISMA PWA BTCUSDT gratuita y sin órdenes, claves, pagos, modelos residentes ni servidor en Windows. El proyecto SCALP AI, QuantLab Fund y BTC Signal Engine no forma parte de esta modificación.

## Qué incorpora
1. Acceso directo Windows `BTC Intelligence.lnk`, icono propio y perfil Chrome separado (`--disable-background-mode`). No se instala servicio adicional ni se inicia con Windows.
2. Radar 4H/1H/15M/5M: velas cerradas, 16 observaciones contiguas por marco, dos bloques de ocho velas para describir máximos/mínimos crecientes o decrecientes. No identifica una señal rentable. Solo obtiene datos mientras la página está abierta, no emplea modelos de IA ni aprendizaje.
3. Referencias de precio de máximos/mínimos de 20 velas cerradas de 1H/15M, separadas de liquidaciones OI hipotéticas y de órdenes L2 observadas.
4. Confirmación descriptiva de ruptura en 5M del rango de tres velas cerradas. NO entrada automática, probabilidad ni recomendación económica validada.
5. Planificador LONG/SHORT manual para contratos BTCUSDT LINEALES USDT: entrada, stop, objetivo, capital, riesgo, comisiones y slippage por lado; cálculo de BTC, margen teórico, P&L neto y beneficio/riesgo. Limita exposición según margen; invalida el resultado si cambian los datos. NO incluye funding, márgenes de mantenimiento o liquidación forzada.
6. Simulador de cierre parcial y ajuste de stop del resto. Es aritmético, no conecta con ninguna cuenta.
7. Diseño compatible 390 px móvil y 1280 px escritorio. Mapa OI conserva la primera posición entre los mapas.

## Verificación
- Acceso directo: instalado en el escritorio real de OneDrive, ruta COM verificada, icono generado del arte de la PWA; al abrir se observaron 12 procesos del perfil dedicado y después del cierre de ventana **0 procesos**. No se tocaron otros Chrome.
- Lógica nueva: 15 pruebas automatizadas PASS (incluye velas futuras, datos insuficientes, huecos, costes, riesgo, SHORT y parciales).
- Navegador local con REST controlado: PASS 390x844 y 1280x800; cero errores JS y sin desbordamiento horizontal.
- Regresiones anteriores: 31/31 replay, 20/20 heatmap, OI 6 horas, resumen 22/22, OI móvil y otras focales incluidas en `scripts/run_manual_v3_tests.py`. 10/10 grupos PASS tras corregir un dato de preparación del test antiguo de alertas y preservar el mapa OI primero.
- La interpretación económica de zonas / señales / estructura todavía NO tiene prueba prospectiva de rentabilidad. No puede declararse una mejora demostrada de trading.
- El test real con fuentes externas y la publicación web deben documentarse separadamente cuando se verifiquen.

## Posterior / NO implementado
- Modelo de confluencia calibrado frente a velas/OI/flujo y resultados futuros.
- Alertas específicas de los setups y diario de trading manual.
- Validación de utilidad en operaciones paper prospectivas reales.
- Validación prolongada en Android físico (#39 de V2 sigue pendiente).

## Seguridad operativa
Cero órdenes, cero API keys, cero tarea residente. Las actualizaciones dependen de que la PWA esté abierta; mientras esté cerrada no monitoriza el mercado ni envía avisos. El perfil dedicado se cierra sin dejar procesos Chrome observados en la prueba de Windows del 16/11.
