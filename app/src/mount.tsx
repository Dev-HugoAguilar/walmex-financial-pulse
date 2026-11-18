/**
 * Punto de entrada del módulo empaquetado.
 *
 * El portafolio lo carga con `import()` dinámico desde
 * `dist/projects/pulso-comercial.js` y le pasa el nodo donde debe vivir la
 * aplicación.
 */

import { createRoot, type Root } from 'react-dom/client';

import { WalmexApp } from './App';
import { Hallazgos } from './ui/Hallazgos';
import './estilos.css';

export interface OpcionesMontaje {
  apiBase?: string;
}

export interface InstanciaTablero {
  unmount: () => void;
  resize: () => void;
}

let raiz: Root | null = null;
let contenedor: HTMLElement | null = null;
let raizHallazgos: Root | null = null;
let hostHallazgos: HTMLElement | null = null;
let observador: MutationObserver | null = null;
let espera: number | null = null;

export function unmount(): void {
  if (raiz) {
    raiz.unmount();
    raiz = null;
  }
  if (contenedor && contenedor.parentNode) {
    contenedor.parentNode.removeChild(contenedor);
  }
  contenedor = null;

  observador?.disconnect();
  observador = null;
  if (espera !== null) {
    window.clearTimeout(espera);
    espera = null;
  }
  if (raizHallazgos) {
    raizHallazgos.unmount();
    raizHallazgos = null;
  }
  if (hostHallazgos) {
    hostHallazgos.textContent = '';
    hostHallazgos = null;
  }
}

/** El tablero ya pintó cifras (no «No publicado» en todas las tarjetas). */
function conDatos(): boolean {
  const valores = [...document.querySelectorAll('.wm-kpi-valor')];
  return valores.length > 0 && valores.some((nodo) => !(nodo.textContent ?? '').includes('No publicado'));
}

/** Monta los hallazgos cuando el tablero ya tiene cifras, para no competir por la API. */
function montarHallazgos(apiBase?: string): void {
  const hueco = document.getElementById('hallazgos-host');
  if (!hueco) return;
  const empezar = () => {
    observador?.disconnect();
    observador = null;
    if (espera !== null) {
      window.clearTimeout(espera);
      espera = null;
    }
    if (!hueco.isConnected) return;
    hueco.textContent = '';
    hostHallazgos = hueco;
    raizHallazgos = createRoot(hueco);
    raizHallazgos.render(<Hallazgos apiBase={apiBase} />);
  };
  if (conDatos()) {
    empezar();
    return;
  }
  observador = new MutationObserver(() => {
    if (conDatos()) empezar();
  });
  observador.observe(document.body, { childList: true, subtree: true, characterData: true });
  espera = window.setTimeout(empezar, 6000);
}

export function mount(host: HTMLElement, opciones: OpcionesMontaje = {}): InstanciaTablero {
  unmount();
  contenedor = document.createElement('div');
  contenedor.className = 'wm-root';
  host.appendChild(contenedor);
  raiz = createRoot(contenedor);
  raiz.render(<WalmexApp apiBase={opciones.apiBase} />);
  montarHallazgos(opciones.apiBase);
  return { unmount, resize: () => undefined };
}

export default { mount, unmount };
