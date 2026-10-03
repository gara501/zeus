# Zeus y el aprendizaje del rayo — Plan de implementación

Actualizado el 3 de octubre de 2026: campaña de 25 niveles y diferenciación de cajas, bloques y nubes.

## 1. Concepto y decisiones confirmadas

Zeus niño aprende a usar su rayo en Creta. Permanece fijo: el jugador apunta libremente con el ratón. El protagonista es el rayo, sus rebotes, ramificaciones y tiempos de viaje.

- La cuadrícula organiza objetos; no limita los ángulos del rayo.
- Los espejos rotables giran libremente, sin restringirse a dos orientaciones ni pasos angulares.
- Un solo disparo puede estar en curso. Sus ramas viajan simultáneamente en tiempo continuo; no se permite otro disparo hasta que terminen todas las ramas, pulsos y cargas retenidas.
- Munición por nivel: 3 rayos como base; 4 o 5 según la complejidad. Los intentos bloqueados no gastan munición ni se encolan.
- Espejos reflejan; agua conduce y ramifica; metal transporta por redes continuas interconectadas; cristal rotatorio divide; cajas de madera consumen un rayo y abren paso; bloques requieren dos impactos; nubes almacenan y descargan tras un retraso o en ciclos definidos por nivel.
- Tótems normales permanecen activos. Los grupos temporizados exigen activar todos sus miembros dentro de una ventana; si vence, se desactivan todos.
- Se incluyen también tótems de varios golpes y grupos que deben activarse en un orden determinado.
- Las bifurcaciones de metal dividen el pulso por todas las salidas, sin devolverlo por el tramo de entrada.
- Dos ramas que golpean el mismo tótem producen dos impactos independientes.
- «Deshacer» reinicia el nivel entero. No hay historial de acciones.
- Niveles secuenciales: empezar muy fácil, enseñar cada mecánica e incrementar dificultad.
- Todas las mecánicas principales deben estar presentes en la entrega web.
- Al abrirse la puerta aparece un mensaje de victoria y un fundido lleva automáticamente al siguiente nivel. En algunos cambios de nivel se muestra una imagen de Zeus con texto; el autor proporcionará esas imágenes después.

## 2. Jam y entrega

Fuente: https://itch.io/jam/littlejs-jam (consultada el 2 de octubre de 2026).

- LittleJS Jam 3: del 2 de octubre al 2 de noviembre de 2026. Tema: **ZIGZAG**.
- Obligatorio: LittleJS y proyecto HTML gratuito jugable en navegador, embebido en itch.io.
- Se permiten equipos, plugins y assets externos con derechos de uso.
- Puede partirse de un prototipo, pero la mayoría del juego debe completarse durante la jam. Aquí se comienza desde cero.
- No es obligatorio compartir el código fuente; se permiten actualizaciones durante votaciones.
- IA permitida para código, arte y música; la página pide compartir qué herramientas se usaron.
- Registrar herramientas y licencias/atribuciones en créditos.
- Verificar la hora exacta de cierre en itch.io; reservar un día para subida y pruebas del iframe.

El zigzag se expresa en el dibujo dentado y en los cambios reales de trayectoria. No se necesita un modo separado que obligue a alternar diagonales.

## 3. Entorno elegido

**LittleJS + JavaScript con módulos ES + Vite**, con versiones fijadas y lockfile. LittleJS tiene un starter oficial de Vite. Los módulos separan simulación y presentación; Vite ofrece servidor de desarrollo y build estática sin añadir un framework de interfaz.

- Node.js 22.12 o posterior.
- Comandos: `npm install`, `npm run dev`, `npm run build`, `npm run preview`.
- `base: './'` para funcionar en subdirectorios/iframe de itch.io.
- Recarga completa al editar: el HMR parcial puede duplicar canvases, listeners y bucle del motor.
- Assets en `public/`; ningún servicio remoto necesario para jugar.
- ZIP con el contenido de `dist/` e `index.html` en su raíz.
- No se necesita backend ni Box2D para este puzzle.

Referencias: https://github.com/KilledByAPixel/LittleJS/blob/main/FAQ.md y https://vite.dev/guide/.

## 4. Vista y controles

