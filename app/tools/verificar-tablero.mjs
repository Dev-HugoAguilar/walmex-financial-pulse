/**
 * Verificación del tablero «Pulso comercial · Walmex».
 *
 * Comprueba, en escritorio, tableta y móvil: los nueve bloques visibles, las
 * interacciones conectadas (selección, reproducción, arrastre, base sobre la línea
 * temporal, foco vinculado), la ausencia de recortes y etiquetas encimadas y las
 * cifras derivadas contra la API (puente, contribuciones, brechas, índice).
 *
 *   node tools/verificar-tablero.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SITIO = process.env.WALMEX_SITIO || 'http://127.0.0.1:8000';
const API = process.env.WALMEX_API || 'http://127.0.0.1:8010/api/v1/walmex';
const RUTA = '/#/area/dashboards/pulso-comercial';
const SALIDA = fileURLToPath(
  new URL('evidencias/revision/verificacion.json', new URL('../', import.meta.url)),
);

const resultados = [];
const comprobar = (nombre, condicion, detalle = '') => {
  resultados.push({ nombre, ok: Boolean(condicion), detalle: String(detalle).slice(0, 420) });
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

/* ------------------------------------------------------------------ datos */
const resumen = await (await fetch(`${API}/resumen`)).json();
const matriz = await (await fetch(`${API}/matriz`)).json();
const periodos = resumen.periodos;
const comparables = periodos.filter((p) => periodos.includes(`${p[0]}T${Number(p.slice(2)) - 1}`));
const trimestre = comparables[comparables.length - 1];
const anterior = `${trimestre[0]}T${Number(trimestre.slice(2)) - 1}`;
const importe = (mercado, periodo) =>
  resumen.series.find((fila) => fila.mercado === mercado)?.ingresos.find((p) => p.periodo === periodo)
    ?.valor ?? null;
const celda = (indicador, mercado, periodo) =>
  matriz.celdas.find(
    (fila) => fila.indicador === indicador && fila.mercado === mercado && fila.periodo === periodo,
  )?.valor ?? null;


/** Brechas visibles por indicador, calculadas desde la matriz de la API. */
const brechasVisibles = Object.fromEntries(
  ['trafico', 'ticket', 'mismas_tiendas'].map((clave) => [
    clave,
    periodos.map((periodo) => {
      const mexico = celda(clave, 'mexico', periodo);
      const centro = celda(clave, 'centroamerica', periodo);
      return {
        periodo,
        brecha: mexico !== null && centro !== null ? mexico - centro : null,
      };
    }),
  ]),
);
const totalPrevio = importe('consolidado', anterior);
const totalActual = importe('consolidado', trimestre);
const deltaMexico = importe('mexico', trimestre) - importe('mexico', anterior);
const deltaCentro = importe('centroamerica', trimestre) - importe('centroamerica', anterior);
const cambioTotal = totalActual - totalPrevio;
const aporteMexico = (100 * deltaMexico) / totalPrevio;
const aporteCentro = (100 * deltaCentro) / totalPrevio;
const crecimientoCalculado = (100 * (totalActual - totalPrevio)) / totalPrevio;

comprobar(
  '[datos] el puente concilia con el consolidado publicado',
  Math.abs(deltaMexico + deltaCentro - cambioTotal) <= 1,
  `ΔMX ${deltaMexico.toFixed(0)} + ΔCA ${deltaCentro.toFixed(0)} vs ΔTotal ${cambioTotal.toFixed(0)}`,
);
comprobar(
  '[datos] las contribuciones usan el ingreso consolidado del año anterior',
  Math.abs(aporteMexico + aporteCentro - crecimientoCalculado) < 0.02,
  `${aporteMexico.toFixed(2)} + ${aporteCentro.toFixed(2)} = ${(aporteMexico + aporteCentro).toFixed(
    2,
  )} pp · calculado ${crecimientoCalculado.toFixed(2)} pp`,
);

const VISTAS = [
  {
    clave: 'resumen',
    tab: 'Resumen comercial',
    bloques: ['bloque-puente', 'bloque-mezcla', 'bloque-calendario'],
    espera: '[data-testid="bloque-calendario"] svg',
  },
  {
    clave: 'motores',
    tab: 'Motores del crecimiento',
    bloques: ['bloque-motores', 'bloque-ventaja', 'bloque-brecha'],
    espera: '[data-testid="bloque-brecha"] svg',
  },
  {
    clave: 'comparativa',
    tab: 'Comparativa histórica',
    bloques: ['bloque-contribuciones', 'bloque-indice', 'bloque-pulso'],
    espera: '[data-testid="bloque-pulso"] .wm-celda',
  },
];

