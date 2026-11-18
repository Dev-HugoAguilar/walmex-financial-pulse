/**
 * Verificación de la tarjeta «Pulso comercial · Walmex» frente a «Marketing y clientes».
 *
 * Comprueba, en escritorio y en móvil, que la captura de Walmex:
 *   1. carga de verdad (naturalWidth > 0 y sin error de red),
 *   2. mide lo mismo que la tarjeta de referencia (misma proporción y mismas dimensiones
 *      de imagen),
 *   3. tiene el recuadro del mismo tamaño que el de referencia y deja las etiquetas y el
 *      título alineados,
 *   4. se ve completa (sin bandas ni recortes),
 *   5. declara dimensiones, texto alternativo y no rompe el ancho de la página.
 *
 * Guarda capturas de las dos tarjetas y del catálogo en cada tamaño.
 *
 * Uso: node tools/verificar-tarjeta.mjs
 */

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const SITIO = process.env.WALMEX_SITIO || 'http://127.0.0.1:8000';
const DESTINO = fileURLToPath(new URL('evidencias/', new URL('../', import.meta.url)));
mkdirSync(DESTINO, { recursive: true });

const navegador = await chromium.launch();
const resultados = [];
const comprobar = (nombre, correcto, detalle = '') => {
  resultados.push({ nombre, correcto });
  console.log(`${correcto ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ` :: ${detalle}` : ''}`);
};

const medirTarjeta = (titulo) =>
  (() => {
    const tarjeta = [...document.querySelectorAll('.project-card')].find((nodo) =>
      (nodo.textContent ?? '').includes(titulo),
    );
    if (!tarjeta) return null;
    const cover = tarjeta.querySelector('.cover');
    const img = cover.querySelector('img');
    const rc = cover.getBoundingClientRect();
    const ri = img.getBoundingClientRect();
    const estiloCaja = getComputedStyle(cover);
    const bordeX = parseFloat(estiloCaja.borderLeftWidth) + parseFloat(estiloCaja.borderRightWidth);
    const bordeY = parseFloat(estiloCaja.borderTopWidth) + parseFloat(estiloCaja.borderBottomWidth);
    const etiqueta = tarjeta.querySelector('.card-meta');
    const cabecera = tarjeta.querySelector('h3, .project-title');
    const ret = etiqueta ? etiqueta.getBoundingClientRect() : null;
    const rti = cabecera ? cabecera.getBoundingClientRect() : null;
    const rt = tarjeta.getBoundingClientRect();
    return {
      tarjetaY: Math.round(rt.top + window.scrollY),
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      anchoAtributo: img.getAttribute('width'),
      altoAtributo: img.getAttribute('height'),
      natural: { ancho: img.naturalWidth, alto: img.naturalHeight },
      caja: { ancho: Math.round(rc.width), alto: Math.round(rc.height), top: Math.round(rc.top + window.scrollY), left: Math.round(rc.left) },
      contenido: { ancho: Math.round(rc.width - bordeX), alto: Math.round(rc.height - bordeY) },
      imagen: { ancho: Math.round(ri.width), alto: Math.round(ri.height) },
      ajuste: getComputedStyle(img).objectFit,
      proporcionCaja: rc.width / rc.height,
      proporcionImagen: img.naturalWidth / img.naturalHeight,
      desborda: img.scrollWidth > Math.ceil(ri.width) + 1 || img.scrollHeight > Math.ceil(ri.height) + 1,
      etiquetaY: ret ? Math.round(ret.top + window.scrollY) : null,
      tituloY: rti ? Math.round(rti.top + window.scrollY) : null,
      anchoPagina: document.documentElement.scrollWidth,
      anchoVista: window.innerWidth,
    };
  })();

