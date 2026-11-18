/**
 * Cliente HTTP de la API de «Pulso comercial · Walmex».
 *
 * El navegador solo habla con la API del portafolio; nunca descarga documentos de
 * Walmex ni habla con MongoDB. Los filtros son los mismos en todas las vistas.
 */

import type {
  Catalogo,
  Desempeno,
  Estado,
  Filtros,
  FuentesRespuesta,
  Matriz,
  Motores,
  Resumen,
} from './tipos';

export const RUTA_API_POR_OMISION = 'http://127.0.0.1:8010/api/v1/walmex';

export function resolverApiBase(explicita?: string): string {
  const global = (window as unknown as { PORTFOLIO_WALMEX_API?: string }).PORTFOLIO_WALMEX_API;
  return (explicita || global || RUTA_API_POR_OMISION).replace(/\/+$/, '');
}

export class ErrorApi extends Error {
  readonly status: number;

  constructor(mensaje: string, status = 0) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
  }
}

async function pedir<T>(url: string, senal: AbortSignal): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      signal: senal,
      headers: { Accept: 'application/json' },
      mode: 'cors',
      credentials: 'omit',
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ErrorApi(
      'No se pudo contactar con la API del portafolio. Comprueba que el backend esté en ' +
        'marcha (uvicorn app.main:app --port 8010) y que el origen esté permitido por CORS.',
    );
  }
  if (!respuesta.ok) {
    let detalle = `La API respondió ${respuesta.status}.`;
    try {
      const cuerpo = (await respuesta.json()) as { detail?: unknown };
      if (typeof cuerpo.detail === 'string') detalle = cuerpo.detail;
    } catch {
      /* el cuerpo no era JSON */
    }
    throw new ErrorApi(detalle, respuesta.status);
  }
  return (await respuesta.json()) as T;
}

export function parametros(filtros: Filtros): string {
  const busqueda = new URLSearchParams();
  for (const mercado of filtros.mercados) busqueda.append('mercado', mercado);
  if (filtros.desde) busqueda.set('desde', filtros.desde);
  if (filtros.hasta) busqueda.set('hasta', filtros.hasta);
  if (filtros.indicador) busqueda.set('indicador', filtros.indicador);
  if (filtros.base) busqueda.set('base', filtros.base);
  const texto = busqueda.toString();
  return texto ? `?${texto}` : '';
}

export function crearCliente(apiBase: string) {
  const con = (ruta: string, filtros: Filtros) => `${apiBase}${ruta}${parametros(filtros)}`;
  return {
    apiBase,
    estado: (senal: AbortSignal) => pedir<Estado>(`${apiBase}/estado`, senal),
    catalogo: (senal: AbortSignal) => pedir<Catalogo>(`${apiBase}/catalogo`, senal),
    resumen: (filtros: Filtros, senal: AbortSignal) =>
      pedir<Resumen>(con('/resumen', filtros), senal),
    motores: (filtros: Filtros, senal: AbortSignal) =>
      pedir<Motores>(con('/motores', filtros), senal),
    desempeno: (filtros: Filtros, senal: AbortSignal) =>
      pedir<Desempeno>(con('/desempeno', filtros), senal),
    matriz: (filtros: Filtros, senal: AbortSignal) =>
      pedir<Matriz>(con('/matriz', filtros), senal),
    fuentes: (senal: AbortSignal) => pedir<FuentesRespuesta>(`${apiBase}/fuentes`, senal),
    urlExportar: (filtros: Filtros) => con('/exportar', filtros),
  };
}

export type Cliente = ReturnType<typeof crearCliente>;
