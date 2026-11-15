# BTC Intelligence V2 — corrección del mapa solicitado (14/11/2026)

## Motivo
La mejora anterior reorganizó **Bybit L2: órdenes cercanas al precio**, que en la captura del usuario incluían, por ejemplo, diferencias de pocos dólares. No era el mapa señalado por el usuario. El mapa correcto es **Zonas estimadas de liquidación (OI)**, basado en modelos hipotéticos de Open Interest; los niveles pueden estar a miles de dólares de distancia.

## Cambio de interfaz
- Aparece primero y expandido el **mapa OI**, mientras el mapa de órdenes cercanas queda debajo y plegado inicialmente. Una migración de presentación por única vez respeta los demás paneles guardados.
- Dos resúmenes destacan la zona modelada más cercana arriba y abajo, su precio, la distancia porcentual y el recorrido absoluto en USD respecto al precio observado.
- El gráfico tiene filas gruesas legibles para tres escenarios arriba (shorts, morado) y tres abajo (longs, naranja), BTC actual en amarillo y diferencia porcentual junto a cada nivel.
- Encima de BTC, la zona más cercana queda físicamente junto al centro; debajo, se ordenan de más cercana a más lejana.
- Las filas del gráfico están **ordenadas por cercanía, NO representan escala vertical proporcional a precios**. La longitud/intensidad representa solo el peso relativo de las estimaciones modeladas.
- El panel de órdenes Bybit L2 aclara que los precios con diferencias de $20–$50 pueden ser normales y **no son liquidaciones**.
- Si falta precio vivo o caduca (>20 segundos), las tarjetas ocultan los niveles; no presentan estimaciones antiguas como vigentes.

## Integridad
No se cambiaron los datos originales, fórmulas de estimación del modelo OI, umbrales de alertas, fuentes, WebSockets, precios de mercado, tipos de cuenta, API ni órdenes. El gráfico muestra únicamente **shorts supuestos por encima** y **longs supuestos por debajo** dentro de ±11,5% de BTC. Otras zonas modeladas quedan fuera de la vista de proximidad y no deben interpretarse como inexistentes.

**Advertencia:** no se conocen las posiciones privadas ni la distribución real de apalancamiento. La existencia de niveles hipotéticos por encima o debajo NO implica probabilidad de subida/bajada; tampoco garantiza liquidaciones futuras.

## Evidencia
- Prueba móvil focal de mapa OI en Chromium 390px y 320px con datos sintéticos aislados, sin desbordamiento, con diferencias y sin inventar valores ante datos caducados: PASS.
- Prueba Bybit L2 móvil 390px/320px y estado de libro caducado: PASS.
- Prueba del flujo móvil con Bybit/Binance en vivo, desconexión y recuperación: PASS.
- Reproducción adversarial de muestras públicas WebSocket (31/31): PASS.
- Prueba de geometría histórica de mapa Bybit L2 (20/20): PASS; recuperación de cap de opacidad contractual 0,95.
- Prueba de etiquetado y antigüedad del flujo (19/19): PASS.
- **No se declara PASS general de todas las pruebas históricas**: dos antiguos tests de simulación de muros tenían harness o expectativas obsoletas y no se utilizaron para certificar esta mejora.
- Estado de la validación física prolongada Android V2 #39 permanece sin certificación.
