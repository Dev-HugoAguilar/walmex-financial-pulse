# Cómo contribuir

Gracias por revisar este proyecto. Es una pieza de portafolio con alcance
deliberadamente acotado; las contribuciones más útiles son las que mejoran la
claridad del análisis, la cobertura de pruebas o la accesibilidad de la demo.

## Entorno

`ash
git clone https://github.com/Dev-HugoAguilar/walmex-financial-pulse.git
cd walmex-financial-pulse
`

## Convenciones

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/).
  Prefijos usados: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`,
  `perf`, `ci`, `style`. Ámbito opcional en minúsculas, por ejemplo
  `fix(ci): corrige el escaneo de credenciales`.
- **Idioma**: documentación y mensajes de interfaz en español; identificadores,
  mensajes de commit y nombres de archivo técnicos pueden ir en inglés.
- **Estilo**: 4 espacios en Python, 2 en CSS/JS/TS/HTML, línea de 100 columnas.
- **Pruebas**: cualquier cambio de comportamiento necesita evidencia reproducible.

## Datos y secretos

- No se versionan datos crudos restringidos ni credenciales. Las fuentes se
  documentan en `docs/DATA.md` con su licencia y sus límites.
- Cada cambio pasa por el escaneo de credenciales de la integración continua.

## Flujo de revisión

1. Abre un *issue* que describa el problema observable.
2. Trabaja en una rama corta: `feat/…`, `fix/…` o `docs/…`.
3. Asegura la integración continua en verde.
4. Envía el *pull request* con contexto, decisión y evidencia del cambio.
