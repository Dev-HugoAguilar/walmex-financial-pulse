/**
 * Tipos de la API de «Pulso comercial · Walmex».
 *
 * Reflejan solo lo que la API publica: hechos agrupados por trimestre y mercado,
 * con su unidad, su base de comparación y la referencia del documento oficial.
 */

export interface Periodo {
  periodo: string;
  orden: number;
  anio: number;
  trimestre: number;
  etiqueta: string;
  fecha_publicacion: string | null;
}

export interface IndicadorCatalogo {
  clave: string;
  etiqueta: string;
  unidad: string;
  tipo: string;
  definicion: string;
  bases: string[];
}

export interface Combinacion {
  mercado: string;
  indicador: string;
  base: string;
}

export interface Catalogo {
  datos_disponibles: boolean;
  version: string;
  indicadores: IndicadorCatalogo[];
  mercados: { clave: string; etiqueta: string }[];
  periodos: Periodo[];
  combinaciones: Combinacion[];
  ultimo_periodo: string | null;
  cobertura: Record<string, any> | null;
  conclusiones_validacion?: string[];
  notas: string[];
  alcance: {
    unidad_importes: string;
    unidad_variaciones: string;
    detalle: string;
  };
}

export interface Estado {
  datos_disponibles: boolean;
  version: string | null;
  motivo?: string;
  fuente?: {
    nombre: string;
    sitio: string;
    documentos: number;
    ultima_publicacion: string | null;
  };
  periodo?: {
    ultimo: string | null;
    etiqueta: string | null;
    desde: string | null;
    hasta: string | null;
    trimestres: number;
  };
  publicacion?: { publicado_en: string | null; extraid_en: string | null; nota: string };
  modelo?: string;
  persistencia?: Record<string, unknown>;
  cobertura?: Record<string, any> | null;
  notas?: string[];
}

export interface IndicadorResumen {
  clave: string;
  indicador: string;
  mercado: string;
  etiqueta: string;
  valor: number | null;
  unidad: string;
  base: string | null;
  publicado: boolean;
  derivado: boolean;
  estado: 'publicado' | 'no_publicado';
  periodo: string;
  fuente: string | null;
}

export interface PuntoSerie {
  periodo: string;
  valor: number | null;
  base?: string | null;
}

export interface SerieMercado {
  mercado: string;
  etiqueta: string;
  ingresos: PuntoSerie[];
  /** Importes del mismo trimestre del año anterior (misma definición). */
  ingresos_anio_anterior?: PuntoSerie[];
  crecimiento: PuntoSerie[];
}

export interface Consistencia {
  periodo: string;
  prueba: string;
  izquierda: number;
  derecha: number | null;
  diferencia: number;
  cuadra: boolean;
  unidad: string;
}

export interface Resumen {
  datos_disponibles: boolean;
  version: string | null;
  motivo?: string;
  periodo_seleccionado: string;
  periodos: string[];
  mercados: string[];
  indicadores: IndicadorResumen[];
  series: SerieMercado[];
  consistencia: Consistencia[];
  definiciones: Record<string, string>;
  notas: string[];
  avisos: string[];
}

export interface PuntoMotor {
  periodo: string;
  trafico: number;
  ticket: number;
  mismas_tiendas: number | null;
  implicado: number | null;
}

export interface PanelMotor {
  mercado: string;
  etiqueta: string;
  puntos: PuntoMotor[];
  periodos_incompletos: string[];
}

export interface Motores {
  datos_disponibles: boolean;
  version: string | null;
  motivo?: string;
  unidad: string;
  paneles: PanelMotor[];
  definicion: string;
  advertencia: string;
  notas: string[];
  avisos: string[];
}

export interface CeldaDesempeno {
  periodo: string;
  valor: number | null;
  estado: 'publicado' | 'cero' | 'no_publicado';
  fuente?: string;
  publicado?: boolean;
  derivado?: boolean;
}

export interface FilaDesempeno {
  mercado: string;
  etiqueta: string;
  celdas: CeldaDesempeno[];
}

export interface Desempeno {
  datos_disponibles: boolean;
  version: string | null;
  motivo?: string;
  indicador: string;
  etiqueta: string;
  unidad: string;
  base: string | null;
  bases: string[];
  periodos: string[];
  filas: FilaDesempeno[];
  periodo_ranking: string | null;
  ranking: { mercado: string; etiqueta: string; valor: number | null }[];
  divergente: boolean;
  notas: string[];
  avisos: string[];
}

export interface FuentesRespuesta {
  datos_disponibles: boolean;
  version: string | null;
  fuentes: FuenteDocumento[];
  periodos: string[];
}

/** Celda de la matriz de indicadores: valor publicado, cero exacto o ausencia. */
export interface CeldaMatriz {
  indicador: string;
  mercado: string;
  periodo: string;
  valor: number | null;
  estado: 'publicado' | 'cero' | 'no_publicado';
  base: string | null;
  fuente: string | null;
  publicado: boolean;
  derivado: boolean;
}

export interface IndicadorMatriz {
  clave: string;
  etiqueta: string;
  unidad: string;
  base: string | null;
  definicion: string;
  periodos_con_dato: number;
}

export interface Matriz {
  datos_disponibles: boolean;
  version: string | null;
  motivo?: string;
  unidad: string;
  anios: string[];
  indicadores: IndicadorMatriz[];
  mercados: { clave: string; etiqueta: string }[];
  periodos: string[];
  celdas: CeldaMatriz[];
  dominio: { min: number; max: number };
  notas: string[];
  avisos: string[];
}

export interface FuenteDocumento {
  id: string;
  trimestre: string;
  tipo: string;
  fecha_publicacion: string | null;
  url_comunicado: string;
  sha256_estados: string;
  sha256_comunicado: string | null;
  archivo_estados: string;
  archivo_comunicado: string;
  paginas: Record<string, string>;
}

export interface Filtros {
  mercados: string[];
  desde: string | null;
  hasta: string | null;
  indicador: string | null;
  base: string | null;
}
