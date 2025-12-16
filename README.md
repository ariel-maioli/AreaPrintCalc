# PeeP Rosario · Calculadora de área imprimible

Aplicación SPA (HTML/CSS/JS) para talleres de sublimación o estampado que desean saber cuántas copias caben en cada hoja sin instalar software. Toda la interfaz está en español, corre offline en el navegador y prioriza accesibilidad, contraste y soporte táctil.

## Objetivos
- Evaluar dos estrategias:
  - **Modo estricto**: cuadrícula alineada a los ejes, sin rotación.
  - **Modo optimizado**: compara la versión rotada y agrega franjas híbridas que combinan ambas orientaciones para aprovechar los residuos.
- Mostrar como máximo dos previsualizaciones y añadir un badge `+N piezas (+X%)` solo cuando el modo optimizado supera al estricto.
- Ofrecer un panel de métricas compacto con copias totales, uso del área y desperdicio (cada métrica incluye la referencia estricta cuando hay mejora).
- Recalcular automáticamente al modificar cualquier campo, sin botones extras ni flujos de envío.
- Mantener temas claro/oscuro accesibles y patrones reconocibles para distinguir los modos.

## Arquitectura
```
index.html             # Maquetado semántico, formulario, métricas y paneles
assets/css/styles.css  # Tokens de tema, layout, responsivo, estados de foco
assets/js/app.js       # Estado, cálculos, render SVG, controlador de tema
```

### Módulos principales (assets/js/app.js)
- `StateStore`: mantiene todos los valores canonizados en milímetros, banderas como “mantener proporción / espacios iguales”, preferencias de tema y resultados vigentes.
- `CalculatorCore`: normaliza entradas, calcula el layout estricto, el rotado y combinaciones híbridas (añadiendo franjas laterales o inferiores) y elige la mejor con `pickBetterLayout`.
- `PreviewRenderer`: dibuja tarjetas SVG con márgenes, área imprimible y segmentos independientes (cada segmento conoce su offset, gap y etiqueta “Original/Rotado”).
- `ThemeController`: sincroniza el switch accesible (`role="switch"`), aplica `data-theme` antes del primer repintado y persiste en `localStorage`.

## Formulario
Los controles viven en la columna izquierda. Valores iniciales: hoja A4, unidad mm, margen 5 mm, gaps 3 mm, rotación y vínculo de gaps activados.

| Campo                     | Tipo / Opciones                                      | Predeterminado | Obligatorio | Notas |
|---------------------------|------------------------------------------------------|----------------|-------------|-------|
| Formato de hoja           | select (Carta, Oficio, Tabloide, A4, A3, A3+, Personalizada) | A4 | Sí | Cada preset rellena ancho/alto; solo “Personalizada” permite editarlos. |
| Ancho / Alto de hoja      | Números sincronizados con la unidad                  | Según preset   | Sí | Rangos: 1‑40 in, 1‑100 cm o 1‑1000 mm. Bloqueados salvo preset personalizado. |
| Unidad                    | Control segmentado (in / cm / mm)                    | mm             | Sí | Cambiar unidad convierte todos los campos con redondeo apropiado. |
| Ancho / Alto de imagen    | Número                                               | Vacío          | Sí | Deben ser > 0 y caber en el área imprimible. |
| Mantener proporción       | Checkbox                                             | Desactivado    | No | Bloquea la relación ancho/alto al editar. |
| Permitir rotación         | Checkbox                                             | Activado       | Sí | Desbloquea layouts rotados y combinaciones híbridas. |
| Margen uniforme (mm)      | Número entero (paso 1)                               | 5              | Sí | Aplica a los cuatro lados; siempre en mm. |
| Espacio horizontal (mm)   | Número                                               | 3              | Sí | Separación entre columnas, ≥ 0. |
| Espacio vertical (mm)     | Número                                               | 3              | Sí | Separación entre filas, ≥ 0. |
| Mantener espacios iguales | Checkbox                                             | Activado       | No | Sincroniza ambos gaps; cambiar uno replica el otro. |

Las validaciones se ejecutan al escribir o salir de cada campo y publican mensajes con `aria-live="polite"`. No existe botón de envío: la app recalcula en caliente cuando los datos son válidos.

## Métricas y previsualización
- **Copias**: total del layout activo (muestra la cifra estricta como referencia cuando la optimización gana).
- **Uso área**: porcentaje de área imprimible cubierta por las copias.
- **Desperdicio**: complemento al 100 % del uso.

Las tarjetas SVG muestran el contorno de la hoja, el área imprimible y cada segmento de piezas. El modo estricto usa relleno sólido; los segmentos rotados emplean la misma paleta con ligera variación de opacidad para identificarlos sin introducir líneas punteadas.

## Temas y accesibilidad
- Variables CSS definen colores, superficies y patrones; los temas claro/oscuro sobrescriben este set manteniendo contraste AA.
- El switch de tema en el encabezado usa `role="switch"`, `aria-checked` y persistencia en `localStorage`; el script inline lo aplica antes de que cargue el CSS para evitar parpadeos.
- Todos los campos tienen área táctil ≥ 11 mm, foco visible y ayudas contextuales. El orden de tabulación es lineal y los mensajes de error se anuncian sin bloquear la interacción.

## Orden sugerido de implementación
1. Maquetar `index.html` y estilos base (grid, tipografías, tokens de tema).
2. Implementar `ThemeController` y el switch claro/oscuro.
3. Construir `StateStore`, enlazar los campos del formulario y validar entradas.
4. Incorporar `CalculatorCore` con layouts estricto, rotado e híbrido.
5. Añadir `PreviewRenderer`, badges y métricas sincronizadas.
6. Ajustar responsividad, contraste WCAG y verificar accesibilidad (lectores de pantalla, `aria-live`, foco).

