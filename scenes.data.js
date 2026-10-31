// Promptzilla — Scene data for the adventure prototype
// Code language: English | Content language: Spanish
//
// Coordinate system: percentages of the scene box.
//   Feet position of a character/player: { x, y }  (y = vertical floor position)
//   hotspots: rectangular regions { x, y, w, h }; `approach` = {x,y} the player walks to
//   walk: floor band + depth scaling
//         { yMin, yMax, near, far }  → scale = far..near from top (yMin) to bottom (yMax)
//   bg.image: background art (falls back to bg.theme placeholder if absent)
//
// Coordinates below are tuned to the background art in assets/scenes/.

"use strict";

/* global window */
window.SCENES = {

  // ─── Entrance + corridor (map-like hub) ──────────────────────────────────
  entrance: {
    id: "entrance",
    name: { es: "Entrada de la Facultad", en: "Faculty hall" },
    caption: {
      es: "Facultad de Informática. Año 2035. Huele a café malo y a modelos sobrecargados.",
      en: "School of Computer Science. Year 2035. It smells of bad coffee and overloaded models."
    },
    bg: {
      image: "assets/scenes/scene_corridor.png",
      foregroundImage: "assets/scenes/scene_corridor_fg.png",
      theme: "hallway"
    },
    walk: {
      yMin: 28, yMax: 76, xMin: 16, xMax: 84, near: 1.05, far: 0.50, depthFarY: 24,
      // Walkable corridor floor. Each point is [x%, y%]. Adjust to hug the floor.
      polygon: [
        [37, 77],   // 1 · frente-izquierda (borde izq. de la alfombra)
        [23, 58],   // 2 · lateral izquierdo (donde el suelo se ensancha)
        [19, 52],   // 2a · franja entre el mostrador y la pared, frente al aula 0.01
        [24, 46],   // 2b · pie de la puerta del aula 0.01 (sin pisar el marco)
        [30, 42],   // 2c · vuelta a la pared, antes de la papelera
        [41, 28],   // 3 · fondo-izquierda (hacia las escaleras)
        [57, 28],   // 4 · fondo-derecha
        [78, 58],   // 5 · lateral derecho
        [63, 77]    // 6 · frente-derecha (borde der. de la alfombra)
      ]
    },
    charScale: 0.7,
    // Walls are excluded by the polygon; only real props block the feet.
    obstacles: [
      { x: 10, y: 56, w: 30, h: 20 },  // mostrador / recepción (izquierda)
      { x: 27.3, y: 35.5, w: 3.5, h: 3.5 }, // fuente (izquierda, junto al aula 0.01)
      { x: 32.5, y: 33.5, w: 2.2, h: 2.4 },   // maceta junto al aula 0.02
      { x: 68, y: 39, w: 6, h: 4 }   // papelera (derecha)
    ],
    entryPoints: {
      default:        { x: 50, y: 72 },   // on the entrance mat, inside the corridor
      fromClassroom:  { x: 21.5, y: 50 },
      fromClassroom2: { x: 40, y: 32 },
      fromStudy:      { x: 70, y: 60 },
      fromRooftop:    { x: 48, y: 38 }
    },
    characters: [],
    hotspots: [
      {
        id: "door-classroom",
        label: { es: "Aula 0.01", en: "Room 0.01" },
        kind: "exit",
        target: "classroom",
        x: 11, y: 7, w: 11, h: 45,
        approach: { x: 21.5, y: 50 }
      },
      {
        id: "door-classroom2",
        label: { es: "Aula 0.02", en: "Room 0.02" },
        kind: "exit",
        target: "classroom2",
        x: 33.4, y: 7, w: 5, h: 28,
        approach: { x: 40, y: 32 }
      },
      {
        id: "door-study",
        label: { es: "Sala de estudio", en: "Study room" },
        kind: "exit",
        target: "studyroom",
        x: 81, y: 9, w: 15, h: 50,
        approach: { x: 74, y: 56 }
      },
      {
        id: "stairs",
        label: { es: "Escaleras ↑", en: "Stairs ↑" },
        kind: "exit",
        target: "rooftop",
        targetEntry: "fromCorridor",
        x: 45, y: 0, w: 10, h: 18,
        approach: { x: 48, y: 30 }
      },
      {
        id: "poster",
        label: { es: "Cartel de 'SE BUSCA'", en: "'WANTED' poster" },
        kind: "look",
        x: 71, y: 7, w: 12, h: 33,
        approach: { x: 66, y: 56 },
        look: {
          es: "Un cartel descolorido: «SE BUSCA: Promptzilla. Peligrosidad: media. Recompensa: 3 créditos ECTS». Alguien ha añadido a boli: 'lo vi ayer en la cafetería, pidió un cortado'.",
          en: "A faded poster: «WANTED: Promptzilla. Danger level: medium. Reward: 3 ECTS credits». Someone has added in pen: 'saw it yesterday in the cafeteria, it ordered a macchiato'."
        }
      },
      {
        id: "street-door",
        label: { es: "Salir a la plaza", en: "Go out to the square" },
        kind: "exit",
        target: "plaza",
        targetEntry: "fromCorridor",
        x: 27, y: 66, w: 46, h: 31,
        approach: { x: 50, y: 72 }
      }
    ]
  },

  // ─── Classroom (professor) ───────────────────────────────────────────────
  classroom: {
    id: "classroom",
    name: { es: "Aula 0.01", en: "Room 0.01" },
    caption: {
      es: "El aula del examen final. La pizarra holográfica parpadea con nervios.",
      en: "The final exam room. The holographic blackboard flickers nervously."
    },
    bg: { image: "assets/scenes/scene_class_room.png", theme: "classroom" },
    walk: { yMin: 66, yMax: 95, near: 1.0, far: 0.72 },
    obstacles: [
      { x: 91, y: 60, w: 13, h: 5 },   // front-right seat, just above the exit
      { x: 5, y: 60, w: 5, h: 5 }   // plant under the blackboard
    ],
    entryPoints: {
      default:      { x: 76, y: 88 },
      fromEntrance: { x: 78, y: 88 }
    },
    characters: [
      { id: "teacher", name: { es: "Profesor", en: "Teacher" }, sprite: "teacher", x: 38, y: 84, dialogue: "teacher" , hit: { w: 33, h: 99 } }
    ],
    hotspots: [
      {
        id: "door-out",
        label: { es: "Salir al pasillo", en: "Go to the corridor" },
        kind: "exit",
        target: "entrance",
        targetEntry: "fromClassroom",
        x: 88, y: 70, w: 22, h: 34,
        approach: { x: 94, y: 90 }
      },
      {
        id: "blackboard",
        label: { es: "Pizarra holográfica", en: "Holographic blackboard" },
        kind: "look",
        x: 0, y: 4, w: 32, h: 44,
        approach: { x: 28, y: 84 },
        look: {
          es: "En la pizarra pone: «EXAMEN FINAL — Prohibido preguntar al LLM… salvo que sepas preguntar bien». El profesor la mira con orgullo sospechoso.",
          en: "The blackboard says: «FINAL EXAM — Asking the LLM is forbidden… unless you know how to ask well». The teacher looks at it with suspicious pride."
        }
      }
    ]
  },
  // ─── Classroom 2 (bright / daytime) ──────────────────────────────
  classroom2: {
    id: "classroom2",
    name: { es: "Aula 0.02", en: "Room 0.02" },
    caption: {
      es: "Otra aula, esta con luz de día. Aquí el examen es a primera hora y sin excusas.",
      en: "Another classroom, this one in daylight. Here the exam is first thing in the morning, no excuses."
    },
    bg: { image: "assets/scenes/scene_class_room_2.png", theme: "classroom" },
    walk: { yMin: 69.5, yMax: 95, near: 1.0, far: 0.79 },
    entryPoints: {
      default:      { x: 76, y: 88 },
      fromEntrance: { x: 78, y: 88 }
    },
    characters: [
      // Idle student you can talk to; he offers a practice challenge.
      // hit = tuned clickable box (percent of the sprite, anchored at the feet).
      { id: "student-glasses", name: { es: "Estudiante con gafas", en: "Student with glasses" }, sprite: "student-glasses", x: 32, y: 84, scale: 1.13, animMs: 700,
        animSeq: [0, 1, 2, 1], dialogue: "studentGlasses", hit: { w: 32, h: 96 } }
    ],
    hotspots: [
      {
        id: "door-out",
        label: { es: "Salir al pasillo", en: "Go to the corridor" },
        kind: "exit",
        target: "entrance",
        targetEntry: "fromClassroom2",
        x: 88, y: 70, w: 22, h: 34,
        approach: { x: 94, y: 90 }
      },
      {
        id: "blackboard",
        label: { es: "Pizarra holográfica", en: "Holographic blackboard" },
        kind: "look",
        x: 64, y: 7, w: 36, h: 42,
        approach: { x: 82, y: 84 },
        look: {
          es: "La pizarra proyecta: «Aula B — Aquí sí puedes usar la IA… si demuestras que no la necesitas». Debajo, en letra pequeña: 'y trae café para todos'.",
          en: "The blackboard shows: «Room B — Here you CAN use the AI… if you prove you don't need it». Below, in small print: 'and bring coffee for everyone'."
        }
      }
    ]
  },
  // ─── Study room (two students) ───────────────────────────────────────────
  studyroom: {
    id: "studyroom",
    name: { es: "Sala de estudio", en: "Study room" },
    caption: {
      es: "Sala de estudio. Dos compañeros fingen repasar mientras discuten de etiquetas HTML.",
      en: "Study room. Two classmates pretend to revise while arguing about HTML tags."
    },
    bg: { image: "assets/scenes/scene_study_room.png", theme: "study" },
    // yMin keeps the feet off the chairs; depthFarY keeps the perspective anchored at 62.
    walk: { yMin: 67, yMax: 95, near: 1.0, far: 0.72, depthFarY: 62 },
    entryPoints: {
      default:      { x: 22, y: 88 },
      fromEntrance: { x: 20, y: 88 }
    },
    characters: [
      // `scale` offsets the steeper perspective (far 0.72) so the girl keeps her size.
      { id: "student-girl", name: { es: "Estudiante de la coleta", en: "Student with a ponytail" }, sprite: "student-girl", x: 38.5, y: 88, scale: 1.03, dialogue: "studentGirl" , hit: { w: 32, h: 96 } },
      { id: "student-boy", name: { es: "Estudiante de los cascos", en: "Student with headphones" }, sprite: "student-boy",  x: 66, y: 93, dialogue: "studentBoy", hit: { w: 33, h: 98 } }
    ],
    hotspots: [
      {
        id: "door-out",
        label: { es: "Salir al pasillo", en: "Go to the corridor" },
        kind: "exit",
        target: "entrance",
        targetEntry: "fromStudy",
        x: -9, y: 67, w: 22, h: 35,
        approach: { x: 6, y: 90 }
      },
      {
        id: "vending",
        label: { es: "Máquina de café", en: "Coffee machine" },
        kind: "look",
        x: 80, y: 9, w: 20, h: 58,
        approach: { x: 79, y: 70 },
        look: {
          es: "Una máquina de café con una pegatina: «Powered by IA». Cobra en tokens. Por supuesto que cobra en tokens.",
          en: "A coffee machine with a sticker: «Powered by AI». It charges in tokens. Of course it charges in tokens."
        }
      }
    ]
  },

  // ─── Rooftop (Promptzilla) ───────────────────────────────────────────────
  rooftop: {
    id: "rooftop",
    name: { es: "Azotea de la Facultad", en: "Faculty rooftop" },
    caption: {
      es: "La azotea. Al atardecer, sobre la ciudad… y ahí está él, digiriendo tokens.",
      en: "The rooftop. At sunset, above the city… and there it is, digesting tokens."
    },
    bg: { image: "assets/scenes/scene_rooftop.png", theme: "hallway" },
    walk: { yMin: 64, yMax: 90, xMin: 18, xMax: 95, near: 1.0, far: 0.60 },
    entryPoints: {
      default:      { x: 26, y: 86 },
      fromCorridor: { x: 26, y: 86 }
    },
    characters: [
      // Frames: 0 = eyes open, 1 = half-closed, 2 = closed. Never holds a frame
      // longer than ~1 s; one full blink per ~8 s cycle.
      { id: "promptzilla", name: "Promptzilla", sprite: "promptzilla", x: 66, y: 97, scale: 1.65, dialogue: "promptzilla", hit: { w: 66, h: 96 },
        noShadow: true, animMs: 500,   // noShadow: no floor ellipse nor drop-shadow
        approach: { x: 43, y: 90 },
        animSeq: [0, 0, 1, 0, 0, 1, 0, 0, 1, 2, 1, 0, 0, 1, 0, 1] }
    ],
    hotspots: [
      {
        id: "door-down",
        label: { es: "Bajar por las escaleras", en: "Go down the stairs" },
        kind: "exit",
        target: "entrance",
        targetEntry: "fromRooftop",
        x: 8, y: 28, w: 10, h: 39,
        approach: { x: 24, y: 86 }
      },
      {
        id: "skyline",
        label: { es: "La ciudad", en: "The city" },
        kind: "look",
        x: 74, y: 6, w: 28, h: 38,
        approach: { x: 95, y: 84 },
        look: {
          es: "La ciudad de 2035 parpadea con anuncios holográficos. En uno pone: «IA responsable: pregunta menos, piensa más». Nadie le hace caso.",
          en: "The city of 2035 flickers with holographic ads. One of them reads: «Responsible AI: ask less, think more». Nobody pays attention."
        }
      }
    ]
  },

  // ─── Plaza (exterior entrance) ───────────────────────────────────────
  plaza: {
    id: "plaza",
    name: { es: "Entrada a la Facultad", en: "Faculty entrance" },
    caption: {
      es: "La plaza de entrada. Drones sobrevolando, la ciudad zumbando de fondo.",
      en: "The entrance square. Drones flying overhead, the city buzzing in the background."
    },
    bg: { image: "assets/scenes/scene_entrance.png", theme: "hallway" },
    // Wide shot: small character; flat plaza floor as an octagon.
    walk: {
      yMin: 56, yMax: 96, xMin: 12, xMax: 88, near: 1.7, far: 0.6,
      polygon: [
        [22, 95],   // frente-izquierda
        [16, 72],   // lateral izquierdo
        [30, 60],   // fondo-izquierda (junto a la jardinera)
        [42, 56],   // pie de escaleras (izq. de la puerta)
        [58, 56],   // pie de escaleras (der. de la puerta)
        [70, 60],   // fondo-derecha
        [84, 72],   // lateral derecho
        [78, 95]    // frente-derecha
      ]
    },
    charScale: 0.5,   // plano amplio: el personaje se ve pequeño/alejado
    entryPoints: {
      default:      { x: 50, y: 84 },
      fromCorridor: { x: 50, y: 63 }   // sale del edificio, junto a la puerta
    },
    characters: [
      // Ambient chatting trio (non-interactive; the hotspot carries the joke).
      // animSeq recorre los 5 frames (0/2 = todos hablando, 1 = bocas cerradas,
      // 3 = centro, 4 = derecha).
      { id: "students-plaza", sprite: "students-plaza", x: 29, y: 85, scale: 1.08, static: true, animMs: 450,
        animSeq: [0, 1, 2, 3, 4] }
    ],
    hotspots: [
      {
        id: "students-talk",
        label: { es: "Estudiantes", en: "Students" },
        kind: "look",
        x: 16, y: 42, w: 26, h: 44,
        approach: { x: 46, y: 84 },
        look: {
          es: "Un corrillo de estudiantes cuchichea sobre la IA. Pillas retazos: «...no le sueltes un testamento al modelo, que cada token se paga»; «sé concreto: pídele exacto lo que necesitas y listo»; «yo gasté media cuenta preguntándole cosas con rodeos… aprende de mis errores».",
          en: "A huddle of students whispers about AI. You catch snippets: «...don't dump an essay on the model, every token costs»; «be specific: ask exactly for what you need and that's it»; «I burnt half my balance asking it things in a roundabout way… learn from my mistakes»."
        }
      },
      {
        id: "door-in",
        label: { es: "Entrar", en: "Go in" },
        kind: "exit",
        target: "entrance",
        targetEntry: "default",
        x: 40, y: 30, w: 20, h: 30,
        approach: { x: 50, y: 58 }
      },
      {
        id: "billboard",
        label: { es: "Panel holográfico", en: "Holographic billboard" },
        kind: "look",
        x: 84, y: 36, w: 8, h: 25,
        approach: { x: 78, y: 74 },
        look: {
          es: "Un panel publicitario: «Matrícula 2035: ahora con tutía de IA incluida». En letra pequeña: 'la IA no se hace responsable de tu expediente'.",
          en: "An advertising billboard: «Enrolment 2035: now with AI tutoring included». In small print: 'the AI takes no responsibility for your transcript'."
        }
      },
      {
        id: "scooter",
        label: { es: "Patinete", en: "Scooter" },
        kind: "look",
        x: 8, y: 48, w: 14, h: 16,
        approach: { x: 24, y: 70 },
        look: {
          es: "Un patinete eléctrico aparcado. Tiene una pegatina: «Desbloquea con un prompt». Nadie recuerda cuál era.",
          en: "A parked e-scooter. It has a sticker: «Unlock with a prompt». Nobody remembers which one."
        }
      }
    ]
  }
};
