/**
 * «Hallazgos del análisis» de la ficha del proyecto.
 *
 * El portafolio reserva el hueco `#hallazgos-host` y este componente lo ocupa con
 * los tres hallazgos del último trimestre publicado, calculados sobre **todos**
 * los trimestres y sin filtros: describen la versión activa, no el subconjunto que
 * el visitante elija.
 *
 * Cada hallazgo es un solo párrafo —título y una o dos frases— y resalta como
 * mucho un par de cifras, sin notas técnicas: las advertencias de método y de
 * cobertura están en sus apartados.
 */

import { Fragment, useEffect, useState, type ReactNode } from 'react';

import { crearCliente, resolverApiBase } from '../api/cliente';
import type { Desempeno, Motores, Resumen } from '../api/tipos';
import { FILTROS_VACIOS } from '../dominio';
import { construirHallazgos, type Hallazgo } from '../hallazgos';

export interface PropsHallazgos {
  apiBase?: string;
}

interface EstadoHallazgos {
  cargando: boolean;
  error: string | null;
  subtitulo: string;
  hallazgos: Hallazgo[];
  omitidos: string[];
}

const INICIAL: EstadoHallazgos = {
  cargando: true,
  error: null,
  subtitulo: '',
  hallazgos: [],
  omitidos: [],
};

/** Escapa un fragmento para poder usarlo dentro de una expresión regular. */
function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Devuelve el texto con sus cifras clave resaltadas. */
function resaltar(texto: string, enfasis: string[]): ReactNode {
  const fragmentos = enfasis.filter((fragmento) => fragmento && texto.includes(fragmento));
  if (!fragmentos.length) return texto;

  const patron = new RegExp(`(${fragmentos.map(escapar).join('|')})`, 'g');
  return texto.split(patron).map((parte, indice) =>
    fragmentos.includes(parte) ? (
      <strong key={`${parte}-${indice}`} className="hallazgo-cifra">
        {parte}
      </strong>
    ) : (
      <Fragment key={`texto-${indice}`}>{parte}</Fragment>
    ),
  );
}

export function Hallazgos({ apiBase }: PropsHallazgos) {
  const [estado, setEstado] = useState<EstadoHallazgos>(INICIAL);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    setEstado(INICIAL);
    const cliente = crearCliente(resolverApiBase(apiBase));
    Promise.all([
      cliente.resumen(FILTROS_VACIOS, control.signal),
      cliente.motores(FILTROS_VACIOS, control.signal),
      cliente.desempeno({ ...FILTROS_VACIOS, indicador: 'mismas_tiendas' }, control.signal),
    ])
      .then(([resumen, motores, desempeno]) => {
        if (control.signal.aborted) return;
        const resultado = construirHallazgos({
          resumen: resumen as Resumen,
          motores: motores as Motores,
          desempeno: desempeno as Desempeno,
        });
        setEstado({
          cargando: false,
          error: null,
          subtitulo: resultado.subtitulo,
          hallazgos: resultado.hallazgos,
          omitidos: resultado.omitidos,
        });
      })
      .catch((error) => {
        if (control.signal.aborted || (error as Error).name === 'AbortError') return;
        setEstado({
          ...INICIAL,
          cargando: false,
          error:
            'No se pudieron calcular los hallazgos: la API de Walmex no respondió. Vuelve a intentarlo cuando el servicio esté disponible.',
        });
      });
    return () => control.abort();
  }, [apiBase, intento]);

  if (estado.cargando) {
    return <p className="hallazgos-espera" data-state="loading" role="status" aria-busy="true">Calculando hallazgos con los datos publicados…</p>;
  }
  if (estado.error) {
    return (
      <p className="hallazgos-espera" role="alert" data-state="error" data-testid="hallazgos-error">
        {estado.error}
        {' '}<button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
      </p>
    );
  }
  if (!estado.hallazgos.length) {
    return (
      <p className="hallazgos-espera" data-state="empty" role="status">
        Todavía no hay cifras publicadas suficientes para redactar hallazgos.
      </p>
    );
  }

  return (
    <div data-state="ready">
      <p className="hallazgos-alcance" data-testid="hallazgos-alcance">
        {estado.subtitulo}
      </p>
      {estado.hallazgos.map((hallazgo) => (
        <p key={hallazgo.id} data-testid={`hallazgo-${hallazgo.id}`}>
          <strong className="hallazgo-titulo">{hallazgo.titulo}.</strong>{' '}
          {resaltar(hallazgo.texto, hallazgo.enfasis)}
        </p>
      ))}
    </div>
  );
}
