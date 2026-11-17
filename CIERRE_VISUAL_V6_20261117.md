# CIERRE TÉCNICO · BTC INTELLIGENCE V6 · 2026-11-17

## Alcance
Continuación de V5 y V4. Revisión enfocada en facilitar análisis 4H/1H/15M/5M y experiencia visual. Mantener PWA gratuita, ligera, sin órdenes, credenciales, software residente o servidores locales, y sin modificar SCALP AI/QuantLab/BTC Signal Engine.

## Implementaciones
1. MAPA NUEVO: canvas vsLiqCanvas con velas Bybit BTCUSDT 5m cerradas dentro de 6h y visualización del modelo actual de bandas OI 6h. Eje proporcional; zoom ±4/±7/±11%; máximo 8 franjas SHORT arriba/LONG abajo, peso e intensidad relativos. Etiqueta permanente hipotético/no liquidaciones observadas. Sin datos no se inventan velas ni bandas. Modelo con apalancamientos supuestos 10x/25x/50x, desconoce distribución real de entradas/lados. El gráfico NO contiene un historial de bandas que permita interpretar cambios históricos de la liquidez. No equivale a CoinGlass/Bitlobo.
2. MODELO ORIGINAL preservado bajo desplegable en LIQUIDEZ. No se redibuja mientras esté cerrado; actualiza al abrir.
3. INFORMACIÓN IMPORTANTE: máximo 3 hechos concisos derivados de precio fresco, estructuras de velas cerradas vigentes, OI y precio alineados, flujo ejecutado, funding, zonas hipotéticas y confluencias. Sin datos fiables: "Datos insuficientes" o "Sin eventos destacados". NO incluye titulares macro sin verificar ni probabilidades inventadas.
4. DATOS RECUPERADOS: funding resumido visible en ANÁLISIS. Sigue comparación OI Binance, Bybit, OKX en BTC normalizado. Tablas y diagnóstico en LIQUIDEZ → DATOS AVANZADOS.
5. EXPERIENCIA: letras grandes y pocas tarjetas, tres pestañas, zoom, anchos 320/390/1280.
6. CIERRE: mismo acceso directo Windows; ninguna orden, proceso local ni tarea de fondo adicional.

## Evidencia técnica
- node tests/v6_facts_map.test.cjs: 12 controles de datos obsoletos, orientación de franjas, eventos.
- node tests/v6_visual_browser.cjs: Chromium 320/390/1280 con datos sintéticos, zoom, mapa original, estados sin fuente.
- python scripts/run_visual_v6_tests.py: 21 grupos de pruebas unitarias y regresión V2-V6, todos PASS en el preflight local.
- node tests/v6_live_browser.cjs: PASS con Bybit REST real desde Chrome (80 muestras OI, 85 velas, 45 zonas).
- node scripts/verify-deploy.mjs: verifica assets V6 públicos y cache del service worker tras publicar.
- Verificar fuentes REST Bybit, Binance, OKX y el cierre del perfil de Chrome por separado.

## HOLD, límites
- Sin prueba de ventaja predictiva, precisión ni rentabilidad. El peso de un escenario no equivale a probabilidad direccional.
- Sin acceso a posiciones privadas ni liquidaciones reales históricas de terceros; la estética similar NO implica mismo contenido.
- Prueba prolongada Android físico: HOLD del control V2 #39, no se inventa PASS.
- No avisos con la aplicación cerrada. Diario local, sin sincronización.
- Información importante muestra hechos de mercado; NO una agenda macro económica de IPC/Fed ni noticias externas.

## Ajuste de utilidad visual tras capturas del usuario (17/11/2026)
Los paneles «Órdenes grandes visibles» (fold-06), «Comparación Binance vs Bybit» (fold-07), «Bloqueos importantes» (fold-08) y «Vigencia y procedencia» (fold-13) se retiran de la interfaz visible. Permanecen intactos sus nodos de datos en contenedor oculto #vsInternalDiagnostics para respetar integridad de funciones, cálculo y controles de caducidad; no se desconectan fuentes ni se atribuye reducción de RAM sin medirla. El objetivo es eliminar ruido, no convertir muros próximos de pocos segundos en soportes o señales. Comprobar con tests de V6 y luego despliegue público.
