/**
 * Bloque B · «Mezcla del negocio».
 *
 * Áreas apiladas México + Centroamérica, un punto por trimestre observado e
 * interpolación lineal entre puntos: la superficie entre trimestres es una unión
 * recta, no un dato medido, y así se declara en la leyenda y en el globo.
 * El consolidado es el total publicado (va en el globo), nunca una tercera área.
 */

import { useMemo, useState } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { area, line } from 'd3-shape';

import type { FilaMezcla } from '../analisis';
import { COLOR_MERCADO, millones, porcentajeSinSigno } from '../dominio';
import { Bloque } from './Bloque';
import { useAncho, type DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsMezcla {
  filas: FilaMezcla[];
  periodo: string;
  modo: string;
  onCambiarModo: (modo: string) => void;
  onSeleccionarPeriodo: (periodo: string) => void;
  onSeleccionar: (dato: DatoContexto) => void;
  resaltado: string | null;
  hoverPeriodo: string | null;
  onHoverPeriodo: (periodo: string | null) => void;
}

const ALTO = 236;
const MARGEN = { arriba: 16, derecha: 74, abajo: 28, izquierda: 58 };

interface Activo {
  x: number;
  y: number;
}

export function Mezcla({
  filas,
  periodo,
  modo,
  onCambiarModo,
  onSeleccionarPeriodo,
  onSeleccionar,
  resaltado,
  hoverPeriodo,
  onHoverPeriodo,
}: PropsMezcla) {
  const [caja, ancho] = useAncho<HTMLDivElement>(280);
  const [activo, setActivo] = useState<Activo | null>(null);

  const participacion = modo === 'participacion';
  const validas = useMemo(
    () => filas.filter((fila) => fila.mexico !== null && fila.centroamerica !== null),
    [filas],
  );

  const interior = Math.max(120, ancho - MARGEN.izquierda - MARGEN.derecha);
  const x = scalePoint<string>()
    .domain(validas.map((fila) => fila.periodo))
    .range([0, interior])
    .padding(0.18);

  const acumulado = validas.map((fila) => ({
    periodo: fila.periodo,
    mexico: fila.mexico as number,
    centroamerica: fila.centroamerica as number,
    base: participacion
      ? fila.total ?? (fila.mexico as number) + (fila.centroamerica as number)
      : 1,
    baseReal: fila.total ?? (fila.mexico as number) + (fila.centroamerica as number),
    total: fila.total,
    suma: (fila.mexico as number) + (fila.centroamerica as number),
  }));

  const valores = acumulado.map((fila) =>
    participacion ? 100 : fila.mexico + fila.centroamerica,
  );
  const maximo = participacion ? 100 : Math.max(1, ...valores);
  const y = scaleLinear().domain([0, maximo * (participacion ? 1 : 1.04)]).range([ALTO, 0]);

  const posicion = (fila: (typeof acumulado)[number], valor: number) => {
    const proporcion = participacion ? (100 * valor) / fila.base : valor;
    return y(proporcion);
  };

  const puntos = acumulado.map((fila) => ({
    periodo: fila.periodo,
    x: x(fila.periodo) ?? 0,
    yMexico: posicion(fila, fila.mexico),
    yTotal: posicion(fila, fila.mexico + fila.centroamerica),
  }));

  const areaMexico = area<{ x: number; yMexico: number; yTotal: number }>()
    .x((punto) => punto.x)
    .y1((punto) => punto.yMexico)
    .y0(y(0))(puntos);

  const areaCentro = area<{ x: number; yMexico: number; yTotal: number }>()
    .x((punto) => punto.x)
    .y1((punto) => punto.yTotal)
    .y0((punto) => punto.yMexico)(puntos);

  const lineaMexico = line<{ x: number; yMexico: number }>()
    .x((punto) => punto.x)
    .y((punto) => punto.yMexico)(puntos);

  const lineaTotal = line<{ x: number; yTotal: number }>()
    .x((punto) => punto.x)
    .y((punto) => punto.yTotal)(puntos);

  const indiceSeleccion = puntos.findIndex((punto) => punto.periodo === periodo);
  const rotular = (indice: number) => {
    if (indice === indiceSeleccion) return true;
    if (Math.abs(indice - indiceSeleccion) <= 1) return false;
    return indice % Math.max(1, Math.ceil(puntos.length / (ancho < 460 ? 5 : 9))) === 0;
  };

  const indiceHover = hoverPeriodo ? acumulado.findIndex((fila) => fila.periodo === hoverPeriodo) : -1;
  const filaHover = indiceHover >= 0 ? acumulado[indiceHover] : null;
  const opacidadMexico = resaltado === null || resaltado === 'mexico' ? 0.92 : 0.28;
  const opacidadCentro = resaltado === null || resaltado === 'centroamerica' ? 0.92 : 0.28;

  const abrirFila = (fila: (typeof acumulado)[number], mercado: string) => {
    const valor = mercado === 'mexico' ? fila.mexico : fila.centroamerica;
    const base = fila.total ?? fila.suma;
    onSeleccionarPeriodo(fila.periodo);
    onSeleccionar({
      titulo:
        mercado === 'consolidado'
          ? `Ingresos consolidados · ${fila.periodo}`
          : `Ingresos · ${mercado === 'mexico' ? 'México' : 'Centroamérica'} · ${fila.periodo}`,
      valor: `${millones(valor)} M MXN`,
      unidad: 'millones de pesos nominales del trimestre',
      periodo: fila.periodo,
      mercado,
      base: 'nominal',
      origen: 'publicado',
      formula:
        mercado === 'consolidado'
          ? 'Cifra consolidada publicada por la empresa'
          : `Participación = ${millones(valor)} ÷ ${millones(base)} = ${porcentajeSinSigno(
              (100 * valor) / base,
            )}`,
      fuente: `walmex-${fila.periodo.toLowerCase()}`,
      nota:
        Math.abs(fila.suma - base) <= 1
          ? 'La suma de los dos mercados coincide con el consolidado publicado dentro del redondeo de la fuente.'
          : 'La suma de los dos mercados no coincide con el consolidado publicado; la diferencia se trata como residual y no se reparte.',
    });
  };

  const moverPuntero = (evento: React.PointerEvent<SVGSVGElement>) => {
    const cajaSvg = evento.currentTarget.getBoundingClientRect();
    const posicionX = evento.clientX - cajaSvg.left - MARGEN.izquierda;
    let cercano: (typeof puntos)[number] | null = null;
    let distancia = Infinity;
    for (const punto of puntos) {
      const actual = Math.abs(punto.x - posicionX);
      if (actual < distancia) {
        distancia = actual;
        cercano = punto;
      }
    }
    if (cercano && distancia < interior / Math.max(2, puntos.length - 1)) {
      onHoverPeriodo(cercano.periodo);
      setActivo({ x: evento.clientX, y: evento.clientY });
    } else {
      onHoverPeriodo(null);
      setActivo(null);
    }
  };

  return (
    <Bloque
      testid="bloque-mezcla"
      titulo="Mezcla del negocio"
      sub="México y Centroamérica por trimestre · el consolidado es el total publicado"
      controles={
        <div className="wm-segmentado" role="group" aria-label="Modo de la mezcla">
          <button
            type="button"
            className={`wm-seg${!participacion ? ' is-activa' : ''}`}
            aria-pressed={!participacion}
            onClick={() => onCambiarModo('importe')}
          >
            Importe
          </button>
          <button
            type="button"
            className={`wm-seg${participacion ? ' is-activa' : ''}`}
            aria-pressed={participacion}
            onClick={() => onCambiarModo('participacion')}
          >
            Participación
          </button>
        </div>
      }
    >
      <div className="wm-grafica" ref={caja} data-testid="mezcla-grafica">
        {ancho > 0 && puntos.length ? (
          <svg
            width={ancho}
            height={ALTO + MARGEN.arriba + MARGEN.abajo}
            role="img"
            aria-label={`Mezcla de ingresos por trimestre entre México y Centroamérica en ${
              participacion ? 'participación' : 'millones de pesos'
            }: ${acumulado
              .map(
                (fila) =>
                  `${fila.periodo} México ${millones(fila.mexico)}, Centroamérica ${millones(
                    fila.centroamerica,
                  )}`,
              )
              .join('; ')}.`}
            onPointerMove={moverPuntero}
            onPointerLeave={() => {
              onHoverPeriodo(null);
              setActivo(null);
            }}
            onClick={() => {
              if (filaHover) abrirFila(filaHover, 'consolidado');
            }}
          >
            <g transform={`translate(${MARGEN.izquierda},${MARGEN.arriba})`}>
              {y.ticks(4).map((valor) => (
                <g key={`eje-${valor}`}>
                  <line x1={0} x2={interior} y1={y(valor)} y2={y(valor)} className="wm-rejilla" />
                  <text x={-10} y={y(valor) + 3} textAnchor="end" className="wm-eje">
                    {participacion ? `${valor} %` : millones(valor)}
                  </text>
                </g>
              ))}

              {/* Guías de trimestres medidos: la superficie entre ellas es interpolación. */}
              {puntos.map((punto) => (
                <line
                  key={`guia-${punto.periodo}`}
                  x1={punto.x}
                  x2={punto.x}
                  y1={0}
                  y2={ALTO}
                  className="wm-guia"
                />
              ))}

              <g key={modo} className="wm-transicion">
                <path d={areaMexico ?? ''} fill={COLOR_MERCADO.mexico} opacity={opacidadMexico * 0.55} />
                <path d={areaCentro ?? ''} fill={COLOR_MERCADO.centroamerica} opacity={opacidadCentro * 0.55} />
                <path d={lineaMexico ?? ''} fill="none" stroke={COLOR_MERCADO.mexico} strokeWidth={2} />
                <path d={lineaTotal ?? ''} fill="none" stroke={COLOR_MERCADO.centroamerica} strokeWidth={2} />
              </g>

              {puntos.map((punto) => (
                <g key={`punto-${punto.periodo}`}>
                  <circle cx={punto.x} cy={punto.yMexico} r={2.6} fill={COLOR_MERCADO.mexico} />
                  <circle cx={punto.x} cy={punto.yTotal} r={2.6} fill={COLOR_MERCADO.centroamerica} />
                </g>
              ))}

              {hoverPeriodo ? (
                <line
                  x1={x(hoverPeriodo) ?? 0}
                  x2={x(hoverPeriodo) ?? 0}
                  y1={-6}
                  y2={ALTO}
                  className="wm-cursor"
                />
              ) : null}
              {periodo && x(periodo) !== undefined ? (
                <g>
                  <line
                    x1={x(periodo) ?? 0}
                    x2={x(periodo) ?? 0}
                    y1={-6}
                    y2={ALTO}
                    className="wm-cursor-fuerte"
                  />
                  <circle
                    cx={x(periodo) ?? 0}
                    cy={
                      puntos.find((punto) => punto.periodo === periodo)?.yTotal ??
                      ALTO
                    }
                    r={4.5}
                    fill="#111318"
                    stroke="#fff"
                    strokeWidth={1.4}
                  />
                </g>
              ) : null}

              {puntos.length && ancho >= 520 ? (
                <>
                  <text
                    x={Math.min(interior - 2, (x(puntos[puntos.length - 1].periodo) ?? 0) + 10)}
                    y={puntos[puntos.length - 1].yTotal + 4}
                    textAnchor={
                      (x(puntos[puntos.length - 1].periodo) ?? 0) + 10 > interior - 2 ? 'end' : 'start'
                    }
                    className="wm-etiqueta-directa"
                    fill={COLOR_MERCADO.centroamerica}
                  >
                    Centroamérica
                  </text>
                  <text
                    x={Math.min(interior - 2, (x(puntos[puntos.length - 1].periodo) ?? 0) + 10)}
                    y={(puntos[puntos.length - 1].yMexico + ALTO) / 2 + 4}
                    textAnchor={
                      (x(puntos[puntos.length - 1].periodo) ?? 0) + 10 > interior - 2 ? 'end' : 'start'
                    }
                    className="wm-etiqueta-directa"
                    fill={COLOR_MERCADO.mexico}
                  >
                    México
                  </text>
                </>
              ) : null}

              {puntos.map((punto, indice) =>
                rotular(indice) ? (
                  <text
                    key={`eje-x-${punto.periodo}`}
                    x={punto.x}
                    y={ALTO + 18}
                    textAnchor="middle"
                    className={`wm-eje${punto.periodo === periodo ? ' is-activo' : ''}`}
                  >
                    {punto.periodo}
                  </text>
                ) : null,
              )}
            </g>
          </svg>
        ) : (
          <p className="wm-vacio">Sin importes publicados para el rango seleccionado.</p>
        )}
      </div>

      <ul className="wm-leyenda wm-leyenda--compacta">
        <li>
          <span className="wm-punto-color" style={{ background: COLOR_MERCADO.mexico }} /> México
        </li>
        <li>
          <span className="wm-punto-color" style={{ background: COLOR_MERCADO.centroamerica }} />{' '}
          Centroamérica
        </li>
        <li className="wm-tenue">área entre trimestres: interpolación lineal</li>
        {participacion ? <li className="wm-tenue">base 100 %: consolidado publicado</li> : null}
      </ul>

      <Tooltip visible={activo !== null && filaHover !== null} x={activo?.x ?? 0} y={activo?.y ?? 0} testid="tooltip-mezcla">
        {filaHover ? (
          <>
            <p className="wm-tooltip-titulo">{filaHover.periodo}</p>
            <p className="wm-tooltip-linea">
              <span className="wm-punto-color" style={{ background: COLOR_MERCADO.mexico }} /> México{' '}
              <strong>{porcentajeSinSigno((100 * filaHover.mexico) / filaHover.baseReal)}</strong>
            </p>
            <p className="wm-tooltip-linea">
              <span className="wm-punto-color" style={{ background: COLOR_MERCADO.centroamerica }} />{' '}
              Centroamérica{' '}
              <strong>{porcentajeSinSigno((100 * filaHover.centroamerica) / filaHover.baseReal)}</strong>
            </p>
            <p className="wm-tooltip-linea">
              Total publicado <strong>{millones(filaHover.total ?? filaHover.suma)} M MXN</strong>
            </p>
            <p className="wm-tooltip-fuente">
              {participacion ? 'participación sobre el consolidado · ' : ''}
              superficie entre puntos: interpolación lineal
            </p>
          </>
        ) : null}
      </Tooltip>
    </Bloque>
  );
}