for (const tamano of [
  { nombre: 'escritorio', viewport: { width: 1440, height: 960 }, sufijo: 'escritorio' },
  { nombre: 'movil', viewport: { width: 390, height: 844 }, sufijo: 'movil' },
]) {
  const contexto = await navegador.newContext({
    viewport: tamano.viewport,
    deviceScaleFactor: 2,
    isMobile: tamano.nombre === 'movil',
    hasTouch: tamano.nombre === 'movil',
    locale: 'es-MX',
  });
  const pagina = await contexto.newPage();
  const fallos = [];
  pagina.on('requestfailed', (peticion) => {
    if (peticion.url().includes('pulso-comercial')) fallos.push(peticion.url());
  });

  await pagina.goto(`${SITIO}/#/area/dashboards`, { waitUntil: 'domcontentloaded' });
  const tarjeta = pagina.locator('.project-card', { hasText: 'Pulso comercial' }).first();
  await tarjeta.waitFor({ state: 'visible', timeout: 45_000 });
  await tarjeta.locator('.cover img').waitFor({ state: 'visible', timeout: 45_000 });
  await pagina.waitForFunction(
    () =>
      [...document.querySelectorAll('.project-card .cover img')].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    { timeout: 45_000 },
  );
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(700);

  const marketing = await pagina.evaluate(medirTarjeta, 'Marketing y clientes');
  const walmex = await pagina.evaluate(medirTarjeta, 'Pulso comercial');
  const etiqueta = tamano.nombre;

  comprobar(
    `${etiqueta}: la imagen de la tarjeta carga`,
    Boolean(walmex && walmex.natural.ancho > 0) && fallos.length === 0,
    `${walmex?.src} · ${walmex?.natural.ancho}×${walmex?.natural.alto} px`,
  );
  comprobar(
    `${etiqueta}: misma proporción y dimensiones que «Marketing y clientes»`,
    Boolean(marketing) &&
      walmex.natural.ancho === marketing.natural.ancho &&
      walmex.natural.alto === marketing.natural.alto,
    `Walmex ${walmex.natural.ancho}×${walmex.natural.alto} · Marketing ${marketing.natural.ancho}×${marketing.natural.alto}`,
  );
  comprobar(
    `${etiqueta}: el recuadro de Walmex mide lo mismo que el de referencia`,
    Math.abs(walmex.caja.ancho - marketing.caja.ancho) <= 1 &&
      Math.abs(walmex.caja.alto - marketing.caja.alto) <= 1 &&
      Math.abs(walmex.proporcionCaja - marketing.proporcionCaja) < 0.01,
    `Walmex ${walmex.caja.ancho}×${walmex.caja.alto} · Marketing ${marketing.caja.ancho}×${marketing.caja.alto}`,
  );
  const mismaFila = Math.abs(walmex.tarjetaY - marketing.tarjetaY) <= 2;
  const desfase = (tarjeta) => ({
    etiqueta: (tarjeta.etiquetaY ?? 0) - tarjeta.tarjetaY,
    titulo: (tarjeta.tituloY ?? 0) - tarjeta.tarjetaY,
  });
  const desplazamientoWalmex = desfase(walmex);
  const desplazamientoMarketing = desfase(marketing);
  comprobar(
    `${etiqueta}: etiquetas y títulos arrancan a la misma altura`,
    Math.abs(desplazamientoWalmex.etiqueta - desplazamientoMarketing.etiqueta) <= 2 &&
      Math.abs(desplazamientoWalmex.titulo - desplazamientoMarketing.titulo) <= 2 &&
      (!mismaFila || Math.abs(walmex.tituloY - marketing.tituloY) <= 2),
    mismaFila
      ? `misma fila · etiqueta ${walmex.etiquetaY} vs ${marketing.etiquetaY} · título ${walmex.tituloY} vs ${marketing.tituloY}`
      : `apiladas · desfase etiqueta ${desplazamientoWalmex.etiqueta} vs ${desplazamientoMarketing.etiqueta} · título ${desplazamientoWalmex.titulo} vs ${desplazamientoMarketing.titulo}`,
  );
  comprobar(
    `${etiqueta}: la captura se ve completa, sin bandas ni recortes`,
    Math.abs(walmex.imagen.alto - walmex.contenido.alto) <= 1 &&
      Math.abs(walmex.imagen.ancho - walmex.contenido.ancho) <= 1 &&
      Math.abs(walmex.proporcionCaja - walmex.proporcionImagen) < 0.01 &&
      walmex.ajuste !== 'cover' &&
      !walmex.desborda,
    `contenido ${walmex.contenido.ancho}×${walmex.contenido.alto} · imagen ${walmex.imagen.ancho}×${walmex.imagen.alto} · ajuste ${walmex.ajuste}`,
  );
  comprobar(
    `${etiqueta}: declara dimensiones y texto alternativo`,
    Boolean(
      walmex.anchoAtributo &&
        walmex.altoAtributo &&
        walmex.alt &&
        walmex.alt.length > 60,
    ),
    `${walmex.anchoAtributo}×${walmex.altoAtributo} · alt de ${walmex.alt.length} caracteres`,
  );
  comprobar(
    `${etiqueta}: sin desbordes horizontales en el catálogo`,
    walmex.anchoPagina <= walmex.anchoVista + 1,
    `${walmex.anchoPagina}/${walmex.anchoVista}`,
  );

  await tarjeta.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(300);
  await pagina.screenshot({ path: `${DESTINO}catalogo-${tamano.sufijo}.png`, fullPage: false });
  console.log(`captura del catálogo: ${DESTINO}catalogo-${tamano.sufijo}.png`);
  await tarjeta.screenshot({ path: `${DESTINO}tarjeta-${tamano.sufijo}.png`, animations: 'disabled' });
  await contexto.close();
}

const correctas = resultados.filter((resultado) => resultado.correcto).length;
console.log(`\n${correctas}/${resultados.length} comprobaciones correctas`);
await navegador.close();
process.exit(correctas === resultados.length ? 0 : 1);