- Cenital 2D, tablero de referencia 15 × 8, casilla de una unidad. Cámara fija y escala adaptable con espacio para HUD.
- Ratón: apuntado libre. Clic en zona libre o Espacio: disparar.
- Espejos con giro libre. Control propuesto: arrastrar desde el espejo para orientar su superficie; consumir ese gesto sin disparar y mostrar el ángulo durante el ajuste.
- R o Z: reiniciar todo, incluidos rayos, relojes, nubes, fases de cristales y objetos destruidos.
- Esc: pausa; congela simulación, ventanas de tótems y tiempo de puntuación.
- Vista previa hasta el primer impacto con la geometría real. No promete trayectorias futuras de objetos móviles.
- Mostrar munición, objetivos y cuenta atrás de grupos temporizados con texto/forma además de color.
- Web para escritorio como entrega base; las reglas consultadas no exigen controles móviles. Táctil como adaptación posterior.

## 5. Simulación del rayo

Se reemplaza el antiguo recorrido completo precalculado de cuatro direcciones por simulación temporal: un cristal cambia de orientación antes del impacto y otra rama del mismo disparo puede alterar el tablero durante el viaje.

- Paso fijo, inicialmente 1/60 s, independiente del renderizado.
- Estado explícito: reloj, objetos, rayos, rutas conductoras, descargas pendientes, munición y objetivos.
- Rayo con identificadores de disparo/rama, posición, dirección unitaria, velocidad, duración y presupuesto de interacciones.
- Colisiones barridas sobre cada segmento recorrido para no atravesar objetos finos.
- Resolver el impacto más próximo dentro del paso; continuar el tiempo sobrante después del rebote.
- Ordenar impactos concurrentes por tiempo e identificador estable. Cambiar el tablero al ocurrir el impacto.
- Una rama posterior encuentra libres los objetos ya destruidos. Dos llegadas reales al tótem cuentan dos impactos, pero el solapamiento continuo de una sola rama no se cuenta repetidamente.
- Evolución pura: `stepSimulation(state, commands, dt) -> { state, events }`; LittleJS adapta entrada y presentación.
- `ray.js` contiene geometría/reflexión puras, sin calcular todo el futuro de objetos dinámicos.
- Eventos con identidad y tiempo: disparo, rebote, conducción, división, quema, ruptura, carga/descarga, tótem y victoria.
- Semilla visual por rama para el zigzag; el dibujo no modifica colisiones.

Seguridad: límite de interacciones y vida por rama, presupuesto de ramas por disparo y protección contra recirculación del mismo pulso en redes. No basta «casilla + dirección» como estado visitado: hay ángulos continuos y objetos dinámicos. Separar ligeramente el rayo de la superficie tras reflejarlo para evitar impactos repetidos espurios.

## 6. Elementos y contratos

| Elemento | Regla |
|---|---|
| Mármol | Absorbe el rayo. |
| Espejo | Reflexión geométrica según su normal; fijo o con giro manual libre. |
| Bloque frágil | Requiere dos impactos; ambos consumen la rama. El siguiente rayo atraviesa la brecha. Resistencia configurable. |
| Agua | Propaga por celdas ortogonales a 8 unidades/s. Emite perpendicularmente por cada borde libre, excepto los bloqueados por mármol. Cada celda se carga una vez por pulso. |
| Metal | Red ortogonal continua a 14 unidades/s. Las bifurcaciones llevan el pulso por todos los ramales. Terminales con dirección configurable; por defecto, salen en dirección opuesta a su único vecino. No devuelve carga por el puerto de entrada. |
| Cristal/hielo | Rama recta más rama reflejada por su superficie giratoria. Ángulo al impacto: `phase + π * tiempo / period`. Periodo de orientación de 12 s en el tutorial, configurable por nivel. |
| Caja de madera | Consume la rama al impacto, se quema y abre paso permanentemente. La animación no retiene ni libera rayos. |
| Nube trampa | Absorbe una rama; no cancela otros rayos. |
| Nube de carga | Una carga por nube. Libera tras `delay` o en el siguiente ciclo de `period`/`phase`, usando el reloj del nivel. Su dirección es configurable. Estando llena absorbe impactos extra. |
| Tótem simple | Un impacto lo activa permanentemente. |
| Tótem de varios golpes | Necesita el número de impactos definido por nivel. Dos ramas que llegan al mismo tótem cuentan como dos impactos. |
| Grupo normal | Miembros activables en distintos momentos, con carga persistente. |
| Grupo ordenado | Sus miembros deben activarse en la secuencia indicada; un error reinicia el grupo y los ya activos se ignoran. Se señala el siguiente objetivo. |
| Grupo temporizado | Primer impacto inicia la ventana; si no se completan todos a tiempo, se desactivan todos y se borran las cargas parciales. El instante exacto del límite es válido. |
| Puerta | Abre al cumplir objetivos y dispara una única secuencia de victoria, mensaje y fundido al siguiente nivel. |

