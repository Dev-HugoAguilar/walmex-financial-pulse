/**
 * Panel contextual del dato seleccionado.
 *
 * Se abre con la marca elegida, muestra el resumen (valor, periodo, mercado) y deja
 * el detalle técnico —base, origen, fórmula, documento y nota— en una sección
 * expandible: la información no se pierde, pero deja de ocupar la pantalla.
 */

import { useEffect, useState } from 'react';

import { MERCADOS, slugBase } from '../dominio';
import type { DatoContexto } from './comun';

export interface PropsContexto {
  dato: DatoContexto | null;
  onCerrar: () => void;
  onLimpiarMercado: () => void;
}

export function Contexto({ dato, onCerrar, onLimpiarMercado }: PropsContexto) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    setAbierto(false);
  }, [dato]);

  if (!dato) return null;

  return (
    <aside className="wm-contexto" aria-live="polite" data-testid="panel-contexto">
      <div className="wm-contexto-cabeza">
        <div>
          <p className="wm-contexto-eyebrow">
            {dato.origen === 'publicado' ? 'Dato publicado' : 'Dato derivado'}
          </p>
          <h4>{dato.titulo}</h4>
        </div>
        <button
          type="button"
          className="wm-btn-ico"
          onClick={onCerrar}
          aria-label="Cerrar el detalle"
        >
          ✕
        </button>
      </div>

      <p className="wm-contexto-valor">
        {dato.valor} <span className="wm-tenue">{dato.unidad}</span>
      </p>

      <div className="wm-contexto-resumen">
        <span>
          <strong>Periodo</strong> {dato.periodo}
        </span>
        <span>
          <strong>Mercado</strong>{' '}
          {dato.mercado ? MERCADOS[dato.mercado] ?? dato.mercado : 'Ambos mercados'}
        </span>
        <span>
          <strong>Base</strong> {slugBase(dato.base)}
        </span>
        {dato.mercado ? (
          <button type="button" className="wm-enlace" onClick={onLimpiarMercado}>
            quitar resaltado
          </button>
        ) : null}
      </div>

      <button
        type="button"
        className="wm-contexto-mas"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        data-testid="contexto-expandir"
      >
        {abierto ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
      </button>

      {abierto ? (
        <dl className="wm-contexto-datos">
          <div>
            <dt>Origen</dt>
            <dd>
              {dato.origen === 'publicado'
                ? 'Publicado por la empresa'
                : 'Cálculo derivado de importes publicados'}
            </dd>
          </div>
          <div>
            <dt>Base de comparación</dt>
            <dd>{slugBase(dato.base)}</dd>
          </div>
          {dato.formula ? (
            <div className="wm-contexto-ancho">
              <dt>Fórmula</dt>
              <dd className="wm-mono">{dato.formula}</dd>
            </div>
          ) : null}
          <div className="wm-contexto-ancho">
            <dt>Documento</dt>
            <dd>
              {dato.fuente
                ? `${dato.fuente} · estados financieros y comunicado del trimestre`
                : 'sin referencia'}
            </dd>
          </div>
          {dato.nota ? (
            <div className="wm-contexto-ancho">
              <dt>Nota</dt>
              <dd>{dato.nota}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </aside>
  );
}
