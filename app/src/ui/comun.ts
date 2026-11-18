/** Piezas compartidas por las visualizaciones: medición y tipos de contexto. */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ancho real del contenedor, medido en píxeles de maquetación.
 *
 * Devuelve `[ref, ancho]`. Se usa una *callback ref* en lugar de un objeto `ref`
 * porque el portafolio inserta el tablero en un contenedor que puede montarse
 * después del primer render. La medición usa `clientWidth` y el `contentRect` del
 * `ResizeObserver` —no `getBoundingClientRect`— y se acota al ancho de la ventana,
 * así que una animación de escala o un reflujo transitorio del contenedor no fija
 * un lienzo más ancho que el real. Si el valor cambia, se vuelve a medir en los dos
 * cuadros siguientes para corregir cualquier medida pasajera.
 */
export function useAncho<T extends HTMLElement = HTMLDivElement>(
  minimo = 280,
): [(nodo: T | null) => void, number] {
  const [nodo, setNodo] = useState<T | null>(null);
  const [ancho, setAncho] = useState(0);
  const ultimo = useRef(0);

  const ref = useCallback((actual: T | null) => {
    setNodo(actual);
  }, []);

  useEffect(() => {
    if (!nodo) return;
    let vivo = true;

    const medir = (observado?: number) => {
      if (!vivo || !nodo.isConnected) return;
      const marco = nodo.parentElement?.clientWidth ?? 0;
      const vista = document.documentElement.clientWidth || window.innerWidth;
      const bruto = Math.round(observado ?? nodo.clientWidth);
      /* El lienzo nunca supera el ancho de su marco ni el de la ventana. */
      let medido = Math.min(bruto, vista > 0 ? vista : bruto);
      if (marco > 0) medido = Math.min(medido, marco);
      const valor = medido <= 0 ? 0 : Math.max(marco > 0 ? Math.min(minimo, marco) : minimo, medido);
      if (valor === ultimo.current) return;
      ultimo.current = valor;
      setAncho(valor);
      /* Revisión de confirmación: descarta una medida transitoria. */
      requestAnimationFrame(() => requestAnimationFrame(() => medir()));
    };

    medir();
    const cuadro = requestAnimationFrame(() => medir());
    const observador = new ResizeObserver((entradas) => {
      const entrada = entradas[entradas.length - 1];
      const inline = entrada.contentBoxSize?.[0]?.inlineSize ?? entrada.contentRect?.width;
      medir(inline);
    });
    observador.observe(nodo);
    const alRedimensionar = () => medir();
    const alAlternar = () => medir();
    window.addEventListener('resize', alRedimensionar);
    document.addEventListener('toggle', alAlternar, true);
    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      window.removeEventListener('resize', alRedimensionar);
      document.removeEventListener('toggle', alAlternar, true);
    };
  }, [nodo, minimo]);

  return [ref, ancho];
}

/** ¿La persona pidió reducir el movimiento? Sin animaciones innecesarias. */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const actualizar = () => setReducido(consulta.matches);
    actualizar();
    consulta.addEventListener('change', actualizar);
    return () => consulta.removeEventListener('change', actualizar);
  }, []);
  return reducido;
}

/** Dato que abre el panel contextual al seleccionar algo en una gráfica. */
export interface DatoContexto {
  titulo: string;
  valor: string;
  unidad: string;
  periodo: string;
  mercado?: string | null;
  base?: string | null;
  origen: 'publicado' | 'derivado';
  formula?: string | null;
  fuente?: string | null;
  nota?: string | null;
}

/** ¿Los periodos son consecutivos en la lista publicada (sin huecos)? */
export function sonConsecutivos(periodos: string[], a: string, b: string): boolean {
  const ia = periodos.indexOf(a);
  const ib = periodos.indexOf(b);
  return ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1;
}

export function ticksLineales(
  minimo: number,
  maximo: number,
  cantidad = 5,
  formato: (valor: number) => string,
): { valor: number; etiqueta: string }[] {
  const paso = (maximo - minimo) / Math.max(1, cantidad - 1);
  return Array.from({ length: cantidad }, (_, indice) => {
    const valor = minimo + paso * indice;
    return { valor, etiqueta: formato(valor) };
  });
}

