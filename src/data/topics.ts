import type { CefrLevel, EverydayTopic, SpeechPace, TutorVoice } from '../types/tutor';

export const EVERYDAY_TOPICS: EverydayTopic[] = [
  {
    id: 'free',
    labelEs: 'Charla cotidiana libre',
    labelEn: 'Everyday Free Talk',
    descriptionEs: 'Conversación natural sobre tu día, planes recientes, intereses o cualquier situación diaria.',
    sampleQuestionEn: 'How has your day been going so far?',
    promptHintEn: 'everyday life, daily routines, weekend plans, or casual personal stories',
  },
  {
    id: 'cafe',
    labelEs: 'Café y restaurantes',
    labelEn: 'Coffee Shops & Dining',
    descriptionEs: 'Pedir comida, recomendar platos, hablar de sabores y charlar en la mesa.',
    sampleQuestionEn: 'What do you usually like to order when you go out for coffee?',
    promptHintEn: 'ordering food or coffee, favorite meals, cooking at home, or restaurant experiences',
  },
  {
    id: 'work',
    labelEs: 'Trabajo y oficina',
    labelEn: 'Work & Collaboration',
    descriptionEs: 'Reuniones diarias, proyectos actuales, hábitos de productividad y trato con colegas.',
    sampleQuestionEn: 'What kind of project are you focusing on this week?',
    promptHintEn: 'daily work tasks, teamwork, meetings, deadlines, and work-life balance',
  },
  {
    id: 'travel',
    labelEs: 'Viajes y ciudad',
    labelEn: 'Travel & Getting Around',
    descriptionEs: 'Aeropuertos, hoteles, pedir direcciones y contar anécdotas de viajes.',
    sampleQuestionEn: 'If you could take a short trip next month, where would you go?',
    promptHintEn: 'trips, airports, hotels, asking for directions, and memorable places visited',
  },
  {
    id: 'routine',
    labelEs: 'Rutina y tiempo libre',
    labelEn: 'Daily Routine & Hobbies',
    descriptionEs: 'Hábitos de mañana, deporte, series, música y qué haces para desconectar.',
    sampleQuestionEn: 'What is the first thing you usually do after waking up?',
    promptHintEn: 'morning routines, hobbies, exercise, books, and relaxing after work',
  },
  {
    id: 'shopping',
    labelEs: 'Compras y recados',
    labelEn: 'Shopping & Errands',
    descriptionEs: 'Comparar precios, preguntar por tallas, cambios o hacer compras del día.',
    sampleQuestionEn: 'Do you prefer shopping in local stores or ordering things online?',
    promptHintEn: 'shopping in stores or online, returning items, groceries, and everyday errands',
  },
];

export const CEFR_LEVELS: {
  value: CefrLevel;
  label: string;
  shortDesc: string;
}[] = [
  {
    value: 'A1',
    label: 'A1 · Principiante',
    shortDesc: 'Frases cortas, vocabulario básico y ritmo pausado.',
  },
  {
    value: 'A2',
    label: 'A2 · Básico',
    shortDesc: 'Situaciones simples del día a día con claridad.',
  },
  {
    value: 'B1',
    label: 'B1 · Intermedio',
    shortDesc: 'Conversación fluida con vocabulario cotidiano variado.',
  },
  {
    value: 'B2',
    label: 'B2 · Intermedio-Alto',
    shortDesc: 'Matices naturales, expresiones idiomáticas y ritmo ágil.',
  },
  {
    value: 'C1',
    label: 'C1 · Avanzado',
    shortDesc: 'Conversación espontánea a velocidad nativa con precisión.',
  },
];

export const SPEECH_PACES: {
  value: SpeechPace;
  label: string;
  description: string;
}[] = [
  {
    value: 'slow',
    label: 'Despacio',
    description: 'Articulación pausada y oraciones breves.',
  },
  {
    value: 'adaptive',
    label: 'Adaptable',
    description: 'Se ajusta automáticamente a tu soltura.',
  },
  {
    value: 'natural',
    label: 'Natural',
    description: 'Velocidad conversacional espontánea.',
  },
];

export const TUTOR_VOICES: {
  value: TutorVoice;
  label: string;
  tone: string;
}[] = [
  { value: 'Zephyr', label: 'Zephyr', tone: 'Clara y cálida' },
  { value: 'Puck', label: 'Puck', tone: 'Ágil y cercana' },
  { value: 'Kore', label: 'Kore', tone: 'Serena y pausada' },
  { value: 'Charon', label: 'Charon', tone: 'Grave y firme' },
  { value: 'Fenrir', label: 'Fenrir', tone: 'Expresiva y directa' },
];