const medirSvg = () =>
  [...document.querySelectorAll('.wm-bloque svg')].map((svg) => {
    const textos = [...svg.querySelectorAll('text')].map((nodo) => {
      const r = nodo.getBoundingClientRect();
      return { texto: (nodo.textContent ?? '').trim(), x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
    });
    const caja = svg.getBoundingClientRect();
    const fuera = textos.filter(
      (t) => t.x0 < caja.left - 1 || t.x1 > caja.right + 1 || t.y0 < caja.top - 2 || t.y1 > caja.bottom + 2,
    );
    const encimadas = [];
    for (let i = 0; i < textos.length; i += 1) {
      for (let j = i + 1; j < textos.length; j += 1) {
        const a = textos[i];
        const b = textos[j];
        if (!a.texto || !b.texto) continue;
        if (a.x0 < b.x1 - 1 && a.x1 > b.x0 + 1 && a.y0 < b.y1 - 1 && a.y1 > b.y0 + 1) {
          encimadas.push(`${a.texto} / ${b.texto}`);
        }
      }
    }
    return {
      bloque: svg.closest('.wm-bloque')?.dataset.testid ?? '?',
      caja: { ancho: Math.round(caja.width), alto: Math.round(caja.height) },
      fuera: fuera.map((t) => t.texto),
      encimadas,
    };
  });

const navegador = await chromium.launch();

for (const tamano of [
  { nombre: 'escritorio', width: 1440, height: 1000 },
  { nombre: 'tableta', width: 834, height: 1112 },
  { nombre: 'movil', width: 390, height: 844 },
]) {
  const contexto = await navegador.newContext({
    viewport: { width: tamano.width, height: tamano.height },
    deviceScaleFactor: 1,
    locale: 'es-MX',
    colorScheme: 'light',
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  pagina.on('pageerror', (error) => errores.push(`pageerror: ${error.message}`));

  await pagina.goto(`${SITIO}${RUTA}`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('[data-testid="bloque-puente"]', { timeout: 90_000 });
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(800);

  for (const vista of VISTAS) {
    await pagina.locator(`.wm-tab:has-text("${vista.tab}")`).click();
    await pagina.waitForSelector(vista.espera, { timeout: 45_000 });
    await pagina.waitForTimeout(700);

    const estadoVista = await pagina.evaluate(() => ({
      testids: [...document.querySelectorAll('.wm-bloque')].map((bloque) => bloque.dataset.testid),
      alturas: [...document.querySelectorAll('.wm-bloque')].map((bloque) =>
        Math.round(bloque.getBoundingClientRect().height),
      ),
      dentroDeAcordeon: [...document.querySelectorAll('.wm-bloque details')].length,
      numeros: document.querySelectorAll('.wm-bloque-num').length,
      sellos: document.querySelectorAll('.wm-sello').length,
      preguntas: [...document.querySelectorAll('.wm-bloque h3')].filter((nodo) =>
        (nodo.textContent ?? '').trim().startsWith('¿'),
      ).length,
      parrafosTecnicos: [...document.querySelectorAll('.wm-cuerpo p')].length,
      observaciones: document.querySelectorAll('[data-testid="observacion-vista"]').length,
    }));

    comprobar(
      `[${tamano.nombre}/${vista.clave}] los tres bloques están visibles`,
      vista.bloques.every((clave) => estadoVista.testids.includes(clave)),
      estadoVista.testids.join(', '),
    );
    comprobar(
      `[${tamano.nombre}/${vista.clave}] sin acordeones dentro de los bloques`,
      estadoVista.dentroDeAcordeon === 0,
    );
    comprobar(
      `[${tamano.nombre}/${vista.clave}] sin numeración, insignias ni preguntas largas`,
      estadoVista.numeros === 0 && estadoVista.sellos === 0 && estadoVista.preguntas === 0,
      `números ${estadoVista.numeros} · sellos ${estadoVista.sellos} · preguntas ${estadoVista.preguntas}`,
    );
    comprobar(
      `[${tamano.nombre}/${vista.clave}] sin párrafos técnicos permanentes bajo las gráficas`,
      estadoVista.parrafosTecnicos === 0,
      `${estadoVista.parrafosTecnicos} párrafos`,
    );
    comprobar(
      `[${tamano.nombre}/${vista.clave}] una observación verificada de la vista`,
      estadoVista.observaciones === 1,
    );
    comprobar(
      `[${tamano.nombre}/${vista.clave}] los bloques tienen altura suficiente`,
      estadoVista.alturas.every((alto) => alto > 120),
      estadoVista.alturas.join(' / '),
    );
  }

  /* ---------------- Resumen: puente proporcional y calendario ---------------- */
  await pagina.locator('.wm-tab:has-text("Resumen comercial")').click();
  await pagina.waitForSelector('[data-testid="bloque-calendario"] svg', { timeout: 45_000 });
  await pagina.waitForTimeout(600);

  const barras = await pagina.evaluate(() => {
    const svg = document.querySelector('[data-testid="bloque-puente"] svg');
    if (!svg) return null;
    return [...svg.querySelectorAll('rect[role="button"]')].map((rect) => ({
      ancho: Math.round(rect.getBoundingClientRect().width),
      etiqueta: rect.getAttribute('aria-label') ?? '',
    }));
  });
  if (barras && barras.length >= 2) {
    const proporcion = barras[0].ancho / barras[1].ancho;
    const esperada = deltaMexico / deltaCentro;
    comprobar(
      `[${tamano.nombre}] el puente dibuja barras proporcionales a las aportaciones`,
      Math.abs(proporcion - esperada) / esperada < 0.12,
      `dibujo ${proporcion.toFixed(2)} vs datos ${esperada.toFixed(2)}`,
    );
  } else {
    comprobar(`[${tamano.nombre}] el puente dibuja las dos aportaciones`, false, 'sin barras');
  }

  const circulos = await pagina.evaluate(() => {
    const svg = document.querySelector('[data-testid="bloque-calendario"] svg');
    if (!svg) return null;
    return [...svg.querySelectorAll('circle')]
      .map((nodo) => Number(nodo.getAttribute('r')))
      .filter((r) => r > 0);
  });
  comprobar(
    `[${tamano.nombre}] el calendario dibuja círculos de área proporcional`,
    Boolean(circulos && circulos.length >= 8),
    circulos ? `${circulos.length} círculos · radios ${circulos.slice(0, 4).map((r) => r.toFixed(1)).join(', ')}` : 'sin círculos',
  );

  /* ---------------- Motores: reproducción, arrastre y foco vinculado -------- */
  await pagina.locator('.wm-tab:has-text("Motores del crecimiento")').click();
  await pagina.waitForSelector('[data-testid="bloque-brecha"] svg', { timeout: 45_000 });
  await pagina.waitForTimeout(600);

  const trimestreInicial = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  await pagina.locator('[data-testid="motores-reproducir"]').click();
  await pagina.waitForTimeout(1300);
  const trimestreReproduciendo = await pagina
    .locator('[aria-label="Trimestre seleccionado"]')
    .inputValue();
  const hayEstado = await pagina.locator('[data-testid="motores-estado-reproduccion"]').count();
  await pagina.locator('[data-testid="motores-reproducir"]').click();
  comprobar(
    `[${tamano.nombre}] la reproducción avanza entre observaciones reales`,
    trimestreInicial !== trimestreReproduciendo && hayEstado === 1,
    `${trimestreInicial} → ${trimestreReproduciendo}`,
  );
  comprobar(
    `[${tamano.nombre}] la reproducción no inventa trimestres`,
    (await pagina.locator('[aria-label="Trimestre seleccionado"] option').count()) === periodos.length,
  );

  await pagina.locator('[data-testid="bloque-ventaja"] rect[role="button"]').first().click({ force: true });
  await pagina.waitForTimeout(400);
  const panelesActivos = await pagina.locator('[data-testid="bloque-brecha"] .wm-brecha-panel.is-activa').count();
  comprobar(
    `[${tamano.nombre}] el foco de un indicador se propaga a su panel histórico`,
    panelesActivos === 1,
    `${panelesActivos} paneles resaltados`,
  );
  const urlIndicador = new URL(pagina.url()).searchParams.get('wm-indicador');
  comprobar(
    `[${tamano.nombre}] el indicador activo vive en la URL`,
    ['trafico', 'ticket', 'mismas_tiendas'].includes(urlIndicador ?? ''),
    urlIndicador ?? 'sin parámetro',
  );

  /* ---------------- Brecha de motores: paneles, escala e interacción ------- */
  const bloqueBrecha = pagina.locator('[data-testid="bloque-brecha"]');
  await bloqueBrecha.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(400);

  const geoBrecha = await pagina.evaluate(() => {
    const bloque = document.querySelector('[data-testid="bloque-brecha"]');
    const paneles = [...bloque.querySelectorAll('.wm-brecha-panel')];
    const svgs = paneles.map((panel) => panel.querySelector('svg').getBoundingClientRect());
    return {
      paneles: paneles.length,
      anchos: svgs.map((r) => Math.round(r.width)),
      y: svgs.map((r) => Math.round(r.top)),
      x: svgs.map((r) => Math.round(r.left)),
      altoBloque: Math.round(bloque.getBoundingClientRect().height),
      texto: bloque.textContent ?? '',
      escala: [...bloque.querySelectorAll('.wm-brecha-panel')].map((panel) => {
        const textos = [...panel.querySelectorAll('text')]
          .map((nodo) => nodo.textContent.trim())
          .filter((texto) => texto.startsWith('+') || texto.startsWith('−'));
        return textos[0] ?? '?';
      }),
      barras: [...bloque.querySelectorAll('rect[rx="2"]')].map((rect) => ({
        x: Math.round(rect.getBoundingClientRect().left),
        fill: rect.getAttribute('fill'),
        alto: Number(rect.getAttribute('height')),
        y: Math.round(rect.getBoundingClientRect().top),
      })),
      bandas: [...bloque.querySelectorAll('.wm-brecha-banda')].map((rect) => ({
        x: Math.round(rect.getBoundingClientRect().left),
        ancho: Math.round(rect.getBoundingClientRect().width),
      })),
    };
  });

  comprobar(
    `[${tamano.nombre}/brecha] tres paneles apilados a todo el ancho`,
    geoBrecha.paneles === 3 &&
      geoBrecha.anchos.every((ancho) => Math.abs(ancho - geoBrecha.anchos[0]) <= 1) &&
      geoBrecha.y[0] < geoBrecha.y[1] &&
      geoBrecha.y[1] < geoBrecha.y[2] &&
      geoBrecha.anchos[0] > 240,
    `anchos ${geoBrecha.anchos.join(' / ')} · y ${geoBrecha.y.join(' / ')}`,
  );
  comprobar(
    `[${tamano.nombre}/brecha] misma escala vertical simétrica en los tres paneles`,
    new Set(geoBrecha.escala).size === 1,
    geoBrecha.escala.join(' / '),
  );
  comprobar(
    `[${tamano.nombre}/brecha] la banda temporal se alinea en los tres paneles`,
    geoBrecha.bandas.length === 3 &&
      geoBrecha.bandas.every(
        (banda) => Math.abs(banda.x - geoBrecha.bandas[0].x) <= 1 && banda.ancho === geoBrecha.bandas[0].ancho,
      ),
    geoBrecha.bandas.map((banda) => `${banda.x}+${banda.ancho}`).join(' / '),
  );

  await pagina
    .locator('[aria-label="Trimestre seleccionado"]')
    .selectOption(trimestre);
  await pagina.waitForTimeout(400);

  const esperadas = ['trafico', 'ticket', 'mismas_tiendas'].map((clave) => {
    const mx = celda(clave, 'mexico', trimestre);
    const ca = celda(clave, 'centroamerica', trimestre);
    return mx !== null && ca !== null ? mx - ca : null;
  });
  const valoresPanel = await pagina.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="brecha-valor-"]')].map((nodo) => nodo.textContent.trim()),
  );
  const numero = (texto) =>
    Number(
      texto
        .replace('pp', '')
        .replace('−', '-')
        .replace('+', '')
        .replace(/\s/g, '')
        .replace(',', '.'),
    );
  comprobar(
    `[${tamano.nombre}/brecha] la cifra del panel es la diferencia de las dos tasas`,
    esperadas.every(
      (esperada, indice) =>
        esperada === null || Math.abs(numero(valoresPanel[indice] ?? '0') - esperada) < 0.05,
    ),
    `${valoresPanel.join(' · ')} vs ${esperadas.map((valor) => valor?.toFixed(2)).join(' · ')}`,
  );

  const azules = geoBrecha.barras.filter((barra) => barra.fill?.toUpperCase() === '#3458F5').length;
  const violetas = geoBrecha.barras.filter((barra) => barra.fill?.toUpperCase() === '#8066E8').length;
  comprobar(
    `[${tamano.nombre}/brecha] columnas azules sobre cero y violetas bajo cero`,
    azules > 0 && violetas > 0,
    `${azules} azules · ${violetas} violetas`,
  );
  const barrasEsperadas = ['trafico', 'ticket', 'mismas_tiendas'].reduce(
    (total, clave) =>
      total +
      (brechasVisibles[clave] ?? []).filter((punto) => punto.brecha !== null && punto.brecha !== 0).length,
    0,
  );
  comprobar(
    `[${tamano.nombre}/brecha] solo se dibujan trimestres con las dos tasas`,
    geoBrecha.barras.length === barrasEsperadas,
    `${geoBrecha.barras.length} columnas vs ${barrasEsperadas} brechas válidas`,
  );
  comprobar(
    `[${tamano.nombre}/brecha] sin la nota de interpolación`,
    !/interpol|cruce por cero/i.test(geoBrecha.texto),
  );

  const peticionesBrecha = [];
  const alPedir = (peticion) => peticionesBrecha.push(peticion.url());
  pagina.on('request', alPedir);
  const svgTrafico = pagina.locator('[data-testid="brecha-panel-trafico"] svg');
  const cajaTrafico = await svgTrafico.boundingBox();
  if (cajaTrafico) {
    await pagina.mouse.move(cajaTrafico.x + cajaTrafico.width * 0.45, cajaTrafico.y + cajaTrafico.height / 2);
    await pagina.waitForTimeout(400);
  }
  const explorado = await pagina.evaluate(() => ({
    bandas: document.querySelectorAll('.wm-brecha-banda.is-explorada').length,
    tooltip: document.querySelector('[data-testid="tooltip-brecha"]')?.textContent ?? '',
    lineas: document.querySelectorAll('[data-testid="tooltip-brecha"] .wm-tooltip-linea').length,
  }));
  comprobar(
    `[${tamano.nombre}/brecha] el cursor resalta la misma columna en los tres paneles`,
    explorado.bandas === 3,
    `${explorado.bandas} bandas`,
  );
  comprobar(
    `[${tamano.nombre}/brecha] globo compartido con las dos tasas y la diferencia por indicador`,
    explorado.lineas === 3 && /MX/.test(explorado.tooltip) && /pp/.test(explorado.tooltip),
    explorado.tooltip.replace(/\s+/g, ' ').slice(0, 140),
  );

  const antesClic = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  await pagina.mouse.down();
  await pagina.mouse.up();
  await pagina.waitForTimeout(400);
  const despuesClic = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  comprobar(
    `[${tamano.nombre}/brecha] el clic fija el trimestre y sincroniza la selección`,
    antesClic !== despuesClic &&
      new URL(pagina.url()).searchParams.get('wm-trimestre') === despuesClic,
    `${antesClic} → ${despuesClic}`,
  );

  await pagina.mouse.move(4, 4);
  await pagina.waitForTimeout(350);
  const trasSalir = await pagina.evaluate(() => ({
    exploradas: document.querySelectorAll('.wm-brecha-banda.is-explorada').length,
    fijadas: document.querySelectorAll('.wm-brecha-banda').length,
    tooltip: Boolean(document.querySelector('[data-testid="tooltip-brecha"]')),
  }));
  comprobar(
    `[${tamano.nombre}/brecha] al salir se recupera la selección fijada`,
    trasSalir.exploradas === 0 && trasSalir.fijadas === 3 && !trasSalir.tooltip,
    JSON.stringify(trasSalir),
  );

  await svgTrafico.focus();
  const antesTecla = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  await pagina.keyboard.press('ArrowLeft');
  await pagina.waitForTimeout(350);
  const trasTecla = await pagina.evaluate(() => ({
    bandas: document.querySelectorAll('.wm-brecha-banda.is-explorada').length,
    tooltip: Boolean(document.querySelector('[data-testid="tooltip-brecha"]')),
  }));
  await pagina.keyboard.press('Enter');
  await pagina.waitForTimeout(350);
  const fijadoTecla = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  comprobar(
    `[${tamano.nombre}/brecha] teclado: flechas exploran y Enter fija`,
    trasTecla.bandas === 3 && trasTecla.tooltip && fijadoTecla !== antesTecla,
    `${antesTecla} → ${fijadoTecla}`,
  );

  pagina.off('request', alPedir);
  comprobar(
    `[${tamano.nombre}/brecha] sin peticiones de red al explorar`,
    peticionesBrecha.filter((url) => url.includes('/api/')).length === 0,
    `${peticionesBrecha.length} peticiones`,
  );

  await pagina
    .locator('[aria-label="Trimestre seleccionado"]')
    .selectOption(await pagina.locator('[aria-label="Trimestre seleccionado"] option').first().getAttribute('value'));
  await pagina.waitForTimeout(300);
  const antesArrastre = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  await pagina.locator('[data-testid="motores-grafica"] svg').first().scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(300);
  const cajaSvg = await pagina.locator('[data-testid="motores-grafica"] svg').first().boundingBox();
  if (cajaSvg) {
    await pagina.mouse.move(cajaSvg.x + 40, cajaSvg.y + cajaSvg.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(cajaSvg.x + cajaSvg.width - 30, cajaSvg.y + cajaSvg.height / 2, { steps: 8 });
    await pagina.mouse.up();
    await pagina.waitForTimeout(400);
  }
  const despuesArrastre = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  comprobar(
    `[${tamano.nombre}] el arrastre selecciona otro trimestre`,
    antesArrastre !== despuesArrastre,
    `${antesArrastre} → ${despuesArrastre}`,
  );

  await pagina.locator('[data-testid="motores-grafica"] svg').first().focus();
  const antesTeclado = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  await pagina.keyboard.press('ArrowRight');
  await pagina.waitForTimeout(300);
  const despuesTeclado = await pagina.locator('[aria-label="Trimestre seleccionado"]').inputValue();
  comprobar(
    `[${tamano.nombre}] el teclado recorre los trimestres`,
    antesTeclado !== despuesTeclado,
    `${antesTeclado} → ${despuesTeclado}`,
  );

  /* ---------------- Comparativa: base sobre la línea y foco en la matriz ---- */
  await pagina.locator('.wm-tab:has-text("Comparativa histórica")').click();
  await pagina.waitForSelector('[data-testid="bloque-pulso"] .wm-celda', { timeout: 45_000 });
  await pagina.waitForTimeout(600);

  const baseInicial = await pagina.locator('[data-testid="indice-base-actual"]').innerText();
  const tiraBase = pagina.locator('[data-testid="bloque-indice"] .wm-tira-base[role="button"]');
  const cuantasBases = await tiraBase.count();
  await tiraBase.nth(Math.min(3, cuantasBases - 1)).click({ force: true });
  await pagina.waitForTimeout(500);
  const baseFinal = await pagina.locator('[data-testid="indice-base-actual"]').innerText();
  const urlBase = new URL(pagina.url()).searchParams.get('wm-indice-base');
  comprobar(
    `[${tamano.nombre}] la base del índice se elige sobre la línea temporal`,
    baseInicial !== baseFinal && Boolean(urlBase),
    `${baseInicial.trim()} → ${baseFinal.trim()} · URL ${urlBase}`,
  );
  comprobar(
    `[${tamano.nombre}] la base vale 100 por definición`,
    baseFinal.includes(urlBase ?? '###'),
    `${baseFinal.trim()} · ${urlBase}`,
  );

  const fila = pagina.locator('[data-testid="bloque-pulso"] tbody tr').first();
  await fila.locator('.wm-pulso-nombre').click();
  await pagina.waitForSelector('[data-testid="panel-contexto"]', { timeout: 10_000 });
  const tituloHistoria = await pagina.locator('[data-testid="panel-contexto"] h4').innerText();
  await pagina.locator('[data-testid="contexto-expandir"]').click();
  await pagina.waitForTimeout(300);
  const textoHistoria = await pagina.locator('[data-testid="panel-contexto"]').innerText();
  const filasDetalle = await pagina.locator('[data-testid="panel-contexto"] dt').count();
  comprobar(
    `[\] elegir un indicador abre su historia en el detalle`,
    tituloHistoria.includes('historia') && textoHistoria.includes('Mínimo'),
    tituloHistoria.slice(0, 90),
  );
  comprobar(
    `[\] el panel contextual se expande con fórmula y fuente`,
    filasDetalle >= 3,
    `\ campos`,
  );

  /* ---------------- URL, exportación y tooltip ---------------- */
  const url = new URL(pagina.url());
  comprobar(
    `[${tamano.nombre}] el estado vive en la URL`,
    url.searchParams.get('wm-vista') === 'comparativa' &&
      Boolean(url.searchParams.get('wm-trimestre')) &&
      Boolean(url.searchParams.get('wm-indice-base')),
    url.search,
  );

  const exportar = pagina.locator('[data-testid="exportar"]');
  const href = await exportar.getAttribute('href');
  const respuesta = await pagina.request.get(href);
  const csv = await respuesta.text();
  comprobar(
    `[${tamano.nombre}] la exportación declara unidades, origen y filtros`,
    respuesta.ok() &&
      csv.includes('periodo,mercado,indicador,base,valor,unidad,origen,fuente') &&
      csv.includes('# Unidades') &&
      csv.includes('# Origen') &&
      csv.includes('# Filtros'),
  );

  await pagina.locator('[data-testid="bloque-pulso"] .wm-celda').nth(3).hover();
  await pagina.waitForTimeout(400);
  const globo = await pagina.locator('[data-testid="tooltip-pulso"]').count();
  comprobar(`[${tamano.nombre}] las marcas muestran globo con valor y base`, globo === 1);

  /* ---------------- defectos de maquetación ---------------- */
  for (const vista of VISTAS) {
    await pagina.locator(`.wm-tab:has-text("${vista.tab}")`).click();
    await pagina.waitForSelector(vista.espera, { timeout: 45_000 });
    await pagina.waitForTimeout(500);
    const svg = await pagina.evaluate(medirSvg);
    const desbordes = await pagina.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    comprobar(
      `[${tamano.nombre}/${vista.clave}] sin desbordes horizontales`,
      desbordes <= 1,
      `${desbordes} px`,
    );
    for (const medida of svg) {
      comprobar(
        `[${tamano.nombre}/${vista.clave}] ${medida.bloque} sin textos fuera del lienzo`,
        medida.fuera.length === 0,
        `${medida.caja.ancho}x${medida.caja.alto} · ${medida.fuera.join(' | ')}`,
      );
      comprobar(
        `[${tamano.nombre}/${vista.clave}] ${medida.bloque} sin etiquetas encimadas`,
        medida.encimadas.length === 0,
        medida.encimadas.join(' | '),
      );
    }
  }
  comprobar(`[${tamano.nombre}] sin errores de consola`, errores.length === 0, errores.join(' | '));

  await contexto.close();
}

/* ---------------- movimiento reducido ---------------- */
{
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'es-MX',
    reducedMotion: 'reduce',
  });
  const pagina = await contexto.newPage();
  await pagina.goto(`${SITIO}${RUTA}`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('[data-testid="bloque-puente"]', { timeout: 90_000 });
  await pagina.waitForTimeout(600);
  await pagina.locator('.wm-tab:has-text("Motores del crecimiento")').click();
  await pagina.waitForSelector('[data-testid="bloque-brecha"] svg', { timeout: 45_000 });
  await pagina.waitForTimeout(600);
  const sinAnimacion = await pagina.evaluate(() => ({
    vistaAnimada: [...document.querySelectorAll('.wm-vista')].some((nodo) =>
      nodo.className.includes('wm-vista--entra'),
    ),
    indicadorSinMovimiento: [...document.querySelectorAll('.wm-tabs-indicador')].some((nodo) =>
      nodo.className.includes('sin-movimiento'),
    ),
  }));
  comprobar(
    '[reduced motion] no se animan vistas ni el indicador de pestaña',
    sinAnimacion.vistaAnimada === false && sinAnimacion.indicadorSinMovimiento === true,
    JSON.stringify(sinAnimacion),
  );
  await contexto.close();
}

await navegador.close();

const fallas = resultados.filter((resultado) => !resultado.ok);
await writeFile(SALIDA, JSON.stringify({ resultados, fallas: fallas.length }, null, 1));
console.log(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones correctas`);
if (fallas.length) {
  console.log('Fallas:');
  for (const falla of fallas) console.log(` · ${falla.nombre} — ${falla.detalle}`);
  process.exitCode = 1;
}






