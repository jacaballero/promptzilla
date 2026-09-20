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
    name: "Entrada de la Facultad",
    caption: "Facultad de Informática. Año 2035. Huele a café malo y a modelos sobrecargados.",
    bg: {
      image: "assets/scenes/scene_corridor.png",
      foregroundImage: "assets/scenes/scene_corridor_fg.png",
      theme: "hallway"
    },
    walk: {
      yMin: 28, yMax: 76, xMin: 16, xMax: 84, near: 1.05, far: 0.43, depthFarY: 24,
      // Walkable corridor floor. Each point is [x%, y%]. Adjust to hug the floor.
      polygon: [
        [37, 77],   // 1 · frente-izquierda (borde izq. de la alfombra)
        [23, 58],   // 2 · lateral izquierdo (donde el suelo se ensancha)
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
      { x: 68, y: 39, w: 6, h: 4 }   // papelera (derecha)
    ],
    entryPoints: {
      default:       { x: 50, y: 72 },   // on the entrance mat, inside the corridor
      fromClassroom: { x: 32, y: 54 },
      fromStudy:     { x: 70, y: 60 },
      fromRooftop:   { x: 48, y: 38 }
    },
    characters: [],
    hotspots: [
      {
        id: "door-classroom",
        label: "Aula 2035",
        kind: "exit",
        target: "classroom",
        x: 11, y: 7, w: 11, h: 45,
        approach: { x: 30, y: 54 }
      },
      {
        id: "door-study",
        label: "Sala de estudio",
        kind: "exit",
        target: "studyroom",
        x: 81, y: 9, w: 15, h: 50,
        approach: { x: 74, y: 56 }
      },
      {
        id: "stairs",
        label: "Escaleras ↑",
        kind: "exit",
        target: "rooftop",
        targetEntry: "fromCorridor",
        x: 45, y: 0, w: 10, h: 18,
        approach: { x: 48, y: 30 }
      },
      {
        id: "poster",
        label: "Cartel de 'SE BUSCA'",
        kind: "look",
        x: 71, y: 7, w: 12, h: 33,
        approach: { x: 66, y: 56 },
        look: "Un cartel descolorido: «SE BUSCA: Promptzilla. Peligrosidad: media. Recompensa: 3 créditos ECTS». Alguien ha añadido a boli: 'lo vi ayer en la cafetería, pidió un cortado'."
      },
      {
        id: "street-door",
        label: "Salir a la plaza",
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
    name: "Aula 2035",
    caption: "El aula del examen final. La pizarra holográfica parpadea con nervios.",
    bg: { image: "assets/scenes/scene_class_room.png", theme: "classroom" },
    walk: { yMin: 66, yMax: 95, near: 1.0, far: 0.82 },
    entryPoints: {
      default:      { x: 76, y: 88 },
      fromEntrance: { x: 78, y: 88 }
    },
    characters: [
      { id: "teacher", sprite: "teacher", x: 38, y: 84, dialogue: "teacher" }
    ],
    hotspots: [
      {
        id: "door-out",
        label: "Salir al pasillo",
        kind: "exit",
        target: "entrance",
        targetEntry: "fromClassroom",
        x: 88, y: 70, w: 22, h: 34,
        approach: { x: 94, y: 90 }
      },
      {
        id: "blackboard",
        label: "Pizarra holográfica",
        kind: "look",
        x: 0, y: 4, w: 32, h: 44,
        approach: { x: 28, y: 84 },
        look: "En la pizarra pone: «EXAMEN FINAL — Prohibido preguntar al LLM… salvo que sepas preguntar bien». El profesor la mira con orgullo sospechoso."
      }
    ]
  },

  // ─── Study room (two students) ───────────────────────────────────────────
  studyroom: {
    id: "studyroom",
    name: "Sala de estudio",
    caption: "Sala de estudio. Dos compañeros fingen repasar mientras discuten de etiquetas HTML.",
    bg: { image: "assets/scenes/scene_study_room.png", theme: "study" },
    walk: { yMin: 62, yMax: 95, near: 1.0, far: 0.85 },
    entryPoints: {
      default:      { x: 22, y: 88 },
      fromEntrance: { x: 20, y: 88 }
    },
    characters: [
      { id: "student-girl", sprite: "student-girl", x: 40, y: 88, dialogue: "studentGirl" },
      { id: "student-boy",  sprite: "student-boy",  x: 60, y: 84, dialogue: "studentBoy" }
    ],
    hotspots: [
      {
        id: "door-out",
        label: "Salir al pasillo",
        kind: "exit",
        target: "entrance",
        targetEntry: "fromStudy",
        x: -9, y: 67, w: 22, h: 35,
        approach: { x: 6, y: 90 }
      },
      {
        id: "vending",
        label: "Máquina de café",
        kind: "look",
        x: 80, y: 9, w: 20, h: 58,
        approach: { x: 74, y: 84 },
        look: "Una máquina de café con una pegatina: «Powered by IA». Cobra en tokens. Por supuesto que cobra en tokens."
      }
    ]
  },

  // ─── Rooftop (Promptzilla) ───────────────────────────────────────────────
  rooftop: {
    id: "rooftop",
    name: "Azotea de la Facultad",
    caption: "La azotea. Al atardecer, sobre la ciudad… y ahí está él, digiriendo tokens.",
    bg: { image: "assets/scenes/scene_rooftop.png", theme: "hallway" },
    walk: { yMin: 64, yMax: 90, xMin: 18, xMax: 95, near: 1.0, far: 0.82 },
    entryPoints: {
      default:      { x: 26, y: 86 },
      fromCorridor: { x: 26, y: 86 }
    },
    characters: [
      { id: "promptzilla", sprite: "promptzilla", x: 66, y: 89, scale: 1.65, dialogue: "promptzilla" }
    ],
    hotspots: [
      {
        id: "door-down",
        label: "Bajar por las escaleras",
        kind: "exit",
        target: "entrance",
        targetEntry: "fromRooftop",
        x: 8, y: 28, w: 10, h: 39,
        approach: { x: 24, y: 86 }
      },
      {
        id: "skyline",
        label: "La ciudad",
        kind: "look",
        x: 74, y: 6, w: 28, h: 38,
        approach: { x: 95, y: 84 },
        look: "La ciudad de 2035 parpadea con anuncios holográficos. En uno pone: «IA responsable: pregunta menos, piensa más». Nadie le hace caso."
      }
    ]
  },

  // ─── Plaza (exterior entrance) ───────────────────────────────────────
  plaza: {
    id: "plaza",
    name: "Entrada a la Facultad",
    caption: "La plaza de entrada. Drones sobrevolando, la ciudad zumbando de fondo.",
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
    characters: [],
    hotspots: [
      {
        id: "door-in",
        label: "Entrar",
        kind: "exit",
        target: "entrance",
        targetEntry: "default",
        x: 40, y: 30, w: 20, h: 30,
        approach: { x: 50, y: 58 }
      },
      {
        id: "billboard",
        label: "Panel holográfico",
        kind: "look",
        x: 84, y: 36, w: 8, h: 25,
        approach: { x: 78, y: 74 },
        look: "Un panel publicitario: «Matrícula 2035: ahora con tutía de IA incluida». En letra pequeña: 'la IA no se hace responsable de tu expediente'."
      },
      {
        id: "scooter",
        label: "Patinete",
        kind: "look",
        x: 8, y: 48, w: 14, h: 16,
        approach: { x: 24, y: 70 },
        look: "Un patinete eléctrico aparcado. Tiene una pegatina: «Desbloquea con un prompt». Nadie recuerda cuál era."
      }
    ]
  }
};
