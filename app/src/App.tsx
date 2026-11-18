/**
 * «Pulso comercial · Walmex» — aplicación del tablero.
 *
 * Tres vistas, nueve bloques analíticos visibles y un estado compartido (rango,
 * trimestre, mercado enfocado, indicador activo y base del índice) que vive en la URL.
 *
 *  · Resumen comercial      → origen del crecimiento · mezcla del negocio · calendario
 *  · Motores del crecimiento → tráfico y ticket · ventaja por indicador · brecha
 *  · Comparativa histórica   → aportación al crecimiento · trayectorias · pulso
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { crearCliente, resolverApiBase } from './api/cliente';
import type { Catalogo, Estado, Matriz, Motores as MotoresDatos, Resumen } from './api/tipos';
import {
  construirBrechas,
  construirCalendario,
  construirContribuciones,
  construirMezcla,
  construirPuente,
  construirVentaja,
  crecimientoDe,
  importeDe,
  observacionResumen,
} from './analisis';
import {
  FILTROS_VACIOS,
  MERCADOS,
  decimal,
  enRango,
  escribirEstado,
  etiquetaFecha,
  leerEstado,
  millones,
  periodoAnioAnterior,
  porcentaje,
  puntosPorcentuales,
  type EstadoUrl,
} from './dominio';
import { BrechaMotores } from './ui/BrechaMotores';
import { Calendario } from './ui/Calendario';
import { Contexto } from './ui/Contexto';
import { Contribuciones } from './ui/Contribuciones';
import type { DatoContexto } from './ui/comun';
import { useMovimientoReducido } from './ui/comun';
import { Indice } from './ui/Indice';
import { Mezcla } from './ui/Mezcla';
import { Motores } from './ui/Motores';
import { Puente } from './ui/Puente';
import { Pulso } from './ui/Pulso';
import { Ventaja } from './ui/Ventaja';

type Vista = 'resumen' | 'motores' | 'comparativa';

const VISTAS: { clave: Vista; etiqueta: string; resumen: string }[] = [
  { clave: 'resumen', etiqueta: 'Resumen comercial', resumen: 'Origen del crecimiento, mezcla y calendario' },
  {
    clave: 'motores',
    etiqueta: 'Motores del crecimiento',
    resumen: 'Tráfico, ticket y unidades iguales: nivel, ventaja y brecha',
  },
  {
    clave: 'comparativa',
    etiqueta: 'Comparativa histórica',
    resumen: 'Aportación al crecimiento, trayectorias y pulso histórico',
  },
];

export interface PropsApp {
  apiBase?: string;
}

export function WalmexApp({ apiBase }: PropsApp) {
  const cliente = useMemo(() => crearCliente(resolverApiBase(apiBase)), [apiBase]);
  const reducir = useMovimientoReducido();

  const [estado, setEstado] = useState<Estado | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [errorBase, setErrorBase] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [motores, setMotores] = useState<MotoresDatos | null>(null);
  const [matriz, setMatriz] = useState<Matriz | null>(null);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const inicial = useMemo<EstadoUrl>(() => leerEstado(new URL(window.location.href)), []);
  const [vista, setVista] = useState<Vista>(inicial.vista);
  const [desde, setDesde] = useState<string | null>(inicial.desde);
  const [hasta, setHasta] = useState<string | null>(inicial.hasta);
  const [trimestre, setTrimestre] = useState<string | null>(inicial.trimestre);
  const [baseIndice, setBaseIndice] = useState<string | null>(inicial.baseIndice);
  const [mercadoFoco, setMercadoFoco] = useState<string | null>(inicial.mercado);
  const [indicadorActivo, setIndicadorActivo] = useState<string | null>(inicial.indicador);
  const [motoresVista, setMotoresVista] = useState<string>(inicial.motores ?? 'comparar');
  const [mezclaModo, setMezclaModo] = useState<string>(inicial.composicion ?? 'importe');
  const [calendarioMercado, setCalendarioMercado] = useState<string>(inicial.estacional ?? 'mexico');
  const [pulsoMercado, setPulsoMercado] = useState<string>(inicial.calorMercado ?? 'mexico');
  const [hoverPeriodo, setHoverPeriodo] = useState<string | null>(null);
  const [contexto, setContexto] = useState<DatoContexto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const pedidoMotores = useRef(false);
  const pedidoMatriz = useRef(false);

  /* ---- estado y catálogo */
  useEffect(() => {
    const control = new AbortController();
    Promise.all([cliente.estado(control.signal), cliente.catalogo(control.signal)])
      .then(([datosEstado, datosCatalogo]) => {
        setEstado(datosEstado);
        setCatalogo(datosCatalogo);
      })
      .catch((error) => {
        if ((error as Error).name === 'AbortError') return;
        setErrorBase((error as Error).message);
      });
    return () => control.abort();
  }, [cliente]);

  useEffect(() => {
    if (!catalogo?.datos_disponibles || resumen) return;
    const control = new AbortController();
    setCargando(true);
    cliente
      .resumen(FILTROS_VACIOS, control.signal)
      .then(setResumen)
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setErrorVista((error as Error).message);
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false);
      });
    return () => control.abort();
  }, [cliente, catalogo, resumen]);

  useEffect(() => {
    if (!catalogo?.datos_disponibles || vista !== 'motores' || pedidoMotores.current) return;
    const control = new AbortController();
    pedidoMotores.current = true;
    cliente
      .motores(FILTROS_VACIOS, control.signal)
      .then(setMotores)
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setErrorVista((error as Error).message);
      });
    return () => control.abort();
  }, [cliente, catalogo, vista]);

  useEffect(() => {
    if (!catalogo?.datos_disponibles || pedidoMatriz.current) return;
    if (vista !== 'motores' && vista !== 'comparativa') return;
    const control = new AbortController();
    pedidoMatriz.current = true;
    cliente
      .matriz(FILTROS_VACIOS, control.signal)
      .then(setMatriz)
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setErrorVista((error as Error).message);
      });
    return () => control.abort();
  }, [cliente, catalogo, vista]);

  const todosPeriodos = resumen?.periodos ?? [];
  const visibles = useMemo(() => enRango(todosPeriodos, desde, hasta), [todosPeriodos, desde, hasta]);

  /* ---- coherencia entre rango, trimestre y base del índice */
  useEffect(() => {
    if (!visibles.length) return;
    if (!trimestre || !visibles.includes(trimestre)) {
      const nuevo = visibles[visibles.length - 1];
      if (trimestre && trimestre !== nuevo) {
        setAviso(`El trimestre ${trimestre} quedó fuera del rango visible; se muestra ${nuevo}.`);
      }
      setTrimestre(nuevo);
    }
  }, [visibles, trimestre]);

  useEffect(() => {
    if (visibles.length && !baseIndice) setBaseIndice(visibles[0]);
  }, [visibles, baseIndice]);

  /* ---- URL */
  useEffect(() => {
    escribirEstado({
      vista,
      desde,
      hasta,
      trimestre,
      baseIndice,
      indicador: indicadorActivo,
      base: null,
      mercado: mercadoFoco,
      motores: motoresVista,
      estacional: calendarioMercado,
      composicion: mezclaModo,
      calorMercado: pulsoMercado,
      calorModo: 'tasa',
    });
  }, [
    vista,
    desde,
    hasta,
    trimestre,
    baseIndice,
    indicadorActivo,
    mercadoFoco,
    motoresVista,
    calendarioMercado,
    mezclaModo,
    pulsoMercado,
  ]);

  const restablecer = useCallback(() => {
    setDesde(null);
    setHasta(null);
    setTrimestre(null);
    setBaseIndice(null);
    setMercadoFoco(null);
    setIndicadorActivo(null);
    setContexto(null);
    setAviso(null);
    setVista('resumen');
    setMotoresVista('comparar');
    setMezclaModo('importe');
    setCalendarioMercado('mexico');
    setPulsoMercado('mexico');
  }, []);

  const compartir = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2400);
    } catch {
      setAviso(`Copia el enlace de la barra de direcciones para compartir: ${url}`);
    }
  }, []);

  const mover = useCallback(
    (delta: number) => {
      if (!visibles.length) return;
      const actual = Math.max(0, visibles.indexOf(trimestre ?? visibles[visibles.length - 1]));
      const siguiente = Math.max(0, Math.min(visibles.length - 1, actual + delta));
      setTrimestre(visibles[siguiente]);
    },
    [visibles, trimestre],
  );

  const urlExportar = useMemo(
    () => cliente.urlExportar({ ...FILTROS_VACIOS, desde, hasta }),
    [cliente, desde, hasta],
  );

  /* ---- derivaciones por bloque */
  const puente = useMemo(
    () => (resumen && trimestre ? construirPuente(resumen.series, todosPeriodos, trimestre) : null),
    [resumen, todosPeriodos, trimestre],
  );
  const mezcla = useMemo(
    () => (resumen ? construirMezcla(resumen.series, visibles) : []),
    [resumen, visibles],
  );
  const calendario = useMemo(
    () => (resumen ? construirCalendario(resumen.series, calendarioMercado) : null),
    [resumen, calendarioMercado],
  );
  const contribuciones = useMemo(
    () => (resumen ? construirContribuciones(resumen.series, visibles) : []),
    [resumen, visibles],
  );
  const ventaja = useMemo(
    () => (matriz && trimestre ? construirVentaja(matriz, trimestre) : []),
    [matriz, trimestre],
  );
  const brechas = useMemo(() => construirBrechas(matriz, visibles), [matriz, visibles]);

  /* ---- indicadores de contexto (máximo tres) con su tendencia */
  const indicadores = useMemo(() => {
    if (!resumen || !trimestre) return [];
    const serie = (mercado: string, campo: 'ingresos' | 'crecimiento') =>
      resumen.series
        .find((fila) => fila.mercado === mercado)
        ?.[campo].filter((punto) => punto.valor !== null)
        .map((punto) => punto.valor as number) ?? [];
    const ingresos = serie('consolidado', 'ingresos').slice(-8);
    const crecimientos = serie('consolidado', 'crecimiento').slice(-8);
    const brechasSerie = visibles
      .map((periodo) => {
        const mexico = crecimientoDe(resumen.series, 'mexico', periodo);
        const centro = crecimientoDe(resumen.series, 'centroamerica', periodo);
        return mexico !== null && centro !== null ? mexico - centro : null;
      })
      .filter((valor): valor is number => valor !== null)
      .slice(-8);
    const brechaActual = brechasSerie[brechasSerie.length - 1] ?? null;
    return [
      {
        clave: 'ingresos',
        etiqueta: `Ingresos ${trimestre}`,
        valor: `${millones(importeDe(resumen.series, 'consolidado', trimestre))} M`,
        detalle: 'millones de pesos nominales',
        serie: ingresos,
        color: '#596273',
      },
      {
        clave: 'crecimiento',
        etiqueta: 'Crecimiento anual',
        valor: porcentaje(crecimientoDe(resumen.series, 'consolidado', trimestre)),
        detalle: 'consolidado, frente al año anterior',
        serie: crecimientos,
        color: '#3458F5',
      },
      {
        clave: 'brecha',
        etiqueta: 'Brecha entre mercados',
        valor: puntosPorcentuales(brechaActual),
        detalle: 'crecimiento de México − Centroamérica',
        serie: brechasSerie,
        color: '#8066E8',
      },
    ];
  }, [resumen, trimestre, visibles]);

  /* ---- una observación verificada por vista */
  const observaciones = useMemo(() => {
    const resumenTexto = puente ? observacionResumen(puente) : null;

    let motoresTexto: string | null = null;
    if (trimestre && ventaja.length && ventaja.every((fila) => fila.brecha !== null)) {
      const mayores = ventaja.filter((fila) => (fila.brecha ?? 0) < 0);
      const menor = ventaja.filter((fila) => (fila.brecha ?? 0) >= 0);
      const nombre = (clave: string) =>
        clave === 'trafico' ? 'tráfico' : clave === 'ticket' ? 'ticket' : 'unidades iguales';
      const partes: string[] = [];
      if (mayores.length) {
        partes.push(
          `Centroamérica tiene la tasa mayor en ${mayores
            .map((fila) => `${nombre(fila.clave)} (${puntosPorcentuales(fila.brecha)})`)
            .join(' y ')}`,
        );
      }
      if (menor.length) {
        partes.push(
          `México en ${menor
            .map((fila) => `${nombre(fila.clave)} (${puntosPorcentuales(fila.brecha)})`)
            .join(' y ')}`,
        );
      }
      motoresTexto = partes.length ? `En ${trimestre}, ${partes.join('; ')}.` : null;
    }

    const columna = contribuciones.find((fila) => fila.periodo === trimestre) ?? null;
    const comparativaTexto = columna
      ? `En ${columna.periodo} México aportó ${decimal(columna.aporteMexico, 2)} pp y Centroamérica ` +
        `${decimal(columna.aporteCentroamerica, 2)} pp al crecimiento consolidado; el calculado con ` +
        `importes es ${decimal(columna.crecimientoCalculado, 2)} pp y la tasa publicada ${porcentaje(
          columna.crecimientoPublicado,
        )}.`
      : null;

    return { resumen: resumenTexto, motores: motoresTexto, comparativa: comparativaTexto };
  }, [puente, trimestre, ventaja, contribuciones]);

  const anterior = useMemo(
    () => (trimestre ? periodoAnioAnterior(todosPeriodos, trimestre) : null),
    [todosPeriodos, trimestre],
  );
  const panelesVisibles = useMemo(() => {
    if (!motores) return [];
    return motores.paneles.map((panel) => ({
      ...panel,
      puntos: panel.puntos.filter((punto) => visibles.includes(punto.periodo)),
    }));
  }, [motores, visibles]);

  const sinVersion = catalogo?.datos_disponibles === false || Boolean(errorBase);
  const vistaActual = VISTAS.find((opcion) => opcion.clave === vista);
  const observacion =
    vista === 'resumen'
      ? observaciones.resumen
      : vista === 'motores'
        ? observaciones.motores
        : observaciones.comparativa;

  const indiceVista = VISTAS.findIndex((opcion) => opcion.clave === vista);

  return (
    <div
      className="wm-app"
      data-testid="app"
      data-disponible={catalogo?.datos_disponibles ? 'true' : 'false'}
      data-vista={vista}
    >
      <header className="wm-head">
        <div className="wm-head-texto">
          <p className="wm-eyebrow">Pulso comercial · Walmex</p>
          <h1>{vistaActual?.etiqueta}</h1>
          <p className="wm-head-sub" data-testid="periodo-actual">
            {estado?.periodo?.ultimo ? (
              <>
                {vistaActual?.resumen} · último trimestre:{' '}
                <strong>{estado.periodo.etiqueta}</strong>
                {estado.fuente?.ultima_publicacion
                  ? ` (comunicado del ${etiquetaFecha(estado.fuente.ultima_publicacion)})`
                  : ''}
                {` · ${estado.periodo.trimestres} trimestres publicados`}
              </>
            ) : (
              'Cargando la versión publicada…'
            )}
          </p>
        </div>
        <nav className="wm-tabs" aria-label="Vistas del tablero">
          <span
            className={`wm-tabs-indicador${reducir ? ' sin-movimiento' : ''}`}
            style={{
              width: `${100 / VISTAS.length}%`,
              transform: `translateX(${indiceVista * 100}%)`,
            }}
            aria-hidden="true"
          />
          {VISTAS.map((opcion) => (
            <button
              key={opcion.clave}
              type="button"
              className={`wm-tab${vista === opcion.clave ? ' is-activa' : ''}`}
              aria-current={vista === opcion.clave ? 'page' : undefined}
              title={opcion.resumen}
              onClick={() => setVista(opcion.clave)}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </nav>
      </header>

      <div className="wm-barra" data-testid="barra-controles">
        <div className="wm-grupo">
          <label className="wm-control">
            <span className="wm-control-label">Desde</span>
            <select value={desde ?? ''} onChange={(evento) => setDesde(evento.target.value || null)}>
              <option value="">Primer trimestre</option>
              {todosPeriodos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="wm-control">
            <span className="wm-control-label">Hasta</span>
            <select value={hasta ?? ''} onChange={(evento) => setHasta(evento.target.value || null)}>
              <option value="">Último trimestre</option>
              {todosPeriodos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <div className="wm-paso">
            <button
              type="button"
              className="wm-paso-btn"
              onClick={() => mover(-1)}
              aria-label="Trimestre anterior"
            >
              ‹
            </button>
            <select
              value={trimestre ?? ''}
              onChange={(evento) => setTrimestre(evento.target.value || null)}
              aria-label="Trimestre seleccionado"
            >
              {visibles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="wm-paso-btn"
              onClick={() => mover(1)}
              aria-label="Trimestre siguiente"
            >
              ›
            </button>
          </div>
        </div>

        <div className="wm-grupo wm-grupo--derecha">
          <button type="button" className="wm-btn" onClick={compartir} aria-live="polite">
            {copiado ? 'Enlace copiado' : 'Compartir'}
          </button>
          <a className="wm-btn" href={urlExportar} download data-testid="exportar">
            Exportar CSV
          </a>
          <button type="button" className="wm-btn wm-btn--ghost" onClick={restablecer}>
            Restablecer
          </button>
        </div>
      </div>

      {aviso ? (
        <p className="wm-aviso-linea" role="status" data-testid="aviso-ajuste">
          {aviso}{' '}
          <button type="button" className="wm-enlace" onClick={() => setAviso(null)}>
            entendido
          </button>
        </p>
      ) : null}

      {errorVista ? (
        <div className="wm-aviso" role="status">
          <p className="wm-aviso-titulo">No se pudo cargar la vista</p>
          <p>{errorVista}</p>
        </div>
      ) : null}

      {sinVersion ? (
        <div className="wm-aviso" role="status">
          <p className="wm-aviso-titulo">Sin versión publicada</p>
          <p>
            {errorBase ??
              'La API no encuentra una versión publicada en MongoDB Atlas. El tablero no muestra cifras de ejemplo.'}
          </p>
        </div>
      ) : null}

      {!sinVersion ? (
        <>
          {observacion ? (
            <p className="wm-observacion-vista" data-testid="observacion-vista">
              <span className="wm-observacion-chip">{trimestre}</span>
              {observacion}
            </p>
          ) : null}

          <div key={vista} className={`wm-vista${reducir ? '' : ' wm-vista--entra'}`}>
            {vista === 'resumen' ? (
              <>
                <div className="wm-indicadores" data-testid="kpis">
                  {indicadores.map((indicador) => (
                    <article key={indicador.clave} className="wm-indicador">
                      <div>
                        <p className="wm-indicador-etiqueta">{indicador.etiqueta}</p>
                        <p className="wm-indicador-valor">{indicador.valor}</p>
                        <p className="wm-indicador-detalle">{indicador.detalle}</p>
                      </div>
                      <Sparkline valores={indicador.serie} color={indicador.color} />
                    </article>
                  ))}
                </div>

                {puente && resumen?.datos_disponibles ? (
                  <div className="wm-fila wm-fila--ancha">
                    <Puente
                      datos={puente}
                      onSeleccionar={setContexto}
                      onResaltar={setMercadoFoco}
                      resaltado={mercadoFoco}
                    />
                  </div>
                ) : null}

                <div className="wm-fila wm-fila--dos">
                  {resumen?.datos_disponibles ? (
                    <Mezcla
                      filas={mezcla}
                      periodo={trimestre ?? ''}
                      modo={mezclaModo}
                      onCambiarModo={setMezclaModo}
                      onSeleccionarPeriodo={setTrimestre}
                      onSeleccionar={setContexto}
                      resaltado={mercadoFoco}
                      hoverPeriodo={hoverPeriodo}
                      onHoverPeriodo={setHoverPeriodo}
                    />
                  ) : null}
                  {calendario ? (
                    <Calendario
                      datos={calendario}
                      mercado={calendarioMercado}
                      onCambiarMercado={setCalendarioMercado}
                      periodo={trimestre ?? ''}
                      onSeleccionarPeriodo={setTrimestre}
                      onSeleccionar={setContexto}
                      hoverPeriodo={hoverPeriodo}
                    />
                  ) : null}
                </div>
              </>
            ) : null}

            {vista === 'motores' ? (
              <>
                {panelesVisibles.length ? (
                  <div className="wm-fila wm-fila--ancha">
                    <Motores
                      paneles={panelesVisibles}
                      periodos={todosPeriodos}
                      seleccionado={trimestre}
                      vista={motoresVista}
                      onCambiarVista={setMotoresVista}
                      onSeleccionarPeriodo={setTrimestre}
                      onSeleccionar={setContexto}
                      cobertura={
                        panelesVisibles.reduce((mayor, panel) => Math.max(mayor, panel.puntos.length), 0)
                      }
                    />
                  </div>
                ) : (
                  <p className="wm-vacio">{cargando ? 'Calculando…' : 'Sin datos de motores.'}</p>
                )}

                {matriz?.datos_disponibles && trimestre ? (
                  <>
                    <div className="wm-fila wm-fila--ancha">
                      <Ventaja
                        filas={ventaja}
                        periodo={trimestre}
                        indicadorActivo={indicadorActivo}
                        onSeleccionarIndicador={setIndicadorActivo}
                        onSeleccionar={setContexto}
                      />
                    </div>
                    <div className="wm-fila wm-fila--ancha">
                      <BrechaMotores
                        brechas={brechas}
                        periodos={visibles}
                        periodo={trimestre}
                        indicadorActivo={indicadorActivo}
                        onSeleccionarPeriodo={setTrimestre}
                        onSeleccionar={setContexto}
                        onSeleccionarIndicador={setIndicadorActivo}
                      />
                    </div>
                  </>
                ) : (
                  <p className="wm-vacio">{cargando ? 'Calculando…' : 'Sin matriz de indicadores.'}</p>
                )}
              </>
            ) : null}

            {vista === 'comparativa' ? (
              <>
                {resumen?.datos_disponibles ? (
                  <div className="wm-fila wm-fila--ancha">
                    <Contribuciones
                      columnas={contribuciones}
                      periodo={trimestre ?? ''}
                      onSeleccionarPeriodo={setTrimestre}
                      onSeleccionar={setContexto}
                    />
                  </div>
                ) : null}

                {resumen?.datos_disponibles && baseIndice ? (
                  <div className="wm-fila wm-fila--ancha">
                    <Indice
                      series={resumen.series}
                      periodos={visibles}
                      todos={todosPeriodos}
                      base={baseIndice}
                      onCambiarBase={setBaseIndice}
                      onSeleccionarPeriodo={setTrimestre}
                      onSeleccionar={setContexto}
                      seleccionado={trimestre}
                    />
                  </div>
                ) : null}

                <div className="wm-fila wm-fila--ancha">
                  {matriz?.datos_disponibles && trimestre ? (
                    <Pulso
                      matriz={matriz}
                      mercado={pulsoMercado}
                      onCambiarMercado={setPulsoMercado}
                      periodos={visibles}
                      periodo={trimestre}
                      onSeleccionarPeriodo={setTrimestre}
                      onSeleccionar={setContexto}
                      indicadorActivo={indicadorActivo}
                      onSeleccionarIndicador={setIndicadorActivo}
                      hoverPeriodo={hoverPeriodo}
                    />
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <Contexto
            dato={contexto}
            onCerrar={() => setContexto(null)}
            onLimpiarMercado={() => setMercadoFoco(null)}
          />

          <Tablas resumen={resumen} visibles={visibles} matriz={matriz} periodo={trimestre} />
          <Metodo estado={estado} />
        </>
      ) : null}
    </div>
  );
}

/** Tendencia compacta de un indicador: serie observada, sin suavizado. */
function Sparkline({ valores, color }: { valores: number[]; color: string }) {
  if (valores.length < 2) return null;
  const ancho = 68;
  const alto = 24;
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const rango = maximo - minimo || 1;
  const puntos = valores.map((valor, indice) => {
    const x = (indice / (valores.length - 1)) * ancho;
    const y = alto - ((valor - minimo) / rango) * (alto - 4) - 2;
    return `${indice === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const ultimoX = ancho;
  const ultimoY = alto - ((valores[valores.length - 1] - minimo) / rango) * (alto - 4) - 2;
  return (
    <svg className="wm-spark" width={ancho} height={alto} aria-hidden="true">
      <path d={puntos.join(' ')} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={ultimoX} cy={ultimoY} r={2.4} fill={color} />
    </svg>
  );
}

function Tablas({
  resumen,
  visibles,
  matriz,
  periodo,
}: {
  resumen: Resumen | null;
  visibles: string[];
  matriz: Matriz | null;
  periodo: string | null;
}) {
  if (!resumen?.datos_disponibles) return null;
  return (
    <details className="wm-detalle-tecnico" data-testid="tabla-accesible">
      <summary>Ver los datos como tabla accesible</summary>
      <div className="wm-tabla-caja">
        <table className="wm-tabla">
          <caption>Ingresos, año anterior y crecimiento anual por trimestre y mercado</caption>
          <thead>
            <tr>
              <th scope="col">Mercado</th>
              <th scope="col">Trimestre</th>
              <th scope="col" className="wm-num">
                Ingresos (M MXN)
              </th>
              <th scope="col" className="wm-num">
                Año anterior (M MXN)
              </th>
              <th scope="col" className="wm-num">
                Crecimiento
              </th>
            </tr>
          </thead>
          <tbody>
            {resumen.series
              .filter((serie) => serie.mercado !== 'consolidado')
              .flatMap((serie) =>
                serie.ingresos
                  .filter((punto) => visibles.includes(punto.periodo))
                  .map((punto) => (
                    <tr key={`${serie.mercado}-${punto.periodo}`}>
                      <th scope="row">{serie.etiqueta}</th>
                      <td>{punto.periodo}</td>
                      <td className="wm-num">{millones(punto.valor)}</td>
                      <td className="wm-num">
                        {millones(
                          serie.ingresos_anio_anterior?.find(
                            (fila) => fila.periodo === punto.periodo,
                          )?.valor,
                        )}
                      </td>
                      <td className="wm-num">
                        {porcentaje(
                          serie.crecimiento.find((fila) => fila.periodo === punto.periodo)?.valor,
                        )}
                      </td>
                    </tr>
                  )),
              )}
          </tbody>
        </table>
      </div>

      {matriz?.datos_disponibles && periodo ? (
        <div className="wm-tabla-caja">
          <table className="wm-tabla">
            <caption>
              Indicadores de variación del {periodo} por mercado, con base y origen de cada cifra
            </caption>
            <thead>
              <tr>
                <th scope="col">Indicador</th>
                <th scope="col">Base</th>
                <th scope="col">Mercado</th>
                <th scope="col" className="wm-num">
                  Valor
                </th>
                <th scope="col">Origen</th>
                <th scope="col">Fuente</th>
              </tr>
            </thead>
            <tbody>
              {matriz.celdas
                .filter((celda) => celda.periodo === periodo)
                .map((celda) => {
                  const indicador = matriz.indicadores.find((fila) => fila.clave === celda.indicador);
                  const mercado = matriz.mercados.find((fila) => fila.clave === celda.mercado);
                  return (
                    <tr key={`${celda.indicador}-${celda.mercado}`}>
                      <th scope="row">{indicador?.etiqueta ?? celda.indicador}</th>
                      <td>{mercado?.etiqueta ?? celda.mercado}</td>
                      <td>{celda.base ?? '—'}</td>
                      <td className="wm-num">
                        {celda.valor === null ? 'No publicado' : porcentaje(celda.valor)}
                      </td>
                      <td>{celda.valor === null ? '—' : celda.derivado ? 'Derivado' : 'Publicado'}</td>
                      <td>{celda.fuente ?? '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : null}
    </details>
  );
}

function Metodo({ estado }: { estado: Estado | null }) {
  return (
    <details className="wm-detalle-tecnico" data-testid="metodo">
      <summary>Fuente, método y límites</summary>
      <div className="wm-metodo">
        <p>
          <strong>Fuente.</strong> Comunicados trimestrales y «Estados Financieros» de Walmart de
          México y Centroamérica en{' '}
          <a
            href="https://www.walmex.mx/comunicados-y-eventos/comunicados-a-bmv.html"
            target="_blank"
            rel="noreferrer"
          >
            walmex.mx
          </a>
          . Cada cifra conserva su documento de origen.
        </p>
        <p>
          <strong>Consolidado.</strong> México y Centroamérica lo componen: no es un tercer mercado.
          El puente de Resumen comprueba ΔConsolidado = ΔMéxico + ΔCentroamérica + residual, con una
          tolerancia de 1 millón por el redondeo de la fuente; el residual se muestra cuando existe.
        </p>
        <p>
          <strong>Contribuciones.</strong> Aportación = (ingreso del mercado en t − ingreso del mismo
          mercado en t−4) ÷ ingreso consolidado de t−4 × 100. Todas usan el mismo denominador; no son
          las tasas de crecimiento de cada mercado.
        </p>
        <p>
          <strong>Índice.</strong> importe(t) ÷ importe(base) × 100, con base común, comparable y
          mayor que cero, elegida sobre la línea temporal. Mover el rango no la cambia y se avisa si
          queda fuera. Compara niveles nominales: no es crecimiento real y arrastra estacionalidad.
        </p>
        <p>
          <strong>Motores.</strong> Tráfico, ticket y unidades iguales son variaciones publicadas; sus
          diferencias se expresan en puntos porcentuales y no se suman ni descomponen el crecimiento.
          Las brechas unen trimestres de forma lineal: el cruce por cero no es una fecha observada.
        </p>
        <p>
          <strong>Ausencias.</strong> Un dato no publicado se muestra como ausencia (hueco, «—», celda
          vacía), nunca como cero, y no se interpola. Las series conservan todos los trimestres del
          eje temporal.
        </p>
        <p>
          <strong>Lo que no está.</strong> Sin detalle por tienda, formato, producto, estado ni
          cliente; sin metas de la empresa; sin comercio electrónico (definición cambiante entre
          trimestres).
        </p>
        <p>
          <strong>Versión.</strong> {estado?.version ?? 'sin publicar'} · modelo {estado?.modelo ?? '—'} ·
          publicado {estado?.publicacion?.publicado_en ?? '—'} · persistencia MongoDB Atlas
          {estado?.periodo?.desde && estado?.periodo?.hasta
            ? ` · cobertura ${estado.periodo.desde} – ${estado.periodo.hasta}`
            : ''}
          .
        </p>
      </div>
    </details>
  );
}

