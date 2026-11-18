/**
 * Marco común de los bloques: título breve de negocio, subtítulo con el periodo y la
 * unidad, controles compactos y la observación verificada del bloque.
 *
 * No hay numeración ni preguntas largas: la pregunta vive en el título corto y los
 * detalles técnicos en el panel contextual y la metodología.
 */

import type { ReactNode } from 'react';

export interface PropsBloque {
  titulo: string;
  sub?: string;
  controles?: ReactNode;
  observacion?: string | null;
  protagonista?: boolean;
  testid: string;
  children: ReactNode;
}

export function Bloque({ titulo, sub, controles, observacion, protagonista, testid, children }: PropsBloque) {
  return (
    <article
      className={`wm-bloque${protagonista ? ' wm-bloque--protagonista' : ''}`}
      data-testid={testid}
    >
      <header className="wm-cabeza">
        <div className="wm-cabeza-texto">
          <h3>{titulo}</h3>
          {sub ? <p className="wm-cabeza-sub">{sub}</p> : null}
        </div>
        {controles ? <div className="wm-controles">{controles}</div> : null}
      </header>
      <div className="wm-cuerpo">{children}</div>
      {observacion ? <p className="wm-observacion">{observacion}</p> : null}
    </article>
  );
}
