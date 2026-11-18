/**
 * Bloque D · «Tráfico y ticket».
 *
 * Trayectoria temporal explorable: cada punto es un trimestre con ambas variaciones
 * publicadas, la línea une solo trimestres consecutivos y el rastro anterior queda
 * atenuado. Se puede arrastrar para recorrer trimestres, reproducir la secuencia de
 * observaciones reales (una transición entre datos publicados, nunca una simulación
 * de valores intermedios) y navegar con el teclado.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';

import type { PanelMotor } from '../api/tipos';
import { COLOR_MERCADO, decimal, porcentaje } from '../dominio';
import { Bloque } from './Bloque';
import { useAncho, useMovimientoReducido, type DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsMotores {
  paneles: PanelMotor[];
  periodos: string[];
  seleccionado: string | null;
  vista: string;
  onCambiarVista: (vista: string) => void;
  onSeleccionarPeriodo: (periodo: string) => void;
  onSeleccionar: (dato: DatoContexto) => void;
  cobertura: number;
}

type Vista = 'mexico' | 'centroamerica' | 'comparar';

const ALTO = 300;
const MARGEN = { arriba: 26, derecha: 24, abajo: 44, izquierda: 52 };
const ANCHO_ETIQUETA = 34;
const ALTO_ETIQUETA = 12;
const INTERVALO_REPRODUCCION = 900;

interface Etiqueta {
  periodo: string;
  x: number;
  y: number;
  ancla: 'start' | 'middle' | 'end';
}

interface Activo {
  x: number;
  y: number;
  periodo: string;
  mercado: string;
}

export function Motores({
  paneles,
  periodos,
  seleccionado,
  vista: vistaProp,
  onCambiarVista,
  onSeleccionarPeriodo,
  onSeleccionar,
  cobertura,
}: PropsMotores) {
  const [caja, ancho] = useAncho<HTMLDivElement>(300);
  const [activo, setActivo] = useState<Activo | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const reducir = useMovimientoReducido();
  const arrastrando = useRef(false);

  const vista: Vista =
    vistaProp === 'mexico' || vistaProp === 'centroamerica' ? (vistaProp as Vista) : 'comparar';
  const visibles = paneles.filter((panel) => (vista === 'comparar' ? true : panel.mercado === vista));

  /* Dominios compartidos y estables: todos los puntos, nunca solo los del panel. */
  const escalas = useMemo(() => {
    const construir = (valores: number[]) => {
      const finitos = valores.filter((valor) => Number.isFinite(valor));
      const bajo = Math.min(0, ...finitos);
      const alto = Math.max(0, ...finitos);
      const aire = Math.max(0.6, (alto - bajo) * 0.12);
      return scaleLinear().domain([bajo - aire, alto + aire]);
    };
    return {
      x: construir(paneles.flatMap((panel) => panel.puntos.map((punto) => punto.trafico))),
      y: construir(paneles.flatMap((panel) => panel.puntos.map((punto) => punto.ticket))),
    };
  }, [paneles]);

  const columnas = visibles.length > 1 && ancho >= 620 ? 2 : 1;
  const anchoPanel = Math.max(240, Math.floor((ancho - (columnas - 1) * 18) / columnas));
  const interior = Math.max(120, anchoPanel - MARGEN.izquierda - MARGEN.derecha);
  const base = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = escalas.x.copy().range([0, interior]);
  const y = escalas.y.copy().range([base, 0]);

  const indiceSeleccion = seleccionado ? periodos.indexOf(seleccionado) : -1;
  const esAnterior = (periodo: string) => {
    const indice = periodos.indexOf(periodo);
    return indiceSeleccion >= 0 && indice >= 0 && indice < indiceSeleccion;
  };

  /* Tramos continuos por panel: se cortan si falta un trimestre intermedio. */
  const tramos = (panel: PanelMotor) => {
    const ordenados = [...panel.puntos].sort(
      (a, b) => periodos.indexOf(a.periodo) - periodos.indexOf(b.periodo),
    );
    const salida: (typeof ordenados)[] = [];
    let actual: typeof ordenados = [];
    ordenados.forEach((punto, indice) => {
      if (indice === 0) {
        actual = [punto];
        return;
      }
      const previo = ordenados[indice - 1];
      const consecutivos = periodos.indexOf(punto.periodo) - periodos.indexOf(previo.periodo) === 1;
      if (consecutivos) actual.push(punto);
      else {
        salida.push(actual);
        actual = [punto];
      }
    });
    if (actual.length) salida.push(actual);
    return salida;
  };

  /** Primer, último y seleccionado, sin empalmes ni salidas del lienzo. */
  const etiquetas = (panel: PanelMotor): Etiqueta[] => {
    const puntos = panel.puntos;
    if (!puntos.length) return [];
    const candidatos: string[] = [];
    if (seleccionado && puntos.some((punto) => punto.periodo === seleccionado)) {
      candidatos.push(seleccionado);
    }
    for (const periodo of [puntos[puntos.length - 1].periodo, puntos[0].periodo]) {
      if (!candidatos.includes(periodo)) candidatos.push(periodo);
    }
    const ocupadas: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const salida: Etiqueta[] = [];
    const desplazamientos: { dx: number; dy: number; ancla: Etiqueta['ancla'] }[] = [
      { dx: 9, dy: -7, ancla: 'start' },
      { dx: -9, dy: -7, ancla: 'end' },
      { dx: 9, dy: 14, ancla: 'start' },
      { dx: -9, dy: 14, ancla: 'end' },
      { dx: 0, dy: -13, ancla: 'middle' },
      { dx: 0, dy: 20, ancla: 'middle' },
    ];
    for (const periodo of candidatos) {
      const punto = puntos.find((actual) => actual.periodo === periodo);
      if (!punto) continue;
      let colocado = false;
      for (const desplazamiento of desplazamientos) {
        const tx = x(punto.trafico) + desplazamiento.dx;
        const ty = y(punto.ticket) + desplazamiento.dy;
        const x0 =
          desplazamiento.ancla === 'start'
            ? tx
            : desplazamiento.ancla === 'end'
              ? tx - ANCHO_ETIQUETA
              : tx - ANCHO_ETIQUETA / 2;
        const y0 = ty - ALTO_ETIQUETA + 3;
        const cajaEtiqueta = { x0, x1: x0 + ANCHO_ETIQUETA, y0, y1: ty + 3 };
        const fuera =
          x0 < -2 ||
          cajaEtiqueta.x1 > interior + 2 ||
          y0 < -MARGEN.arriba + 2 ||
          cajaEtiqueta.y1 > base + MARGEN.abajo - 6;
        const choque = ocupadas.some(
          (otra) =>
            x0 < otra.x1 && cajaEtiqueta.x1 > otra.x0 && y0 < otra.y1 && cajaEtiqueta.y1 > otra.y0,
        );
        if (fuera || choque) continue;
        ocupadas.push(cajaEtiqueta);
        salida.push({ periodo, x: tx, y: ty, ancla: desplazamiento.ancla });
        colocado = true;
        break;
      }
      if (!colocado && periodo === seleccionado) {
        salida.push({ periodo, x: x(punto.trafico) + 9, y: y(punto.ticket) - 7, ancla: 'start' });
      }
    }
    return salida;
  };

  const abrir = (panel: PanelMotor, periodo: string) => {
    const punto = panel.puntos.find((actual) => actual.periodo === periodo);
    if (!punto) return;
    onSeleccionarPeriodo(periodo);
    onSeleccionar({
      titulo: `Tráfico y ticket · ${panel.etiqueta} · ${periodo}`,
      valor: `tráfico ${porcentaje(punto.trafico)} · ticket ${porcentaje(punto.ticket)}`,
      unidad: 'variación anual publicada',
      periodo,
      mercado: panel.mercado,
      base: 'publicado_comunicado',
      origen: 'publicado',
      formula: 'Variaciones anuales publicadas por la empresa para cada variable',
      fuente: `walmex-${periodo.toLowerCase()}`,
      nota:
        punto.mismas_tiendas === null
          ? 'La empresa no publicó unidades iguales para este trimestre. El producto de tráfico y ticket no se usa como reproducción exacta de las ventas comparables.'
          : `Unidades iguales publicadas: ${porcentaje(
              punto.mismas_tiendas,
            )}. El producto de tráfico y ticket no reproduce exactamente esa variación.`,
    });
  };

  /* Reproducción: recorre observaciones reales del panel de referencia. */
  const referencia = visibles[0] ?? paneles[0];
  const secuencia = useMemo(
    () =>
      [...(referencia?.puntos ?? [])]
        .sort((a, b) => periodos.indexOf(a.periodo) - periodos.indexOf(b.periodo))
        .map((punto) => punto.periodo),
    [referencia, periodos],
  );

  useEffect(() => {
    if (!reproduciendo) return;
    if (!secuencia.length) {
      setReproduciendo(false);
      return;
    }
    const temporizador = window.setTimeout(() => {
      const actual = seleccionado ? secuencia.indexOf(seleccionado) : -1;
      const siguiente = secuencia[(actual + 1) % secuencia.length];
      onSeleccionarPeriodo(siguiente);
    }, INTERVALO_REPRODUCCION);
    return () => window.clearTimeout(temporizador);
  }, [reproduciendo, seleccionado, secuencia, onSeleccionarPeriodo]);

  /* Se detiene al cambiar de mercado, de vista o al desmontar. */
  useEffect(() => {
    setReproduciendo(false);
  }, [vista]);
  useEffect(() => () => setReproduciendo(false), []);

  const seleccionarPorPosicion = useCallback(
    (clientX: number, svg: SVGSVGElement) => {
      const panel = visibles[0];
      if (!panel) return;
      const cajaSvg = svg.getBoundingClientRect();
      const escalaX = cajaSvg.width / anchoPanel;
      const posicion = (clientX - cajaSvg.left) / escalaX - MARGEN.izquierda;
      let cercano: string | null = null;
      let distancia = Infinity;
      for (const punto of panel.puntos) {
        const actual = Math.abs(x(punto.trafico) - posicion);
        if (actual < distancia) {
          distancia = actual;
          cercano = punto.periodo;
        }
      }
      if (cercano && distancia < interior / 3) {
        onSeleccionarPeriodo(cercano);
      }
    },
    [visibles, anchoPanel, x, interior, onSeleccionarPeriodo],
  );

  const moverTeclado = (evento: React.KeyboardEvent<SVGSVGElement>) => {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const actual = seleccionado ? secuencia.indexOf(seleccionado) : -1;
    const siguiente =
      evento.key === 'ArrowRight'
        ? Math.min(secuencia.length - 1, actual + 1)
        : Math.max(0, (actual < 0 ? secuencia.length : actual) - 1);
    onSeleccionarPeriodo(secuencia[siguiente]);
  };

  const corto = (valor: number) => `${decimal(valor, Number.isInteger(valor) ? 0 : 1)} %`;

  return (
    <Bloque
      testid="bloque-motores"
      protagonista
      titulo="Tráfico y ticket"
      sub={`${
        vista === 'comparar' ? 'Ambos mercados' : vista === 'mexico' ? 'México' : 'Centroamérica'
      } · ${cobertura} trimestres con ambas variables · variación anual`}
      controles={
        <div className="wm-controles-fila">
          <div className="wm-segmentado" role="group" aria-label="Mercado de la trayectoria">
            {(
              [
                ['mexico', 'México'],
                ['centroamerica', 'Centroamérica'],
                ['comparar', 'Comparar'],
              ] as [Vista, string][]
            ).map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                className={`wm-seg${vista === clave ? ' is-activa' : ''}`}
                aria-pressed={vista === clave}
                onClick={() => onCambiarVista(clave)}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`wm-btn-ico${reproduciendo ? ' is-activo' : ''}`}
            onClick={() => setReproduciendo((valor) => !valor)}
            aria-label={
              reproduciendo
                ? 'Pausar la reproducción de trimestres'
                : 'Reproducir los trimestres observados'
            }
            aria-pressed={reproduciendo}
            data-testid="motores-reproducir"
          >
            {reproduciendo ? '❚❚' : '▶'}
            <span>{reproduciendo ? 'Pausa' : 'Reproducir'}</span>
          </button>
          {reproduciendo ? (
            <span className="wm-reproduciendo" data-testid="motores-estado-reproduccion">
              {seleccionado ?? ''}
            </span>
          ) : null}
        </div>
      }
    >
      <div className="wm-grafica wm-grafica--motores" ref={caja} data-testid="motores-grafica">
        {ancho > 0
          ? visibles.map((panel) => {
              const color = COLOR_MERCADO[panel.mercado] ?? '#3458F5';
              const puntos = panel.puntos;
              const idClip = `clip-${panel.mercado}`;
              return (
                <figure key={panel.mercado} className="wm-figura" style={{ width: anchoPanel }}>
                  <figcaption>
                    {panel.etiqueta}
                    <span className="wm-figura-nota"> · {puntos.length} trimestres</span>
                  </figcaption>
                  <svg
                    width={anchoPanel}
                    height={ALTO}
                    role="img"
                    tabIndex={0}
                    className={reducir ? undefined : 'wm-svg-suave'}
                    style={{ touchAction: 'pan-y' }}
                    aria-label={`Trayectoria de tráfico y ticket de ${panel.etiqueta}: ${puntos
                      .map(
                        (punto) =>
                          `${punto.periodo} ${porcentaje(punto.trafico)} y ${porcentaje(punto.ticket)}`,
                      )
                      .join('; ')}`}
                    onKeyDown={moverTeclado}
                    onPointerDown={(evento) => {
                      arrastrando.current = true;
                      evento.currentTarget.setPointerCapture(evento.pointerId);
                      seleccionarPorPosicion(evento.clientX, evento.currentTarget);
                    }}
                    onPointerMove={(evento) => {
                      if (!arrastrando.current) return;
                      seleccionarPorPosicion(evento.clientX, evento.currentTarget);
                    }}
                    onPointerUp={() => {
                      arrastrando.current = false;
                    }}
                    onPointerCancel={() => {
                      arrastrando.current = false;
                    }}
                  >
                    <defs>
                      <marker
                        id={`flecha-${panel.mercado}`}
                        viewBox="0 0 8 8"
                        refX="6"
                        refY="4"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M0,0 L8,4 L0,8 z" fill={color} opacity="0.7" />
                      </marker>
                      <clipPath id={idClip}>
                        <rect x={0} y={0} width={interior} height={base} />
                      </clipPath>
                    </defs>
                    <g transform={`translate(${MARGEN.izquierda},${MARGEN.arriba})`}>
                      <text x={4} y={base - 10} className="wm-cuadrante">
                        tráfico ↓ · ticket ↓
                      </text>
                      <text x={interior - 4} y={base - 10} textAnchor="end" className="wm-cuadrante">
                        tráfico ↑ · ticket ↓
                      </text>
                      <text x={4} y={16} className="wm-cuadrante">
                        tráfico ↓ · ticket ↑
                      </text>
                      <text x={interior - 4} y={16} textAnchor="end" className="wm-cuadrante">
                        tráfico ↑ · ticket ↑
                      </text>

                      <line x1={0} x2={interior} y1={y(0)} y2={y(0)} className="wm-cero" />
                      <line x1={x(0)} x2={x(0)} y1={0} y2={base} className="wm-cero" />
                      {escalas.x.ticks(5).map((valor) => (
                        <text
                          key={`ex-${valor}`}
                          x={x(valor)}
                          y={base + 16}
                          textAnchor="middle"
                          className="wm-eje"
                        >
                          {corto(valor)}
                        </text>
                      ))}
                      {escalas.y.ticks(4).map((valor) => (
                        <text
                          key={`ey-${valor}`}
                          x={-10}
                          y={y(valor) + 3}
                          textAnchor="end"
                          className="wm-eje"
                        >
                          {corto(valor)}
                        </text>
                      ))}
                      <text x={interior} y={base + 34} textAnchor="end" className="wm-eje-sutil">
                        tráfico (% anual) →
                      </text>
                      <text x={-MARGEN.izquierda + 2} y={-10} className="wm-eje-sutil">
                        ↑ ticket (% anual)
                      </text>

                      <g clipPath={`url(#${idClip})`}>
                        {tramos(panel).map((tramo, indice) =>
                          tramo.length > 1 ? (
                            <path
                              key={`tramo-${indice}`}
                              d={tramo
                                .map(
                                  (punto, posicion) =>
                                    `${posicion === 0 ? 'M' : 'L'}${x(punto.trafico)},${y(punto.ticket)}`,
                                )
                                .join(' ')}
                              fill="none"
                              stroke={color}
                              strokeWidth={1.6}
                              opacity={
                                tramo.every((punto) => esAnterior(punto.periodo)) ? 0.45 : 0.75
                              }
                              markerEnd={`url(#flecha-${panel.mercado})`}
                            />
                          ) : null,
                        )}
                      </g>

                      {puntos.map((punto) => {
                        const elegido = punto.periodo === seleccionado;
                        const enfocado =
                          activo?.periodo === punto.periodo && activo.mercado === panel.mercado;
                        return (
                          <circle
                            key={punto.periodo}
                            cx={x(punto.trafico)}
                            cy={y(punto.ticket)}
                            r={elegido ? 6 : 4}
                            fill={elegido || enfocado ? '#111318' : color}
                            stroke="#FFFFFF"
                            strokeWidth={1.2}
                            opacity={elegido || enfocado || !esAnterior(punto.periodo) ? 1 : 0.72}
                            role="button"
                            tabIndex={0}
                            aria-label={`${punto.periodo}: tráfico ${porcentaje(
                              punto.trafico,
                            )}, ticket ${porcentaje(punto.ticket)}`}
                            onMouseEnter={(evento) =>
                              setActivo({
                                x: evento.clientX,
                                y: evento.clientY,
                                periodo: punto.periodo,
                                mercado: panel.mercado,
                              })
                            }
                            onMouseMove={(evento) =>
                              setActivo((previo) =>
                                previo ? { ...previo, x: evento.clientX, y: evento.clientY } : null,
                              )
                            }
                            onMouseLeave={() => setActivo(null)}
                            onFocus={() =>
                              setActivo({
                                x: Math.max(140, window.innerWidth / 2),
                                y: 140,
                                periodo: punto.periodo,
                                mercado: panel.mercado,
                              })
                            }
                            onBlur={() => setActivo(null)}
                            onClick={() => abrir(panel, punto.periodo)}
                            onKeyDown={(evento) => {
                              if (evento.key === 'Enter' || evento.key === ' ') {
                                evento.preventDefault();
                                abrir(panel, punto.periodo);
                              }
                            }}
                          />
                        );
                      })}

                      {etiquetas(panel).map((etiqueta) => (
                        <text
                          key={`etiqueta-${etiqueta.periodo}`}
                          x={etiqueta.x}
                          y={etiqueta.y}
                          textAnchor={etiqueta.ancla}
                          className={`wm-valor${etiqueta.periodo === seleccionado ? ' is-activo' : ''}`}
                        >
                          {etiqueta.periodo}
                        </text>
                      ))}
                    </g>
                  </svg>
                </figure>
              );
            })
          : null}
      </div>

      <Tooltip visible={activo !== null} x={activo?.x ?? 0} y={activo?.y ?? 0} testid="tooltip-motores">
        {activo
          ? (() => {
              const panel = paneles.find((fila) => fila.mercado === activo.mercado);
              const punto = panel?.puntos.find((fila) => fila.periodo === activo.periodo);
              if (!punto) return null;
              return (
                <>
                  <p className="wm-tooltip-titulo">
                    {panel?.etiqueta} · {punto.periodo}
                  </p>
                  <p className="wm-tooltip-linea">
                    Tráfico <strong>{porcentaje(punto.trafico)}</strong> · Ticket{' '}
                    <strong>{porcentaje(punto.ticket)}</strong>
                  </p>
                  <p className="wm-tooltip-linea">
                    Unidades iguales{' '}
                    <strong>
                      {punto.mismas_tiendas === null
                        ? 'no publicado'
                        : porcentaje(punto.mismas_tiendas)}
                    </strong>
                  </p>
                  <p className="wm-tooltip-fuente">comunicado {punto.periodo.toLowerCase()}</p>
                </>
              );
            })()
          : null}
      </Tooltip>
    </Bloque>
  );
}