Todas las variantes de tótems de esta tabla forman parte de la entrega. La cantidad de golpes, secuencia y ventana temporal se configura en los datos del nivel.

Propuestas para afinar mediante prototipos, todavía sujetas a revisión:

- La ventana no se extiende al golpear un miembro ya activo. Un impacto justo en el límite cuenta como válido.
- La madera consume el primer rayo. El tiempo pertenece a las nubes: demoras fijas y ciclos con cuenta atrás visible.
- Cristal: periodo y fase inicial reproducibles al reiniciar.
- Bloquear disparos mientras quede actividad del anterior; el HUD indica «Rayo en curso» o «Listo para disparar». Las ventanas de tótems deben permitir completar viajes consecutivos y sus demoras.
- No declarar derrota al gastar la última munición mientras queden rayos o descargas capaces de resolver el nivel.
- Grupos especiales: reglas implementadas en `totems.js`; resolver llegadas simultáneas con el orden determinista de eventos.

## 7. Formato y progresión de niveles

ASCII para ocupación inicial, más metadatos para geometría y tiempo:

```text
# pared, . vacío, Z Zeus, / y \\ espejo fijo,
m espejo rotable, ~ agua, B bloque frágil,
T tótem, D puerta, C nube trampa, N nube de carga,
W madera, = riel, G cristal
```

Metadatos: posiciones, ángulos, redes, puertos, periodos/fases de cristales y nubes, retrasos, resistencia de bloques, grupos, golpes, secuencias, ventanas, munición y tutorial. Las escenas se seleccionan en `cinematics.js` tras 5/10/15 y al finalizar el nivel 25.

Campaña implementada de 25 niveles: 16 lecciones de mecánicas y nueve puzzles de combinación avanzada. Ajustar dificultad tras pruebas con jugadores:

| Nivel | Enseñanza propuesta |
|---|---|
| 1 | Apuntar a un tótem grande. |
| 2 | Rebote en espejo fijo y camino directo bloqueado. |
| 3 | Espejo con giro libre. |
| 4 | Conducción por un canal de agua. |
| 5 | Agua con salidas hacia dos tótems. |
| 6 | Transporte por metal. |
| 7 | Metal interconectado. |
| 8 | Caja: consumir un rayo para abrir paso al siguiente. |
| 9 | Bloque: dos impactos para romper y otro para cruzar. |
| 10 | Combinar madera y bloque. |
| 11 | Cristal rotatorio y momento del disparo. |
| 12 | Nube de carga y retraso. |
| 13 | Tótems persistentes y nube trampa. |
| 14 | Tótem de varios golpes. |
| 15 | Grupo de tótems en orden. |
| 16 | Ventana temporal y disparos consecutivos. |
| 17 | Tres rebotes con dos espejos ajustables. |
| 18 | Caja y cadena de tres espejos. |
| 19 | Nube cíclica y rebote tras la descarga. |
| 20 | Sincronizar la descarga con el cristal rotatorio. |
| 21 | Dos ramas, dos nubes y una ventana de medio segundo. |
| 22 | Reorientar un espejo durante una carga para recibir el rayo de vuelta. |
| 23 | Un espejo distribuidor y tótems ordenados. |
| 24 | Elegir entre tres rebotes inmediatos o una ruta corta con espera cíclica. |
| 25 | Caja, bloque, tres espejos, metal, nube, cristal y ventana de 1,25 s. |

Dividir niveles si hace falta. Cada elemento necesita una demostración clara, práctica fácil y combinación posterior. Ventanas iniciales generosas y tolerancia de puntería razonable.

## 8. Escenas y puntuación

Arranque → intro saltable → título → selección secuencial → nivel → mensaje de victoria → fundido de salida → escena de Zeus opcional → carga del siguiente nivel → fundido de entrada. Último nivel → final → créditos.

- Desbloqueo progresivo y opción de rejugar. Mapa del monte Ida opcional como presentación.
- Al cumplir objetivos, abrir la puerta, registrar estrellas/progreso y mostrar el mensaje de victoria. Avanzar automáticamente después de una breve celebración; no exigir un botón «Siguiente».
- Lanzar esta secuencia una sola vez aunque lleguen más impactos. Congelar la simulación tras resolver la victoria y bloquear disparos/rotación durante la celebración y los fundidos.
- Tras los niveles 5/10/15 se muestran imágenes y narración de Amaltea. La imagen 4 cierra el nivel 25. Un clic completa el texto y el siguiente continúa, con fundidos y simulación congelada.
- El autor generará las imágenes posteriormente. Usar una silueta provisional mientras faltan y separar texto/ruta de imagen en datos para sustituirlas sin modificar la lógica.
- Una estrella por completar; dos por disparos ideales; tres si además cumple tiempo generoso.
- El reloj de puntuación no causa derrota. Las ventanas de tótems sí son mecánicas.
- Pausa y transiciones congelan relojes. Reinicio restablece el intento.
- `localStorage` versionado para progreso/récords/volumen, con fallback si no está disponible.