> Nota: README y `help.html` se actualizan con cada cambio funcional para que la documentación refleje el estado real de la app.
# Calculadora de Disposición de Área

Aplicación de una sola página (HTML/CSS/JS) para talleres de sublimación o estampado que necesitan saber cuántas piezas caben en una hoja imprimible. Todo corre en el navegador, sin instalaciones, priorizando accesibilidad, contraste y portabilidad.

## Objetivos
- Calcular dos estrategias de distribución:
  - **Modo estricto**: solo colocación alineada a los ejes, sin rotaciones.
  - **Modo optimizado**: permite rotar 90° para maximizar la cantidad de piezas.
- Mostrar 0, 1 o 2 previsualizaciones; la vista optimizada aparece únicamente cuando entrega más piezas. El badge se muestra como `+N piezas (+X%)`, con `X = Math.round(percentGain)`.
- Ofrecer un panel de métricas compacto (filas, columnas, piezas totales, área usada vs. desperdiciada).
- Mantener la experiencia simple: sin cargas de imagen, historiales, exportaciones ni animaciones.
- Incluir temas claro/oscuro con colores que cumplan WCAG y patrones diferenciados para los dos modos.

## Arquitectura
```
index.html             # Estructura semántica (formulario, tema, métricas, vistas)
assets/css/styles.css  # Variables, temas, layout, patrones, estados de foco/validación
assets/js/app.js       # Lógica SPA (estado, cálculos, render, controlador de tema)
```

### Módulos principales (assets/js/app.js)
- `StateStore`: estado central inmutable con entradas, resultados, tema y errores.
- `CalculatorCore`: normaliza unidades, valida dimensiones y calcula ambos modos:
  - Estricto: `cols = floor((sheetWidth - 2*margin + gapX) / (imageWidth + gapX))`; filas análogas, sin rotar.
  - Optimizado: evalúa la disposición estricta, la versión rotada (ancho/alto intercambiados) y heurísticas combinadas; se queda con el mayor conteo.
- `PreviewRenderer`: dibuja la hoja y las piezas a escala mediante SVG, aplicando hatch para estricto y patrón de puntos para optimizado.
- `ThemeController`: ajusta el atributo `[data-theme]`, inicializa desde `localStorage` o `prefers-color-scheme` y expone un switch accesible.

## Formulario
Todos los campos viven en la columna izquierda. Valores por defecto al cargar: hoja A4, margen 5 mm (entero), gaps 3 mm, rotación permitida.

| Campo                  | Tipo / Opciones                                      | Predeterminado | Obligatorio | Notas |
|------------------------|------------------------------------------------------|----------------|-------------|-------|
| Formato de hoja        | select (Carta, Oficio, Tabloide, A4, A3, A3+, Personalizada) | A4 | Sí | Cada preset rellena ancho/alto; solo “Personalizada” permite editarlos. |
| Ancho / Alto de hoja   | Número + selector de unidad (in, cm, mm)             | Desde preset   | Sí | Rangos: 1-40 in, 1-100 cm, 1-1000 mm. Bloqueado salvo preset personalizado. |
| Unidad                 | Control segmentado (radiogrupo)                      | in             | Sí | Cambiar unidad convierte los valores en caliente (mm en enteros, in/cm a décimas). |
| Ancho / Alto de imagen | Número                                               | Vacío          | Sí | Deben ser > 0 y caber dentro del área imprimible. |
| Mantener proporción    | Checkbox                                             | Desactivado    | No | Bloquea la relación al editar ancho/alto. |
| Permitir rotación      | Checkbox                                             | Activado       | Sí | Habilita rotar las piezas 90°. |
| Margen (mm)            | Número entero (paso 1)                               | 5 mm           | Sí | Aplica a los cuatro lados; siempre en milímetros. |
| Espacio horizontal     | Número (mm)                                          | 3 mm           | Sí | Separación entre columnas, >= 0. |
| Espacio vertical       | Número (mm)                                          | 3 mm           | Sí | Separación entre filas, >= 0. |

Las validaciones se ejecutan al cambiar o salir de un campo; los mensajes se anuncian con `aria-live="polite"` y el botón de cálculo se deshabilita si falta información. Las métricas se actualizan de inmediato cuando todo es válido.

## Temas y accesibilidad
- Se usan variables CSS para colores base, superficies, texto, acentos, bordes y patrones. Cada tema sobreescribe este set común.
- La tarjeta estricta usa un hatch diagonal frío; la optimizada usa puntos cálidos. Ambos patrones están calibrados para mantener contraste AA en modos claro/oscuro.
- El switch de tema vive en el encabezado, con `role="switch"` y `aria-checked`. La preferencia se guarda en `localStorage` (`theme`) y se aplica antes del primer render mediante un script inline.
- Todos los controles tienen un área táctil generosa (≥ 11 mm), foco visible y ayudas contextuales; la navegación por teclado está ordenada de arriba hacia abajo.

## Orden sugerido de implementación
1. Armar la estructura HTML y el estilo base (grid, tipografía, formularios, contenedores de preview, tokens de tema).
2. Implementar `ThemeController` y el toggle claro/oscuro.
3. Construir `StateStore`, enlazar eventos del formulario y validar campos.
4. Añadir `CalculatorCore` con los cálculos de ambos modos y la comparación para mostrar solo la vista que aporta.
5. Implementar `PreviewRenderer` con los patrones, el badge `+N (+X%)` y el render condicional.
6. Pulir detalles responsivos, verificar contraste WCAG y repasar accesibilidad (lectores de pantalla, orden de tabulación, mensajes en vivo).
