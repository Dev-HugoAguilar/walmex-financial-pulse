/**
 * Bloque I · «Pulso histórico».
 *
 * Matriz de indicadores (todos en porcentaje) por trimestre para el mercado elegido.
 * Color divergente centrado en cero con un dominio compartido; el cruce de fila y
 * columna se resalta al explorar, y elegir un indicador abre su historia en el panel
 * de detalle. Seleccionar una celda actualiza el trimestre compartido.
 *
 * No se mezclan importes y porcentajes en la misma escala y no hay normalizaciones
 * adicionales: la pregunta que responde el bloque es en qué periodos se concentran
 * fortaleza y debilidad con las tasas publicadas.
 */

import { useMemo, useState } from 'react';

import type { Matriz } from '../api/tipos';
import { COLOR_AUMENTO, COLOR_DISMINUCION, decimal, porcentaje, slugBase } from '../dominio';
import { Bloque } from './Bloque';
import type { DatoContexto } from './comun';
import { Tooltip } from './Tooltip';

export interface PropsPulso {
  matriz: Matriz;
  mercado: string;
  onCambiarMercado: (mercado: string) => void;
  periodos: string[];
  periodo: string;
  onSeleccionarPeriodo: (periodo: string) => void;
  onSeleccionar: (dato: DatoContexto) => void;
  indicadorActivo: string | null;
  onSeleccionarIndicador: (clave: string | null) => void;
  hoverPeriodo: string | null;
}

interface Activo {
  x: number;
  y: number;
  titulo: string;
  valor: string;
  detalle: string;
}

