/**
 * Verificación de «Hallazgos del análisis» de la ficha «Pulso comercial · Walmex».
 *
 * Comprueba, en escritorio y en móvil, que la sección:
 *
 *  · tiene el subtítulo del trimestre verificado;
 *  · tiene exactamente tres hallazgos, con título y una o dos frases;
 *  · no lleva notas técnicas ni párrafos de método o de límites;
 *  · repite las cifras verificadas contra la API, sin afirmaciones causales;
 *  · muestra como mucho dos cifras resaltadas por hallazgo;
 *  · se lee sin alturas fijas, sin desbordes y con separación constante.
 *
 * Guarda las capturas reales de la sección en `evidencias/`.
 *
 *   node tools/verificar-hallazgos.mjs
 */

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SITIO = process.env.WALMEX_SITIO || 'http://127.0.0.1:8000';
const API = process.env.WALMEX_API || 'http://127.0.0.1:8010/api/v1';
const RUTA = '/#/area/dashboards/pulso-comercial';
const BASE = fileURLToPath(new URL('evidencias/', new URL('../', import.meta.url)));
mkdirSync(BASE, { recursive: true });

const comprobaciones = [];
const comprobar = (nombre, correcto, detalle = '') => {
  comprobaciones.push({ nombre, correcto });
  console.log(`${correcto ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ` :: ${detalle}` : ''}`);
};

