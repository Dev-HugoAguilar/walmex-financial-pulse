/**
 * Bloque E · «Ventaja por indicador».
 *
 * Tres barras divergentes con la diferencia de cada motor en el trimestre
 * seleccionado: tasa de México − tasa de Centroamérica, en puntos porcentuales, con
 * cero central y una escala común. Arriba del cero la tasa mayor es la de México;
 * debajo, la de Centroamérica. Las tres diferencias no se suman ni forman una
 * descomposición del crecimiento.
 */

import { useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';

import type { BrechaIndicador } from '../analisis';
import { COLOR_MERCADO, decimal, porcentaje, puntosPorcentuales, slugBase } from '../dominio';
import { Bloque } from './Bloque';
import { useAncho, type DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsVentaja {
  filas: BrechaIndicador[];
  periodo: string;
  indicadorActivo: string | null;
  onSeleccionarIndicador: (clave: string | null) => void;
  onSeleccionar: (dato: DatoContexto) => void;
}

const ALTO = 216;
const MARGEN = { arriba: 18, derecha: 16, abajo: 40, izquierda: 64 };

interface Activo {
  x: number;
  y: number;
  clave: string;
}

export function Ventaja({
  filas,
  periodo,
  indicadorActivo,
  onSeleccionarIndicador,
  onSeleccionar,
}: PropsVentaja) {
  const [caja, ancho] = useAncho<HTMLDivElement>(260);
  const [activo, setActivo] = useState<Activo | null>(null);

  const interior = Math.max(120, ancho - MARGEN.izquierda - MARGEN.derecha);
  const x = scaleBand<string>()
    .domain(filas.map((fila) => fila.clave))
    .range([0, interior])
    .padding(interior > 620 ? 0.76 : 0.42);

  const valores = filas.map((fila) => fila.brecha ?? 0);
  const maximo = Math.max(0.8, ...valores.map((valor) => Math.abs(valor)));
  const aire = Math.max(0.25, maximo * 0.18);
  const y = scaleLinear()
    .domain([-maximo - aire, maximo + aire])
    .range([ALTO, 0]);

  const abrir = (fila: BrechaIndicador) => {
    onSeleccionarIndicador(fila.clave);
    if (fila.brecha === null) {
      onSeleccionar({
        titulo: `${fila.etiqueta} · ${periodo}`,
        valor: 'No comparable',
        unidad: 'puntos porcentuales',
        periodo,
        mercado: null,
        base: fila.base,
        origen: 'publicado',
        formula: null,
        fuente: `walmex-${periodo.toLowerCase()}`,
        nota: 'Falta el dato de uno de los dos mercados en este trimestre: la diferencia no se calcula ni se estima.',
      });
      return;
    }
    onSeleccionar({
      titulo: `${fila.etiqueta} · ventaja entre mercados · ${periodo}`,
      valor: puntosPorcentuales(fila.brecha),
      unidad: 'puntos porcentuales',
      periodo,
      mercado: fila.brecha >= 0 ? 'mexico' : 'centroamerica',
      base: fila.base,
      origen: 'publicado',
      formula: `Tasa de México (${porcentaje(fila.mexico)}) − tasa de Centroamérica (${porcentaje(
        fila.centroamerica,
      )}) = ${puntosPorcentuales(fila.brecha)}`,
      fuente: `walmex-${periodo.toLowerCase()}`,
      nota: `${fila.definicion}. ${
        fila.brecha >= 0 ? 'México' : 'Centroamérica'
      } tiene la tasa mayor; una tasa mayor no implica un importe mayor. Base ${slugBase(fila.base)}.`,
    });
  };

  return (
    <Bloque
      testid="bloque-ventaja"
      titulo="Ventaja por indicador"
      sub={`${periodo} · tasa de México − tasa de Centroamérica, en puntos porcentuales`}
    >
      <div className="wm-grafica" ref={caja} data-testid="ventaja-grafica">
        {ancho > 0 ? (
          <svg
            width={ancho}
            height={ALTO + MARGEN.arriba + MARGEN.abajo}
            role="img"
            aria-label={`Ventaja por indicador en ${periodo}: ${filas
              .map((fila) => `${fila.etiqueta} ${puntosPorcentuales(fila.brecha)}`)
              .join('; ')}.`}
          >
            <g transform={`translate(${MARGEN.izquierda},${MARGEN.arriba})`}>
              {ancho >= 460 ? (
                <>
                  <text x={interior} y={12} textAnchor="end" className="wm-eje-sutil">
                    mayor tasa en México ↑
                  </text>
                  <text x={interior} y={ALTO - 2} textAnchor="end" className="wm-eje-sutil">
                    mayor tasa en Centroamérica ↓
                  </text>
                </>
              ) : null}
              <line x1={0} x2={interior} y1={y(0)} y2={y(0)} className="wm-cero-fuerte" />
              {y.ticks(4).map((valor) => (
                <text
                  key={`eje-${valor}`}
                  x={-10}
                  y={y(valor) + 3}
                  textAnchor="end"
                  className="wm-eje"
                >
                  {decimal(valor, 1)}
                </text>
              ))}

              {filas.map((fila) => {
                const centro = (x(fila.clave) ?? 0) + x.bandwidth() / 2;
                const brecha = fila.brecha ?? 0;
                const positivo = brecha >= 0;
                const alto = Math.max(2, Math.abs(y(brecha) - y(0)));
                const esActivo = indicadorActivo === fila.clave;
                const esHover = activo?.clave === fila.clave;
                const color = fila.brecha === null
                  ? '#C3CAD8'
                  : positivo
                    ? COLOR_MERCADO.mexico
                    : COLOR_MERCADO.centroamerica;
                return (
                  <g
                    key={fila.clave}
                    onMouseEnter={(evento) =>
                      setActivo({ x: evento.clientX, y: evento.clientY, clave: fila.clave })
                    }
                    onMouseMove={(evento) =>
                      setActivo((previo) => (previo ? { ...previo, x: evento.clientX, y: evento.clientY } : null))
                    }
                    onMouseLeave={() => setActivo(null)}
                  >
                    <rect
                      x={x(fila.clave)}
                      y={-MARGEN.arriba + 4}
                      width={x.bandwidth()}
                      height={ALTO + 8}
                      fill={esActivo || esHover ? 'rgba(52,88,245,0.05)' : 'transparent'}
                      rx={6}
                    />
                    {fila.brecha === null ? (
                      <rect
                        x={centro - 11}
                        y={y(0) - 1}
                        width={22}
                        height={2}
                        rx={1}
                        fill="#C3CAD8"
                        strokeDasharray="2 2"
                      />
                    ) : (
                      <rect
                        x={centro - x.bandwidth() / 2}
                        y={positivo ? y(brecha) : y(0)}
                        width={x.bandwidth()}
                        height={alto}
                        rx={5}
                        fill={color}
                        opacity={esActivo || esHover || indicadorActivo === null ? 1 : 0.55}
                        role="button"
                        tabIndex={0}
                        aria-label={`${fila.etiqueta}: ${puntosPorcentuales(fila.brecha)}`}
                        onFocus={() => onSeleccionarIndicador(fila.clave)}
                        onClick={() => abrir(fila)}
                        onKeyDown={(evento) => {
                          if (evento.key === 'Enter' || evento.key === ' ') {
                            evento.preventDefault();
                            abrir(fila);
                          }
                        }}
                      />
                    )}
                    <text
                      x={centro}
                      y={fila.brecha === null ? y(0) + 16 : positivo ? y(brecha) - 7 : y(brecha) + 15}
                      textAnchor="middle"
                      className={`wm-valor${esActivo ? ' is-activo' : ''}`}
                    >
                      {fila.brecha === null ? 'sin par' : puntosPorcentuales(fila.brecha)}
                    </text>
                    <text x={centro} y={ALTO + 18} textAnchor="middle" className="wm-eje-fuerte">
                      {fila.etiqueta}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : null}
      </div>

      <Tooltip visible={activo !== null} x={activo?.x ?? 0} y={activo?.y ?? 0} testid="tooltip-ventaja">
        {activo
          ? (() => {
              const fila = filas.find((actual) => actual.clave === activo.clave);
              if (!fila) return null;
              return (
                <>
                  <p className="wm-tooltip-titulo">
                    {fila.etiqueta} · {periodo}
                  </p>
                  <p className="wm-tooltip-linea">
                    <span className="wm-punto-color" style={{ background: COLOR_MERCADO.mexico }} />{' '}
                    México <strong>{porcentaje(fila.mexico)}</strong>
                  </p>
                  <p className="wm-tooltip-linea">
                    <span className="wm-punto-color" style={{ background: COLOR_MERCADO.centroamerica }} />{' '}
                    Centroamérica <strong>{porcentaje(fila.centroamerica)}</strong>
                  </p>
                  <p className="wm-tooltip-valor">
                    {fila.brecha === null ? 'No comparable' : puntosPorcentuales(fila.brecha)}
                  </p>
                  <p className="wm-tooltip-fuente">{fila.definicion}</p>
                </>
              );
            })()
          : null}
      </Tooltip>
    </Bloque>
  );
}



