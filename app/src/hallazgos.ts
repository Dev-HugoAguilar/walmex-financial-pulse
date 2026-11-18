/**
 * «Hallazgos del análisis» de la ficha de «Pulso comercial · Walmex».
 *
 * Tres lecturas del último trimestre publicado frente al mismo trimestre del año
 * anterior, calculadas con la API y sin filtros:
 *
 *  1. cómo se reparte el incremento de ingresos entre los dos mercados, con los
 *     importes aditivos del mismo trimestre;
 *  2. qué hace el tráfico y qué hace el ticket en cada mercado, tal como la
 *     empresa los publica;
 *  3. ventas a unidades iguales —la medida comparable que reporta la empresa— y la
 *     diferencia entre los dos mercados en puntos porcentuales.
 *
 * Reglas:
 *
 *  · ninguna cifra se escribe a mano: todas salen de la API;
 *  · las participaciones solo usan importes aditivos (México + Centroamérica);
 *  · no se suman ni se promedian porcentajes;
 *  · tráfico y ticket se describen como variaciones publicadas, nunca como
 *    descomposición del crecimiento ni como explicación causal;
 *  · si falta un dato, el hallazgo se omite en vez de rellenarse.
 *
 * Las advertencias de método, cobertura y límites no viven aquí: están en «Método
 * y decisiones técnicas», «Limitaciones» y «Fuentes y datos».
 */

import type { Desempeno, Motores, Resumen } from './api/tipos';
import { decimal } from './dominio';

export interface Hallazgo {
  id: string;
  titulo: string;
  texto: string;
  /** Fragmentos de `texto` que se muestran resaltados (cifras clave). */
  enfasis: string[];
}

export interface DatosHallazgos {
  resumen: Resumen;
  motores: Motores;
  desempeno: Desempeno;
}

export interface ResultadoHallazgos {
  subtitulo: string;
  hallazgos: Hallazgo[];
  omitidos: string[];
}

/** Agrupación de miles con espacio duro: 7 308. */
function cifra(valor: number): string {
  return Math.round(valor).toLocaleString('es-MX').replace(/,/g, '\u00A0');
}

/** Variación con coma decimal y signo tipográfico: 84,7 %. */
function porcentaje(valor: number): string {
  return `${decimal(valor, 1).replace('.', ',')} %`;
}

/** Puntos porcentuales con un decimal, redondeados sobre esa precisión. */
function puntos(valor: number): string {
  const redondeado = Math.round(valor * 10) / 10;
  return `${decimal(redondeado, 1).replace('.', ',')} puntos porcentuales`;
}

const ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto'];

/** «3T26» → «tercer trimestre de 2026». */
function nombreTrimestre(periodo: string): string {
  const partes = /^(\d)T(\d{2})$/.exec(periodo);
  if (!partes) return periodo;
  const indice = Number(partes[1]) - 1;
  const ordinal = ORDINAL[indice] ?? `${partes[1]}º`;
  return `${ordinal} trimestre de 20${partes[2]}`;
}

/** Describe una variación publicada sin atribuirle causalidad. */
function movimiento(valor: number, sujeto: string): string {
  if (Math.abs(valor) < 0.05) return `${sujeto} permanece estable`;
  const signo = valor > 0 ? 'aumenta' : 'cae';
  return `${sujeto} ${signo} ${porcentaje(Math.abs(valor))}`;
}

