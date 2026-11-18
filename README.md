# Pulso comercial · Walmex

Analiza ventas, crecimiento y desempeño comercial de **Walmart de México y
Centroamérica** a partir de sus comunicados trimestrales oficiales, con el puente
de origen del crecimiento y la comparación contra el mismo trimestre del año
anterior.

[![Build](https://github.com/Dev-HugoAguilar/walmex-financial-pulse/actions/workflows/tests.yml/badge.svg)](https://github.com/Dev-HugoAguilar/walmex-financial-pulse/actions/workflows/tests.yml)
[![React](https://img.shields.io/badge/React-TypeScript-3178C6?logo=react&logoColor=white)](app)
[![Datos](https://img.shields.io/badge/datos-comunicados%20Walmex-b7791f)](#datos-y-atribución)

> **Alcance.** Solo información **pública** de los comunicados trimestrales. Este
> proyecto no está vinculado ni patrocinado por Walmex.

---

## Ejecutar

Requiere la API del portafolio (`portfolio-api`) en el puerto 8010:

```bash
python -m uvicorn app.main:app --port 8010   # terminal 1

cd app && npm ci && npm run dev              # terminal 2
```

Producción: `npm run build`.

![Portada de Pulso comercial](docs/cover.jpg)

## Qué demuestra

- **Validación antes de publicar**: México + Centroamérica debe sumar el
  consolidado; ventas netas + otros ingresos debe sumar el total; y la variación
  calculada con importes debe coincidir con la publicada.
- **Lectura interanual**: cada trimestre se compara con el mismo trimestre del año
  anterior, no con el inmediato anterior.
- **Nueve visualizaciones** en tres vistas: puente de origen del crecimiento,
  áreas apiladas y calendario de círculos proporcionales.
- **Huecos declarados**: los trimestres sin dato se muestran como «no publicado»,
  nunca como cero.

## Datos y atribución

**Walmart de México y Centroamérica (Walmex)**: comunicados trimestrales de
resultados y «Estados Financieros» publicados en walmex.mx. Cubre del **1T23 al
3T26: 15 trimestres y 16 documentos oficiales** (un comunicado y un libro de
estados financieros por trimestre, más el histórico de ventas). La fecha de
publicación se toma del propio comunicado.

## Estructura

```text
app/                 Aplicación React + TypeScript (Vite)
  src/               Puente de crecimiento, áreas apiladas y calendario
  tools/             Minificador y utilidades de build
docs/LEEME.md        Documentación original del proyecto
docs/cover.jpg       Captura real de la aplicación
```

## Límites

- Sin detalle por tienda, formato, producto ni cliente, y sin metas de la empresa.
- El comercio electrónico (ventas netas y GMV) queda fuera: su definición cambia
  entre trimestres y no cubre todo el periodo.
- Tráfico y ticket solo se publican desde 2024: la vista de motores cubre **10 de
  los 15** trimestres y los huecos se marcan como «no publicado».
- Los importes son **millones de pesos nominales** del periodo, sin ajuste por
  inflación ni por tipo de cambio.

## Seguridad y contribución

Sin credenciales ni datos personales en el repositorio. Ver [`SECURITY.md`](SECURITY.md)
y [`CONTRIBUTING.md`](CONTRIBUTING.md).