## 9. Arte, sonido y transiciones

English release: all game text, narration, level names, hints, feedback, accessibility labels, README and distributed credits are now in English. Title buttons use equal dimensions and typography. Mirror scale is 0.62 (about 27% smaller than 0.85); sprite rendering, collision segments and drag radius share that scale. Rotatable mirrors use a blue accent and rotation ring; fixed mirrors retain bronze. The 25 serial solutions pass at 30, 60 and 120 Hz with the smaller mirrors.

Música integrada: `src/music/1.mp3` en niveles 1–16 y `src/music/2.mp3` desde el 17. Bucle, volumen máximo 4 %, atenuación inmediata a 0,8 % durante efectos y recuperación gradual. Se pausa en menús, escenas, pausa y pestaña oculta. Controles independientes de música y efectos; preferencia de música guardada como `musicMuted`. Créditos de OpenMindAudio (1.mp3) y Tunetank (2.mp3), de Pixabay, en README y créditos distribuidos. `scripts/music-check.cjs` verifica reproducción, límites de niveles, persistencia y niveles RMS decodificados frente al disparo.

Escenas añadidas: `intro.png` abre una partida desde el nivel 1 con Amaltea explicando el objetivo de encender los tótems y preparar a Zeus para su futuro. `ready.png` aparece tras superar el nivel 16, antes del nivel 17, para anunciar el entrenamiento avanzado. Ambas usan narración progresiva y continuación explícita; las imágenes se precargan y la simulación permanece congelada.

Selección de campaña: el HUD muestra solo el nivel actual. Después de la primera victoria aparece «Niveles» en el inicio, con una matriz de 25 lecciones, estrellas y estados de desbloqueo. Los niveles superados se pueden repetir y cada victoria habilita el siguiente. «Continuar» abre la primera lección pendiente y «Inicio» regresa al título conservando las estrellas. Validación del flujo real y persistencia en `scripts/progression-check.cjs`.

UI integrada: Mana Soul GUI (CC0), con marcos y botones de bronce mediante filtros CSS, paneles de pergamino y retrato de Zeus. Cinzel y Pixelify Sans están incluidas localmente, junto con sus licencias SIL OFL. HUD compacto con iconos y 3–5 cargas visibles; fondo exterior de cueva vectorial con columnas y luz azul tenue. Pantalla de título, carga con reintento y cuatro escenas de Amaltea: tras niveles 5/10/15 y final de la campaña de 25 niveles. Créditos en `CREDITS.md`; la build incluye créditos y licencias en `public/`.

- Formas básicas y render separado para sustituir por sprites. Paleta única: terracota, mármol, bronce, azul y dorado.
- Integrados los sprites proporcionados por el autor: suelos, muros y puerta del tileset; Zeus animado en reposo, lanzamiento, victoria y derrota. Recortes/pivotes en `sprites.js`, hojas originales intactas, precarga LittleJS y empaquetado Vite. Amaltea y Ateos reservados para escenas posteriores.
- Integradas también las hojas de tótem, madera, metal y nubes: carga eléctrica, destrucción durante la demora, conexiones metálicas según la red real y nubes claras/oscuras animadas. Se conservan contadores de impactos, orden, cuentas atrás y flechas de salida.
- Orden de dibujo: suelo, objetos, rayos, partículas e interfaz.
- Rayo con halo dorado y núcleo claro. Chispas, vapor, escombros, brasas, señales de carga y pulsos de tótems.
- ZzFX/LittleJS para sonidos de acciones, impactos y resultado. Música con derechos de uso y atribuciones.
- Volúmenes separados, silencio e inicio de audio tras primer gesto.
- Intro saltable de 20–30 s: cueva de Creta, Amaltea, chispas y título.
- Escenas intermedias de Zeus con imagen y texto configurables por nivel. Precargar imágenes disponibles; si falta una, conservar texto y silueta provisional sin bloquear el avance.
- Fundidos, iris y barrido de rayo; bloquear entrada durante transición y reiniciar rápido.
- Sacudida/destellos moderados y opción de reducir efectos.
- Si hay pausa de impacto, congelar toda simulación y puntuación: no alterar ventanas injustamente.