export function construirHallazgos(datos: DatosHallazgos): ResultadoHallazgos {
  const { resumen, motores, desempeno } = datos;
  const hallazgos: Hallazgo[] = [];
  const omitidos: string[] = [];

  const periodos = resumen.periodos ?? [];
  const ultimo = periodos[periodos.length - 1];
  const anioAnterior = ultimo ? Number(ultimo.slice(-2)) - 1 : null;
  const subtitulo = ultimo
    ? `Resultados del ${nombreTrimestre(ultimo)} frente al mismo trimestre de 20${anioAnterior}.`
    : 'Resultados del último trimestre publicado frente al mismo trimestre del año anterior.';

  const serie = (mercado: string) => resumen.series.find((fila) => fila.mercado === mercado);

  const valorEn = (
    mercado: string,
    campo: 'ingresos' | 'crecimiento',
    periodo: string,
  ): number | null => {
    const fila = serie(mercado);
    if (!fila) return null;
    return fila[campo].find((punto) => punto.periodo === periodo)?.valor ?? null;
  };

  /**
   * Importe del mismo trimestre del año anterior: se prefiere la columna publicada
   * del año previo y, si no está, el trimestre equivalente de la serie.
   */
  const importePrevio = (mercado: string, periodo: string): number | null => {
    const fila = serie(mercado);
    const publicado =
      fila?.ingresos_anio_anterior?.find((punto) => punto.periodo === periodo)?.valor ?? null;
    if (publicado !== null && publicado !== undefined) return publicado;
    const indice = periodos.indexOf(periodo);
    if (indice < 4) return null;
    return valorEn(mercado, 'ingresos', periodos[indice - 4]);
  };

  /* --------------------------------- 1. Reparto del incremento de ingresos */
  if (ultimo) {
    const ingresosMx = valorEn('mexico', 'ingresos', ultimo);
    const ingresosCa = valorEn('centroamerica', 'ingresos', ultimo);
    const previoMx = importePrevio('mexico', ultimo);
    const previoCa = importePrevio('centroamerica', ultimo);

    if (
      ingresosMx !== null &&
      ingresosCa !== null &&
      previoMx !== null &&
      previoCa !== null
    ) {
      const variacionMx = ingresosMx - previoMx;
      const variacionCa = ingresosCa - previoCa;
      const incremento = variacionMx + variacionCa;
      if (incremento > 0) {
        const parteMx = (100 * variacionMx) / incremento;
        const parteCa = (100 * variacionCa) / incremento;
        const reparto =
          parteMx >= parteCa
            ? { lider: 'México', seguidor: 'Centroamérica', parte: parteMx, resto: parteCa }
            : { lider: 'Centroamérica', seguidor: 'México', parte: parteCa, resto: parteMx };
        hallazgos.push({
          id: 'reparto',
          titulo: `${reparto.lider} concentra el aumento de ingresos`,
          texto:
            `Aporta el ${porcentaje(reparto.parte)} del incremento consolidado de ` +
            `${cifra(incremento)} millones de pesos; ${reparto.seguidor} contribuye con el ` +
            `${porcentaje(reparto.resto)} restante.`,
          enfasis: [porcentaje(reparto.parte)],
        });
      } else {
        omitidos.push('reparto: el incremento del trimestre no es positivo');
      }
    } else {
      omitidos.push('reparto: faltan importes por mercado en el último trimestre');
    }
  }

  /* -------------------------------------- 2. Tráfico y ticket por mercado */
  const panelMexico = motores.paneles.find((panel) => panel.mercado === 'mexico');
  const panelCentro = motores.paneles.find((panel) => panel.mercado === 'centroamerica');
  const puntoMexico = panelMexico?.puntos[panelMexico.puntos.length - 1] ?? null;
  const puntoCentro = panelCentro?.puntos[panelCentro.puntos.length - 1] ?? null;

  if (puntoMexico && puntoCentro && puntoMexico.periodo === puntoCentro.periodo) {
    const mismoTrimestre = !ultimo || puntoMexico.periodo === ultimo;
    if (mismoTrimestre) {
      const enfasis: string[] = [];
      if (Math.abs(puntoMexico.ticket) >= 0.05) enfasis.push(porcentaje(Math.abs(puntoMexico.ticket)));
      if (Math.abs(puntoCentro.trafico) >= 0.05) enfasis.push(porcentaje(Math.abs(puntoCentro.trafico)));
      const ambosSuben = puntoCentro.trafico > 0.05 && puntoCentro.ticket > 0.05;
      const centroamerica = ambosSuben
        ? `En Centroamérica crecen tanto el tráfico (${porcentaje(puntoCentro.trafico)}) ` +
          `como el ticket (${porcentaje(puntoCentro.ticket)}).`
        : `En Centroamérica ${movimiento(puntoCentro.trafico, 'el tráfico')} y ` +
          `${movimiento(puntoCentro.ticket, 'el ticket')}.`;
      hallazgos.push({
        id: 'mercados',
        titulo: 'Los mercados presentan patrones distintos',
        texto:
          `En México, ${movimiento(puntoMexico.trafico, 'el tráfico')} y ` +
          `${movimiento(puntoMexico.ticket, 'el ticket')}. ${centroamerica}`,
        enfasis,
      });
    } else {
      omitidos.push('mercados: tráfico y ticket no cubren el último trimestre publicado');
    }
  } else {
    omitidos.push('mercados: faltan tráfico o ticket del último trimestre con datos');
  }

  /* ---------------------------------------- 3. Ventas a unidades iguales */
  if (ultimo) {
    const iguales = (mercado: string): number | null =>
      desempeno.filas
        .find((fila) => fila.mercado === mercado)
        ?.celdas.find((celda) => celda.periodo === ultimo)?.valor ?? null;
    const igualesMx = iguales('mexico');
    const igualesCa = iguales('centroamerica');

    if (igualesMx !== null && igualesCa !== null) {
      const diferencia = igualesCa - igualesMx;
      if (diferencia > 0.05) {
        hallazgos.push({
          id: 'unidades-iguales',
          titulo: 'Centroamérica destaca en ventas a unidades iguales',
          texto:
            `Registra un crecimiento de ${porcentaje(igualesCa)}, frente al ` +
            `${porcentaje(igualesMx)} de México: una diferencia de ${puntos(diferencia)}.`,
          enfasis: [porcentaje(igualesCa), puntos(diferencia)],
        });
      } else {
        omitidos.push('unidades iguales: Centroamérica no supera a México en el trimestre');
      }
    } else {
      omitidos.push('unidades iguales: falta el dato comparable del último trimestre');
    }
  }

  return { subtitulo, hallazgos, omitidos };
}
