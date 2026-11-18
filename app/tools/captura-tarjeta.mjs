/**
 * Captura real de la tarjeta «Pulso comercial · Walmex» para el catálogo.
 *
 * Reproduce el encuadre de la tarjeta «Marketing y clientes» (1600 × 1726) para que
 * ambos recuadros midan lo mismo: abre la vista «Resumen comercial» en el portafolio,
 * espera a que estén cargados los datos y las gráficas, y captura el contenido completo
 * de la vista —cabecera, controles, indicadores, origen del crecimiento, mezcla del
 * negocio y calendario comercial— sin la navegación del portafolio, el pie ni los
 * paneles técnicos plegados.
 *
 * El único ajuste de captura es de distribución y espaciado (se reducen los huecos
 * verticales del tablero para que el encuadre alcance la proporción de la otra tarjeta);
 * los componentes, sus datos y su tipografía son los reales.
 *
 * Uso:
 *   node tools/captura-tarjeta.mjs            # borrador para revisar
 *   node tools/captura-tarjeta.mjs --final    # escribe la imagen de la tarjeta
 */

import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const SITIO = process.env.WALMEX_SITIO || 'http://127.0.0.1:8000';
const DESTINO = fileURLToPath(new URL('evidencias/', new URL('../', import.meta.url)));
const SALIDA = fileURLToPath(new URL('../../dist/img/', new URL('../', import.meta.url)));
mkdirSync(DESTINO, { recursive: true });

/** Proporción de la tarjeta de referencia: «Marketing y clientes». */
const ANCHO_FINAL = 1600;
const ALTO_FINAL = 1726;
const CALIDAD = 0.84;

const argumentos = process.argv.slice(2);
const final = argumentos.includes('--final');

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 2600 },
  deviceScaleFactor: 2,
  locale: 'es-MX',
  colorScheme: 'light',
});
const pagina = await contexto.newPage();

await pagina.goto(`${SITIO}/#/area/dashboards/pulso-comercial`, { waitUntil: 'domcontentloaded' });
await pagina.waitForSelector('[data-testid="bloque-puente"] svg', { timeout: 90_000 });
await pagina.waitForFunction(
  () =>
    document.querySelectorAll('.wm-indicador-valor').length >= 3 &&
    document.querySelectorAll('[data-testid="bloque-puente"] svg rect[role="button"]').length >= 2 &&
    Boolean(document.querySelector('[data-testid="bloque-mezcla"] svg')) &&
    Boolean(document.querySelector('[data-testid="bloque-calendario"] svg')),
  { timeout: 90_000 },
);
await pagina.evaluate(() => document.fonts?.ready);
await pagina.waitForTimeout(900);

const medir = () =>
  pagina.evaluate(() => {
    const raiz = document.querySelector('.wm-root');
    const bloques = [...document.querySelectorAll('.wm-bloque')];
    const ultimo = bloques[bloques.length - 1].getBoundingClientRect();
    const primera = raiz.getBoundingClientRect();
    return {
      ancho: Math.round(primera.width),
      izquierda: Math.round(primera.left),
      arriba: Math.round(primera.top + window.scrollY),
      finBloques: Math.round(ultimo.bottom + window.scrollY),
      bloques: bloques.map((bloque) => bloque.dataset.testid),
    };
  });

/* Modo de captura: solo distribución y espaciado. */
await pagina.addStyleTag({
  content: '.wm-app { gap: 10px; padding-bottom: 4px; } .wm-vista { gap: 10px; } .wm-fila { gap: 10px; }',
});
await pagina.waitForTimeout(400);

const inicial = await medir();
const altoObjetivo = Math.round(inicial.ancho * (ALTO_FINAL / ANCHO_FINAL));
const natural = inicial.finBloques - inicial.arriba + 8;
console.log(
  JSON.stringify(
    {
      ancho: inicial.ancho,
      altoObjetivo,
      altoNatural: natural,
      proporcionNatural: Number((inicial.ancho / natural).toFixed(4)),
      proporcionObjetivo: Number((ANCHO_FINAL / ALTO_FINAL).toFixed(4)),
      bloques: inicial.bloques,
    },
    null,
    1,
  ),
);

/* Si el contenido no cabe, se aprieta un poco más el espaciado (nunca se recorta). */
if (natural > altoObjetivo) {
  const hueco = Math.max(6, 10 - Math.ceil((natural - altoObjetivo) / 8));
  await pagina.addStyleTag({
    content: `.wm-app { gap: ${hueco}px; } .wm-vista { gap: ${hueco}px; }`,
  });
  await pagina.waitForTimeout(400);
}

const finalMedidas = await medir();
const altoFrame = Math.round(finalMedidas.ancho * (ALTO_FINAL / ANCHO_FINAL));
const recorte = {
  x: finalMedidas.izquierda,
  y: finalMedidas.arriba,
  width: finalMedidas.ancho,
  height: altoFrame,
};
console.log(
  JSON.stringify(
    {
      recorte,
      sobraBajoBloques: altoFrame - (finalMedidas.finBloques - finalMedidas.arriba),
      proporcion: Number((recorte.width / recorte.height).toFixed(4)),
    },
    null,
    1,
  ),
);

const png = await pagina.screenshot({ clip: recorte, fullPage: true, animations: 'disabled' });

const webp = await pagina.evaluate(
  async ({ base64, calidad, anchoFinal, altoFinal }) => {
    const imagen = new Image();
    imagen.src = 'data:image/png;base64,' + base64;
    await imagen.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = anchoFinal;
    lienzo.height = altoFinal;
    const contexto2d = lienzo.getContext('2d');
    contexto2d.imageSmoothingEnabled = true;
    contexto2d.imageSmoothingQuality = 'high';
    contexto2d.drawImage(imagen, 0, 0, anchoFinal, altoFinal);
    const blob = await new Promise((resolver) => lienzo.toBlob(resolver, 'image/webp', calidad));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binario = '';
    for (const byte of bytes) binario += String.fromCharCode(byte);
    return { base64: btoa(binario), ancho: lienzo.width, alto: lienzo.height, bytes: bytes.length };
  },
  { base64: png.toString('base64'), calidad: CALIDAD, anchoFinal: ANCHO_FINAL, altoFinal: ALTO_FINAL },
);

const nombre = final ? 'pulso-comercial-resumen.webp' : 'borrador-pulso-comercial.webp';
const ruta = final ? `${SALIDA}${nombre}` : `${DESTINO}${nombre}`;
await writeFile(ruta, Buffer.from(webp.base64, 'base64'));
console.log(
  `imagen: ${ruta} · ${webp.ancho} × ${webp.alto} px · ${(webp.bytes / 1024).toFixed(1)} KB · ` +
    `relación ${(webp.ancho / webp.alto).toFixed(4)}`,
);

await navegador.close();
