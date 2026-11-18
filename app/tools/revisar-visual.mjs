/**
 * Barrido de defectos de maquetación del tablero «Pulso comercial · Walmex».
 *
 * Recorre las tres vistas en escritorio y móvil y mide, sin opinar: desbordes
 * horizontales, elementos fuera del marco, textos SVG que se salen del lienzo,
 * gráficas sin dibujar y controles cuyo tamaño cambia entre vistas.
 *
 *   node tools/revisar-visual.mjs
 */

import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SITIO = process.env.WALMEX_SITIO || 'http://127.0.0.1:8000';
const DESTINO = fileURLToPath(new URL('evidencias/revision/', new URL('../', import.meta.url)));
mkdirSync(DESTINO, { recursive: true });

const VISTAS = [
  { clave: 'resumen', tab: 'Resumen comercial', espera: '[data-testid="bloque-calendario"] svg' },
  { clave: 'motores', tab: 'Motores del crecimiento', espera: '[data-testid="bloque-brecha"] svg' },
  { clave: 'comparativa', tab: 'Comparativa histórica', espera: '[data-testid="bloque-pulso"] .wm-celda' },
];

const TAMANOS = [
  { nombre: 'escritorio', width: 1440, height: 1000 },
  { nombre: 'movil', width: 390, height: 844 },
];

const navegador = await chromium.launch();
const informe = [];

for (const tamano of TAMANOS) {
  const contexto = await navegador.newContext({
    viewport: { width: tamano.width, height: tamano.height },
    deviceScaleFactor: 2,
    locale: 'es-MX',
    colorScheme: 'light',
  });
  const pagina = await contexto.newPage();
  const consola = [];
  pagina.on('console', (mensaje) => {
    if (mensaje.type() === 'error') consola.push(mensaje.text());
  });
  pagina.on('pageerror', (error) => consola.push(`pageerror: ${error.message}`));

  await pagina.goto(`${SITIO}/#/area/dashboards/pulso-comercial`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('[data-testid="bloque-puente"]', { timeout: 90_000 });
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(900);

  for (const vista of VISTAS) {
    await pagina.locator(`.wm-tab:has-text("${vista.tab}")`).click();
    await pagina.waitForSelector(vista.espera, { timeout: 60_000 });
    await pagina.waitForTimeout(800);

    const metricas = await pagina.evaluate(() => {
      const marco = document.querySelector('.wm-app');
      if (!marco) return { error: 'sin contenedor' };
      const caja = marco.getBoundingClientRect();

      const recortado = (nodo) => {
        let padre = nodo.parentElement;
        while (padre && padre !== marco) {
          const estilo = getComputedStyle(padre);
          if (['auto', 'scroll', 'hidden'].includes(estilo.overflowX)) return true;
          padre = padre.parentElement;
        }
        return false;
      };

      const desbordes = [...marco.querySelectorAll('*')]
        .filter((nodo) => {
          const estilo = getComputedStyle(nodo);
          if (estilo.overflowX === 'auto' || estilo.overflowX === 'scroll') return false;
          if (nodo.tagName.toLowerCase() === 'svg') return false;
          return nodo.scrollWidth - nodo.clientWidth > 1 && nodo.clientWidth > 0;
        })
        .slice(0, 12)
        .map((nodo) => ({
          clase: nodo.className?.toString?.().slice(0, 60) ?? nodo.tagName,
          exceso: nodo.scrollWidth - nodo.clientWidth,
        }));

      const fueraDelMarco = [...marco.querySelectorAll('*')]
        .filter((nodo) => {
          const r = nodo.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          if (r.right <= caja.right + 1 && r.left >= caja.left - 1) return false;
          return !recortado(nodo);
        })
        .slice(0, 12)
        .map((nodo) => {
          const r = nodo.getBoundingClientRect();
          return {
            clase: nodo.className?.toString?.().slice(0, 60) || nodo.tagName,
            derecha: Math.round(r.right - caja.right),
            izquierda: Math.round(caja.left - r.left),
          };
        });

      const textosFuera = [...marco.querySelectorAll('svg text')]
        .filter((nodo) => {
          const svg = nodo.ownerSVGElement;
          if (!svg) return false;
          const r = nodo.getBoundingClientRect();
          const c = svg.getBoundingClientRect();
          return (
            r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 2 || r.bottom > c.bottom + 2
          );
        })
        .slice(0, 12)
        .map((nodo) => (nodo.textContent ?? '').slice(0, 28));

      const bloques = [...marco.querySelectorAll('.wm-bloque')].map((nodo) => {
        const r = nodo.getBoundingClientRect();
        return {
          id: nodo.dataset.testid,
          ancho: Math.round(r.width),
          alto: Math.round(r.height),
          svg: nodo.querySelectorAll('svg').length,
          celdas: nodo.querySelectorAll('.wm-celda').length,
          formas: nodo.querySelectorAll('rect, circle, path, line, text').length,
        };
      });

      return {
        marco: { ancho: Math.round(caja.width), alto: Math.round(caja.height) },
        desbordes,
        fueraDelMarco,
        textosFuera,
        bloques,
        documentoAncho: document.documentElement.scrollWidth,
        ventanaAncho: window.innerWidth,
      };
    });

    informe.push({ tamano: tamano.nombre, vista: vista.clave, ...metricas, consola: [...consola] });

    await pagina.screenshot({
      path: `${DESTINO}${tamano.nombre}-${vista.clave}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }

  await contexto.close();
}

await navegador.close();
await writeFile(`${DESTINO}informe.json`, JSON.stringify(informe, null, 1));
console.log(`${DESTINO}informe.json`);


