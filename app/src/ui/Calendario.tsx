/**
 * Bloque C · «Calendario comercial».
 *
 * Matriz de círculos: filas = años, columnas = T1–T4. El **área** del círculo es
 * proporcional al ingreso (radio con raíz cuadrada, nunca radio proporcional) y el
 * color codifica la variación anual comparable, con una escala divergente centrada en
 * cero. Si hay ingreso pero no variación, el círculo conserva color neutral; si no hay
 * ingreso publicado, la celda queda vacía con una señal discreta y nunca con un
 * círculo de tamaño cero.
 */

import { useMemo, useState } from 'react';
import { scaleSqrt } from 'd3-scale';

import type { Calendario as DatosCalendario, CeldaCalendario } from '../analisis';
import { COLOR_AUMENTO, COLOR_DISMINUCION, MERCADOS, millones, porcentaje, trimestreDe } from '../dominio';
import { Bloque } from './Bloque';
import { useAncho, type DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsCalendario {
  datos: DatosCalendario;
  mercado: string;
  onCambiarMercado: (mercado: string) => void;
  periodo: string;
  onSeleccionarPeriodo: (periodo: string) => void;
  onSeleccionar: (dato: DatoContexto) => void;
  hoverPeriodo: string | null;
}

const MARGEN = { arriba: 22, derecha: 132, abajo: 34, izquierda: 46 };
const ALTO_FILA = 62;

interface Activo {
  x: number;
  y: number;
  celda: CeldaCalendario;
}

export function Calendario({
  datos,
  mercado,
  onCambiarMercado,
  periodo,
  onSeleccionarPeriodo,
  onSeleccionar,
  hoverPeriodo,
}: PropsCalendario) {
  const [caja, ancho] = useAncho<HTMLDivElement>(280);
  const [activo, setActivo] = useState<Activo | null>(null);

  const interior = Math.max(160, ancho - MARGEN.izquierda - MARGEN.derecha);
  const anchoColumna = interior / 4;
  const alto = MARGEN.arriba + datos.anios.length * ALTO_FILA + MARGEN.abajo;

  const crecimientoMaximo = useMemo(() => {
    const valores = datos.celdas
      .map((celda) => celda.crecimiento)
      .filter((valor): valor is number => valor !== null)
      .map((valor) => Math.abs(valor));
    return Math.max(1, ...valores);
  }, [datos]);

  const radio = scaleSqrt()
    .domain([0, datos.maximo || 1])
    .range([0, Math.min(anchoColumna, ALTO_FILA) * 0.44]);

  const colorDe = (celda: CeldaCalendario) => {
    if (celda.crecimiento === null) return '#E4E8F0';
    if (Math.abs(celda.crecimiento) < 0.05) return '#C9CFDB';
    const intensidad = Math.sqrt(Math.abs(celda.crecimiento) / crecimientoMaximo);
    const alfa = 0.22 + 0.68 * intensidad;
    return celda.crecimiento > 0 ? `rgba(15, 123, 90, ${alfa})` : `rgba(180, 67, 63, ${alfa})`;
  };

  const textoDe = (celda: CeldaCalendario) =>
    celda.crecimiento === null ? '#596273' : '#FFFFFF';

  const abrir = (celda: CeldaCalendario) => {
    if (celda.importe === null) {
      onSeleccionar({
        titulo: `${MERCADOS[mercado] ?? mercado} · ${celda.periodo}`,
        valor: 'No publicado',
        unidad: 'millones de pesos',
        periodo: celda.periodo,
        mercado,
        base: 'nominal',
        origen: 'publicado',
        formula: null,
        fuente: `walmex-${celda.periodo.toLowerCase()}`,
        nota: 'La empresa no publicó ingresos para este trimestre en la versión vigente; no se estima ni se interpola.',
      });
      return;
    }
    onSeleccionarPeriodo(celda.periodo);
    onSeleccionar({
      titulo: `Ingresos de ${MERCADOS[mercado] ?? mercado} · ${celda.periodo}`,
      valor: `${millones(celda.importe)} M MXN`,
      unidad: 'millones de pesos nominales del trimestre',
      periodo: celda.periodo,
      mercado,
      base: 'nominal',
      origen: 'publicado',
      formula:
        celda.crecimiento === null
          ? null
          : `Variación anual publicada: ${porcentaje(celda.crecimiento)} frente al mismo trimestre del año anterior`,
      fuente: `walmex-${celda.periodo.toLowerCase()}`,
      nota:
        celda.crecimiento === null
          ? 'Hay ingreso publicado, pero no variación anual comparable para este trimestre.'
          : null,
    });
  };

  const marcasTamano = useMemo(() => {
    if (!datos.maximo) return [];
    const marcas = [datos.maximo, datos.maximo / 2, datos.maximo / 4].map((valor) => ({
      valor,
      r: radio(valor),
    }));
    let desplazamiento = 0;
    return marcas.map((marca) => {
      const cx = desplazamiento + marca.r;
      desplazamiento += marca.r * 2 + 26;
      return { ...marca, cx };
    });
  }, [datos.maximo, radio]);
  const altoLeyenda = Math.max(12, ...marcasTamano.map((marca) => marca.r)) * 2 + 16;

  return (
    <Bloque
      testid="bloque-calendario"
      titulo="Calendario comercial"
      sub={`${MERCADOS[mercado] ?? mercado} · ingreso por trimestre y año · área proporcional al importe`}
      controles={
        <div className="wm-segmentado" role="group" aria-label="Mercado del calendario">
          {(['mexico', 'centroamerica', 'consolidado'] as const).map((clave) => (
            <button
              key={clave}
              type="button"
              className={`wm-seg${mercado === clave ? ' is-activa' : ''}`}
              aria-pressed={mercado === clave}
              onClick={() => onCambiarMercado(clave)}
            >
              {MERCADOS[clave]}
            </button>
          ))}
        </div>
      }
    >
      <div className="wm-grafica" ref={caja} data-testid="calendario-grafica">
        {ancho > 0 ? (
          <svg
            width={ancho}
            height={alto}
            role="img"
            aria-label={`Ingreso por trimestre y año de ${MERCADOS[mercado] ?? mercado}: ${datos.celdas
              .filter((celda) => celda.importe !== null)
              .map((celda) => `${celda.periodo} ${millones(celda.importe)} millones`)
              .join('; ')}.`}
          >
            <g transform={`translate(${MARGEN.izquierda},${MARGEN.arriba})`}>
              {[1, 2, 3, 4].map((trimestre, indice) => (
                <text
                  key={`col-${trimestre}`}
                  x={anchoColumna * (indice + 0.5)}
                  y={-8}
                  textAnchor="middle"
                  className={`wm-eje${trimestreDe(periodo) === trimestre ? ' is-activo' : ''}`}
                >
                  T{trimestre}
                </text>
              ))}

              {datos.anios.map((anio, fila) => (
                <g key={anio} transform={`translate(0,${fila * ALTO_FILA})`}>
                  <text x={-12} y={ALTO_FILA / 2 + 4} textAnchor="end" className="wm-calendario-anio">
                    {anio}
                  </text>
                  {[1, 2, 3, 4].map((trimestre, indice) => {
                    const cx = anchoColumna * (indice + 0.5);
                    const cy = ALTO_FILA / 2;
                    const celda = datos.celdas.find(
                      (filaCelda) => filaCelda.anio === anio && filaCelda.trimestre === trimestre,
                    );
                    if (!celda) return null;
                    const esHover = hoverPeriodo === celda.periodo;
                    const esSeleccion = periodo === celda.periodo;
                    if (celda.importe === null) {
                      return (
                        <g key={`${anio}-${trimestre}`}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={7}
                            fill="none"
                            stroke="#C3CAD8"
                            strokeWidth={1}
                            strokeDasharray="2 3"
                            opacity={0.85}
                          />
                          <title>{`${celda.periodo}: sin ingreso publicado`}</title>
                        </g>
                      );
                    }
                    const r = Math.max(3, radio(celda.importe));
                    return (
                      <g
                        key={`${anio}-${trimestre}`}
                        onMouseEnter={(evento) =>
                          setActivo({ x: evento.clientX, y: evento.clientY, celda })
                        }
                        onMouseMove={(evento) =>
                          setActivo((previo) =>
                            previo ? { ...previo, x: evento.clientX, y: evento.clientY } : null,
                          )
                        }
                        onMouseLeave={() => setActivo(null)}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={Math.max(r + 5, 12)}
                          fill="transparent"
                          role="button"
                          tabIndex={0}
                          aria-label={`${celda.periodo}: ${millones(celda.importe)} millones${
                            celda.crecimiento === null
                              ? ', sin variación comparable'
                              : `, variación ${porcentaje(celda.crecimiento)}`
                          }`}
                          onFocus={() => setActivo(null)}
                          onClick={() => abrir(celda)}
                          onKeyDown={(evento) => {
                            if (evento.key === 'Enter' || evento.key === ' ') {
                              evento.preventDefault();
                              abrir(celda);
                            }
                          }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={colorDe(celda)}
                          stroke={esSeleccion ? '#111318' : esHover ? '#3458F5' : 'transparent'}
                          strokeWidth={esSeleccion ? 2 : esHover ? 1.5 : 0}
                          pointerEvents="none"
                        />
                        {r >= 22 && ancho >= 520 ? (
                          <text
                            x={cx}
                            y={cy + 3}
                            textAnchor="middle"
                            className="wm-calendario-valor"
                            fill={textoDe(celda)}
                            pointerEvents="none"
                          >
                            {millones(celda.importe)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              ))}
            </g>
          </svg>
        ) : null}
      </div>

      <div className="wm-leyendas-calendario">
        <div className="wm-leyenda-tamano" data-testid="calendario-leyenda-tamano">
          <span className="wm-tenue">Área = ingresos</span>
          <svg
            width={Math.max(90, marcasTamano.reduce((anchoTotal, marca) => anchoTotal + marca.r * 2 + 40, 0))}
            height={altoLeyenda}
            role="img"
            aria-label={`Escala de área: ${marcasTamano
              .map((marca) => millones(marca.valor))
              .join(', ')} millones de pesos`}
          >
            {marcasTamano.map((marca) => (
              <g key={marca.valor}>
                <circle
                  cx={marca.cx}
                  cy={altoLeyenda / 2 - 6}
                  r={marca.r}
                  fill="none"
                  stroke="#B9C1D0"
                  strokeWidth={1}
                />
                <text
                  x={marca.cx}
                  y={altoLeyenda / 2 - 6 + marca.r + 11}
                  textAnchor="middle"
                  className="wm-eje"
                >
                  {millones(marca.valor)}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="wm-leyenda-color" data-testid="calendario-leyenda-color">
          <span className="wm-tenue">Color = variación anual</span>
          <span className="wm-leyenda-escala-extremo">{porcentaje(-crecimientoMaximo, 0)}</span>
          <span
            className="wm-leyenda-escala-banda"
            style={{
              background:
                'linear-gradient(90deg, rgba(180,67,63,0.85), rgba(180,67,63,0.18) 46%, rgba(201,207,219,0.9) 50%, rgba(15,123,90,0.18) 54%, rgba(15,123,90,0.85))',
            }}
            aria-hidden="true"
          />
          <span className="wm-leyenda-escala-extremo">{porcentaje(crecimientoMaximo, 0)}</span>
          <span className="wm-leyenda-item">
            <span className="wm-punto-color" style={{ background: '#E4E8F0' }} /> sin variación
          </span>
          <span className="wm-leyenda-item">
            <span className="wm-punto-color is-ausente" /> sin ingreso
          </span>
          <span className="wm-leyenda-item">
            <span className="wm-punto-color" style={{ background: COLOR_AUMENTO }} /> aumento ·{' '}
            <span className="wm-punto-color" style={{ background: COLOR_DISMINUCION }} /> caída
          </span>
        </div>
      </div>

      <Tooltip visible={activo !== null} x={activo?.x ?? 0} y={activo?.y ?? 0} testid="tooltip-calendario">
        {activo ? (
          <>
            <p className="wm-tooltip-titulo">{activo.celda.periodo}</p>
            <p className="wm-tooltip-valor">{millones(activo.celda.importe)} M MXN</p>
            <p className="wm-tooltip-linea">
              {activo.celda.crecimiento === null
                ? 'Sin variación anual comparable'
                : `Variación anual ${porcentaje(activo.celda.crecimiento)}`}
            </p>
            <p className="wm-tooltip-fuente">walmex · {activo.celda.periodo.toLowerCase()}</p>
          </>
        ) : null}
      </Tooltip>
    </Bloque>
  );
}



