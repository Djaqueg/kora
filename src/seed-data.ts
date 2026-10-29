import type { HighlightColor } from './types';

export interface SeedChapter {
  title: string;
  paragraphs: string[];
}

export interface SeedHighlight {
  chapter: number;
  text: string;
  note: string;
  color: HighlightColor;
}

export interface SeedCapsule {
  chapter: number;
  title: string;
  idea: string;
  practice: string;
  quote?: string;
}

export interface SeedCard {
  chapter: number;
  front: string;
  back: string;
  dueInDays: number;
}

export interface SeedQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SeedBook {
  id: string;
  title: string;
  author: string;
  format: 'EPUB' | 'TXT' | 'MD';
  hue: number;
  summary: string;
  chapterIndex: number;
  scrollRatio: number;
  chapters: SeedChapter[];
  highlights: SeedHighlight[];
  capsules: SeedCapsule[];
  cards: SeedCard[];
  quiz: SeedQuiz[];
}

const GARDEN = 'Es un jardín que se cultiva con límites.';
const ONE = 'Intentar atender a todo es una forma elegante de no atender a nada.';
const DOORS = 'Cada puerta abierta es una promesa de volver.';
const THREAD = 'Perder el hilo no es una falta de carácter.';
const LOSE = 'Empieza por aceptar que elegir es perder.';
const CRITERIA = 'Una lista larga de pros y contras suele esconder que no tenemos criterios.';
const WAIT = 'Esperar parece gratis porque no firmas nada.';
const REVIEW = 'Revisar una decisión no es reabrirla cada hora.';
const FORGET = 'Olvidar no es un defecto de tu disciplina.';
const RECALL = 'Releer produce familiaridad. Recuperar produce memoria.';
const CARD = 'Una ficha mínima tiene dos caras limpias.';
const CAL = 'La memoria necesita calendario más que intensidad.';

