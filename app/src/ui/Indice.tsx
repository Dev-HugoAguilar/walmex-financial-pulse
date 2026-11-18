/**
 * Bloque H · «Trayectorias comparables».
 *
 * Índice base 100: importe del trimestre ÷ importe del trimestre base × 100, con base
 * común, comparable y mayor que cero. La base se elige directamente sobre la línea
 * temporal (o con el selector accesible), permanece visible y no cambia al mover el
 * rango. La línea de referencia marca 100 y las etiquetas directas cierran cada serie.
 */

import { useMemo, useState } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { line } from 'd3-shape';

import type { SerieMercado } from '../api/tipos';
import { basesValidas, construirIndice, importeDe } from '../analisis';
import { COLOR_MERCADO, decimal, millones, orden } from '../dominio';
import { Bloque } from './Bloque';
import { useAncho, useMovimientoReducido, type DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsIndice {
  series: SerieMercado[];
  periodos: string[];
  todos: string[];
  base: string;
  onCambiarBase: (periodo: string) => void;
  onSeleccionarPeriodo: (periodo: string) => void;
  onSeleccionar: (dato: DatoContexto) => void;
  seleccionado: string | null;
}

const ALTO = 256;
const MARGEN = { arriba: 20, derecha: 64, abajo: 54, izquierda: 44 };

interface Activo {
  x: number;
  y: number;
  periodo: string;
}

export function Indice({
  series,
  periodos,
  todos,
  base,
  onCambiarBase,
  onSeleccionarPeriodo,
  onSeleccionar,
  seleccionado,
}: PropsIndice) {
  const [caja, ancho] = useAncho<HTMLDivElement>(280);
  const [activo, setActivo] = useState<Activo | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const reducir = useMovimientoReducido();

  const bases = useMemo(() => basesValidas(series, todos), [series, todos]);
  const baseEfectiva = bases.includes(base) ? base : bases[0] ?? null;
  const puntos = useMemo(
    () => (baseEfectiva ? construirIndice(series, periodos, baseEfectiva) : []),
    [series, periodos, baseEfectiva],
  );

  const interior = Math.max(120, ancho - MARGEN.izquierda - MARGEN.derecha);
  const x = scalePoint<string>().domain(periodos).range([0, interior]).padding(0.14);

  const valores = puntos
    .flatMap((punto) => [punto.mexico, punto.centroamerica])
    .filter((valor): valor is number => valor !== null);
  const minimo = Math.min(100, ...valores);
  const maximo = Math.max(100, ...valores);
  const aire = Math.max(2, (maximo - minimo) * 0.14);
  const y = scaleLinear()
    .domain([minimo - aire, maximo + aire])
    .range([ALTO, 0]);

  const indiceSeleccion = periodos.indexOf(seleccionado ?? '');
  const rotular = (indice: number) => {
    if (indice === indiceSeleccion) return true;
    if (Math.abs(indice - indiceSeleccion) <= 1) return false;
    return indice % Math.max(1, Math.ceil(periodos.length / (ancho < 520 ? 4 : 8))) === 0;
  };

  const trazo = (clave: 'mexico' | 'centroamerica') =>
    line<{ periodo: string; valor: number }>()
      .x((punto) => x(punto.periodo) ?? 0)
      .y((punto) => y(punto.valor))(
      puntos
        .filter(
          (punto): punto is { periodo: string; mexico: number; centroamerica: number } =>
            punto[clave] !== null,
        )
        .map((punto) => ({ periodo: punto.periodo, valor: punto[clave] })),
    ) ?? '';

  const ultimoDe = (clave: 'mexico' | 'centroamerica') => {
    const lista = puntos.filter((punto) => punto[clave] !== null);
    return lista[lista.length - 1] ?? null;
  };
  const ultimoMexico = ultimoDe('mexico');
  const ultimoCentro = ultimoDe('centroamerica');
  const etiquetasJuntas =
    ultimoMexico?.mexico != null &&
    ultimoCentro?.centroamerica != null &&
    Math.abs(y(ultimoMexico.mexico) - y(ultimoCentro.centroamerica)) < 13;

  const abrir = (mercado: 'mexico' | 'centroamerica', periodo: string) => {
    const punto = puntos.find((actual) => actual.periodo === periodo);
    if (!punto || punto[mercado] === null || !baseEfectiva) return;
    const indice = punto[mercado] as number;
    const importe = importeDe(series, mercado, periodo);
    const importeBase = importeDe(series, mercado, baseEfectiva);
    onSeleccionarPeriodo(periodo);
    onSeleccionar({
      titulo: `Índice base 100 · ${mercado === 'mexico' ? 'México' : 'Centroamérica'} · ${periodo}`,
      valor: `${decimal(indice, 1)} (base 100 = ${baseEfectiva})`,
      unidad: 'índice (base 100)',
      periodo,
      mercado,
      base: 'nominal',
      origen: 'derivado',
      formula: `${millones(importe)} ÷ ${millones(importeBase)} × 100 = ${decimal(indice, 1)}`,
      fuente: `walmex-${periodo.toLowerCase()}`,
      nota: 'Compara niveles de importes nominales con una referencia común: no es crecimiento anual y dos trimestres distintos pueden tener estacionalidad diferente.',
    });
  };

  const baseFueraDeRango =
    baseEfectiva && periodos.length
      ? orden(baseEfectiva) < orden(periodos[0]) || orden(baseEfectiva) > orden(periodos[periodos.length - 1])
      : false;

  return (
    <Bloque
      testid="bloque-indice"
      titulo="Trayectorias comparables"
      sub={`Índice de importes con base 100 en ${baseEfectiva ?? '—'} · la base se elige sobre la línea temporal${
        baseFueraDeRango ? ' · la base queda fuera del rango visible y el índice la conserva' : ''
      }`}
      controles={
        <div className="wm-controles-fila">
          <span className="wm-chip" data-testid="indice-base-actual">
            Base 100 = {baseEfectiva ?? '—'}
          </span>
          <label className="wm-control">
            <span className="wm-control-label">Trimestre base</span>
            <select
              value={baseEfectiva ?? ''}
              onChange={(evento) => onCambiarBase(evento.target.value)}
              aria-label="Trimestre base del índice"
            >
              {bases.map((periodo) => (
                <option key={periodo} value={periodo}>
                  {periodo}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      <div className="wm-grafica" ref={caja} data-testid="indice-grafica">
        {ancho > 0 && baseEfectiva ? (
          <svg
            width={ancho}
            height={ALTO + MARGEN.arriba + MARGEN.abajo}
            role="img"
            aria-label={`Índice base 100 en ${baseEfectiva} de México y Centroamérica: ${puntos
              .map(
                (punto) =>
                  `${punto.periodo} México ${
                    punto.mexico === null ? 'sin dato' : decimal(punto.mexico, 0)
                  } y Centroamérica ${
                    punto.centroamerica === null ? 'sin dato' : decimal(punto.centroamerica, 0)
                  }`,
              )
              .join('; ')}`}
            onMouseMove={(evento) => {
              const cajaSvg = evento.currentTarget.getBoundingClientRect();
              const posicion = evento.clientX - cajaSvg.left - MARGEN.izquierda;
              let cercano: string | null = null;
              let distancia = Infinity;
              for (const periodo of periodos) {
                const actual = Math.abs((x(periodo) ?? 0) - posicion);
                if (actual < distancia) {
                  distancia = actual;
                  cercano = periodo;
                }
              }
              if (cercano) setActivo({ x: evento.clientX, y: evento.clientY, periodo: cercano });
            }}
            onMouseLeave={() => setActivo(null)}
          >
            <g transform={`translate(${MARGEN.izquierda},${MARGEN.arriba})`}>
              {y.ticks(4).map((tick) => (
                <g key={`eje-${tick}`}>
                  <line x1={0} x2={interior} y1={y(tick)} y2={y(tick)} className="wm-rejilla" />
                  <text x={-8} y={y(tick) + 3} textAnchor="end" className="wm-eje">
                    {decimal(tick, 0)}
                  </text>
                </g>
              ))}
              <line x1={0} x2={interior} y1={y(100)} y2={y(100)} className="wm-cero-fuerte" />
              <text x={interior} y={y(100) - 6} textAnchor="end" className="wm-eje-sutil">
                100 · base {baseEfectiva}
              </text>

              {x(baseEfectiva) !== undefined ? (
                <g>
                  <line
                    x1={x(baseEfectiva) ?? 0}
                    x2={x(baseEfectiva) ?? 0}
                    y1={0}
                    y2={ALTO}
                    className="wm-cursor-base"
                  />
                  <circle cx={x(baseEfectiva) ?? 0} cy={y(100)} r={4} fill="#111318" />
                </g>
              ) : null}

              <g key={baseEfectiva} className={reducir ? undefined : 'wm-transicion'}>
                {(['mexico', 'centroamerica'] as const).map((clave) => (
                  <path
                    key={`trazo-${clave}`}
                    d={trazo(clave)}
                    fill="none"
                    stroke={COLOR_MERCADO[clave]}
                    strokeWidth={foco === null || foco === clave ? 2.4 : 1.4}
                    opacity={foco === null || foco === clave ? 1 : 0.4}
                    onMouseEnter={() => setFoco(clave)}
                    onMouseLeave={() => setFoco(null)}
                  />
                ))}

                {(['mexico', 'centroamerica'] as const).map((clave) =>
                  puntos.map((punto) => {
                    const valor = punto[clave];
                    if (valor === null) return null;
                    const elegido = punto.periodo === seleccionado;
                    return (
                      <circle
                        key={`${clave}-${punto.periodo}`}
                        cx={x(punto.periodo) ?? 0}
                        cy={y(valor)}
                        r={elegido ? 5 : 2.6}
                        fill={elegido ? '#111318' : COLOR_MERCADO[clave]}
                        stroke="#fff"
                        strokeWidth={elegido ? 1.2 : 0.8}
                        opacity={foco === null || foco === clave ? 1 : 0.4}
                        role="button"
                        tabIndex={0}
                        aria-label={`${punto.periodo} ${
                          clave === 'mexico' ? 'México' : 'Centroamérica'
                        }: índice ${decimal(valor, 1)}`}
                        onFocus={() => setFoco(clave)}
                        onBlur={() => setFoco(null)}
                        onClick={() => abrir(clave, punto.periodo)}
                        onKeyDown={(evento) => {
                          if (evento.key === 'Enter' || evento.key === ' ') {
                            evento.preventDefault();
                            abrir(clave, punto.periodo);
                          }
                        }}
                      />
                    );
                  }),
                )}

                {ultimoMexico ? (
                  <text
                    x={(x(ultimoMexico.periodo) ?? 0) + 8}
                    y={y(ultimoMexico.mexico as number) + 3 + (etiquetasJuntas ? -7 : 0)}
                    className="wm-etiqueta-directa"
                    fill={COLOR_MERCADO.mexico}
                  >
                    MX {decimal(ultimoMexico.mexico as number, 0)}
                  </text>
                ) : null}
                {ultimoCentro ? (
                  <text
                    x={(x(ultimoCentro.periodo) ?? 0) + 8}
                    y={y(ultimoCentro.centroamerica as number) + 3 + (etiquetasJuntas ? 7 : 0)}
                    className="wm-etiqueta-directa"
                    fill={COLOR_MERCADO.centroamerica}
                  >
                    CA {decimal(ultimoCentro.centroamerica as number, 0)}
                  </text>
                ) : null}
              </g>

              {periodos.map((periodo, indice) =>
                rotular(indice) ? (
                  <text
                    key={`eje-x-${periodo}`}
                    x={x(periodo) ?? 0}
                    y={ALTO + 16}
                    textAnchor="middle"
                    className={`wm-eje${periodo === seleccionado ? ' is-activo' : ''}`}
                  >
                    {periodo}
                  </text>
                ) : null,
              )}

              {activo ? (
                <line
                  x1={x(activo.periodo) ?? 0}
                  x2={x(activo.periodo) ?? 0}
                  y1={-6}
                  y2={ALTO}
                  className="wm-cursor"
                />
              ) : null}

              {/* Tira de selección de base. */}
              <g transform={`translate(0,${ALTO + 28})`}>
                <rect x={-6} y={-9} width={interior + 12} height={18} rx={9} fill="#F2F4FA" />
                <text x={-10} y={4} textAnchor="end" className="wm-eje-sutil">
                  base
                </text>
                {periodos.map((periodo) => {
                  const disponible = bases.includes(periodo);
                  const esBase = periodo === baseEfectiva;
                  return (
                    <g
                      key={`base-${periodo}`}
                      className={disponible ? 'wm-tira-base' : undefined}
                      onClick={() => disponible && onCambiarBase(periodo)}
                      role={disponible ? 'button' : undefined}
                      tabIndex={disponible ? 0 : -1}
                      aria-label={disponible ? `Usar ${periodo} como trimestre base` : undefined}
                      aria-pressed={esBase}
                      onKeyDown={(evento) => {
                        if (!disponible) return;
                        if (evento.key === 'Enter' || evento.key === ' ') {
                          evento.preventDefault();
                          onCambiarBase(periodo);
                        }
                      }}
                    >
                      <rect x={(x(periodo) ?? 0) - 7} y={-7} width={14} height={14} fill="transparent" />
                      <circle
                        cx={x(periodo) ?? 0}
                        cy={0}
                        r={esBase ? 5.5 : 3.6}
                        fill={esBase ? '#111318' : disponible ? '#B9C1D0' : '#E4E8F0'}
                      />
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        ) : (
          <p className="wm-vacio">
            No hay un trimestre base con importes mayores que cero para ambos mercados.
          </p>
        )}
      </div>

      <Tooltip visible={activo !== null} x={activo?.x ?? 0} y={activo?.y ?? 0} testid="tooltip-indice">
        {activo
          ? (() => {
              const punto = puntos.find((fila) => fila.periodo === activo.periodo);
              if (!punto) return null;
              return (
                <>
                  <p className="wm-tooltip-titulo">
                    {punto.periodo} · base 100 = {baseEfectiva}
                  </p>
                  <p className="wm-tooltip-linea">
                    <span className="wm-punto-color" style={{ background: COLOR_MERCADO.mexico }} />{' '}
                    México{' '}
                    <strong>{punto.mexico === null ? 'sin dato' : decimal(punto.mexico, 1)}</strong>
                  </p>
                  <p className="wm-tooltip-linea">
                    <span
                      className="wm-punto-color"
                      style={{ background: COLOR_MERCADO.centroamerica }}
                    />{' '}
                    Centroamérica{' '}
                    <strong>
                      {punto.centroamerica === null ? 'sin dato' : decimal(punto.centroamerica, 1)}
                    </strong>
                  </p>
                  <p className="wm-tooltip-fuente">
                    índice = importe ÷ importe base × 100 · estacionalidad no corregida
                  </p>
                </>
              );
            })()
          : null}
      </Tooltip>
    </Bloque>
  );
}



