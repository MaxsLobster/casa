// Automatisch erzeugt aus src/mila/engine.ts mit `npm run build:mila-tick`. Nicht von Hand ändern.

// src/lib/dates.ts
var pad = (n) => String(n).padStart(2, "0");
function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s, n) {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// src/mila/shop-rules.json
var shop_rules_default = {
  order: [
    "obst_gemuese",
    "kuehl",
    "fleisch_fisch",
    "trocken",
    "getraenke",
    "sonstiges"
  ],
  labels: {
    obst_gemuese: "Obst & Gem\xFCse",
    kuehl: "K\xFChlregal",
    fleisch_fisch: "Fleisch & Fisch",
    trocken: "Vorrat",
    getraenke: "Getr\xE4nke",
    sonstiges: "Sonstiges"
  },
  rules: [
    {
      cat: "trocken",
      keywords: [
        "tomatenmark",
        "passata",
        "kokosmilch",
        "br\xFChe",
        "currypaste",
        "fischsauce",
        "sojasauce",
        "chia",
        "haferflock",
        "flocken",
        "reis",
        "linse",
        "mehl",
        "pasta",
        "spaghetti",
        "nudel",
        "pinienkern",
        "mandel",
        "oliven\xF6l",
        "\xF6l",
        "essig",
        "dose",
        "gew\xFCrz",
        "paste",
        "zucker",
        "sirup",
        "honig",
        "bambus",
        "palmzucker",
        "pulver",
        "brot",
        "toast",
        "cracker",
        "n\xFCsse"
      ]
    },
    {
      cat: "fleisch_fisch",
      keywords: [
        "hack",
        "rind",
        "schwein",
        "h\xE4hnch",
        "lamm",
        "fisch",
        "wurst",
        "speck",
        "garnele",
        "lachs",
        "steak",
        "pute",
        "chorizo",
        "salami",
        "schinken",
        "chashu"
      ]
    },
    {
      cat: "kuehl",
      keywords: [
        "milch",
        "joghurt",
        "butter",
        "k\xE4se",
        "parmesan",
        "feta",
        "sahne",
        "quark",
        "frischk\xE4se",
        "eier",
        "creme",
        "mozzarella",
        "ricotta"
      ]
    },
    {
      cat: "getraenke",
      keywords: [
        "wein",
        "bier",
        "limonad",
        "cola",
        "prosecco"
      ]
    },
    {
      cat: "obst_gemuese",
      keywords: [
        "karotte",
        "sellerie",
        "zwiebel",
        "knoblauch",
        "paprika",
        "tomate",
        "basilikum",
        "petersilie",
        "koriander",
        "thymian",
        "rosmarin",
        "zitrone",
        "limette",
        "ingwer",
        "spargel",
        "aubergine",
        "kartoffel",
        "b\xE4rlauch",
        "beere",
        "banane",
        "kr\xE4uter",
        "zuckerschot",
        "apfel",
        "birne",
        "salat",
        "gurk",
        "lauch",
        "schalotte",
        "peperoncino",
        "chili",
        "kapern",
        "minze",
        "dill",
        "avocado",
        "kresse",
        "zweige",
        "topping"
      ]
    }
  ]
};

// src/mila/shopping.ts
var SHOP_ORDER = shop_rules_default.order;
var SHOP_LABELS = shop_rules_default.labels;

// src/mila/portions.ts
var CATEGORY_LABELS = {
  schnell: "Schnell",
  mealprep: "Meal-Prep",
  wochenende: "Wochenende",
  grill: "Grill",
  fruehstueck: "Fr\xFChst\xFCck"
};
var CATEGORIES = Object.keys(CATEGORY_LABELS);
var DEVICE_LABELS = {
  thermomix: "Thermomix",
  pfanne: "Pfanne",
  topf: "Topf",
  wok: "Wok",
  ofen: "Ofen",
  plancha: "Plancha",
  bge: "Big Green Egg",
  dutch_oven: "Dutch Oven"
};
var DEVICES = Object.keys(DEVICE_LABELS);

// src/mila/engine.ts
var DEFAULT_RHYTHM = {
  lunches: 3,
  dinners: 3,
  card_weekday: 5,
  card_time: "00:00",
  close_weekday: 7,
  close_time: "20:00",
  adopt_weekday: 6,
  adopt_time: "14:00",
  shop_weekday: 1,
  prep_weekday: 1,
  prep_time: "17:00"
};

// src/mila/wahl.ts
var DAY = 864e5;
var ABEND_PORTIONEN = 3;
var MITTAG_PORTIONEN = 2;
var RESTE_PORTIONEN = 2;
var daysBetween = (a, b) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / DAY);
function planTimes(week, r) {
  const base = addDays(week, -7);
  return {
    opens: `${addDays(base, r.card_weekday - 1)}T${r.card_time.slice(0, 5)}`,
    deadline: `${addDays(base, r.close_weekday - 1)}T${r.close_time.slice(0, 5)}`,
    einkauf: addDays(week, r.shop_weekday - 1),
    prep: addDays(week, r.prep_weekday - 1)
  };
}
function wahlWeek(now, r) {
  const monday = startMonday(now.slice(0, 10));
  const next = addDays(monday, 7);
  return now >= planTimes(next, r).opens ? next : null;
}
function startMonday(d) {
  const wd = (fromISO(d).getDay() + 6) % 7;
  return addDays(d, -wd);
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
var FALLBACK = { obst_gemuese: 5, kuehl: 7, fleisch_fisch: 2, trocken: null, getraenke: null, sonstiges: 7 };
function ingredientDays(i, rules) {
  if (i.pantry_basic || i.shop_category === "trocken" || i.shop_category === "getraenke") return null;
  const n = i.name.toLowerCase();
  let best;
  for (const r of rules) {
    if (!n.includes(r.stichwort.toLowerCase())) continue;
    if (r.tage === null) {
      if (best === void 0) best = null;
    } else if (best === void 0 || best === null || r.tage < best) best = r.tage;
  }
  if (best !== void 0) return best;
  return FALLBACK[i.shop_category] ?? 7;
}
var isPrepped = (r) => r.prep_info ? !!r.prep_info.tauglich : r.prep_box;
function dishDays(r, ings, rules, prepOffset) {
  let raw = null;
  for (const i of ings) {
    const d = ingredientDays(i, rules);
    if (d !== null && (raw === null || d < raw)) raw = d;
  }
  if (raw === null || raw >= 5) return { days: raw, gruppe: "schluss" };
  if (isPrepped(r)) return { days: Math.max(raw, prepOffset + (r.prep_info?.haltbar_tage ?? 3)), gruppe: "prep" };
  return { days: raw, gruppe: "zuerst" };
}
function eingangFromSwipes(swipes) {
  const by = /* @__PURE__ */ new Map();
  for (const s of swipes) by.set(s.recipe_id, [...by.get(s.recipe_id) ?? [], s.wahl]);
  return [...by.entries()].filter(([, w]) => w.some((x) => x !== "nein")).map(([recipe_id, w]) => ({ recipe_id, art: w.includes("stern") ? "joker" : w.filter((x) => x !== "nein").length >= 2 ? "treffer" : "halb" }));
}
var ART_RANK = { joker: 0, treffer: 1, halb: 2, offen: 3 };
function buildKombo(input) {
  const { plan, eingang, rules, ingredientsOf } = input;
  const byId = new Map(input.recipes.map((r) => [r.id, r]));
  const einkauf = plan.einkauf_tag ?? plan.week;
  const prepDay = plan.prep_tag ?? einkauf;
  const prepOffset = Math.max(0, daysBetween(einkauf, prepDay));
  const artOf = new Map(eingang.map((e) => [e.recipe_id, e.art]));
  const out = [];
  const choose = (meal, n) => {
    const cards = plan.deck.filter((c) => c.meal === meal && byId.has(c.recipe_id));
    const ranked = cards.map((c) => {
      const r = byId.get(c.recipe_id);
      const art = artOf.get(c.recipe_id) ?? "offen";
      const bonus = (r.prep_box ? 1.5 : 0) + (meal === "abend" && r.cook_double ? 1.5 : 0) + hash(input.seed + r.id);
      return { r, art, bonus };
    }).sort((a, b) => ART_RANK[a.art] - ART_RANK[b.art] || b.bonus - a.bonus);
    const taken = ranked.slice(0, n);
    const reserve = ranked.slice(n).filter((x) => x.art !== "offen");
    for (const x of taken) out.push(item(x.r, meal, x.art, "offen"));
    for (const x of reserve) out.push(item(x.r, meal, x.art, "reserve"));
  };
  const item = (r, meal, art, status) => {
    const { days, gruppe } = dishDays(r, ingredientsOf(r.id), rules, prepOffset);
    return {
      key: meal + ":" + r.id,
      parent_key: null,
      recipe_id: r.id,
      slot: meal,
      gruppe,
      position: 0,
      art,
      portionen: meal === "abend" ? ABEND_PORTIONEN : MITTAG_PORTIONEN,
      variante: "original",
      status,
      frist_bis: days === null ? null : addDays(einkauf, days)
    };
  };
  choose("abend", plan.abend_anzahl);
  choose("mittag", plan.mittag_anzahl);
  return order(out, byId);
}
function order(items, byId) {
  const G = { zuerst: 0, prep: 1, schluss: 2 };
  const active = items.filter((i) => i.status !== "reserve" && i.slot !== "reste");
  const sorted = [...active].sort((a, b) => G[a.gruppe] - G[b.gruppe] || (a.frist_bis ?? "9999").localeCompare(b.frist_bis ?? "9999") || (a.slot === "abend" ? -1 : 1) - (b.slot === "abend" ? -1 : 1));
  const out = [];
  for (const it of sorted) {
    out.push(it);
    const r = byId.get(it.recipe_id);
    if (it.slot === "abend" && r?.cook_double) {
      out.push({ ...it, key: "reste:" + it.recipe_id, parent_key: it.key, slot: "reste", art: it.art, portionen: RESTE_PORTIONEN, frist_bis: null });
    }
  }
  const reserve = items.filter((i) => i.status === "reserve");
  return [...out, ...reserve].map((x, k) => ({ ...x, position: k + 1 }));
}
export {
  DEFAULT_RHYTHM,
  buildKombo,
  eingangFromSwipes,
  planTimes,
  wahlWeek
};