export function Pulso({
  matriz,
  mercado,
  onCambiarMercado,
  periodos,
  periodo,
  onSeleccionarPeriodo,
  onSeleccionar,
  indicadorActivo,
  onSeleccionarIndicador,
  hoverPeriodo,
}: PropsPulso) {
  const [filaActiva, setFilaActiva] = useState<string | null>(null);
  const [columnaActiva, setColumnaActiva] = useState<string | null>(null);
  const [activo, setActivo] = useState<Activo | null>(null);

  const indicadores = matriz.indicadores;
  const celdas = useMemo(
    () => matriz.celdas.filter((celda) => celda.mercado === mercado && periodos.includes(celda.periodo)),
    [matriz, mercado, periodos],
  );

  const buscar = (indicador: string, p: string) =>
    celdas.find((celda) => celda.indicador === indicador && celda.periodo === p) ?? null;

  const tope = useMemo(() => {
    const valores = celdas
      .filter((celda) => celda.valor !== null && celda.estado === 'publicado')
      .map((celda) => Math.abs(celda.valor as number));
    const maximo = Math.max(0.5, ...valores);
    return Math.ceil(maximo / 5) * 5 || maximo;
  }, [celdas]);

  const fondo = (valor: number | null): string => {
    if (valor === null) return 'transparent';
    if (valor === 0) return 'rgba(89, 98, 115, 0.16)';
    const intensidad = Math.min(1, Math.sqrt(Math.abs(valor) / tope));
    const alfa = 0.1 + 0.7 * intensidad;
    return valor > 0 ? `rgba(15, 123, 90, ${alfa})` : `rgba(180, 67, 63, ${alfa})`;
  };

  const historia = (clave: string) => {
    const serie = indicadores.find((fila) => fila.clave === clave);
    const valores = periodos
      .map((p) => ({ periodo: p, valor: buscar(clave, p)?.valor ?? null }))
      .filter((punto): punto is { periodo: string; valor: number } => punto.valor !== null);
    return { serie, valores };
  };

  const abrirIndicador = (clave: string) => {
    onSeleccionarIndicador(clave === indicadorActivo ? null : clave);
    const { serie, valores } = historia(clave);
    if (!serie || !valores.length) return;
    const ultimo = valores[valores.length - 1];
    const minimo = valores.reduce((a, b) => (b.valor < a.valor ? b : a));
    const maximo = valores.reduce((a, b) => (b.valor > a.valor ? b : a));
    const media = valores.reduce((suma, punto) => suma + punto.valor, 0) / valores.length;
    onSeleccionar({
      titulo: `${serie.etiqueta} · historia en el rango`,
      valor: `${decimal(ultimo.valor, 1)} % en ${ultimo.periodo}`,
      unidad: 'variación porcentual frente al mismo trimestre del año anterior',
      periodo: `${periodos[0]} – ${periodos[periodos.length - 1]}`,
      mercado,
      base: serie.base,
      origen: 'publicado',
      formula: null,
      fuente: `walmex-${ultimo.periodo.toLowerCase()}`,
      nota:
        `${valores.length} trimestres publicados en el rango. ` +
        `Mínimo ${decimal(minimo.valor, 1)} % (${minimo.periodo}) · máximo ${decimal(
          maximo.valor,
          1,
        )} % (${maximo.periodo}) · media simple ${decimal(media, 1)} %. ` +
        `Base ${slugBase(serie.base)}. La media es descriptiva: no es una meta ni una proyección.`,
    });
  };

  const abrirCelda = (clave: string, p: string) => {
    const celda = buscar(clave, p);
    const serie = indicadores.find((fila) => fila.clave === clave);
    if (!celda || !serie) return;
    onSeleccionarPeriodo(p);
    onSeleccionarIndicador(clave);
    onSeleccionar({
      titulo: `${serie.etiqueta} · ${matriz.mercados.find((fila) => fila.clave === mercado)?.etiqueta ?? mercado}`,
      valor: celda.valor === null ? 'No publicado' : porcentaje(celda.valor),
      unidad: 'variación porcentual frente al mismo trimestre del año anterior',
      periodo: p,
      mercado,
      base: celda.base,
      origen: celda.derivado ? 'derivado' : 'publicado',
      formula: null,
      fuente: celda.fuente ?? `walmex-${p.toLowerCase()}`,
      nota:
        celda.valor === null
          ? 'La empresa no publicó este indicador en este trimestre: se muestra como ausencia, no como cero.'
          : `${serie.definicion}. Base ${slugBase(celda.base)}.`,
    });
  };

  return (
    <Bloque
      testid="bloque-pulso"
      titulo="Pulso histórico"
      sub={`Indicadores en porcentaje × trimestre · escala centrada en cero · ${
        matriz.mercados.find((fila) => fila.clave === mercado)?.etiqueta ?? mercado
      }`}
      controles={
        <div className="wm-segmentado" role="group" aria-label="Mercado del pulso histórico">
          {matriz.mercados.map((fila) => (
            <button
              key={fila.clave}
              type="button"
              className={`wm-seg${mercado === fila.clave ? ' is-activa' : ''}`}
              aria-pressed={mercado === fila.clave}
              onClick={() => onCambiarMercado(fila.clave)}
            >
              {fila.etiqueta}
            </button>
          ))}
        </div>
      }
    >
      <div className="wm-pulso" data-testid="pulso-matriz">
        <div className="wm-pulso-caja">
          <table className="wm-pulso-tabla">
            <caption className="wm-sr">
              Variación porcentual por indicador y trimestre de{' '}
              {matriz.mercados.find((fila) => fila.clave === mercado)?.etiqueta ?? mercado}.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="wm-pulso-esquina">
                  Indicador
                </th>
                {periodos.map((p) => (
                  <th
                    key={p}
                    scope="col"
                    className={`${p === periodo ? 'is-activo' : ''}${
                      columnaActiva === p || hoverPeriodo === p ? ' is-resaltada' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="wm-pulso-cabeza"
                      onClick={() => onSeleccionarPeriodo(p)}
                      aria-label={`Seleccionar ${p} para todo el tablero`}
                    >
                      {p}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indicadores.map((indicador) => (
                <tr
                  key={indicador.clave}
                  className={`${indicadorActivo === indicador.clave ? 'is-activa' : ''}${
                    filaActiva === indicador.clave ? ' is-resaltada' : ''
                  }`}
                  onMouseEnter={() => setFilaActiva(indicador.clave)}
                  onMouseLeave={() => setFilaActiva(null)}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className="wm-pulso-nombre"
                      onClick={() => abrirIndicador(indicador.clave)}
                      aria-pressed={indicadorActivo === indicador.clave}
                    >
                      <span>{indicador.etiqueta}</span>
                      <span className="wm-pulso-base">{slugBase(indicador.base)}</span>
                    </button>
                  </th>
                  {periodos.map((p) => {
                    const celda = buscar(indicador.clave, p);
                    if (!celda) {
                      return (
                        <td key={p}>
                          <span className="wm-celda is-ausente" aria-hidden="true">
                            —
                          </span>
                        </td>
                      );
                    }
                    const esAusente = celda.valor === null;
                    const esCero = celda.valor === 0;
                    return (
                      <td key={p}>
                        <button
                          type="button"
                          className={`wm-celda${esAusente ? ' is-ausente' : ''}${
                            esCero ? ' is-cero' : ''
                          }${columnaActiva === p ? ' is-columna' : ''}`}
                          style={esAusente ? undefined : { background: fondo(celda.valor) }}
                          aria-label={`${indicador.etiqueta}, ${p}: ${
                            esAusente ? 'no publicado' : porcentaje(celda.valor)
                          }`}
                          onMouseEnter={(evento) => {
                            setColumnaActiva(p);
                            setActivo({
                              x: evento.clientX,
                              y: evento.clientY,
                              titulo: `${indicador.etiqueta} · ${p}`,
                              valor: esAusente ? 'No publicado' : porcentaje(celda.valor),
                              detalle: slugBase(celda.base),
                            });
                          }}
                          onMouseMove={(evento) =>
                            setActivo((previo) =>
                              previo ? { ...previo, x: evento.clientX, y: evento.clientY } : null,
                            )
                          }
                          onMouseLeave={() => {
                            setColumnaActiva(null);
                            setActivo(null);
                          }}
                          onFocus={() => {
                            setColumnaActiva(p);
                            setActivo(null);
                          }}
                          onBlur={() => {
                            setColumnaActiva(null);
                            setActivo(null);
                          }}
                          onClick={() => abrirCelda(indicador.clave, p)}
                        >
                          {esAusente ? '—' : decimal(celda.valor ?? 0, 1)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="wm-pulso-leyenda">
          <span className="wm-leyenda-escala-extremo">{decimal(-tope, 0)} %</span>
          <span
            className="wm-leyenda-escala-banda"
            style={{
              background:
                'linear-gradient(90deg, rgba(180,67,63,0.82), rgba(180,67,63,0.12) 44%, rgba(89,98,115,0.18) 50%, rgba(15,123,90,0.12) 56%, rgba(15,123,90,0.82))',
            }}
            aria-hidden="true"
          />
          <span className="wm-leyenda-escala-extremo">+{decimal(tope, 0)} %</span>
          <span className="wm-leyenda-item">
            <span className="wm-punto-color" style={{ background: 'rgba(89,98,115,0.30)' }} /> cero
          </span>
          <span className="wm-leyenda-item">
            <span className="wm-punto-color is-ausente" /> no publicado
          </span>
          <span className="wm-leyenda-item">
            <span className="wm-punto-color" style={{ background: COLOR_AUMENTO }} /> aumento ·{' '}
            <span className="wm-punto-color" style={{ background: COLOR_DISMINUCION }} /> caída
          </span>
        </div>
      </div>

      <Tooltip visible={activo !== null} x={activo?.x ?? 0} y={activo?.y ?? 0} testid="tooltip-pulso">
        {activo ? (
          <>
            <p className="wm-tooltip-titulo">{activo.titulo}</p>
            <p className="wm-tooltip-valor">{activo.valor}</p>
            <p className="wm-tooltip-fuente">{activo.detalle}</p>
          </>
        ) : null}
      </Tooltip>
    </Bloque>
  );
}