## 10. Arquitectura

```text
src/
  main.js        # motor, entrada y render
  config.js      # constantes/paleta
  simulation.js  # estado temporal y eventos
  ray.js         # geometría y reflexión
  grid.js        # ASCII y consultas espaciales
  entities.js    # reglas de elementos
  scenes.js      # escenas/transiciones
  levels.js      # niveles/metadatos
  fx.js          # partículas/rayo visual
  audio.js       # sonidos/música
  ui.js          # HUD/menús
  save.js        # persistencia
```

Crear módulos cuando exista su responsabilidad, sin archivos vacíos. Estado actual: 25 niveles completos, incluyendo agua, metal, madera, bloques, cristal rotatorio, nubes y tótems de varios impactos, ordenados y temporizados (`totems.js`). Simulación pura con colisiones barridas, ramas concurrentes de un único disparo, pulsos conductores y liberaciones temporizadas, pausa/reinicio, guardado de estrellas, sonidos/partículas, victoria automática con fundidos y escenas intermedias. Los niveles 17–25 de combinación avanzada y el desafío final están implementados.

`conduction.js` construye las redes, programa la llegada a cada celda y libera las ramas por sus salidas. Cada pulso visita una celda una vez; una rama que vuelve a una red visitada por su linaje se absorbe. Otros disparos sí pueden recargarla. Presupuesto inicial: 128 ramas por disparo. Pausa y reinicio incluyen todas las llegadas pendientes.

## 11. Calendario

- **2–8 de octubre:** entorno, geometría continua, apuntado, rayos concurrentes, paredes, espejos, tótem, pausa y reinicio. Hito: primer puzzle resuelto.
- **9–15 de octubre:** agua, metal ramificado, madera/bloque, cristal, nubes y variantes de tótems: varios golpes, ordenados y temporizados. Hito: prueba verificable por mecánica.
- **16–22 de octubre:** secuencia de niveles, tutoriales, progreso, estrellas, guardado, victoria automática con fundidos, escenas de Zeus y efectos/audio iniciales. Hito: recorrido completo con todas las mecánicas.
- **23–30 de octubre:** dificultad con jugadores externos, arte, mezcla, intro/créditos, navegadores y tamaños. Congelar reglas nuevas.
- **31 de octubre–1 de noviembre:** ZIP, subida y pruebas en iframe. 2 de noviembre como margen, sujeto a la hora exacta de cierre.

Si aprieta el tiempo, reducir decoración del mapa, intro, variantes visuales y niveles redundantes. Mantener las mecánicas solicitadas y suficiente enseñanza.

## 12. Validación y riesgos

- Geometría: ángulos arbitrarios, impactos rasantes y objetos finos sin tunneling.
- Tiempo: orientación al impacto, demoras y límites de ventanas.
- Concurrencia: dos ramas, dos eventos; destrucción visible para llegadas posteriores.
- Reinicio/pausa: no sobreviven descargas anteriores, restaurar fases/relojes, nada avanza en pausa.
- Redes: bifurcaciones, ciclos y presupuestos sin explosión de rayos.
- Tótems: conteo de golpes, secuencia correcta/incorrecta y llegadas simultáneas.
- Flujo: una sola victoria, guardado antes del avance, escenas opcionales con/sin imagen y último nivel hacia final/créditos.
- Solución reproducible de cada nivel, con tolerancias humanas de ángulo y tiempo.
- Dificultad independiente del framerate y sin precisión de un solo píxel.
- Probar build real embebida en itch.io, no solo desarrollo local.

## 13. Parámetros para concretar en los prototipos

Las decisiones principales de alcance y flujo están confirmadas. Las propuestas de control y equilibrio de este documento no se presentan como decisiones explícitas del autor.

1. Ajustar velocidades, presupuesto de redes, periodos del cristal y retrasos de nubes mediante pruebas de juego. Los contratos iniciales de estas mecánicas ya están implementados arriba.
2. Reglas implementadas: un error reinicia solo el grupo ordenado; impactos sobre miembros activos se ignoran. El límite de una ventana acepta impactos en el instante exacto; su expiración borra también cargas parciales.
3. Velocidad del rayo, demoras y ciclos de nubes, enfriamiento y tolerancias de puntería.
4. Duración de celebración/fundidos y niveles concretos con escena de Zeus; textos e imágenes se integrarán desde datos.
