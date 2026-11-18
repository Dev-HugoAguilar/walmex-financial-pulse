/**
 * Derivaciones compartidas por los nueve bloques.
 *
 * Todo se calcula con los agregados que la API ya devuelve (`serie` de ingresos y
 * `matriz` de variaciones). No hay consultas nuevas ni cifras estimadas: cuando un
 * cálculo no se puede hacer con datos publicados, el resultado es `null`.
 */

import type { CeldaMatriz, Matriz, PuntoSerie, SerieMercado } from './api/tipos';
import { orden, periodoAnioAnterior } from './dominio';

export interface PuntoIngreso {
  periodo: string;
  valor: number | null;
}

/** Lectura de una serie de importes por mercado. */
export function serieDe(series: SerieMercado[], mercado: string): SerieMercado | undefined {
  return series.find((fila) => fila.mercado === mercado);
}

export function importeDe(series: SerieMercado[], mercado: string, periodo: string): number | null {
  const fila = serieDe(series, mercado);
  return fila?.ingresos.find((punto) => punto.periodo === periodo)?.valor ?? null;
}

export function importeAnteriorDe(
  series: SerieMercado[],
  mercado: string,
  periodo: string,
): number | null {
  const fila = serieDe(series, mercado);
  return fila?.ingresos_anio_anterior?.find((punto) => punto.periodo === periodo)?.valor ?? null;
}

export function crecimientoDe(
  series: SerieMercado[],
  mercado: string,
  periodo: string,
): number | null {
  const fila = serieDe(series, mercado);
  return fila?.crecimiento.find((punto) => punto.periodo === periodo)?.valor ?? null;
}

/* ------------------------------------------------------------------ bloque A */

export interface Aportacion {
  mercado: 'mexico' | 'centroamerica';
  etiqueta: string;
  importePrevio: number | null;
  importeActual: number | null;
  diferencia: number | null;
  /** Parte del cambio total que explica el mercado, cuando es interpretable. */
  participacion: number | null;
  participacionInterpretable: boolean;
}

export interface Puente {
  anterior: string | null;
  periodo: string;
  totalPrevio: number | null;
  totalActual: number | null;
  cambioTotal: number | null;
  crecimiento: number | null;
  aportaciones: Aportacion[];
  residual: number | null;
  residualInterpretable: boolean;
  concilia: boolean;
  calculable: boolean;
}

/** Puente horizontal del cambio de ingresos entre un trimestre y el de un año antes. */
export function construirPuente(
  series: SerieMercado[],
  periodos: string[],
  periodo: string,
): Puente {
  const anterior = periodoAnioAnterior(periodos, periodo);
  const totalPrevio = anterior ? importeDe(series, 'consolidado', anterior) : null;
  const totalActual = importeDe(series, 'consolidado', periodo);
  const cambioTotal =
    totalPrevio !== null && totalActual !== null ? totalActual - totalPrevio : null;

  const aportaciones: Aportacion[] = (['mexico', 'centroamerica'] as const).map((mercado) => {
    const importePrevio = anterior ? importeDe(series, mercado, anterior) : null;
    const importeActual = importeDe(series, mercado, periodo);
    const diferencia =
      importePrevio !== null && importeActual !== null ? importeActual - importePrevio : null;
    const interpretable =
      diferencia !== null &&
      cambioTotal !== null &&
      cambioTotal !== 0 &&
      Math.sign(diferencia) === Math.sign(cambioTotal);
    return {
      mercado,
      etiqueta: mercado === 'mexico' ? 'México' : 'Centroamérica',
      importePrevio,
      importeActual,
      diferencia,
      participacion: interpretable ? (100 * (diferencia as number)) / (cambioTotal as number) : null,
      participacionInterpretable: interpretable,
    };
  });

  const sumaDiferencias = aportaciones.reduce((suma, fila) => suma + (fila.diferencia ?? NaN), 0);
  const calculable =
    totalPrevio !== null &&
    totalActual !== null &&
    aportaciones.every((fila) => fila.diferencia !== null);
  const residual =
    calculable && cambioTotal !== null ? Math.round((sumaDiferencias - cambioTotal) * 1000) / 1000 : null;

  return {
    anterior,
    periodo,
    totalPrevio,
    totalActual,
    cambioTotal,
    crecimiento: totalPrevio ? (100 * ((cambioTotal ?? 0) / totalPrevio)) : null,
    aportaciones,
    residual,
    residualInterpretable: residual !== null && Math.abs(residual) > 0.5,
    concilia: residual !== null && Math.abs(residual) <= 1,
    calculable,
  };
}

/* ------------------------------------------------------------------ bloque B */

export interface FilaMezcla {
  periodo: string;
  mexico: number | null;
  centroamerica: number | null;
  total: number | null;
}

export function construirMezcla(series: SerieMercado[], periodos: string[]): FilaMezcla[] {
  return periodos.map((periodo) => {
    const mexico = importeDe(series, 'mexico', periodo);
    const centroamerica = importeDe(series, 'centroamerica', periodo);
    const total = importeDe(series, 'consolidado', periodo);
    return { periodo, mexico, centroamerica, total };
  });
}

