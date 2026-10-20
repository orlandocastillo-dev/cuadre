import type { Account, Category, Rule } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "mercado", name: "Mercado", kind: "gasto", group: "necesidad", icon: "cart", color: 0 },
  { id: "hogar", name: "Arriendo y servicios", kind: "gasto", group: "necesidad", icon: "home", color: 1 },
  { id: "transporte", name: "Transporte", kind: "gasto", group: "necesidad", icon: "bus", color: 2 },
  { id: "salud", name: "Salud", kind: "gasto", group: "necesidad", icon: "heart", color: 3 },
  { id: "educacion", name: "Educación", kind: "gasto", group: "necesidad", icon: "book", color: 4 },
  { id: "domicilios", name: "Domicilios y restaurantes", kind: "gasto", group: "gusto", icon: "food", color: 5 },
  { id: "cafe", name: "Café y antojos", kind: "gasto", group: "gusto", icon: "coffee", color: 6 },
  { id: "suscripciones", name: "Suscripciones", kind: "gasto", group: "gusto", icon: "play", color: 7 },
  { id: "compras", name: "Ropa y compras", kind: "gasto", group: "gusto", icon: "bag", color: 8 },
  { id: "salidas", name: "Salidas", kind: "gasto", group: "gusto", icon: "ticket", color: 9 },
  { id: "iglesia", name: "Iglesia y donaciones", kind: "gasto", group: "aporte", icon: "hands", color: 4 },
  { id: "ahorro", name: "Ahorro", kind: "gasto", group: "ahorro", icon: "piggy", color: 2 },
  { id: "otros", name: "Otros gastos", kind: "gasto", group: "gusto", icon: "dots", color: 9 },
  { id: "salario", name: "Salario", kind: "ingreso", group: "necesidad", icon: "wallet", color: 2 },
  { id: "extra", name: "Trabajos extra", kind: "ingreso", group: "necesidad", icon: "tool", color: 0 },
  { id: "otros-ingresos", name: "Otros ingresos", kind: "ingreso", group: "necesidad", icon: "plus", color: 4 },
];

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: "efectivo", name: "Efectivo", type: "efectivo" },
  { id: "bancolombia", name: "Bancolombia", type: "banco" },
  { id: "nequi", name: "Nequi", type: "billetera" },
];

const keywords: Record<string, string[]> = {
  domicilios: ["rappi", "ifood", "didi food", "domicilio", "restaurante", "frisby", "kfc", "mcdonald", "burger", "crepes", "pizza"],
  transporte: ["uber", "didi", "cabify", "indriver", "transmetro", "transmilenio", "metro de", "taxi", "terpel", "primax", "texaco", "biomax", "peaje", "parqueadero"],
  suscripciones: ["netflix", "spotify", "disney", "prime video", "amazon prime", "youtube premium", "hbo", "max.com", "apple.com", "icloud", "google one", "chatgpt", "openai", "crunchyroll", "deezer"],
  mercado: ["exito", "éxito", "d1", "ara ", "tiendas ara", "olimpica", "olímpica", "jumbo", "carulla", "isimo", "makro", "pricesmart", "surtimax", "mercado", "fruver"],
  cafe: ["juan valdez", "tostao", "oma ", "starbucks", "cafe", "café", "panaderia", "panadería", "dunkin"],
  hogar: ["arriendo", "air-e", "aire ", "triple a", "gases del caribe", "epm", "codensa", "enel", "vanti", "claro", "tigo", "movistar", "wom", "etb", "administracion", "administración"],
  salud: ["drogueria", "droguería", "farmatodo", "cruz verde", "la rebaja", "colsubsidio", "eps", "sura", "colsanitas", "odontolog", "laboratorio"],
  iglesia: ["iglesia", "diezmo", "ofrenda", "donacion", "donación"],
  salidas: ["cine colombia", "cinemark", "procinal", "royal films", "tuboleta", "eticket", "bar ", "discoteca"],
  compras: ["falabella", "zara", "koaj", "arturo calle", "mercadolibre", "mercado libre", "amazon", "temu", "shein", "alkosto", "ktronix", "homecenter", "studio f"],
  educacion: ["universidad", "platzi", "udemy", "coursera", "matricula", "matrícula", "libreria", "librería"],
  ahorro: ["ahorro", "bolsillo", "cdt", "inversion", "inversión", "fiducia"],
  salario: ["nomina", "nómina", "salario", "pago de nom", "abono nomina"],
};

/** Reglas para clasificar los movimientos importados del banco. El usuario puede agregar las suyas. */
export const DEFAULT_RULES: Rule[] = Object.entries(keywords).flatMap(([categoryId, words]) =>
  words.map((pattern) => ({ pattern, categoryId })),
);
