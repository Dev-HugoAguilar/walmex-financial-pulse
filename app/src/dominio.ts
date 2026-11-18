/** Formatos, etiquetas, colores y estado de la URL del tablero. */

import type { Filtros } from './api/tipos';

const PREFIJO = 'wm-';

export const MERCADOS: Record<string, string> = {
  consolidado: 'Consolidado',
  mexico: 'México',
  centroamerica: 'Centroamérica',
};

/** Colores estables por mercado en todas las vistas. */
export const COLOR_MERCADO: Record<string, string> = {
  mexico: '#3458F5',
  centroamerica: '#8066E8',
  consolidado: '#596273',
};

/** Semántica de aumento y disminución, independiente del mercado. */
export const COLOR_AUMENTO = '#0F7B5A';
export const COLOR_DISMINUCION = '#B4433F';

/**
 * Tonos por año para el perfil estacional: misma familia que el mercado elegido,
 * con más saturación en los años recientes. Nunca cambia de mercado a mercado el
 * significado del color dentro de la misma gráfica.
 */
export function colorAnio(mercado: string, indice: number, total: number): string {
  const base = COLOR_MERCADO[mercado] ?? COLOR_MERCADO.mexico;
  const posicion = total <= 1 ? 1 : indice / (total - 1);
  const mezcla = mezclar(base, '#111318', 0.42 - 0.42 * posicion);
  return mezcla;
}