/* ------------------------------------------------------------------ bloque C */

export interface CeldaCalendario {
  anio: number;
  trimestre: number;
  periodo: string;
  importe: number | null;
  crecimiento: number | null;
}

export interface Calendario {
  anios: number[];
  celdas: CeldaCalendario[];
  conImporte: number;
  conCrecimiento: number;
  maximo: number;
}

export function construirCalendario(series: SerieMercado[], mercado: string): Calendario {
  const fila = serieDe(series, mercado);
  const importes = new Map<string, number | null>(
    (fila?.ingresos ?? []).map((punto) => [punto.periodo, punto.valor]),
  );
  const crecimientos = new Map<string, number | null>(
    (fila?.crecimiento ?? []).map((punto) => [punto.periodo, punto.valor]),
  );
  const periodos = (fila?.ingresos ?? [])
    .map((punto) => punto.periodo)
    .sort((a, b) => orden(a) - orden(b));
  const anios = [...new Set(periodos.map((periodo) => 2000 + Number(periodo.slice(2))))].sort();
  const celdas: CeldaCalendario[] = [];
  for (const anio of anios) {
    for (const trimestre of [1, 2, 3, 4]) {
      const periodo = `${trimestre}T${String(anio).slice(2)}`;
      if (!periodos.includes(periodo)) {
        celdas.push({ anio, trimestre, periodo, importe: null, crecimiento: null });
        continue;
      }
      celdas.push({
        anio,
        trimestre,
        periodo,
        importe: importes.get(periodo) ?? null,
        crecimiento: crecimientos.get(periodo) ?? null,
      });
    }
  }
  const valores = celdas.map((celda) => celda.importe).filter((valor): valor is number => valor !== null);
  return {
    anios,
    celdas,
    conImporte: valores.length,
    conCrecimiento: celdas.filter((celda) => celda.crecimiento !== null).length,
    maximo: valores.length ? Math.max(...valores) : 0,
  };
}

/* ------------------------------------------------------------------ bloque G */

export interface ColumnaContribucion {
  periodo: string;
  anterior: string;
  aporteMexico: number;
  aporteCentroamerica: number;
  residual: number;
  crecimientoCalculado: number;
  crecimientoPublicado: number | null;
}

/**
 * Contribución de cada mercado al crecimiento consolidado:
 * (importe del mercado en t − importe del mismo mercado en t−4) ÷ importe
 * consolidado de t−4 × 100. Todas las contribuciones comparten denominador.
 */
export function construirContribuciones(
  series: SerieMercado[],
  periodos: string[],
): ColumnaContribucion[] {
  const salida: ColumnaContribucion[] = [];
  for (const periodo of periodos) {
    const anterior = periodoAnioAnterior(periodos, periodo);
    if (!anterior) continue;
    const base = importeDe(series, 'consolidado', anterior);
    if (!base) continue;
    const mxActual = importeDe(series, 'mexico', periodo);
    const mxPrevio = importeDe(series, 'mexico', anterior);
    const caActual = importeDe(series, 'centroamerica', periodo);
    const caPrevio = importeDe(series, 'centroamerica', anterior);
    const totalActual = importeDe(series, 'consolidado', periodo);
    if (mxActual === null || mxPrevio === null || caActual === null || caPrevio === null || totalActual === null) {
      continue;
    }
    const aporteMexico = (100 * (mxActual - mxPrevio)) / base;
    const aporteCentroamerica = (100 * (caActual - caPrevio)) / base;
    const crecimientoCalculado = (100 * (totalActual - base)) / base;
    salida.push({
      periodo,
      anterior,
      aporteMexico,
      aporteCentroamerica,
      residual:
        crecimientoCalculado - (aporteMexico + aporteCentroamerica),
      crecimientoCalculado,
      crecimientoPublicado: crecimientoDe(series, 'consolidado', periodo),
    });
  }
  return salida;
}

/* --------------------------------------------------------------- bloques E y F */

export interface BrechaIndicador {
  clave: string;
  etiqueta: string;
  definicion: string;
  base: string | null;
  mexico: number | null;
  centroamerica: number | null;
  brecha: number | null;
  periodo: string;
}

export const INDICADORES_MOTOR = ['trafico', 'ticket', 'mismas_tiendas'] as const;

export function celdasDe(
  matriz: Matriz | null,
  indicador: string,
  mercado: string,
  periodo: string,
): CeldaMatriz | null {
  return (
    matriz?.celdas.find(
      (celda) =>
        celda.indicador === indicador && celda.mercado === mercado && celda.periodo === periodo,
    ) ?? null
  );
}

