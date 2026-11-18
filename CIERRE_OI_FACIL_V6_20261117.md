# BTC Intelligence V6 — OI fácil y lectura conjunta

## Objetivo
Facilitar al usuario análisis manual BTCUSDT: entender contratos abiertos (OI), variación del precio y compras/ventas agresivas sin ruido ni señales automáticas.

## Implementado
- ANÁLISIS: lectura corta de BTC + OI del último periodo cerrado 15m de Bybit, o 1h cuando 15m no esté vigente; flujo ejecutado móvil 5m etiquetado por separado.
- LIQUIDEZ: porcentajes de BTC/OI en periodos de 15m y 1h cerrados y comparables (misma vela).
- OI sube = más contratos abiertos; OI baja = menos; NO indica cuántos participantes LONG/SHORT.
- Binance, Bybit y OKX siguen mostrando instantáneas de contratos, sin el 0.00% desde abrir. Las variaciones históricas de 15m/1h son SOLO Bybit, no los tres exchanges.
- Antiguo resumen topSnapshot trasladado al contenedor interno oculto para evitar ruido de alertas de muros sin borrar datos ni análisis.
- Filtro informativo: cambios de OI inferiores a 0,20% por ventana se describen como pequeños. Rechazo de muestras desalineadas o caducadas.
- Cuatro solicitudes Bybit cada 3 minutos en navegador abierto; cero nuevos procesos locales y cero órdenes.

## Pruebas
- node tests/oi_easy_v6.test.cjs — 8 pruebas.
- node tests/oi_easy_browser_live.cjs — navegador 320/390/1280 px y Bybit 15m/1h real.
- python scripts/run_visual_v6_tests.py — regresión V2–V6.
- node scripts/verify-deploy.mjs — publicación.

## Límites
No mejora económica demostrada. El flujo de 5m NO se alinea automáticamente con el último periodo OI 15m/1h. No se inventa histórico para Binance y OKX. Mantener HOLD de Android físico prolongado; SCALP AI, QuantLab, BTC Signal Engine, laboratorio y órdenes reales intactos.