/** Interpola dos colores hex; `peso` 0 = color A, 1 = color B. */
export function mezclar(a: string, b: string, peso: number): string {
  const cortar = (color: string) => {
    const limpio = color.replace('#', '');
    return [0, 2, 4].map((inicio) => parseInt(limpio.slice(inicio, inicio + 2), 16));
  };
  const [r1, g1, b1] = cortar(a);
  const [r2, g2, b2] = cortar(b);
  const canal = (x: number, y: number) => Math.round(x + (y - x) * Math.min(1, Math.max(0, peso)));
  return `#${[canal(r1, r2), canal(g1, g2), canal(b1, b2)]
    .map((valor) => valor.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Año de un periodo «3T26» → 2026. */
export function anioDe(periodo: string): number {
  return 2000 + Number(periodo.slice(2));
}

/** Número de trimestre de un periodo «3T26» → 3. */
export function trimestreDe(periodo: string): number {
  return Number(periodo.slice(0, 1));
}

export const UNIDAD: Record<string, string> = {
  millones_mxn: 'millones de pesos',
  porcentaje: 'porcentaje',
};

const ENTERO = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** Formato decimal local: coma decimal y signo menos tipográfico. */
export function decimal(valor: number, decimales = 1): string {
  const formateado = valor.toLocaleString('es-MX', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  return formateado.replace('-', '−');
}

export function millones(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'No publicado';
  return ENTERO.format(valor).replace('-', '−');
}

export function milesMillones(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'No publicado';
  return ENTERO.format(Math.round(valor)).replace('-', '−');
}

export function numero(valor: number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'No publicado';
  return decimal(valor, decimales);
}

export function porcentaje(valor: number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'No publicado';
  const signo = valor > 0 ? '+' : '';
  return `${signo}${decimal(valor, decimales)} %`;
}

export function porcentajeSinSigno(valor: number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'No publicado';
  return `${decimal(valor, decimales)} %`;
}

/** Diferencia en puntos porcentuales, con signo y dirección explícitos. */
export function puntosPorcentuales(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 'No publicado';
  const signo = valor > 0 ? '+' : '';
  return `${signo}${decimal(valor, 1)} pp`;
}

export function etiquetaFecha(iso: string | null | undefined): string {
  if (!iso) return 'sin fecha';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [anio, mes, dia] = iso.split('-');
  const indice = Number(mes) - 1;
  if (!anio || !dia || !meses[indice]) return iso;
  return `${Number(dia)} ${meses[indice]} ${anio}`;
}

export function slugBase(base: string | null | undefined): string {
  if (!base) return 'sin base declarada';
  const etiquetas: Record<string, string> = {
    nominal: 'importe nominal',
    nominal_publicado: 'variación publicada por la empresa',
    nominal_calculado: 'variación calculada con importes',
    moneda_constante_publicado: 'variación a moneda constante (empresa)',
    unidades_iguales_publicado: 'unidades iguales publicadas',
    publicado_comunicado: 'publicado en el comunicado',
  };
  return etiquetas[base] ?? base;
}

/** Orden comparable de un periodo «3T26» → 20263. */
export function orden(periodo: string): number {
  return Number(`20${periodo.slice(2)}`) * 10 + Number(periodo.slice(0, 1));
}

export const FILTROS_VACIOS: Filtros = {
  mercados: [],
  desde: null,
  hasta: null,
  indicador: null,
  base: null,
};

export interface EstadoUrl {
  vista: 'resumen' | 'motores' | 'comparativa';
  desde: string | null;
  hasta: string | null;
  trimestre: string | null;
  baseIndice: string | null;
  indicador: string | null;
  base: string | null;
  mercado: string | null;
  /** Controles propios de cada bloque, para poder compartir la vista exacta. */
  motores: string | null;
  estacional: string | null;
  composicion: string | null;
  calorMercado: string | null;
  calorModo: string | null;
}

export function leerEstado(url: URL): EstadoUrl {
  const vista = url.searchParams.get(`${PREFIJO}vista`);
  const valor = (clave: string) => url.searchParams.get(`${PREFIJO}${clave}`);
  return {
    vista:
      vista === 'motores' || vista === 'comparativa' || vista === 'resumen' ? vista : 'resumen',
    desde: valor('desde'),
    hasta: valor('hasta'),
    trimestre: valor('trimestre'),
    baseIndice: valor('indice-base'),
    indicador: valor('indicador'),
    base: valor('base'),
    mercado: valor('mercado'),
    motores: valor('motores'),
    estacional: valor('estacional'),
    composicion: valor('composicion'),
    calorMercado: valor('calor-mercado'),
    calorModo: valor('calor-modo'),
  };
}

const CLAVES_ESTADO = [
  'vista',
  'desde',
  'hasta',
  'trimestre',
  'indice-base',
  'indicador',
  'base',
  'mercado',
  'motores',
  'estacional',
  'composicion',
  'calor-mercado',
  'calor-modo',
] as const;

export function escribirEstado(estado: EstadoUrl): void {
  const url = new URL(window.location.href);
  for (const clave of CLAVES_ESTADO) {
    url.searchParams.delete(`${PREFIJO}${clave}`);
  }
  url.searchParams.set(`${PREFIJO}vista`, estado.vista);
  const opcionales: [string, string | null][] = [
    ['desde', estado.desde],
    ['hasta', estado.hasta],
    ['trimestre', estado.trimestre],
    ['indice-base', estado.baseIndice],
    ['indicador', estado.indicador],
    ['base', estado.base],
    ['mercado', estado.mercado],
    ['motores', estado.motores],
    ['estacional', estado.estacional],
    ['composicion', estado.composicion],
    ['calor-mercado', estado.calorMercado],
    ['calor-modo', estado.calorModo],
  ];
  for (const [clave, valor] of opcionales) {
    if (valor) url.searchParams.set(`${PREFIJO}${clave}`, valor);
  }
  window.history.replaceState({}, '', url.toString());
}

/** Recorta una lista de periodos al rango visible. */
export function enRango(periodos: string[], desde: string | null, hasta: string | null): string[] {
  const limiteInferior = desde ? orden(desde) : -Infinity;
  const limiteSuperior = hasta ? orden(hasta) : Infinity;
  return periodos.filter((periodo) => orden(periodo) >= limiteInferior && orden(periodo) <= limiteSuperior);
}

/** Trimestre anterior equivalente: mismo trimestre del año previo (4 posiciones antes). */
export function periodoAnioAnterior(periodos: string[], periodo: string): string | null {
  const meta = `${periodo[0]}T${Number(periodo.slice(2)) - 1}`;
  return periodos.includes(meta) ? meta : null;
}