export function construirVentaja(
  matriz: Matriz | null,
  periodo: string,
): BrechaIndicador[] {
  return INDICADORES_MOTOR.map((clave) => {
    const indicador = matriz?.indicadores.find((fila) => fila.clave === clave);
    const mexico = celdasDe(matriz, clave, 'mexico', periodo)?.valor ?? null;
    const centroamerica = celdasDe(matriz, clave, 'centroamerica', periodo)?.valor ?? null;
    return {
      clave,
      etiqueta:
        clave === 'trafico' ? 'Tráfico' : clave === 'ticket' ? 'Ticket' : 'Unidades iguales',
      definicion:
        clave === 'mismas_tiendas'
          ? 'ventas a unidades iguales publicadas por la empresa'
          : 'variación anual publicada por la empresa',
      base: indicador?.base ?? null,
      mexico,
      centroamerica,
      brecha: mexico !== null && centroamerica !== null ? mexico - centroamerica : null,
      periodo,
    };
  });
}

export interface PuntoBrecha {
  periodo: string;
  mexico: number | null;
  centroamerica: number | null;
  brecha: number | null;
}

export function construirBrechas(
  matriz: Matriz | null,
  periodos: string[],
): Record<string, PuntoBrecha[]> {
  return Object.fromEntries(
    INDICADORES_MOTOR.map((clave) => [
      clave,
      periodos.map((periodo) => {
        const mexico = celdasDe(matriz, clave, 'mexico', periodo)?.valor ?? null;
        const centroamerica = celdasDe(matriz, clave, 'centroamerica', periodo)?.valor ?? null;
        return {
          periodo,
          mexico,
          centroamerica,
          brecha: mexico !== null && centroamerica !== null ? mexico - centroamerica : null,
        };
      }),
    ]),
  );
}

/* ------------------------------------------------------------------ bloque H */

export interface PuntoIndice {
  periodo: string;
  mexico: number | null;
  centroamerica: number | null;
}

export function construirIndice(
  series: SerieMercado[],
  periodos: string[],
  base: string,
): PuntoIndice[] {
  const baseMexico = importeDe(series, 'mexico', base);
  const baseCentro = importeDe(series, 'centroamerica', base);
  return periodos.map((periodo) => {
    const mexico = importeDe(series, 'mexico', periodo);
    const centroamerica = importeDe(series, 'centroamerica', periodo);
    return {
      periodo,
      mexico: mexico !== null && baseMexico ? (100 * mexico) / baseMexico : null,
      centroamerica: centroamerica !== null && baseCentro ? (100 * centroamerica) / baseCentro : null,
    };
  });
}

export function basesValidas(series: SerieMercado[], periodos: string[]): string[] {
  return periodos.filter((periodo) => {
    const mexico = importeDe(series, 'mexico', periodo);
    const centro = importeDe(series, 'centroamerica', periodo);
    return mexico !== null && centro !== null && mexico > 0 && centro > 0;
  });
}

/* ------------------------------------------------------------------ bloque I */

export interface FilaPulso {
  clave: string;
  etiqueta: string;
  base: string | null;
  definicion: string;
  valores: Map<string, CeldaMatriz>;
}

export function construirPulso(
  matriz: Matriz | null,
  mercado: string,
  periodos: string[],
): FilaPulso[] {
  return (matriz?.indicadores ?? []).map((indicador) => {
    const valores = new Map<string, CeldaMatriz>();
    for (const periodo of periodos) {
      const celda = celdasDe(matriz, indicador.clave, mercado, periodo);
      if (celda) valores.set(periodo, celda);
    }
    return {
      clave: indicador.clave,
      etiqueta: indicador.etiqueta,
      base: indicador.base,
      definicion: indicador.definicion,
      valores,
    };
  });
}

/** Observación corta y verificable del trimestre seleccionado (no interpretativa). */
export function observacionResumen(puente: Puente): string | null {
  if (!puente.calculable || puente.cambioTotal === null || puente.totalPrevio === null) return null;
  const [mexico, centro] = puente.aportaciones;
  if (mexico.diferencia === null || centro.diferencia === null) return null;
  const signoCambio = Math.sign(puente.cambioTotal);
  const ambosMismoSigno =
    Math.sign(mexico.diferencia) === signoCambio && Math.sign(centro.diferencia) === signoCambio;
  if (!ambosMismoSigno || puente.cambioTotal === 0) {
    return `El cambio del consolidado (${puente.cambioTotal > 0 ? '+' : ''}${Math.round(
      puente.cambioTotal,
    )} M) mezcla aportaciones de distinto signo: no hay una participación única que repartir.`;
  }
  const parte = (valor: number) => (100 * valor) / (puente.cambioTotal as number);
  return `El cambio de ${puente.cambioTotal > 0 ? '+' : ''}${Math.round(puente.cambioTotal).toLocaleString(
    'es-MX',
  )} M se reparte entre México (${parte(mexico.diferencia).toFixed(1)} %) y Centroamérica (${parte(
    centro.diferencia,
  ).toFixed(1)} %)${puente.residualInterpretable ? ', con un residual de redondeo' : ', sin residual'}.`;
}
