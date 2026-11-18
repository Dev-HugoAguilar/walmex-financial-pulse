/**
 * Bloque F · «Dónde se abre la diferencia».
 *
 * Tres paneles de columnas divergentes, uno debajo del otro y a todo el ancho:
 * tráfico, ticket y ventas mismas tiendas. Cada columna es la diferencia del trimestre
 * en puntos porcentuales (tasa de México − tasa de Centroamérica), con el cero como
 * línea central:
 *
 *   · azul sobre cero   → tasa mayor en México
 *   · violeta bajo cero → tasa mayor en Centroamérica
 *   · marca neutral sobre la línea → diferencia exactamente cero
 *   · espacio vacío → falta alguna de las dos tasas (no se interpola ni se une)
 *
 * Los tres paneles comparten dominio temporal, márgenes, posiciones horizontales y una
 * única escala vertical simétrica calculada con todas las brechas válidas del rango
 * visible. El cursor resalta la misma columna en los tres y un globo único muestra las
 * dos tasas y la diferencia de cada indicador.
 */

import { useEffect, useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';

import type { PuntoBrecha } from '../analisis';
import { COLOR_MERCADO, decimal, porcentaje, puntosPorcentuales } from '../dominio';
import { Bloque } from './Bloque';
import { useAncho, useMovimientoReducido, type DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsBrecha {
  brechas: Record<string, PuntoBrecha[]>;
  periodos: string[];
  periodo: string;
  indicadorActivo: string | null;
  onSeleccionarPeriodo: (periodo: string) => void;
  onSeleccionar: (dato: DatoContexto) => void;
  onSeleccionarIndicador: (clave: string | null) => void;
}

const CLAVES = ['trafico', 'ticket', 'mismas_tiendas'] as const;
const PANELES: Record<string, { nombre: string; nota: string }> = {
  trafico: { nombre: 'Tráfico', nota: 'variación anual del tráfico' },
  ticket: { nombre: 'Ticket', nota: 'variación anual del ticket' },
  mismas_tiendas: {
    nombre: 'Ventas mismas tiendas',
    nota: 'variación de ventas a unidades iguales publicada por la empresa',
  },
};

const ALTO_BANDA = 64;
const MARGEN = { arriba: 14, derecha: 12, abajo: 20, izquierda: 44 };

interface Puntero {
  x: number;
  y: number;
}

export function BrechaMotores({
  brechas,
  periodos,
  periodo,
  indicadorActivo,
  onSeleccionarPeriodo,
  onSeleccionar,
  onSeleccionarIndicador,
}: PropsBrecha) {
  const [caja, ancho] = useAncho<HTMLDivElement>(280);
  const [explorado, setExplorado] = useState<string | null>(null);
  const [puntero, setPuntero] = useState<Puntero | null>(null);
  const [desdeRaton, setDesdeRaton] = useState(true);
  const reducir = useMovimientoReducido();

  const interior = Math.max(120, ancho - MARGEN.izquierda - MARGEN.derecha);
  const x = scaleBand<string>()
    .domain(periodos)
    .range([0, interior])
    .padding(periodos.length > 10 ? 0.42 : 0.34);

  /* Escala única y estable: todas las brechas válidas del rango visible. */
  const tope = useMemo(() => {
    const valores = Object.values(brechas)
      .flat()
      .filter((punto) => periodos.includes(punto.periodo))
      .map((punto) => punto.brecha)
      .filter((valor): valor is number => valor !== null)
      .map((valor) => Math.abs(valor));
    const maximo = Math.max(0.5, ...valores);
    return Math.ceil(maximo * 1.1 * 2) / 2;
  }, [brechas, periodos]);

  const y = scaleLinear().domain([-tope, tope]).range([ALTO_BANDA, 0]);

  /* Referencias anuales discretas al inicio de cada año. */
  const anios = useMemo(() => {
    const salida: { anio: string; inicio: string }[] = [];
    let actual = '';
    for (const p of periodos) {
      const anio = p.slice(2);
      if (anio !== actual) {
        actual = anio;
        salida.push({ anio: `20${anio}`, inicio: p });
      }
    }
    return salida;
  }, [periodos]);

  const resaltado = explorado ?? periodo;

  const puntoDe = (clave: string, p: string | null): PuntoBrecha | null => {
    if (!p) return null;
    return brechas[clave]?.find((punto) => punto.periodo === p) ?? null;
  };

  const cobertura = (clave: string) =>
    (brechas[clave] ?? []).filter(
      (punto) => periodos.includes(punto.periodo) && punto.brecha !== null,
    ).length;

  const fijar = (clave: string, punto: PuntoBrecha) => {
    onSeleccionarIndicador(clave);
    onSeleccionarPeriodo(punto.periodo);
    onSeleccionar({
      titulo: `${PANELES[clave].nombre} · brecha México − Centroamérica · ${punto.periodo}`,
      valor: puntosPorcentuales(punto.brecha),
      unidad: 'puntos porcentuales',
      periodo: punto.periodo,
      mercado: (punto.brecha ?? 0) >= 0 ? 'mexico' : 'centroamerica',
      base: 'publicado_comunicado',
      origen: 'publicado',
      formula: `Tasa de México (${porcentaje(punto.mexico)}) − tasa de Centroamérica (${porcentaje(
        punto.centroamerica,
      )}) = ${puntosPorcentuales(punto.brecha)}`,
      fuente: `walmex-${punto.periodo.toLowerCase()}`,
      nota: `${PANELES[clave].nota}. Una tasa mayor no implica un importe mayor, y las tres brechas no se suman entre sí.`,
    });
  };

  /** Trimestre bajo el puntero, calculado en el momento del evento. */
  const periodoEn = (evento: { clientX: number; currentTarget: SVGSVGElement }): string | null => {
    const cajaSvg = evento.currentTarget.getBoundingClientRect();
    const posicion = evento.clientX - cajaSvg.left - MARGEN.izquierda;
    let cercano: string | null = null;
    let distancia = Infinity;
    for (const p of periodos) {
      const centro = (x(p) ?? 0) + x.bandwidth() / 2;
      const actual = Math.abs(centro - posicion);
      if (actual < distancia) {
        distancia = actual;
        cercano = p;
      }
    }
    return cercano;
  };

  const moverPuntero = (evento: React.PointerEvent<SVGSVGElement>) => {
    const cercano = periodoEn(evento);
    if (cercano) {
      setDesdeRaton(true);
      setExplorado(cercano);
      setPuntero({ x: evento.clientX, y: evento.clientY });
    }
  };

  const teclado = (evento: React.KeyboardEvent<SVGSVGElement>) => {
    const actual = explorado ?? periodo;
    const indice = periodos.indexOf(actual);
    const mover = (destino: number) => {
      const siguiente = periodos[Math.max(0, Math.min(periodos.length - 1, destino))];
      if (!siguiente) return;
      setDesdeRaton(false);
      setExplorado(siguiente);
      const rect = evento.currentTarget.getBoundingClientRect();
      const centro = rect.left + MARGEN.izquierda + (x(siguiente) ?? 0) + x.bandwidth() / 2;
      setPuntero({ x: centro, y: rect.top + rect.height / 2 });
    };
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      mover(indice + 1);
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      mover(indice - 1);
    } else if (evento.key === 'Home') {
      evento.preventDefault();
      mover(0);
    } else if (evento.key === 'End') {
      evento.preventDefault();
      mover(periodos.length - 1);
    } else if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      if (explorado) onSeleccionarPeriodo(explorado);
    }
  };

  /**
   * Etiquetas del eje temporal: extremos, trimestre fijado y explorado, y una
   * frecuencia reducida según el ancho. Se descartan las que se encimarían.
   */
  const etiquetasEje = (clave: string) => {
    const cada = periodos.length > (ancho < 480 ? 6 : 10) ? (ancho < 480 ? 3 : 2) : 1;
    const anchoEtiqueta = 30;
    const candidatos: number[] = [];
    const anadir = (indice: number) => {
      if (indice >= 0 && indice < periodos.length && !candidatos.includes(indice)) {
        candidatos.push(indice);
      }
    };
    anadir(periodos.indexOf(periodo));
    if (explorado) anadir(periodos.indexOf(explorado));
    anadir(periodos.length - 1);
    anadir(0);
    periodos.forEach((_, indice) => {
      if (indice % cada === 0) anadir(indice);
    });

    const ocupadas: { x0: number; x1: number }[] = [];
    const salida: { p: string; centro: number; ancla: 'start' | 'middle' | 'end' }[] = [];
    for (const indice of candidatos) {
      const p = periodos[indice];
      const centro = (x(p) ?? 0) + x.bandwidth() / 2;
      const ancla: 'start' | 'middle' | 'end' =
        indice === 0 ? 'start' : indice === periodos.length - 1 ? 'end' : 'middle';
      const x0 = ancla === 'start' ? centro : ancla === 'end' ? centro - anchoEtiqueta : centro - anchoEtiqueta / 2;
      const x1 = x0 + anchoEtiqueta;
      if (ocupadas.some((otra) => x0 < otra.x1 - 1 && x1 > otra.x0 + 1)) continue;
      ocupadas.push({ x0, x1 });
      salida.push({ p, centro, ancla });
    }
    void clave;
    return salida;
  };
  /* Si el rango cambia, el cursor explorado deja de ser válido. */
  useEffect(() => {
    if (explorado && !periodos.includes(explorado)) setExplorado(null);
  }, [periodos, explorado]);

  return (
    <Bloque
      testid="bloque-brecha"
      titulo="Dónde se abre la diferencia"
      sub="México − Centroamérica · puntos porcentuales"
      controles={
        <ul className="wm-leyenda wm-leyenda--compacta" data-testid="brecha-leyenda">
          <li>
            <span className="wm-punto-color" style={{ background: COLOR_MERCADO.mexico }} /> azul:
            mayor tasa en México
          </li>
          <li>
            <span className="wm-punto-color" style={{ background: COLOR_MERCADO.centroamerica }} />{' '}
            violeta: mayor tasa en Centroamérica
          </li>
        </ul>
      }
    >
      <div className="wm-brecha" ref={caja} data-testid="brecha-grafica">
        {ancho > 0
          ? CLAVES.map((clave) => {
              const puntos = periodos.map(
                (p) =>
                  brechas[clave]?.find((punto) => punto.periodo === p) ?? {
                    periodo: p,
                    mexico: null,
                    centroamerica: null,
                    brecha: null,
                  },
              );
              const seleccionado = puntoDe(clave, periodo);
              const activa = indicadorActivo === clave;
              const disponibles = cobertura(clave);
              const signo =
                seleccionado?.brecha == null
                  ? 'vacio'
                  : seleccionado.brecha > 0
                    ? 'positivo'
                    : seleccionado.brecha < 0
                      ? 'negativo'
                      : 'cero';
              return (
                <section
                  key={clave}
                  className={`wm-brecha-panel${activa ? ' is-activa' : ''}`}
                  data-testid={`brecha-panel-${clave}`}
                >
                  <header className="wm-brecha-cabeza">
                    <h4 className="wm-brecha-nombre">{PANELES[clave].nombre}</h4>
                    <span
                      className={`wm-brecha-valor is-${signo}`}
                      data-testid={`brecha-valor-${clave}`}
                      title={
                        seleccionado?.brecha == null
                          ? `Sin comparación para ${periodo}: falta la tasa de uno de los dos mercados.`
                          : `${PANELES[clave].nombre} en ${periodo}: México ${porcentaje(
                              seleccionado.mexico,
                            )} − Centroamérica ${porcentaje(seleccionado.centroamerica)}`
                      }
                    >
                      {seleccionado?.brecha == null ? '—' : puntosPorcentuales(seleccionado.brecha)}
                    </span>
                    <span className="wm-brecha-cobertura">
                      {disponibles < periodos.length
                        ? `${disponibles} de ${periodos.length} trimestres`
                        : 'todos los trimestres del rango'}
                    </span>
                  </header>

                  <svg
                    width={ancho}
                    height={ALTO_BANDA + MARGEN.arriba + MARGEN.abajo}
                    role="group"
                    tabIndex={0}
                    aria-label={
                      `Brecha de ${PANELES[clave].nombre.toLowerCase()} por trimestre, en puntos porcentuales. ` +
                      `Seleccionado ${periodo}: ${
                        seleccionado?.brecha == null
                          ? 'sin comparación'
                          : puntosPorcentuales(seleccionado.brecha)
                      }. Usa las flechas para recorrer trimestres y Enter para fijarlo.`
                    }
                    className="wm-brecha-svg"
                    onPointerMove={moverPuntero}
                    onPointerLeave={() => {
                      setExplorado(null);
                      setPuntero(null);
                    }}
                    onFocus={() => setExplorado(periodo)}
                    onBlur={() => {
                      setExplorado(null);
                      setPuntero(null);
                    }}
                    onKeyDown={teclado}
                    onClick={(evento) => {
                      const elegido = periodoEn(evento) ?? explorado;
                      if (elegido) onSeleccionarPeriodo(elegido);
                    }}
                  >
                    <g transform={`translate(${MARGEN.izquierda},${MARGEN.arriba})`}>
                      {anios.map((marca) => (
                        <g key={`anio-${marca.anio}`}>
                          <line
                            x1={x(marca.inicio) ?? 0}
                            x2={x(marca.inicio) ?? 0}
                            y1={-6}
                            y2={ALTO_BANDA}
                            className="wm-brecha-guia-anio"
                          />
                          <text x={(x(marca.inicio) ?? 0) + 3} y={-4} className="wm-brecha-anio">
                            {marca.anio}
                          </text>
                        </g>
                      ))}

                      {resaltado && x(resaltado) !== undefined ? (
                        <rect
                          x={(x(resaltado) ?? 0) - 1}
                          y={-6}
                          width={x.bandwidth() + 2}
                          height={ALTO_BANDA + 6}
                          className={`wm-brecha-banda${explorado ? ' is-explorada' : ''}`}
                          rx={3}
                        />
                      ) : null}

                      <line x1={0} x2={interior} y1={y(0)} y2={y(0)} className="wm-brecha-cero" />
                      <text x={-8} y={y(0) + 3} textAnchor="end" className="wm-eje">
                        0
                      </text>
                      <text x={-8} y={y(tope) + 4} textAnchor="end" className="wm-eje">
                        +{decimal(tope, 1)}
                      </text>
                      <text x={-8} y={y(-tope) + 2} textAnchor="end" className="wm-eje">
                        −{decimal(tope, 1)}
                      </text>

                      <g
                        key={`${clave}-${periodos.join('|')}`}
                        className={reducir ? undefined : 'wm-transicion'}
                      >
                        {puntos.map((punto) => {
                          const centro = (x(punto.periodo) ?? 0) + x.bandwidth() / 2;
                          const anchura = Math.max(3, x.bandwidth() * 0.7);
                          if (punto.brecha === null) return null;
                          if (punto.brecha === 0) {
                            return (
                              <rect
                                key={`cero-${punto.periodo}`}
                                x={centro - 5}
                                y={y(0) - 1.5}
                                width={10}
                                height={3}
                                rx={1.5}
                                className="wm-brecha-cero-real"
                                aria-hidden="true"
                              />
                            );
                          }
                          const positivo = punto.brecha > 0;
                          const arriba = Math.min(y(0), y(punto.brecha));
                          const alto = Math.max(1.5, Math.abs(y(punto.brecha) - y(0)));
                          return (
                            <rect
                              key={`barra-${punto.periodo}`}
                              x={centro - anchura / 2}
                              y={arriba}
                              width={anchura}
                              height={alto}
                              rx={2}
                              fill={positivo ? COLOR_MERCADO.mexico : COLOR_MERCADO.centroamerica}
                              opacity={punto.periodo === resaltado ? 1 : 0.82}
                            />
                          );
                        })}
                      </g>

                      {etiquetasEje(clave).map(({ p, centro, ancla }) => {
                        const esFijado = p === periodo;
                        const esExplorado = p === explorado;
                        return (
                          <text
                            key={`x-${clave}-${p}`}
                            x={centro}
                            y={ALTO_BANDA + 15}
                            textAnchor={ancla}
                            className={`wm-eje${esFijado ? ' is-activo' : ''}${
                              esExplorado && !esFijado ? ' is-explorado' : ''
                            }`}
                          >
                            {p}
                          </text>
                        );
                      })}
                    </g>
                  </svg>
                </section>
              );
            })
          : null}
      </div>

      <Tooltip
        visible={puntero !== null && explorado !== null}
        x={puntero?.x ?? 0}
        y={puntero?.y ?? 0}
        testid="tooltip-brecha"
        ocultarAlDesplazar={desdeRaton}
      >
        {explorado ? (
          <>
            <p className="wm-tooltip-titulo">{explorado} · México − Centroamérica</p>
            {CLAVES.map((clave) => {
              const punto = puntoDe(clave, explorado);
              return (
                <p key={clave} className="wm-tooltip-linea">
                  <span className="wm-tooltip-nombre">{PANELES[clave].nombre}</span>
                  {punto?.brecha == null ? (
                    <span className="wm-tooltip-tenue">sin dato</span>
                  ) : (
                    <>
                      <span className="wm-tooltip-tenue">MX {porcentaje(punto.mexico)}</span>
                      <span className="wm-tooltip-tenue">CA {porcentaje(punto.centroamerica)}</span>
                      <strong>{puntosPorcentuales(punto.brecha)}</strong>
                    </>
                  )}
                </p>
              );
            })}
            <p className="wm-tooltip-fuente">
              diferencia en puntos porcentuales · una tasa mayor no implica un importe mayor
            </p>
          </>
        ) : null}
      </Tooltip>
    </Bloque>
  );
}