export const starterBooks: SeedBook[] = [
  {
    id: 'seed-atencion',
    title: 'Semillas de atención',
    author: 'Clara Vidal',
    format: 'MD',
    hue: 168,
    summary:
      'La atención no se fuerza: se cultiva con límites. Clara Vidal propone nombrar el ruido antes de leer, elegir una sola pregunta por sesión, cerrar cada capítulo con tres frases y volver al texto sin culpa. El libro convierte la lectura profunda en un ritual breve y repetible.',
    chapterIndex: 1,
    scrollRatio: 0.35,
    chapters: [
      {
        title: 'El jardín y el ruido',
        paragraphs: [
          `La atención no es un foco que se enciende con fuerza de voluntad. ${GARDEN} Cuando tratamos de leer entre notificaciones, pestañas abiertas y una lista mental de pendientes, no estamos fallando como personas: estamos pidiendo a un sistema frágil que trabaje en un terreno lleno de piedras.`,
          'El ruido digital parece pequeño porque cada interrupción dura apenas un segundo. El coste real no está en ese segundo, sino en el tiempo que tarda la mente en reconstruir el hilo. Un capítulo no se entiende por la suma de sus frases, sino por la relación que aparece cuando las frases se sostienen juntas el tiempo suficiente.',
          'Por eso la primera práctica de este libro es modesta: antes de leer, nombra el ruido que vas a dejar fuera. No hace falta una vida monástica. Hace falta una puerta. Puede ser el modo avión durante veinticinco minutos, una libreta donde anotas lo que te preocupa para no cargarlo en la cabeza, o la decisión de leer junto a la ventana si la silla de siempre ya está asociada al cansancio.',
          'Observa también el ruido interno. A veces la frase que leemos compite con una conversación que no hemos tenido. Si esa conversación insiste, escríbela en una línea y vuelve al párrafo. Externalizar no resuelve la vida, pero devuelve el terreno al texto.',
          'La atención profunda no se presume. Se nota en un signo sencillo: puedes decir, al cerrar el capítulo, qué idea te llevas y qué idea dejas. Si no puedes decirlo, no leíste de más. Leíste sin cerca.',
        ],
      },
      {
        title: 'Un solo objeto',
        paragraphs: [
          `${ONE} El lector que subraya cada línea termina con un libro amarillo y ninguna jerarquía. El lector que elige una pregunta antes de abrir el capítulo tiene un imán: las frases que no responden a esa pregunta pueden pasar, y las que sí responden se vuelven visibles.`,
          'Elige un objeto de atención por sesión. Puede ser una pregunta —qué propone la autora que yo haga distinto mañana— o un contraste —dónde este capítulo discute con lo que yo ya creía—. Escríbela en el margen o en una nota de Kora. Esa frase es tu cerca.',
          'Cuando una idea importante aparezca, no la copies entera por reflejo. Reduce. Una buena nota cabe en dos líneas: la afirmación y la razón. Si necesitas un párrafo, todavía no entendiste qué querías conservar. La reducción no empobrece el libro; revela si el libro tenía un centro.',
          'Hay un ejercicio breve que vale más que una hora de relectura. Al terminar la sección, cierra la pantalla y explica la idea en voz alta como si se la contaras a alguien que llega tarde. Las lagunas que aparecen en esa explicación son el mapa de lo que aún no es tuyo. Vuelve solo a esas lagunas, no al capítulo entero.',
          'Un solo objeto también protege el descanso. Cuando la sesión termina, el objeto se cierra. No arrastres el capítulo a la comida, al mensaje ni al paseo. La atención se renueva porque se le permite terminar.',
        ],
      },
      {
        title: 'Cerrar las puertas',
        paragraphs: [
          `${DOORS} El cerebro mantiene esas promesas en un segundo plano caro. Por eso cinco tareas a medias cansan más que una tarea terminada, aunque la tarea terminada haya sido más difícil. Leer con tres libros empezados y ninguno acompañado de notas es abrir tres puertas y cruzar ninguna.`,
          'Cerrar una puerta puede ser pequeño: terminar el apartado, escribir la idea clave y marcar el punto exacto donde regresarás. Un marcador no es una derrota. Es un contrato. Le dices a tu atención futura que no tendrá que reconstruir el contexto desde cero.',
          'Diseña un ritual de cierre de dos minutos. Primera frase: qué comprendí. Segunda frase: qué haré con ello o por qué decido no hacer nada todavía. Tercera: dónde retomo. Ese trío convierte la lectura en un ciclo completo. Sin cierre, la lectura se siente infinita y, por eso mismo, fácil de posponer.',
          'También se cierran puertas físicas. El teléfono en otra habitación no es un truco de moda: es reconocer que la atención humana pierde contra un dispositivo diseñado para interrumpir. Si no puedes alejarlo, apaga las insignias durante la sesión y acepta que el resultado será más frágil. La honestidad sobre tus condiciones vale más que un método perfecto que no vas a cumplir.',
          'Cuando una puerta no se puede cerrar —una urgencia real, un cuidado, un plazo— no finjas lectura profunda. Lee en modo exploración, toma una sola cita y deja el resto para un día con terreno más limpio. Forzar la profundidad en malas condiciones enseña a odiar el libro.',
        ],
      },
      {
        title: 'Volver sin culpa',
        paragraphs: [
          `${THREAD} Es lo que hace un sistema nervioso rodeado de reclamos. La diferencia entre quien cultiva atención y quien solo se exige está en la velocidad y la amabilidad con que se vuelve. La culpa es una segunda interrupción: primero dejaste el texto y después te castigaste por haberlo dejado.`,
          'El regreso se diseña. Deja siempre una frase de reentrada escrita por ti, no solo el subrayado del autor. «Volver aquí: la autora compara la atención con un jardín y propone nombrar el ruido antes de leer.» Esa nota es un puente. El subrayado ajeno, sin tu frase, obliga a reconstruir el porqué.',
          'Si faltaste varios días, no empieces por el principio por ansiedad. Lee tu última nota, lee el párrafo siguiente y continúa. El principio seguirá ahí si de verdad lo necesitas. Releer todo como castigo es una manera de no avanzar nunca hacia el capítulo que todavía no conoces.',
          'Cuenta los regresos, no solo las rachas perfectas. Una racha premia la continuidad, pero el aprendizaje premia el retorno. Cada vez que vuelves, el texto se encuentra con una persona ligeramente distinta. Esa diferencia es útil: lo que ayer parecía obvio hoy puede revelar un matiz, y lo que ayer era opaco hoy puede caber en una frase.',
          'La atención, al final, no se guarda como un trofeo. Se practica como quien riega. Un poco, con límite, y otra vez mañana. Si el jardín se secó un día, se vuelve a regar. No se arranca.',
        ],
      },
    ],
    highlights: [
      { chapter: 0, text: GARDEN, note: 'La atención se diseña con cercas, no con culpa.', color: 'yellow' },
      { chapter: 1, text: ONE, note: 'Una pregunta previa evita el libro completamente amarillo.', color: 'blue' },
      { chapter: 2, text: DOORS, note: 'Cerrar es dejar una frase de reentrada.', color: 'green' },
    ],
    capsules: [
      {
        chapter: 0,
        title: 'Un jardín con límites',
        idea: 'La atención no se enciende a la fuerza. Se cultiva cuando pones un límite claro al ruido de fuera y al ruido de dentro, y dejas que las frases permanezcan juntas el tiempo suficiente.',
        practice: 'Antes de tu próxima lectura, escribe el ruido que dejarás fuera y pon un temporizador de veinticinco minutos.',
        quote: GARDEN,
      },
      {
        chapter: 0,
        title: 'El coste está en el hilo',
        idea: 'El segundo de la notificación no es el coste real. El coste es el tiempo que tardas en reconstruir la relación entre las frases que estabas sosteniendo.',
        practice: 'Cuando te interrumpan hoy, anota una palabra-puente antes de salir del texto y úsala para volver.',
        quote: 'Un capítulo no se entiende por la suma de sus frases, sino por la relación que aparece cuando las frases se sostienen juntas el tiempo suficiente.',
      },
      {
        chapter: 1,
        title: 'Una sola pregunta',
        idea: 'Elegir un objeto de atención —una pregunta o un contraste— hace visibles las frases que importan y deja pasar el resto sin convertir el libro en un bloque amarillo.',
        practice: 'Escribe una pregunta en una nota antes de abrir el siguiente capítulo y subraya solo lo que la responde.',
        quote: ONE,
      },
      {
        chapter: 2,
        title: 'Cierra con tres frases',
        idea: 'Cada tarea a medias es una promesa que la cabeza sigue pagando. Cerrar la lectura es decir qué comprendiste, qué harás con ello y dónde retomas.',
        practice: 'Al terminar esta sesión, completa esas tres frases en dos minutos. No abras otro libro antes.',
        quote: DOORS,
      },
      {
        chapter: 3,
        title: 'Vuelve sin castigo',
        idea: 'Perder el hilo es normal. La culpa es una segunda interrupción. Se regresa desde la última nota propia y el párrafo siguiente, no desde el principio como penitencia.',
        practice: 'Deja escrita hoy tu frase de reentrada: «Volver aquí…». Mañana empieza por ella.',
        quote: THREAD,
      },
    ],
    cards: [
      { chapter: 0, front: '¿Con qué imagen describe Vidal la atención, y qué consecuencia tiene?', back: 'Con un jardín que se cultiva con límites. La atención se diseña poniendo cercas al ruido, no exigiéndose más fuerza de voluntad.', dueInDays: 0 },
      { chapter: 0, front: '¿Dónde está el coste real de una interrupción breve?', back: 'En el tiempo que tarda la mente en reconstruir el hilo, no en el segundo de la notificación.', dueInDays: 0 },
      { chapter: 1, front: '¿Qué es un objeto de atención?', back: 'Una pregunta o un contraste elegido antes de leer, que actúa como imán y evita subrayarlo todo.', dueInDays: 0 },
      { chapter: 2, front: '¿Cuáles son las tres frases del ritual de cierre?', back: 'Qué comprendí, qué haré con ello (o por qué no haré nada todavía) y dónde retomo.', dueInDays: 0 },
      { chapter: 3, front: '¿Por qué no conviene releer el libro entero tras varios días de pausa?', back: 'Releer todo como castigo impide avanzar. Se vuelve desde la última nota y el párrafo siguiente.', dueInDays: 5 },
      { chapter: 3, front: '¿Qué diferencia una frase de reentrada de un subrayado ajeno?', back: 'La frase de reentrada la escribes tú y conserva el porqué. El subrayado solo, sin tu frase, obliga a reconstruir el contexto.', dueInDays: 6 },
    ],
    quiz: [
      {
        question: 'Según el primer capítulo, ¿qué es la atención?',
        options: [
          'Un jardín que se cultiva con límites',
          'Un músculo que solo crece con esfuerzo máximo',
          'Una lámpara que conviene dejar encendida todo el día',
          'Un archivo que debería guardar cada párrafo',
        ],
        correctIndex: 0,
        explanation: 'Vidal dice que la atención no es un foco de voluntad, sino un jardín que se cultiva con límites.',
      },
      {
        question: '¿Para qué sirve elegir un solo objeto de atención?',
        options: [
          'Para leer tres libros a la vez y compararlos',
          'Para que las frases relevantes se vuelvan visibles y el resto pueda pasar',
          'Para subrayar todas las oraciones del capítulo',
          'Para mantener el teléfono cerca por si surge otra idea',
        ],
        correctIndex: 1,
        explanation: 'Intentar atender a todo es una forma de no atender a nada. Una pregunta previa actúa como imán.',
      },
      {
        question: '¿Qué incluye el ritual de cierre?',
        options: [
          'Copiar el capítulo entero en una nota',
          'Qué comprendí, qué haré con ello y dónde retomo',
          'Contar las páginas leídas y publicar el número',
          'Borrar los subrayados para empezar limpio',
        ],
        correctIndex: 1,
        explanation: 'El cierre de dos minutos son tres frases: comprensión, acción o pausa consciente, y punto de regreso.',
      },
      {
        question: '¿Cómo propone el libro volver después de perder el hilo?',
        options: [
          'Empezar siempre desde la primera página, como castigo',
          'Esperar a tener un día perfecto',
          'Leer la última nota propia y seguir en el párrafo siguiente',
          'Cambiar de libro para no repetir el fallo',
        ],
        correctIndex: 2,
        explanation: 'Perder el hilo no es una falta de carácter. El regreso se diseña con una frase de reentrada.',
      },
    ],
  },
  {
    id: 'seed-decisiones',
    title: 'El cuaderno de las decisiones',
    author: 'Martín Soler',
    format: 'TXT',
    hue: 28,
    summary:
      'Decidir bien empieza por aceptar la pérdida y escribir una frase con borde. Soler pide criterios observables antes que listas de pros y contras, pone precio a la espera y separa la revisión honesta de la rumiación. El cuaderno hace visible la opción por defecto que actúa cuando no eliges.',
    chapterIndex: 2,
    scrollRatio: 0.2,
    chapters: [
      {
        title: 'Elegir es perder',
        paragraphs: [
          `Decidir bien no empieza por reunir más opciones. ${LOSE} Cada sí es un racimo de noes: el tiempo que no usarás, la persona que no acompañarás, el proyecto que quedará en el cuaderno. Quien quiere una decisión sin pérdida no busca claridad. Busca una garantía que no existe.`,
          'El cuaderno de decisiones sirve para hacer visible esa pérdida antes de que la vida la cobre por sorpresa. En la página izquierda se escribe la opción que estás a punto de tomar. En la página derecha, tres cosas que esa opción cierra. Si no puedes nombrar las tres, todavía no entiendes la decisión: solo sientes su atractivo.',
          'Hay decisiones reversibles y decisiones que dejan marca. Confundirlas produce dos errores opuestos. Tratamos como definitivas elecciones que podríamos probar en una semana —un horario, una herramienta, un formato de estudio— y tratamos como ensayos elecciones que mueven una relación, un contrato o la salud. Pregunta siempre: si esto sale mal, ¿puedo volver en siete días sin un daño serio?',
          'Si la respuesta es sí, decide más rápido y evalúa con datos. Si la respuesta es no, baja la velocidad y sube el cuidado. Una decisión clara cabe en una frase que otra persona podría leer sin preguntarte qué quisiste decir. «Voy a leer veinticinco minutos cada mañana antes de abrir el correo, de lunes a viernes, durante dos semanas.»',
          'Compara esa frase con «voy a ponerme más en serio con la lectura». La segunda no es una decisión. Es un deseo sin borde. Escribir la frase no la hace fácil. La hace discutible. Y solo lo discutible se puede mejorar.',
        ],
      },
      {
        title: 'Criterios antes que listas',
        paragraphs: [
          `${CRITERIA} El pro «me gusta» y el contra «me da pereza» no pesan lo mismo en todas las decisiones, pero en la lista parecen hermanos. Antes de comparar opciones, escribe de tres a cinco criterios y dales peso. Sin peso, el criterio es un adorno.`,
          'Los criterios útiles son observables. «Que me haga crecer» es difícil de falsar. «Que me permita practicar una habilidad que usaré en los próximos tres meses» se puede comprobar. «Que sea barato» depende del presupuesto real, no del ánimo del día. Si un criterio no cambia ninguna opción cuando lo aplicas con honestidad, sobra.',
          'Cuidado con el criterio fantasma: aquel que no escribes porque te avergüenza y que, en silencio, decide por ti. Puede ser el deseo de no decepcionar a alguien, el miedo a parecer principiante o la necesidad de que la elección se vea impresionante. Sácalo al cuaderno. Un criterio dicho se puede negociar. Un criterio oculto solo se disfraza de racionalidad.',
          'Cuando dos opciones empatan en los criterios importantes, elige la que sea más fácil de revertir o la que te dé información antes. El empate no se rompe con más rumiación. Se rompe con una regla previa: si empatan, elijo la más pequeña y la reviso el viernes. Esa regla, escrita antes del empate, te salva de la tarde perdida en círculos.',
          'Los criterios también protegen a los demás. Si decides en familia o en equipo, un criterio compartido evita que gane la persona que habla con más seguridad. La seguridad no es un argumento. El criterio sí.',
        ],
      },
      {
        title: 'El coste de esperar',
        paragraphs: [
          `${WAIT} No lo es. Cada día sin decisión es un día en el que una opción por defecto —seguir igual— actúa en tu nombre. La cama sin hacer, el curso sin empezar, la conversación sin tener y el libro sin notas son decisiones tomadas por omisión. El cuaderno las anota para que dejen de ser invisibles.`,
          'Calcula el coste de esperar en una unidad concreta: horas, dinero, confianza o energía. «Si pospongo esta conversación una semana, tendré cinco cenas incómodas y una historia más difícil de contar.» Esa frase duele, y por eso sirve. El coste abstracto —«luego será peor»— se aplaza con facilidad. El coste contado, no tanto.',
          'Hay esperas sabias. Esperar un dato que cambia la decisión es prudencia. Esperar porque temes la sensación de haber elegido es evitación. Distínguelas con una pregunta: ¿qué información nueva, real, espero recibir? Si no hay respuesta, no estás esperando. Estás escondido.',
          'Pon fecha a la espera. Una espera sin fecha es una estantería. «Decido el jueves a las 18:00 con la información que tenga entonces» devuelve el mando al calendario. Cuando llegue la hora, decide con lo que hay. La información perfecta es un lujo que la mayoría de las vidas no entregan.',
          'También se puede decidir no decidir, y eso cuenta si lo escribes. «Durante este mes no cambio de trabajo; reviso la decisión el día 1.» Esa frase cierra la puerta mental que se abría cada noche. A veces la mejor decisión es proteger tu atención de una pregunta que todavía no toca responder.',
        ],
      },
      {
        title: 'Revisar sin rumiar',
        paragraphs: [
          `${REVIEW} Es comparar lo que esperabas con lo que ocurrió, en un momento acordado, y ajustar. Sin revisión, repetimos errores con buena memoria para las excusas. Con rumiación, cambiamos de rumbo antes de haber aprendido nada.`,
          'El ritual de revisión cabe en media página. Qué decidí, en una frase. Qué esperaba que pasara. Qué pasó en hechos, no en interpretaciones. Qué criterio funcionó y cuál me engañó. Qué haré distinto la próxima vez. Cinco líneas. Si escribes más, corres el riesgo de convertir la revisión en un juicio a tu persona.',
          'No revises solo los fracasos. Una decisión que salió bien por casualidad es peligrosa: te enseña el hábito equivocado. Pregunta también si funcionó por las razones que creíste. Si estudiaste mejor porque dormiste, no porque compraste otra libreta, anótalo. El mérito mal atribuido fabrica compras inútiles y métodos hinchados.',
          'Cuando la revisión muestre que te equivocaste, corrige el rumbo sin teatro. Una decisión reversible se cambia. Una decisión irreversible se acompaña: se mitiga el daño, se pide disculpa si hace falta y se extrae el criterio que faltó. Castigarte no mejora el criterio. Nombrar el criterio que faltó, sí.',
          'Guarda las revisiones juntas. Al cabo de un mes verás un patrón: quizá sobrevaloras la novedad, quizá decides mejor por la mañana, quizá dices que algo es irreversible cuando solo te da vergüenza cambiar. Ese patrón vale más que cualquier frase motivacional. Es tu manual, escrito por tus propios hechos.',
        ],
      },
    ],
    highlights: [
      { chapter: 0, text: LOSE, note: 'En la página derecha anoto tres cosas que esta opción cierra.', color: 'rose' },
      { chapter: 1, text: CRITERIA, note: 'Primero el peso del criterio, después las opciones.', color: 'blue' },
      { chapter: 2, text: WAIT, note: 'Mientras no elijo, seguir igual decide por mí.', color: 'yellow' },
    ],
    capsules: [
      {
        chapter: 0,
        title: 'Elegir es perder',
        idea: 'Toda decisión cierra caminos. Si no puedes nombrar tres pérdidas concretas, todavía no entiendes la opción: solo sientes su atractivo.',
        practice: 'Escribe hoy una decisión pendiente y, al lado, tres cosas que esa opción cierra.',
        quote: LOSE,
      },
      {
        chapter: 0,
        title: 'Una frase con borde',
        idea: 'Una decisión clara cabe en una frase que otra persona entendería sin preguntar. Un deseo sin plazo ni conducta no se puede mejorar porque no se puede discutir.',
        practice: 'Reescribe «voy a ponerme en serio» como una conducta, un horario y una fecha de revisión.',
        quote: 'La segunda no es una decisión. Es un deseo sin borde.',
      },
      {
        chapter: 1,
        title: 'Criterios con peso',
        idea: 'La lista de pros y contras esconde la falta de criterios. Tres a cinco criterios observables, con peso, cambian la comparación; un criterio que no descarta nada sobra.',
        practice: 'Antes de la próxima lista, escribe los criterios y tacha el que no cambiaría ninguna opción.',
        quote: CRITERIA,
      },
      {
        chapter: 2,
        title: 'La opción por defecto',
        idea: 'Esperar no es gratis. Mientras no decides, seguir igual decide por ti. La espera sabia nombra el dato que falta; la evitación no puede decir qué información nueva espera.',
        practice: 'Pon fecha y hora a una espera abierta. Si no hay un dato real pendiente, decide con lo que ya sabes.',
        quote: WAIT,
      },
      {
        chapter: 3,
        title: 'Cinco líneas, no un juicio',
        idea: 'Revisar es comparar lo esperado con los hechos en un momento acordado. Rumiar reabre la decisión cada hora. Cinco líneas bastan, y también hay que revisar lo que salió bien por casualidad.',
        practice: 'Agenda una revisión de quince minutos y responde solo: qué decidí, qué esperaba, qué pasó, qué criterio falló y qué cambiaré.',
        quote: REVIEW,
      },
    ],
    cards: [
      { chapter: 0, front: '¿Por qué dice Soler que elegir es perder?', back: 'Porque cada sí cierra otras opciones. Nombrar tres cierres demuestra que entiendes la decisión y no solo su atractivo.', dueInDays: 0 },
      { chapter: 0, front: '¿Cómo distinguir una decisión reversible?', back: 'Pregunta si, si sale mal, puedes volver en siete días sin un daño serio. Si sí, decide más rápido. Si no, baja la velocidad.', dueInDays: 0 },
      { chapter: 1, front: '¿Qué hace útil a un criterio?', back: 'Que sea observable y tenga peso. Si al aplicarlo con honestidad no cambia ninguna opción, sobra.', dueInDays: 0 },
      { chapter: 1, front: '¿Qué es un criterio fantasma?', back: 'Un motivo que no escribes porque te avergüenza —quedar bien, no parecer principiante— y que decide en silencio.', dueInDays: 4 },
      { chapter: 2, front: '¿Qué decisión toma la espera?', back: 'La opción por defecto: seguir igual. Esperar solo es prudente si hay un dato real que cambiaría la elección.', dueInDays: 0 },
      { chapter: 3, front: '¿En qué se diferencia revisar de rumiar?', back: 'Revisar compara hechos con lo esperado en un momento acordado y en cinco líneas. Rumiar reabre la decisión antes de aprender.', dueInDays: 5 },
    ],
    quiz: [
      {
        question: '¿Por dónde empieza, según Soler, una buena decisión?',
        options: [
          'Por reunir el mayor número posible de opciones',
          'Por aceptar que elegir es perder y nombrar lo que se cierra',
          'Por esperar a tener información perfecta',
          'Por copiar la elección de quien habla con más seguridad',
        ],
        correctIndex: 1,
        explanation: 'Decidir bien no empieza por más opciones. Empieza por aceptar que elegir es perder.',
      },
      {
        question: '¿Qué problema tiene una lista larga de pros y contras?',
        options: [
          'Ocupa demasiado papel',
          'Suele esconder que no tenemos criterios con peso',
          'Solo sirve para decisiones irreversibles',
          'Impide escribir la opción en una frase',
        ],
        correctIndex: 1,
        explanation: 'Sin criterios observables y con peso, «me gusta» y «me da pereza» parecen equivalentes.',
      },
      {
        question: '¿Cuándo esperar es prudencia y no evitación?',
        options: [
          'Cuando temes la sensación de haber elegido',
          'Cuando no quieres decepcionar a nadie',
          'Cuando hay un dato real que cambiaría la decisión y una fecha para resolver',
          'Cuando la espera no tiene fecha y así no duele',
        ],
        correctIndex: 2,
        explanation: 'Esperar un dato que cambia la decisión es prudencia. Esperar sin poder nombrar ese dato es esconderse.',
      },
      {
        question: '¿Qué conviene revisar además de los fracasos?',
        options: [
          'Solo el estado de ánimo del día',
          'Las decisiones que salieron bien, para ver si fue por las razones que creíste',
          'La lista completa de opciones descartadas cada hora',
          'Nada: si salió bien, el criterio ya está probado',
        ],
        correctIndex: 1,
        explanation: 'Un acierto por casualidad enseña el hábito equivocado. Hay que preguntar si funcionó por las razones previstas.',
      },
    ],
  },
  {
    id: 'seed-memoria',
    title: 'Memoria viva',
    author: 'Elena Rivas',
    format: 'EPUB',
    hue: 214,
    summary:
      'Olvidar es el estado natural de una memoria que necesita pasillos. Elena Rivas distingue reconocimiento y recuerdo, pide recuperar en vez de releer, reduce cada idea a una ficha mínima y entrega el repaso a un calendario honesto. La memoria viva no es un porcentaje: es la idea que llega a tiempo a una conversación o a una decisión.',
    chapterIndex: 0,
    scrollRatio: 0.15,
    chapters: [
      {
        title: 'Olvidar es natural',
        paragraphs: [
          `${FORGET} Es el estado natural de una memoria que debe dejar sitio. Si recordaras con la misma fuerza cada párrafo que has leído, no podrías pensar: vivirías dentro de un almacén sin pasillos. El problema no es que olvides. El problema es que confías en un reencuentro mágico con el libro en lugar de diseñar el recuerdo que quieres conservar.`,
          'La curva es generosa al principio y cruel después. Horas después de leer, crees que la idea está a salvo porque la reconoces al pasar la vista. El reconocimiento no es recuerdo. El recuerdo es poder traer la idea sin verla, usarla en un ejemplo nuevo y decirla con palabras que el autor no usó. Si solo puedes asentir al releer, todavía no es tuya.',
          'Por eso este libro propone una memoria pequeña y viva, no un archivo total. De cada capítulo no saldrán veinte tesoros. Saldrán una, dos o tres ideas que merecen una cita futura. El resto puede quedar en el libro, donde siempre estuvo. Querer guardarlo todo es la forma más segura de no poder recuperar nada cuando importa.',
          'Empieza por una prueba humilde al final de la sesión. Cierra el texto y escribe tres líneas: la idea, un ejemplo propio y el capítulo donde vive. Si no puedes, no añadas culpa: añade un regreso breve al pasaje. La memoria se construye en ese intento fallido, no en la relectura pasiva que te hace sentir eficiente.',
          'Trata el olvido como información. Lo que se cae pronto tal vez no estaba bien entendido, o no estaba conectado a nada que te importe. Lo que permanece suele tener una imagen, una historia o una decisión pegada. Ahí está la pista para las fichas que vendrán después.',
        ],
      },
      {
        title: 'Recuperar, no releer',
        paragraphs: [
          `${RECALL} La diferencia parece pequeña en el momento y es enorme a la semana. Cuando relees, el texto hace el trabajo de sostener la idea delante de ti. Cuando recuperas, tu mente busca, tropieza, reconstruye y, en ese esfuerzo, refuerza el camino.`,
          'La práctica es sencilla y, al principio, incómoda. Después de un apartado, aparta la mirada y responde sin mirar: ¿cuál era la tesis? ¿qué ejemplo la sostenía? ¿qué objeción queda abierta? Si la respuesta sale rota, mírala el tiempo justo para corregir una pieza y vuelve a intentar decirla completa sin apoyo. Ese segundo intento vale más que subrayar el párrafo de nuevo.',
          'Kora y cualquier cuaderno sirven si obligan a la recuperación. Una flashcard no es un adorno de estudiante. Es una pregunta que te niega el consuelo de la página. El frente debe preguntar de verdad. «¿Qué dice el capítulo 2?» es perezosa. «¿Por qué reconocer una frase no demuestra que la recuerdas?» te obliga a reconstruir el argumento.',
          'Espacia los intentos. Recuperar la misma idea tres veces en un minuto solo entrena la memoria de trabajo. Recuperarla esta tarde, mañana y dentro de cuatro días entrena la memoria que quieres llevar a una conversación real. El esfuerzo debe sentirse moderado. Si es imposible, la ficha está mal escrita o la idea no se entendió. Si es trivial, la ficha ya está madura y puede visitarte menos.',
          'No uses la recuperación como examen de autoestima. Fallar una tarjeta es el sistema funcionando: te mostró un hueco a tiempo. La respuesta correcta, leída con atención y dicha otra vez con tus palabras, es el ladrillo. La vergüenza no es un ladrillo.',
        ],
      },
      {
        title: 'La ficha mínima',
        paragraphs: [
          `${CARD} En el frente, una pregunta o una frase con un hueco que no se pueda adivinar por la gramática sola. En el reverso, una respuesta breve, un ejemplo y, si hace falta, el lugar del libro para volver. Si el reverso es un párrafo copiado, no hiciste una ficha: hiciste una fotocopia cansada.`,
          'Escribe con tus palabras incluso cuando la frase del autor sea hermosa. La frase hermosa puede vivir en la cita, entre comillas, como invitada. La explicación tiene que poder salir de tu boca en la cocina, sin el libro delante. Si solo puedes repetir la música del autor, todavía no separaste la idea del estilo.',
          'Evita las fichas que preguntan por un detalle vanidoso —un número, un apellido, una lista de cinco elementos— salvo que ese detalle sea la idea. La memoria de examen ama las listas. La memoria de vida ama las relaciones: causa, contraste, condición, paso siguiente. Prefiere «¿en qué se diferencia recuperar de releer?» a «¿cuántas líneas tiene el ritual?».',
          'Una ficha, una idea. Cuando metas dos preguntas en una tarjeta, fallarás de forma confusa y no sabrás qué repasar. Parte. El montón crecerá más despacio de lo que temes si eres exigente con lo que merece tarjeta. La mayoría de los subrayados no merecen una. Merecen haber sido leídos.',
          'Revisa la redacción cuando una tarjeta se atasca. A veces no olvidaste: la pregunta era ambigua o la respuesta era un discurso. Acórtala. Una buena tarjeta cabe en un respiro. Si necesitas leer el reverso dos veces para entenderlo, tu yo futuro también se perderá, y el sistema se sentirá injusto.',
        ],
      },
      {
        title: 'El calendario de la memoria',
        paragraphs: [
          `${CAL} Una sesión breve de recuperación, hecha cuando las fichas vencen, vence a la tarde heroica del domingo en la que repasas todo con prisa y culpa. El calendario distribuye el esfuerzo en los días en los que la idea está a punto de irse, que es justo cuando recuperarla más la afirma.`,
          'El método que usa este cuaderno es simple de vivir aunque por dentro calcule intervalos. Si una idea vuelve con facilidad, se aleja: la verás en más días. Si tropiezas, se acerca: la verás pronto, sin castigo, solo con más visitas. No hace falta memorizar la fórmula para obedecerla. Hace falta ser honesto al pulsar otra vez, difícil, bien o fácil. Mentir en ese botón es esconderle el mapa a tu futuro.',
          'Combina el calendario con escenas reales. Cuando una ficha esté madura, úsala fuera del repaso: en una frase de tu diario, en una explicación a otra persona, en una decisión pequeña de esa semana. Una idea que solo vive en la tarjeta es una idea en una jaula. Una idea que sale a la calle se recuerda porque tiene vecinos.',
          'No acumules vencidas hasta la vergüenza. Si el montón de hoy es demasiado grande, responde las más antiguas durante quince minutos y deja el resto para mañana sin drama. Un sistema que solo funciona cuando estás perfecto no es un sistema: es una trampa. La continuidad imperfecta gana a la pureza interrumpida.',
          'Al cerrar la semana, mira no solo cuántas fichas acertaste, sino cuáles ideas usaste. Esa es la memoria viva: no el porcentaje, sino la idea que llegó a tiempo a una conversación, a una página o a una elección. El libro se queda en la estantería. El calendario decide qué parte del libro camina contigo.',
        ],
      },
    ],
    highlights: [
      { chapter: 0, text: FORGET, note: 'Olvidar deja sitio; el problema es no diseñar el recuerdo.', color: 'rose' },
      { chapter: 1, text: RECALL, note: 'La flashcard me niega el consuelo de la página.', color: 'yellow' },
      { chapter: 3, text: CAL, note: 'Quince minutos al día vencen al domingo heroico.', color: 'green' },
    ],
    capsules: [
      {
        chapter: 0,
        title: 'Reconocer no es recordar',
        idea: 'Olvidar deja sitio para pensar. Lo que confunde es creer que una idea está a salvo porque la reconoces al releer. Recordar es traerla sin verla y decirla con palabras propias.',
        practice: 'Cierra este capítulo y escribe tres líneas: la idea, un ejemplo tuyo y el lugar del libro. Si fallas, vuelve solo a ese pasaje.',
        quote: FORGET,
      },
      {
        chapter: 1,
        title: 'Recupera, no releas',
        idea: 'Releer produce familiaridad porque el texto sostiene la idea por ti. Recuperar obliga a buscar y reconstruir, y ese esfuerzo es el que afirma el camino a la semana.',
        practice: 'Después del próximo apartado, responde sin mirar: tesis, ejemplo y objeción. Corrige una sola pieza y dilo otra vez de memoria.',
        quote: RECALL,
      },
      {
        chapter: 2,
        title: 'Una ficha, una idea',
        idea: 'La ficha mínima pregunta de verdad y responde en pocas líneas, con tus palabras. Dos preguntas en una tarjeta confunden el fallo. La mayoría de los subrayados no merecen tarjeta.',
        practice: 'Convierte un solo subrayado en una ficha con un hueco o una pregunta. Si el reverso no cabe en un respiro, pártelo.',
        quote: CARD,
      },
      {
        chapter: 3,
        title: 'Calendario antes que intensidad',
        idea: 'Una sesión breve el día en que la ficha vence vale más que el maratón del domingo. Ser honesto al pulsar otra vez, difícil, bien o fácil es lo que mantiene el mapa.',
        practice: 'Hoy repasa solo quince minutos de tarjetas vencidas y deja el resto para mañana, sin compensar con culpa.',
        quote: CAL,
      },
      {
        chapter: 3,
        title: 'Saca la idea a la calle',
        idea: 'Una idea que solo vive en la tarjeta está en una jaula. Se vuelve memoria viva cuando la usas en un diario, una explicación o una decisión pequeña de la semana.',
        practice: 'Elige una ficha que ya te resulte fácil y úsala hoy en una frase dicha a otra persona o escrita en tu cuaderno.',
        quote: 'Una idea que sale a la calle se recuerda porque tiene vecinos.',
      },
    ],
    cards: [
      { chapter: 0, front: '¿Por qué reconocer una frase no demuestra que la recuerdas?', back: 'Porque el texto la está sosteniendo delante de ti. Recordar es traerla sin verla, usarla en un ejemplo nuevo y decirla con palabras propias.', dueInDays: 0 },
      { chapter: 0, front: '¿Cuántas ideas merece conservar un capítulo, según Rivas?', back: 'Una, dos o tres que merezcan una cita futura. Querer guardarlo todo impide recuperar algo cuando importa.', dueInDays: 0 },
      { chapter: 1, front: '¿Qué entrena repetir una idea tres veces en un minuto?', back: 'La memoria de trabajo. La memoria que quieres llevar a una conversación se entrena espaciando: esta tarde, mañana y dentro de unos días.', dueInDays: 0 },
      { chapter: 1, front: '¿Qué significa fallar una tarjeta?', back: 'Que el sistema funciona: mostró un hueco a tiempo. La vergüenza no es un ladrillo; la respuesta rehecha con tus palabras, sí.', dueInDays: 5 },
      { chapter: 2, front: '¿Qué tiene una ficha mínima?', back: 'Un frente que pregunta de verdad o deja un hueco no gramatical, y un reverso breve con respuesta, ejemplo y, si hace falta, el lugar del libro.', dueInDays: 0 },
      { chapter: 3, front: '¿Por qué no conviene mentir al pulsar Fácil?', back: 'Porque el calendario aleja la tarjeta. Mentir esconde el mapa a tu yo futuro y la idea se va justo cuando había que visitarla.', dueInDays: 6 },
    ],
    quiz: [
      {
        question: '¿Qué diferencia recuerdo de reconocimiento?',
        options: [
          'El recuerdo permite traer la idea sin ver el texto y decirla con palabras propias',
          'El reconocimiento dura más que el recuerdo',
          'Son lo mismo si subrayaste la frase',
          'El recuerdo consiste en asentir al releer',
        ],
        correctIndex: 0,
        explanation: 'Si solo puedes asentir al releer, la idea todavía no es tuya.',
      },
      {
        question: '¿Por qué recuperar supera a releer?',
        options: [
          'Porque ocupa menos páginas',
          'Porque el esfuerzo de reconstruir la idea refuerza el camino',
          'Porque evita escribir flashcards',
          'Porque el texto sigue haciendo el trabajo por ti',
        ],
        correctIndex: 1,
        explanation: 'Al releer, el texto sostiene la idea. Al recuperar, la mente busca, tropieza y refuerza el recuerdo.',
      },
      {
        question: '¿Qué falla en una tarjeta con dos preguntas?',
        options: [
          'Ocupa demasiado espacio en la pantalla',
          'Si fallas, no sabes qué idea repasar',
          'El algoritmo no acepta signos de interrogación',
          'Siempre es más fácil que una sola pregunta',
        ],
        correctIndex: 1,
        explanation: 'Una ficha, una idea. Dos preguntas producen un fallo confuso.',
      },
      {
        question: '¿Qué hace viva a la memoria al cerrar la semana?',
        options: [
          'El porcentaje de tarjetas acertadas',
          'Haber repasado todo el domingo de un tirón',
          'La idea que llegaste a usar en una conversación, una página o una decisión',
          'El número de libros archivados',
        ],
        correctIndex: 2,
        explanation: 'La memoria viva no es el porcentaje, sino la idea que llegó a tiempo.',
      },
    ],
  },
];
