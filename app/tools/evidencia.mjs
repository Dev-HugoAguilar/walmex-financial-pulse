/**
 * Evidencia del rediseño: las tres vistas (escritorio y móvil), una secuencia de
 * capturas de las interacciones conectadas y un video corto con las mismas acciones.
 *
 *   node tools/evidencia.mjs
 */

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SITIO = process.env.WALMEX_SITIO || 'http://127.0.0.1:8000';
const RUTA = '/#/area/dashboards/pulso-comercial';
const BASE = fileURLToPath(new URL('evidencias/', new URL('../', import.meta.url)));
const SECUENCIA = `${BASE}secuencia/`;
const VIDEO = `${BASE}video/`;
mkdirSync(BASE, { recursive: true });
mkdirSync(SECUENCIA, { recursive: true });
mkdirSync(VIDEO, { recursive: true });

const VISTAS = [
  { archivo: 'resumen', tab: 'Resumen comercial', espera: '[data-testid="bloque-calendario"] svg', alto: 3000 },
  { archivo: 'motores', tab: 'Motores del crecimiento', espera: '[data-testid="bloque-brecha"] svg', alto: 2800 },
  { archivo: 'comparativa', tab: 'Comparativa histórica', espera: '[data-testid="bloque-pulso"] .wm-celda', alto: 2700 },
];

const navegador = await chromium.launch();

/* --------------------------------- vistas -------------------------------- */
for (const tamano of [
  { nombre: 'escritorio', width: 1440 },
  { nombre: 'movil', width: 390 },
]) {
  const contexto = await navegador.newContext({
    viewport: { width: tamano.width, height: 900 },
    deviceScaleFactor: 2,
    locale: 'es-MX',
    colorScheme: 'light',
  });
  const pagina = await contexto.newPage();
  await pagina.goto(`${SITIO}${RUTA}`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('[data-testid="bloque-puente"]', { timeout: 90_000 });
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(1200);

  for (const vista of VISTAS) {
    await pagina.setViewportSize({ width: tamano.width, height: vista.alto });
    await pagina.locator(`.wm-tab:has-text("${vista.tab}")`).click();
    await pagina.waitForSelector(vista.espera, { timeout: 60_000 });
    await pagina.waitForTimeout(900);
    const ruta = `${BASE}tablero-${vista.archivo}-${tamano.nombre}.png`;
    await pagina.locator('.wm-root').screenshot({ path: ruta, animations: 'disabled' });
    console.log(ruta);
  }

  await contexto.close();
}

/* ------------------------- secuencia y video ----------------------------- */
const contexto = await navegador.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1.5,
  locale: 'es-MX',
  colorScheme: 'light',
  recordVideo: { dir: VIDEO, size: { width: 1280, height: 800 } },
});
const pagina = await contexto.newPage();
await pagina.goto(`${SITIO}${RUTA}`, { waitUntil: 'domcontentloaded' });
await pagina.waitForSelector('[data-testid="bloque-puente"]', { timeout: 90_000 });
await pagina.evaluate(() => document.fonts?.ready);
await pagina.waitForTimeout(1500);

const capturar = async (nombre) => {
  await pagina.screenshot({ path: `${SECUENCIA}${nombre}.png`, animations: 'disabled' });
  console.log(`${SECUENCIA}${nombre}.png`);
};

/* 1 · selector temporal: mover el trimestre y ver el cambio en las tres marcas. */
await pagina.locator('.wm-tab:has-text("Resumen comercial")').click();
await pagina.waitForSelector('[data-testid="bloque-calendario"] svg', { timeout: 45_000 });
await pagina.waitForTimeout(900);
await pagina.locator('[data-testid="bloque-calendario"] circle[role="button"]').nth(5).click({ force: true });
await pagina.waitForTimeout(900);
await capturar('1-selector-temporal');

/* 2 · reproducción de observaciones reales en Motores. */
await pagina.locator('.wm-tab:has-text("Motores del crecimiento")').click();
await pagina.waitForSelector('[data-testid="bloque-brecha"] svg', { timeout: 45_000 });
await pagina.waitForTimeout(900);
await pagina.locator('[data-testid="motores-reproducir"]').click();
await pagina.waitForTimeout(2000);
await capturar('2-reproduccion');
await pagina.locator('[data-testid="motores-reproducir"]').click();
await pagina.waitForTimeout(500);

/* 3 · foco vinculado: indicador elegido en Ventaja resalta su panel histórico. */
await pagina.locator('[data-testid="bloque-ventaja"] rect[role="button"]').first().click({ force: true });
await pagina.mouse.move(4, 4);
await pagina.waitForTimeout(900);
await capturar('3-foco-vinculado');

/* 4 · base del índice elegida sobre la línea temporal. */
await pagina.locator('.wm-tab:has-text("Comparativa histórica")').click();
await pagina.waitForSelector('[data-testid="bloque-pulso"] .wm-celda', { timeout: 45_000 });
await pagina.waitForTimeout(900);
await pagina.locator('[data-testid="bloque-indice"] .wm-tira-base[role="button"]').nth(8).click({ force: true });
await pagina.waitForTimeout(900);
await capturar('4-base-en-la-linea');

/* 5 · panel contextual expandible con la historia del indicador. */
await pagina.locator('[data-testid="bloque-pulso"] tbody tr').first().locator('.wm-pulso-nombre').click();
await pagina.waitForTimeout(600);
await pagina.locator('[data-testid="contexto-expandir"]').click();
await pagina.waitForTimeout(800);
await capturar('5-panel-contextual');

const video = pagina.video();
await contexto.close();
if (video) {
  const ruta = `${VIDEO}interacciones.webm`;
  await video.saveAs(ruta);
  console.log(ruta);
}

await navegador.close();

