# Fotos Ligeras

Aplicación web para reducir el peso de fotografías antes de compartirlas por WhatsApp, correo o una web. Todo el procesamiento ocurre en el navegador: las imágenes no se envían a ningún servidor y los archivos originales no se modifican.

## Requisitos

- Node.js 20.19+ o 22.12+ (desarrollado y probado con Node.js 24.11).
- npm 10+.
- Un navegador moderno con `createImageBitmap`. La app usa `OffscreenCanvas` y Web Worker cuando están disponibles, y vuelve al hilo principal si no lo están.

## Instalar y ejecutar

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite, normalmente <http://localhost:5173>.

Para probar la compilación de producción:

```bash
npm run build
npm run preview
```

Comprobaciones de código disponibles:

```bash
npm run lint
npm run build
```

## Flujo de uso

1. **Añade tus fotos**: arrastra o selecciona hasta 30 imágenes JPEG, PNG o WebP de 25 MB como máximo.
2. **Elige el tamaño**: elige WhatsApp, correo, web, un peso máximo o un perfil personalizado.
3. **Descarga**: compara el antes y el después, descarga cada foto o todo el lote en un ZIP.

Ajustes incluidos:

| Perfil | Formato | Lado máximo | Calidad |
| --- | --- | --- | --- |
| Enviar por WhatsApp | JPEG | 1600 px | 80 % |
| Enviar por correo | JPEG | 1920 px | 82 % |
| Publicar en una web | WebP | 1600 px | 80 % |
| Peso máximo | JPEG o WebP | Hasta 4000 px de partida | Automática, con objetivo en KB |
| Personalizado | JPEG, WebP o PNG | 400–4000 px | 30–100 % |

Son ajustes propios de la aplicación, no límites oficiales de esos servicios. El control de calidad no se aplica al formato PNG.

### Peso máximo

El perfil **Peso máximo** acepta un objetivo entre 20 KB y 25 MB, con presets de 100 KB, 200 KB, 500 KB, 1 MB y 2 MB. El algoritmo busca la calidad más alta que quepa en el límite (entre 30 % y 92 %). Si ni siquiera la calidad mínima entra, reduce la resolución por pasos hasta un lado más largo de 320 px. Nunca amplía una foto.

El formato de salida puede ser JPEG o WebP; PNG no está disponible en este modo porque su exportación no usa calidad. Si la foto original ya cumple el objetivo, tiene el formato elegido y no supera el lado máximo, se conserva sin recomprimir. Cuando el objetivo no es alcanzable, el resultado más ligero se muestra con un aviso y sigue disponible para descargar.

## Cómo funciona el procesamiento local

1. Al añadir un archivo se valida el tipo, el tamaño y que se pueda decodificar. También se leen sus dimensiones y se crea una vista previa local con `URL.createObjectURL`.
2. El lote se procesa de forma secuencial para limitar el consumo de memoria. Cada foto se envía a un Web Worker.
3. El worker decodifica con `createImageBitmap` respetando la orientación EXIF, calcula las dimensiones proporcionales sin ampliar la imagen y dibuja el resultado en un `OffscreenCanvas`.
4. Se comprueba si la imagen tiene transparencia. PNG y WebP conservan el canal alfa. Al exportar a JPEG se coloca un fondo blanco debajo y se avisa en el resultado.
5. La exportación normal usa `convertToBlob` con el formato y la calidad elegidos. En el modo de peso máximo, el worker prueba varias calidades con una búsqueda binaria y, si es necesario, reduce las dimensiones. Si el navegador no puede exportar WebP en el modo normal, se conserva la transparencia con PNG o se usa JPEG cuando la imagen es opaca, y se indica en el resultado.
6. Cada `ImageBitmap` se cierra al terminar. Las URLs de objetos se liberan al reemplazar un resultado, quitar una foto, vaciar la selección o cerrar la aplicación. Los `File` originales nunca se sobrescriben.
7. Las descargas individuales usan un nombre como `nombre-ligero.jpg`; si hay colisiones dentro del lote se añaden sufijos (`-2`, `-3`). El ZIP se genera con `fflate` e incluye `resumen.txt` con nombres, dimensiones, tamaños, ahorro y notas.

La interfaz permite cancelar un lote en curso. Al cancelar se detiene el trabajo pendiente y se conservan los resultados que ya estaban terminados. Si se cambian los ajustes después de procesar, los resultados se marcan como pendientes y las descargas se desactivan hasta actualizarlos.

### Privacidad

- No hay backend, cuentas, analítica ni servicios externos.
- No se usan fuentes remotas ni peticiones de red durante el procesamiento.
- No se guardan fotos en `localStorage`, IndexedDB ni bases de datos.
- Los archivos originales se leen en memoria y no se modifican.
- Al volver a codificar la imagen no se copian los metadatos EXIF. Esto no garantiza el anonimato: el contenido de la foto puede seguir siendo identificable.

