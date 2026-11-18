/**
 * Bloque G · «Aportación al crecimiento».
 *
 * Columnas divergentes: contribución de cada mercado al crecimiento del consolidado,
 * en puntos porcentuales y con un denominador común (ingreso consolidado de t−4):
 *
 *   contribución = (ingreso del mercado en t − ingreso del mismo mercado en t−4)
 *                  ÷ ingreso consolidado de t−4 × 100
 *
 * Las contribuciones positivas y negativas se apilan por separado y el crecimiento
 * consolidado calculado se marca con un trazo propio. No se usan las tasas de cada
 * mercado como si fueran contribuciones ni se fuerza la conciliación con una tasa
 * oficial de otra base.
 */

import { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';

import type { ColumnaContribucion } from '../analisis';
import { COLOR_MERCADO, decimal, porcentaje } from '../dominio';
import { Bloque } from './Bloque';
import { useAncho, type DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsContribuciones {
  columnas: ColumnaContribucion[];
  periodo: string;
  onSeleccionarPeriodo: (periodo: string) => void;
  onSeleccionar: (dato: DatoContexto) => void;
}

const ALTO = 252;
const MARGEN = { arriba: 22, derecha: 14, abajo: 34, izquierda: 46 };

interface Activo {
  x: number;
  y: number;
  columna: ColumnaContribucion;
}

export function Contribuciones({
  columnas,
  periodo,
  onSeleccionarPeriodo,
  onSeleccionar,
}: PropsContribuciones) {
  const [caja, ancho] = useAncho<HTMLDivElement>(280);
  const [activo, setActivo] = useState<Activo | null>(null);

  const interior = Math.max(120, ancho - MARGEN.izquierda - MARGEN.derecha);
  const x = scaleBand<string>()
    .domain(columnas.map((columna) => columna.periodo))
    .range([0, interior])
    .padding(0.34);

  const { maximo, minimo } = useMemo(() => {
    let arriba = 0.6;
    let abajo = -0.6;
    for (const columna of columnas) {
      const positivos =
        Math.max(0, columna.aporteMexico) +
        Math.max(0, columna.aporteCentroamerica) +
        Math.max(0, columna.residual);
      const negativos =
        Math.min(0, columna.aporteMexico) +
        Math.min(0, columna.aporteCentroamerica) +
        Math.min(0, columna.residual);
      arriba = Math.max(arriba, positivos, columna.crecimientoCalculado);
      abajo = Math.min(abajo, negativos, columna.crecimientoCalculado);
    }
    return { maximo: arriba * 1.12, minimo: abajo * 1.12 };
  }, [columnas]);

  const y = scaleLinear().domain([minimo, maximo]).range([ALTO, 0]);
  const cadaEtiqueta = Math.max(1, Math.ceil(columnas.length / (ancho < 480 ? 4 : 8)));
  const indiceSeleccion = columnas.findIndex((columna) => columna.periodo === periodo);
  const rotular = (indice: number) => {
    if (indice === indiceSeleccion) return true;
    if (Math.abs(indice - indiceSeleccion) <= 1) return false;
    return indice % cadaEtiqueta === 0;
  };

  const abrir = (columna: ColumnaContribucion) => {
    onSeleccionarPeriodo(columna.periodo);
    onSeleccionar({
      titulo: `Aportación al crecimiento · ${columna.periodo}`,
      valor: `${decimal(columna.aporteMexico, 2)} pp México · ${decimal(
        columna.aporteCentroamerica,
        2,
      )} pp Centroamérica`,
      unidad: 'puntos porcentuales del crecimiento consolidado',
      periodo: columna.periodo,
      mercado: null,
      base: 'nominal_publicado',
      origen: 'derivado',
      formula:
        `México: (ingreso ${columna.periodo} − ingreso ${columna.anterior}) ÷ ingreso consolidado ${columna.anterior} × 100; ` +
        `Centroamérica con el mismo denominador. Crecimiento calculado del consolidado: ${decimal(
          columna.crecimientoCalculado,
          2,
        )} pp; publicado: ${porcentaje(columna.crecimientoPublicado)}; residual: ${decimal(
          columna.residual,
          2,
        )} pp.`,
      fuente: `walmex-${columna.periodo.toLowerCase()}`,
      nota: 'Cada contribución usa el ingreso consolidado del mismo trimestre del año anterior como denominador; no son tasas de crecimiento de cada mercado.',
    });
  };

  return (
    <Bloque
      testid="bloque-contribuciones"
      protagonista
      titulo="Aportación al crecimiento"
      sub={`Contribución de cada mercado al crecimiento consolidado · ${columnas.length} trimestres calculables`}
      controles={
        <ul className="wm-leyenda wm-leyenda--compacta">
          <li>
            <span className="wm-punto-color" style={{ background: COLOR_MERCADO.mexico }} /> México
          </li>
          <li>
            <span className="wm-punto-color" style={{ background: COLOR_MERCADO.centroamerica }} />{' '}
            Centroamérica
          </li>
          <li>
            <span className="wm-punto-color" style={{ background: '#8A93A5' }} /> residual
          </li>
          <li>
            <span className="wm-punto-color" style={{ background: '#111318' }} /> crecimiento
            calculado
          </li>
        </ul>
      }
    >
      <div className="wm-grafica" ref={caja} data-testid="contribuciones-grafica">
        {ancho > 0 && columnas.length ? (
          <svg
            width={ancho}
            height={ALTO + MARGEN.arriba + MARGEN.abajo}
            role="img"
            aria-label={`Contribuciones al crecimiento consolidado en puntos porcentuales: ${columnas
              .map(
                (columna) =>
                  `${columna.periodo} México ${decimal(columna.aporteMexico, 2)} y Centroamérica ${decimal(
                    columna.aporteCentroamerica,
                    2,
                  )}, crecimiento calculado ${decimal(columna.crecimientoCalculado, 2)}`,
              )
              .join('; ')}.`}
          >
            <g transform={`translate(${MARGEN.izquierda},${MARGEN.arriba})`}>
              <line x1={0} x2={interior} y1={y(0)} y2={y(0)} className="wm-cero-fuerte" />
              {(() => {
                const marcas = new Set<number>([0]);
                for (const valor of y.ticks(5)) marcas.add(valor);
                if (minimo < 0) marcas.add(-Math.max(1, Math.round(Math.abs(minimo) / 2)));
                if (maximo > 0) marcas.add(Math.round(maximo / 2));
                return [...marcas].sort((a, b) => b - a);
              })().map((valor) => (
                <g key={`eje-${valor}`}>
                  <line x1={0} x2={interior} y1={y(valor)} y2={y(valor)} className="wm-rejilla" />
                  <text x={-10} y={y(valor) + 3} textAnchor="end" className="wm-eje">
                    {decimal(valor, 1)}
                  </text>
                </g>
              ))}
              <text x={-10} y={-6} textAnchor="end" className="wm-eje-sutil">
                pp
              </text>

              {columnas.map((columna, indice) => {
                const base = x(columna.periodo) ?? 0;
                const anchoBarra = x.bandwidth();
                const segmentos = [
                  { clave: 'mexico', valor: columna.aporteMexico, color: COLOR_MERCADO.mexico },
                  {
                    clave: 'centroamerica',
                    valor: columna.aporteCentroamerica,
                    color: COLOR_MERCADO.centroamerica,
                  },
                  { clave: 'residual', valor: columna.residual, color: '#8A93A5' },
                ];
                let acumuladoPositivo = 0;
                let acumuladoNegativo = 0;
                const esSeleccion = columna.periodo === periodo;
                return (
                  <g
                    key={columna.periodo}
                    onMouseEnter={(evento) =>
                      setActivo({ x: evento.clientX, y: evento.clientY, columna })
                    }
                    onMouseMove={(evento) =>
                      setActivo((previo) => (previo ? { ...previo, x: evento.clientX, y: evento.clientY } : null))
                    }
                    onMouseLeave={() => setActivo(null)}
                  >
                    {esSeleccion ? (
                      <line
                        x1={base - 4}
                        x2={base + anchoBarra + 4}
                        y1={ALTO + 4}
                        y2={ALTO + 4}
                        stroke="#3458F5"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    ) : null}
                    {segmentos.map((segmento) => {
                      if (Math.abs(segmento.valor) < 0.005) return null;
                      const positivo = segmento.valor > 0;
                      const desde = positivo ? acumuladoPositivo : acumuladoNegativo;
                      const hasta = desde + segmento.valor;
                      if (positivo) acumuladoPositivo = hasta;
                      else acumuladoNegativo = hasta;
                      const alto = Math.max(1, Math.abs(y(desde) - y(hasta)));
                      const arriba = Math.min(y(desde), y(hasta));
                      return (
                        <rect
                          key={segmento.clave}
                          x={base}
                          y={arriba}
                          width={anchoBarra}
                          height={alto}
                          fill={segmento.color}
                          opacity={0.92}
                          role="button"
                          tabIndex={0}
                          aria-label={`${columna.periodo} ${segmento.clave}: ${decimal(
                            segmento.valor,
                            2,
                          )} puntos porcentuales`}
                          onClick={() => abrir(columna)}
                          onKeyDown={(evento) => {
                            if (evento.key === 'Enter' || evento.key === ' ') {
                              evento.preventDefault();
                              abrir(columna);
                            }
                          }}
                        />
                      );
                    })}

                    {/* Crecimiento consolidado calculado. */}
                    <g>
                      <line
                        x1={base - 3}
                        x2={base + anchoBarra + 3}
                        y1={y(columna.crecimientoCalculado)}
                        y2={y(columna.crecimientoCalculado)}
                        stroke="#111318"
                        strokeWidth={2}
                    />
                    </g>

                    {rotular(indice) ? (
                      <text
                        x={base + anchoBarra / 2}
                        y={ALTO + 16}
                        textAnchor="middle"
                        className={`wm-eje${esSeleccion ? ' is-activo' : ''}`}
                      >
                        {columna.periodo}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <p className="wm-vacio">Sin trimestres comparables en el rango seleccionado.</p>
        )}
      </div>

      <Tooltip
        visible={activo !== null}
        x={activo?.x ?? 0}
        y={activo?.y ?? 0}
        testid="tooltip-contribuciones"
      >
        {activo ? (
          <>
            <p className="wm-tooltip-titulo">{activo.columna.periodo}</p>
            <p className="wm-tooltip-linea">
              <span className="wm-punto-color" style={{ background: COLOR_MERCADO.mexico }} /> México{' '}
              <strong>{decimal(activo.columna.aporteMexico, 2)} pp</strong>
            </p>
            <p className="wm-tooltip-linea">
              <span className="wm-punto-color" style={{ background: COLOR_MERCADO.centroamerica }} />{' '}
              Centroamérica <strong>{decimal(activo.columna.aporteCentroamerica, 2)} pp</strong>
            </p>
            <p className="wm-tooltip-linea">
              Crecimiento calculado{' '}
              <strong>{decimal(activo.columna.crecimientoCalculado, 2)} pp</strong>
            </p>
            <p className="wm-tooltip-linea">
              Publicado {porcentaje(activo.columna.crecimientoPublicado)} · residual{' '}
              {decimal(activo.columna.residual, 2)} pp
            </p>
          </>
        ) : null}
      </Tooltip>
    </Bloque>
  );
}



