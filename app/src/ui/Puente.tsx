/**
 * Bloque A · «Origen del crecimiento».
 *
 * Composición horizontal: los dos totales como cifras destacadas (escala de nivel) y
 * una banda central con las aportaciones de cada mercado en una escala común de
 * millones de pesos (escala de cambio). El cero es el centro de esa banda, así que una
 * aportación negativa se dibuja hacia la izquierda y nunca se presenta como parte de
 * un total positivo.
 *
 * Conciliación: ΔConsolidado = ΔMéxico + ΔCentroamérica + residual. El residual, si
 * existe, se dibuja como segmento propio; no se reparte ni se atribuye a una causa.
 */

import { useState } from 'react';
import { scaleLinear } from 'd3-scale';

import type { Puente as DatosPuente } from '../analisis';
import { COLOR_AUMENTO, COLOR_DISMINUCION, COLOR_MERCADO, decimal, millones, porcentaje } from '../dominio';
import { Bloque } from './Bloque';
import { useAncho, type DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsPuente {
  datos: DatosPuente;
  observacion?: string | null;
  onSeleccionar: (dato: DatoContexto) => void;
  onResaltar: (mercado: string | null) => void;
  resaltado: string | null;
}

const ALTO_FILA = 44;
const MARGEN_ANCHO = { arriba: 8, derecha: 104, abajo: 30, izquierda: 104 };
const MARGEN_ESTRECHO = { arriba: 8, derecha: 78, abajo: 26, izquierda: 74 };

interface Activo {
  clave: string;
  x: number;
  y: number;
}

export function Puente({ datos, observacion, onSeleccionar, onResaltar, resaltado }: PropsPuente) {
  const [caja, ancho] = useAncho<HTMLDivElement>(300);
  const [activo, setActivo] = useState<Activo | null>(null);

  const filas = datos.calculable
    ? [
        ...datos.aportaciones.map((fila) => ({
          clave: fila.mercado,
          etiqueta: fila.etiqueta,
          valor: fila.diferencia as number,
          participacion: fila.participacion,
          participacionInterpretable: fila.participacionInterpretable,
          detalle: `Ingresos ${millones(fila.importePrevio)} → ${millones(fila.importeActual)} M MXN`,
        })),
        ...(datos.residualInterpretable
          ? [
              {
                clave: 'residual',
                etiqueta: 'Residual',
                valor: -(datos.residual as number),
                participacion: null,
                participacionInterpretable: false,
                detalle: 'Diferencia entre la suma de los mercados y el consolidado publicado',
              },
            ]
          : []),
      ]
    : [];

  const extremos = filas.map((fila) => fila.valor);
  const tope = Math.max(1, ...extremos, 0);
  const piso = Math.min(0, ...extremos);
  const aire = Math.max(0.6, (tope - piso) * 0.14);
  const estrecho = ancho < 520;
  const MARGEN = estrecho ? MARGEN_ESTRECHO : MARGEN_ANCHO;
  const interior = Math.max(120, ancho - MARGEN.izquierda - MARGEN.derecha);
  const x = scaleLinear()
    .domain([piso - aire, tope + aire])
    .range([0, interior]);
  const alto = Math.max(
    96,
    MARGEN.arriba + Math.max(1, filas.length) * ALTO_FILA + MARGEN.abajo,
  );
  const cero = x(0);
  const colorDe = (clave: string) =>
    clave === 'mexico'
      ? COLOR_MERCADO.mexico
      : clave === 'centroamerica'
        ? COLOR_MERCADO.centroamerica
        : '#8A93A5';

  const abrir = (clave: string) => {
    const fila = datos.aportaciones.find((fila) => fila.mercado === clave);
    if (clave === 'residual') {
      onSeleccionar({
        titulo: `Residual de conciliación · ${datos.periodo}`,
        valor: `${millones(Math.abs(datos.residual ?? 0))} M MXN`,
        unidad: 'millones de pesos',
        periodo: `${datos.anterior} → ${datos.periodo}`,
        mercado: null,
        base: 'nominal_publicado',
        origen: 'derivado',
        formula: 'ΔMéxico + ΔCentroamérica − ΔConsolidado publicado',
        fuente: `walmex-${datos.periodo.toLowerCase()}`,
        nota: 'Diferencia de redondeo de la fuente. Se muestra como segmento propio; no se reparte entre los mercados ni se atribuye a una causa.',
      });
      return;
    }
    if (!fila) return;
    onResaltar(fila.mercado);
    onSeleccionar({
      titulo: `Aportación de ${fila.etiqueta} · ${datos.anterior} → ${datos.periodo}`,
      valor: `${(fila.diferencia ?? 0) > 0 ? '+' : '−'}${millones(Math.abs(fila.diferencia ?? 0))} M MXN`,
      unidad: 'millones de pesos',
      periodo: `${datos.anterior} → ${datos.periodo}`,
      mercado: fila.mercado,
      base: 'nominal_publicado',
      origen: 'derivado',
      formula:
        `Ingresos de ${fila.etiqueta} en ${datos.periodo} (${millones(fila.importeActual)}) − ` +
        `en ${datos.anterior} (${millones(fila.importePrevio)}). ` +
        (fila.participacionInterpretable
          ? `Participación en el cambio = ${decimal(fila.diferencia ?? 0, 0)} ÷ ${decimal(
              datos.cambioTotal ?? 0,
              0,
            )} = ${porcentaje(fila.participacion)}`
          : 'La participación en el cambio no es interpretable porque la aportación y el cambio total tienen signo distinto.'),
      fuente: `walmex-${datos.periodo.toLowerCase()}`,
      nota: 'La aportación es aritmética de importes publicados; no es una causa económica demostrada.',
    });
  };

  return (
    <Bloque
      testid="bloque-puente"
      protagonista
      titulo="Origen del crecimiento"
      sub={`${datos.anterior ?? '—'} → ${datos.periodo} · aportación de cada mercado al cambio de ingresos · millones de pesos`}
      observacion={observacion}
    >
      <div className="wm-puente" ref={caja}>
        <div className="wm-puente-cifras">
          <div className="wm-cifra">
            <span className="wm-cifra-etiqueta">Ingresos {datos.anterior ?? '—'}</span>
            <strong className="wm-cifra-valor">{millones(datos.totalPrevio)}</strong>
            <span className="wm-cifra-unidad">millones de pesos</span>
          </div>
          <div className={`wm-cifra wm-cifra--cambio${(datos.cambioTotal ?? 0) < 0 ? ' is-baja' : ''}`}>
            <span className="wm-cifra-etiqueta">Cambio total</span>
            <strong className="wm-cifra-valor">
              {(datos.cambioTotal ?? 0) > 0 ? '+' : (datos.cambioTotal ?? 0) < 0 ? '−' : ''}
              {millones(Math.abs(datos.cambioTotal ?? 0))}
            </strong>
            <span className="wm-cifra-unidad">
              M MXN · {porcentaje(datos.crecimiento)}
            </span>
          </div>
          <div className="wm-cifra">
            <span className="wm-cifra-etiqueta">Ingresos {datos.periodo}</span>
            <strong className="wm-cifra-valor">{millones(datos.totalActual)}</strong>
            <span className="wm-cifra-unidad">millones de pesos</span>
          </div>
        </div>

        {ancho > 0 && filas.length ? (
          <svg
            width={ancho}
            height={alto}
            role="img"
            aria-label={`Aportaciones al cambio de ingresos de ${datos.anterior} a ${datos.periodo}: ${filas
              .map(
                (fila) =>
                  `${fila.etiqueta} ${fila.valor > 0 ? 'suma' : 'resta'} ${millones(
                    Math.abs(fila.valor),
                  )} millones`,
              )
              .join('; ')}. Cambio total ${millones(datos.cambioTotal)} millones.`}
          >
            <g transform={`translate(${MARGEN.izquierda},${MARGEN.arriba})`}>
              <line x1={cero} x2={cero} y1={-6} y2={filas.length * ALTO_FILA + 4} className="wm-cero-fuerte" />
              <text x={cero} y={filas.length * ALTO_FILA + 22} textAnchor="middle" className="wm-eje">
                0
              </text>
              {datos.cambioTotal !== null ? (
                <g>
                  <line
                    x1={x(datos.cambioTotal)}
                    x2={x(datos.cambioTotal)}
                    y1={-4}
                    y2={filas.length * ALTO_FILA + 4}
                    className="wm-cursor-base"
                  />
                  <text
                    x={Math.min(interior, Math.max(24, x(datos.cambioTotal)))}
                    y={filas.length * ALTO_FILA + 22}
                    textAnchor={x(datos.cambioTotal) > interior - 70 ? 'end' : 'middle'}
                    className="wm-eje-fuerte"
                  >
                    total {millones(datos.cambioTotal)}
                  </text>
                </g>
              ) : null}

              {filas.map((fila, indice) => {
                const cy = indice * ALTO_FILA + ALTO_FILA / 2;
                const inicio = Math.min(cero, x(fila.valor));
                const largo = Math.max(2, Math.abs(x(fila.valor) - cero));
                const esResaltado = resaltado === fila.clave;
                const opacidad = resaltado === null || esResaltado || fila.clave === 'residual' ? 1 : 0.32;
                const positivo = fila.valor >= 0;
                return (
                  <g
                    key={fila.clave}
                    onMouseEnter={(evento) =>
                      setActivo({ clave: fila.clave, x: evento.clientX, y: evento.clientY })
                    }
                    onMouseMove={(evento) =>
                      setActivo({ clave: fila.clave, x: evento.clientX, y: evento.clientY })
                    }
                    onMouseLeave={() => setActivo(null)}
                  >
                    <rect
                      x={-MARGEN.izquierda}
                      y={cy - ALTO_FILA / 2}
                      width={interior + MARGEN.izquierda + MARGEN.derecha}
                      height={ALTO_FILA}
                      fill={esResaltado ? 'rgba(52,88,245,0.05)' : 'transparent'}
                    />
                    <text x={-MARGEN.izquierda + 2} y={cy + 4} className="wm-puente-etiqueta">
                      {fila.etiqueta}
                    </text>
                    <rect
                      x={inicio}
                      y={cy - 11}
                      width={largo}
                      height={22}
                      rx={5}
                      fill={colorDe(fila.clave)}
                      opacity={opacidad}
                      role="button"
                      tabIndex={0}
                      aria-label={`${fila.etiqueta}: ${positivo ? 'suma' : 'resta'} ${millones(
                        Math.abs(fila.valor),
                      )} millones de pesos`}
                      onFocus={() => onResaltar(fila.clave === 'residual' ? null : fila.clave)}
                      onBlur={() => onResaltar(null)}
                      onClick={() => abrir(fila.clave)}
                      onKeyDown={(evento) => {
                        if (evento.key === 'Enter' || evento.key === ' ') {
                          evento.preventDefault();
                          abrir(fila.clave);
                        }
                      }}
                    />
                    <text
                      x={positivo ? inicio + largo + 10 : inicio - 10}
                      y={cy + 4}
                      textAnchor={positivo ? 'start' : 'end'}
                      className="wm-puente-valor"
                    >
                      {positivo ? '+' : '−'}
                      {millones(Math.abs(fila.valor))}
                      {fila.participacionInterpretable && !estrecho ? (
                        <tspan className="wm-puente-parte"> · {decimal(fila.participacion ?? 0, 1)} %</tspan>
                      ) : null}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <p className="wm-vacio">
            {datos.anterior
              ? 'No hay importes comparables del mismo trimestre del año anterior para este periodo.'
              : 'Este trimestre no tiene un comparable del año anterior en la versión publicada.'}
          </p>
        )}
      </div>

      <Tooltip
        visible={activo !== null}
        x={activo?.x ?? 0}
        y={activo?.y ?? 0}
        testid="tooltip-puente"
      >
        {activo ? (
          <>
            <p className="wm-tooltip-titulo">
              {filas.find((fila) => fila.clave === activo.clave)?.etiqueta} · {datos.periodo}
            </p>
            <p className="wm-tooltip-valor">
              {(filas.find((fila) => fila.clave === activo.clave)?.valor ?? 0) > 0 ? '+' : '−'}
              {millones(
                Math.abs(filas.find((fila) => fila.clave === activo.clave)?.valor ?? 0),
              )}{' '}
              M MXN
            </p>
            <p className="wm-tooltip-linea">
              {filas.find((fila) => fila.clave === activo.clave)?.detalle}
            </p>
            {filas.find((fila) => fila.clave === activo.clave)?.participacionInterpretable ? (
              <p className="wm-tooltip-linea">
                Participación en el cambio:{' '}
                {porcentaje(filas.find((fila) => fila.clave === activo.clave)?.participacion ?? null)}
              </p>
            ) : null}
            <p className="wm-tooltip-fuente">walmex · {datos.periodo.toLowerCase()}</p>
          </>
        ) : null}
      </Tooltip>
    </Bloque>
  );
}