## Formatos y limitaciones

- Formatos admitidos: JPEG, PNG y WebP.
- HEIC/HEIF todavía no se admite; la interfaz explica cómo exportarlo como JPEG.
- Límite por lote: 30 fotos y 25 MB por archivo.
- Las imágenes no se amplían si su lado más largo ya es menor que el límite elegido.
- En el modo de peso máximo, el objetivo puede no alcanzarse en imágenes extremadamente pequeñas o ruidosas; el resultado mínimo se muestra con un aviso.
- El modo de peso máximo solo exporta JPEG o WebP. Un navegador sin codificador WebP mostrará un error claro y permitirá elegir JPEG.
- El PNG no usa la calidad de exportación. Puede ocupar más que el original; en ese caso se ofrece conservar el archivo original.
- La compresión puede producir pérdida visual. La app no promete que la calidad sea idéntica.
- El botón «Ver al 100 %» de la comparación muestra los píxeles reales.
- El ZIP se construye en memoria. Lotes muy grandes pueden consumir bastante memoria, aunque los archivos de imagen del ZIP se almacenan sin recompresión adicional.
- Navegadores probados: Chrome y Edge (Chromium) en escritorio y emulación móvil. No se han probado Safari ni Firefox en esta entrega. La ruta alternativa sin Web Worker/OffscreenCanvas está implementada y se comprobó desactivando esas APIs en Chromium.

## Estructura

```text
src/
  App.tsx                    Estado, lote secuencial y descargas
  components/                Interfaz (carga, perfiles, resultados, comparación)
  lib/
    files.ts                 Validación y dimensiones
    processImage.ts          Decodificación, canvas y exportación
    imageProcessor.ts        Comunicación con el Web Worker y fallback
    downloads.ts             Nombres únicos, ZIP y resumen de texto
    profiles.ts              Perfiles y ajustes
    format.ts                Formato de tamaños y porcentajes
  workers/image.worker.ts    Procesamiento fuera del hilo principal
  types.ts                   Tipos compartidos
```

## Comprobaciones realizadas

- `npm run lint`: 0 errores y 0 avisos.
- `npm run build`: compilación TypeScript y build de Vite correctos.
- Pruebas de navegador automatizadas con Playwright en Chrome y Edge headless: 54/54 comprobaciones correctas.
- Revisión visual en escritorio (1440 × 1000) y móvil (390 × 844), sin desbordamiento horizontal en móvil.
- Escaneo con axe-core: sin violaciones graves o críticas en resultados y en los ajustes de peso máximo.

Casos cubiertos con muestras generadas:

- JPEG vertical con orientación EXIF 6: dimensiones orientadas correctas y salida sin EXIF.
- PNG con transparencia: conservada al exportar WebP; con JPEG se rellena de blanco y se avisa.
- WebP de entrada y salida WebP.
- Nombres repetidos y distintas extensiones: el ZIP genera `playa-ligero.webp`, `playa-ligero-2.webp` y `playa-ligero-3.webp`.
- Archivo corrupto, GIF no admitido, archivo HEIC y archivo de más de 25 MB: avisos claros.
- Imagen cuyo resultado pesa más: se muestra el aumento y se ofrece conservar el original; la copia conservada es idéntica al original.
- 31 archivos seleccionados: se aceptan 30 y se explica la omisión.
- Descarga individual y ZIP con `resumen.txt`.
- Peso objetivo por presets y por valor personalizado; límite aplicado en JPEG y WebP.
- Fotos que ya cumplían el objetivo y tenían el formato elegido: se conservaron sin recomprimir.
- Objetivo agresivo de 20 KB: reducción automática a 650 × 450 px y cumplimiento del límite.
- Objetivo imposible en una imagen ruidosa: se muestra el resultado mínimo (26 KB), se avisa y se permite descargar.
- Cambio de peso o formato: resultados marcados como pendientes y descargas bloqueadas hasta actualizar.
- Cancelación de un lote y posterior reanudación.
- Eliminación individual y vaciado completo.
- Arrastrar y soltar.
- Procesamiento alternativo en el hilo principal cuando no hay Worker/OffscreenCanvas.
- Sin peticiones externas ni errores de consola durante el flujo.
- Navegación por teclado, salto al contenido, foco atrapado en el diálogo de comparación y cierre con Escape.

Las imágenes de salida se comprobaron con Pillow: orientación, eliminación de EXIF, conservación de alfa y fondo blanco en JPEG. El ZIP se abrió y se verificaron sus entradas, dimensiones y el contenido UTF-8 de `resumen.txt`.

No se ha probado en dispositivos físicos, Safari, Firefox ni con archivos HEIC reales (el formato no está admitido). Tampoco se ha publicado ni desplegado la aplicación.
