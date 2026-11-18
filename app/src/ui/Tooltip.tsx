/**
 * Globo de detalle para las marcas de las gráficas.
 *
 * Se coloca junto al puntero o al elemento enfocado, se voltea si no cabe y se
 * desplaza para no tapar nunca el dato señalado. Es HTML (no SVG) para que el texto
 * conserve la tipografía y el contraste del panel.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface PropsTooltip {
  /** Posición del puntero o de la marca, en coordenadas de la ventana. */
  x: number;
  y: number;
  children: ReactNode;
  visible: boolean;
  testid?: string;
  /** Ocultar el globo al desplazar la página (solo si está anclado al puntero). */
  ocultarAlDesplazar?: boolean;
}

export function Tooltip({
  x,
  y,
  children,
  visible,
  testid = 'tooltip',
  ocultarAlDesplazar = true,
}: PropsTooltip) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [posicion, setPosicion] = useState({ left: x, top: y });
  const [oculto, setOculto] = useState(false);

  /* Al desplazar la página la referencia del puntero deja de ser válida. */
  useEffect(() => {
    if (!ocultarAlDesplazar) return;
    const alDesplazar = () => setOculto(true);
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, [ocultarAlDesplazar]);

  useEffect(() => {
    setOculto(false);
  }, [x, y, visible]);

  useLayoutEffect(() => {
    const nodo = caja.current;
    if (!nodo || !visible || oculto) return;
    const ancho = nodo.offsetWidth;
    const alto = nodo.offsetHeight;
    const margen = 12;
    const separacion = 14;

    let left = x + separacion;
    let top = y - alto - separacion;
    if (left + ancho > window.innerWidth - margen) left = x - ancho - separacion;
    if (left < margen) left = margen;
    if (top < margen) top = y + separacion;
    if (top + alto > window.innerHeight - margen) top = Math.max(margen, y - alto - separacion);
    setPosicion({ left, top });
  }, [x, y, visible, children, oculto]);

  if (!visible || oculto) return null;

  return (
    <div
      ref={caja}
      className="wm-tooltip"
      data-testid={testid}
      role="tooltip"
      style={{ left: posicion.left, top: posicion.top }}
    >
      {children}
    </div>
  );
}

