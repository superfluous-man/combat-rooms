export type Identity = {
  sessionId: string;
  nickname: string;
  color: string;
};

const adjectives = [
  "Тихая",
  "Лунная",
  "Снежная",
  "Шальная",
  "Канонная",
  "Фандомная",
  "Квестовая",
  "Артефактная",
  "Спойлерная",
  "Ночная",
  "Стальная",
  "Сахарная",
  "Упрямая",
  "Дикая",
  "Медная",
  "Туманная",
  "Тайная",
  "Боевая",
  "Смелая",
  "Яростная"
];

const animals = [
  "Рысь",
  "Лиса",
  "Лань",
  "Куница",
  "Выдра",
  "Кошка",
  "Волчица",
  "Сорока",
  "Цапля",
  "Ласточка",
  "Пантера",
  "Тигрица",
  "Сова",
  "Гадюка",
  "Медуза"
];

const colors = [
  "#8ecae6", "#a8dadc", "#bde0fe", "#cdb4db", "#ffc8dd",
  "#ffd166", "#c7f9cc", "#b7b7ff", "#f1fa8c", "#ffadad"
];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uuidv4(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : null;

  // Best case
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  // Most mobile browsers still have getRandomValues
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);

    // Per RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

    const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last-resort Math.random fallback (still UUID-shaped)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const KEY = "combat_identity_v2";

export function createIdentity(): Identity {
  return {
    sessionId: uuidv4(),
    nickname: `${pick(adjectives)} ${pick(animals)}`,
    color: pick(colors),
  };
}