/* ------------------------- cifras verificadas en la API ------------------- */
const leer = async (ruta) => {
  const respuesta = await fetch(`${API}/walmex/${ruta}`);
  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status} en /walmex/${ruta}`);
  return respuesta.json();
};

const [resumen, motores, desempeno] = await Promise.all([
  leer('resumen'),
  leer('motores'),
  leer('desempeno?indicador=mismas_tiendas'),
]);

const periodos = resumen.periodos;
const ultimo = periodos[periodos.length - 1];
const anioAnterior = String(Number(ultimo.slice(-2)) - 1);
const valor = (mercado, campo, periodo) =>
  resumen.series.find((fila) => fila.mercado === mercado)?.[campo].find((p) => p.periodo === periodo)?.valor ?? null;
const importePrevio = (mercado) =>
  resumen.series.find((fila) => fila.mercado === mercado)?.ingresos_anio_anterior?.find((p) => p.periodo === ultimo)?.valor ?? null;

const ingresosMx = valor('mexico', 'ingresos', ultimo);
const ingresosCa = valor('centroamerica', 'ingresos', ultimo);
const deltaMx = ingresosMx - importePrevio('mexico');
const deltaCa = ingresosCa - importePrevio('centroamerica');
const incremento = deltaMx + deltaCa;
const parteMx = (100 * deltaMx) / incremento;
const parteCa = (100 * deltaCa) / incremento;

const panelMexico = motores.paneles.find((p) => p.mercado === 'mexico');
const panelCentro = motores.paneles.find((p) => p.mercado === 'centroamerica');
const puntoMexico = panelMexico.puntos[panelMexico.puntos.length - 1];
const puntoCentro = panelCentro.puntos[panelCentro.puntos.length - 1];

const iguales = (mercado) =>
  desempeno.filas.find((fila) => fila.mercado === mercado)?.celdas.find((c) => c.periodo === ultimo)?.valor ?? null;
const igualesMx = iguales('mexico');
const igualesCa = iguales('centroamerica');
const diferenciaIguales = Math.round((igualesCa - igualesMx) * 10) / 10;

/* Formato del texto: coma decimal y espacio duro de miles. */
const pct = (n) => `${n.toFixed(1).replace('.', ',')} %`;
const miles = (n) => Math.round(n).toLocaleString('es-MX').replace(/,/g, '\u00A0');
const limpiar = (texto) => texto.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();

const ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto'];
const nombreTrimestre = (periodo) => {
  const partes = /^(\d)T(\d{2})$/.exec(periodo);
  return partes ? `${ORDINAL[Number(partes[1]) - 1]} trimestre de 20${partes[2]}` : periodo;
};

const SUBTITULO = limpiar(
  `Resultados del ${nombreTrimestre(ultimo)} frente al mismo trimestre de 20${anioAnterior}.`,
);
const ESPERADOS = [
  {
    id: 'reparto',
    titulo: 'México concentra el aumento de ingresos',
    texto: limpiar(
      `Aporta el ${pct(parteMx)} del incremento consolidado de ${miles(incremento)} millones de pesos; ` +
        `Centroamérica contribuye con el ${pct(parteCa)} restante.`,
    ),
  },
  {
    id: 'mercados',
    titulo: 'Los mercados presentan patrones distintos',
    texto: limpiar(
      `En México, el tráfico permanece estable y el ticket aumenta ${pct(puntoMexico.ticket)}. ` +
        `En Centroamérica crecen tanto el tráfico (${pct(puntoCentro.trafico)}) como el ticket (${pct(puntoCentro.ticket)}).`,
    ),
  },
  {
    id: 'unidades-iguales',
    titulo: 'Centroamérica destaca en ventas a unidades iguales',
    texto: limpiar(
      `Registra un crecimiento de ${pct(igualesCa)}, frente al ${pct(igualesMx)} de México: ` +
        `una diferencia de ${diferenciaIguales.toFixed(1).replace('.', ',')} puntos porcentuales.`,
    ),
  },
];

console.log(`\nCifras verificadas en la API (${ultimo} frente a ${anioAnterior}):`);
console.log(
  `  ingresos MX ${miles(ingresosMx)} (Δ ${miles(deltaMx)}) · CA ${miles(ingresosCa)} (Δ ${miles(deltaCa)}) · ` +
    `incremento ${miles(incremento)} → ${pct(parteMx)} / ${pct(parteCa)}`,
);
console.log(
  `  tráfico y ticket: MX ${puntoMexico.trafico} / ${puntoMexico.ticket} · CA ${puntoCentro.trafico} / ${puntoCentro.ticket}`,
);
console.log(
  `  unidades iguales: MX ${igualesMx} · CA ${igualesCa} · diferencia ${diferenciaIguales} pp\n`,
);

const PROHIBIDAS = [
  'explica',
  'descomposición',
  'promedio reciente',
  'no se puede calcular',
  'no se publica',
  'sin dato',
];

const navegador = await chromium.launch();

for (const tamano of [
  { nombre: 'escritorio', viewport: { width: 1440, height: 1000 } },
  { nombre: 'movil', viewport: { width: 390, height: 844 } },
]) {
  const contexto = await navegador.newContext({
    viewport: tamano.viewport,
    deviceScaleFactor: 2,
    locale: 'es-MX',
    colorScheme: 'light',
    isMobile: tamano.nombre === 'movil',
    hasTouch: tamano.nombre === 'movil',
  });
  const pagina = await contexto.newPage();
  await pagina.goto(`${SITIO}${RUTA}`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForFunction(
    () => {
      const host = document.querySelector('#hallazgos-host');
      return host && host.querySelector('.hallazgos-alcance') && host.querySelectorAll('p').length === 4;
    },
    { timeout: 90_000 },
  );
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(500);

  const medida = await pagina.evaluate(() => {
    const host = document.querySelector('#hallazgos-host');
    const estilo = getComputedStyle(host);

    /* Alturas declaradas para la sección en cualquier hoja de la página: la ficha
       no debe fijar alturas para igualar columnas, solo dejar fluir el texto. */
    const alturasDeclaradas = [];
    for (const hoja of document.styleSheets) {
      let reglas;
      try {
        reglas = hoja.cssRules;
      } catch {
        continue;
      }
      for (const regla of reglas ?? []) {
        const selector = regla.selectorText ?? '';
        if (!/hallazgo/i.test(selector)) continue;
        for (const propiedad of ['height', 'min-height', 'max-height']) {
          const valor = regla.style?.getPropertyValue(propiedad);
          if (valor && valor !== 'auto' && valor !== 'none') {
            alturasDeclaradas.push(`${selector} { ${propiedad}: ${valor} }`);
          }
        }
      }
    }

    const parrafos = [...host.querySelectorAll('p')];
    const cajas = parrafos.map((p) => p.getBoundingClientRect());
    const separaciones = cajas.slice(1).map((caja, i) => Math.round(caja.top - cajas[i].bottom));
    return {
      subtitulo: host.querySelector('.hallazgos-alcance')?.textContent ?? '',
      hallazgos: parrafos
        .filter((p) => !p.classList.contains('hallazgos-alcance'))
        .map((p) => {
          const caja = p.getBoundingClientRect();
          return {
            testid: p.dataset.testid ?? '',
            titulo: p.querySelector('.hallazgo-titulo')?.textContent ?? '',
            texto: p.textContent ?? '',
            resaltadas: [...p.querySelectorAll('.hallazgo-cifra')].map((n) => n.textContent ?? ''),
            notas: p.querySelectorAll('.hallazgos-nota').length,
            oraciones: (p.textContent ?? '').split(/(?<=[.!?])\s+/).filter(Boolean).length,
            caracteres: (p.textContent ?? '').length,
            alto: Math.round(caja.height),
            lineas: Math.round(caja.height / parseFloat(getComputedStyle(p).lineHeight)),
          };
        }),
      separaciones,
      alturasDeclaradas,
      alturasFijas: alturasDeclaradas.length > 0,
      margenInterno: `${estilo.paddingTop} ${estilo.paddingBottom}`,
      columnas: getComputedStyle(host.closest('.project-fields')).gridTemplateColumns,
      anchoHost: Math.round(host.getBoundingClientRect().width),
      anchoDocumento: document.documentElement.scrollWidth,
      anchoVentana: window.innerWidth,
      notas: host.querySelectorAll('.hallazgos-nota').length,
      detalles: host.querySelectorAll('details').length,
      altoContenido: Math.round(cajas[cajas.length - 1].bottom - cajas[0].top),
    };
  });

  const etiqueta = tamano.nombre;
  const texto = limpiar(medida.hallazgos.map((h) => h.texto).join(' '));
  console.log(
    `\n${etiqueta}: contenido de la sección ${medida.altoContenido} px de alto · ` +
      `${medida.hallazgos.length} bloques · ${medida.anchoHost} px de ancho`,
  );

  comprobar(
    `${etiqueta}: el subtítulo declara el trimestre publicado`,
    limpiar(medida.subtitulo) === SUBTITULO,
    limpiar(medida.subtitulo),
  );
  comprobar(
    `${etiqueta}: hay exactamente tres hallazgos`,
    medida.hallazgos.length === 3,
    `${medida.hallazgos.length} hallazgos · ${medida.hallazgos.map((h) => h.testid).join(', ')}`,
  );

  for (const esperado of ESPERADOS) {
    const hallazgo = medida.hallazgos.find((h) => h.testid === `hallazgo-${esperado.id}`);
    comprobar(
      `${etiqueta}: hallazgo «${esperado.titulo}» con el título previsto`,
      Boolean(hallazgo) && limpiar(hallazgo.titulo) === `${esperado.titulo}.`,
      hallazgo ? limpiar(hallazgo.titulo) : 'no encontrado',
    );
    comprobar(
      `${etiqueta}: cifras de «${esperado.id}» coinciden con la API`,
      Boolean(hallazgo) && limpiar(hallazgo.texto).endsWith(esperado.texto),
      hallazgo ? limpiar(hallazgo.texto).slice(esperado.titulo.length + 2) : 'no encontrado',
    );
  }

  comprobar(
    `${etiqueta}: cada hallazgo tiene una o dos frases`,
    medida.hallazgos.every((h) => h.oraciones >= 2 && h.oraciones <= 3),
    medida.hallazgos.map((h) => `${h.testid}=${h.oraciones}`).join(' · '),
  );
  comprobar(
    `${etiqueta}: ningún hallazgo es un párrafo largo`,
    medida.hallazgos.every((h) => h.caracteres <= 260),
    medida.hallazgos.map((h) => h.caracteres).join(' · '),
  );
  comprobar(
    `${etiqueta}: sin notas técnicas ni párrafos de método o límites`,
    medida.notas === 0 && medida.detalles === 0 && !/10 de 15|no publicado|no se interpola/i.test(texto),
    `notas ${medida.notas} · detalles ${medida.detalles}`,
  );
  comprobar(
    `${etiqueta}: sin afirmaciones causales ni de descomposición`,
    PROHIBIDAS.every((frase) => !texto.toLowerCase().includes(frase)),
    PROHIBIDAS.filter((frase) => texto.toLowerCase().includes(frase)).join(', ') || 'ninguna',
  );
  comprobar(
    `${etiqueta}: cifras clave resaltadas con moderación`,
    medida.hallazgos.every((h) => h.resaltadas.length >= 1 && h.resaltadas.length <= 2),
    medida.hallazgos.map((h) => `${h.testid}(${h.resaltadas.join('|')})`).join(' · '),
  );
  comprobar(
    `${etiqueta}: sin alturas fijas para igualar columnas`,
    !medida.alturasFijas,
    medida.alturasFijas ? medida.alturasDeclaradas.join(' · ') : `automáticas · relleno ${medida.margenInterno}`,
  );
  comprobar(
    `${etiqueta}: separación constante entre los tres bloques`,
    new Set(medida.separaciones).size === 1,
    medida.separaciones.join(' · '),
  );
  comprobar(
    `${etiqueta}: sin desbordes horizontales`,
    medida.anchoDocumento === medida.anchoVentana,
    `${medida.anchoDocumento}/${medida.anchoVentana}`,
  );

  /* Capturas: la sección con su encabezado y el contexto de la cuadrícula. */
  const host = pagina.locator('#hallazgos-host');
  await host.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(250);
  const caja = await host.boundingBox();
  const campo = await pagina.locator('#hallazgos-host').evaluate((nodo) => {
    const rect = nodo.closest('.field').getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await pagina.screenshot({
    path: `${BASE}hallazgos-${etiqueta}.png`,
    clip: {
      x: Math.max(0, campo.x - 16),
      y: Math.max(0, campo.y - 12),
      width: Math.min(campo.width + 32, tamano.viewport.width),
      height: Math.min(campo.height + 24, tamano.viewport.height),
    },
  });
  await pagina.screenshot({
    path: `${BASE}hallazgos-contexto-${etiqueta}.png`,
    clip: {
      x: 0,
      y: Math.max(0, caja.y - 140),
      width: tamano.viewport.width,
      height: Math.min(tamano.viewport.height - 160, 900),
    },
  });

  await contexto.close();
}

await navegador.close();

const correctas = comprobaciones.filter((c) => c.correcto).length;
console.log(`\n${correctas}/${comprobaciones.length} comprobaciones correctas`);
console.log(`capturas: ${BASE}hallazgos-{escritorio,movil}.png`);
process.exit(correctas === comprobaciones.length ? 0 : 1);
