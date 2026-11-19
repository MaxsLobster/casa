// Automatisch erzeugt aus src/manager/shared-entry.ts mit `npm run build:manager`. Nicht von Hand ändern.

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
function weekday(s) {
  const js = fromISO(s).getDay();
  return js === 0 ? 7 : js;
}
function isoWeek(s) {
  const d = fromISO(s);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
}
var WD_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
function weekdayShort(s) {
  return WD_SHORT[weekday(s) - 1];
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
function categorize(name) {
  const n = (name || "").toLowerCase();
  for (const { cat, keywords } of shop_rules_default.rules) for (const kw of keywords) if (n.includes(kw)) return cat;
  return "sonstiges";
}
function formatNumber(n) {
  const whole = Math.floor(n);
  const frac = n - whole;
  if (Math.abs(frac - 0.5) < 0.01) return (whole ? String(whole) : "") + "\xBD";
  if (Math.abs(frac - 0.25) < 0.01) return (whole ? String(whole) : "") + "\xBC";
  if (Math.abs(frac - 0.75) < 0.01) return (whole ? String(whole) : "") + "\xBE";
  if (Math.abs(frac) < 0.01) return String(whole);
  return String(Math.round(n * 100) / 100).replace(".", ",");
}
function formatAmount(amount, unit) {
  const u = (unit ?? "").trim();
  if (amount === null || amount === void 0) return u;
  const n = formatNumber(Number(amount));
  return u ? `${n} ${u}` : n;
}

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
function scaleAmount(amount, unit, factor) {
  if (amount === null || amount === void 0) return null;
  const v = Number(amount) * factor;
  const u = unit.trim().toLowerCase();
  if (u === "g" || u === "ml") return v >= 100 ? Math.round(v / 10) * 10 : Math.round(v) || (v > 0 ? 1 : 0);
  if (u === "kg" || u === "l") return Math.round(v * 100) / 100;
  const half = Math.round(v * 2) / 2;
  return half || (v > 0 ? 0.5 : 0);
}

// src/mila/week-list.ts
function weekKey(monday) {
  const year = fromISO(addDays(monday, 3)).getFullYear();
  return `${year}-W${String(isoWeek(monday)).padStart(2, "0")}`;
}

// src/mila/engine.ts
function shoppingFor(week, slots, recipes, ingredients) {
  const buckets = /* @__PURE__ */ new Map();
  for (const s of slots) {
    const r = recipes.find((x) => x.id === s.recipe_id);
    if (!r) continue;
    const cookDate = s.leftover ? addDays(s.date, -1) : s.date;
    const factor = Math.max(1, s.servings) / Math.max(1, r.portions);
    for (const i of ingredients.filter((x) => x.recipe_id === r.id)) {
      const name = i.name.trim();
      if (!name || /^wasser$/i.test(name)) continue;
      const unit = (i.unit ?? "").trim();
      const key = name.toLowerCase() + "|" + unit.toLowerCase();
      let b = buckets.get(key);
      if (!b) {
        b = { name, unit, amount: 0, has: false, cat: i.shop_category, stock: true, dates: /* @__PURE__ */ new Set(), rids: /* @__PURE__ */ new Set(), names: /* @__PURE__ */ new Set() };
        buckets.set(key, b);
      }
      if (i.amount !== null && i.amount !== void 0) {
        b.amount += Number(i.amount) * factor;
        b.has = true;
      }
      if (!i.pantry_basic) b.stock = false;
      b.dates.add(cookDate);
      b.rids.add(r.id);
      b.names.add(r.name);
    }
  }
  const wk = weekKey(week);
  return [...buckets.values()].map((b) => {
    const dates = [...b.dates].sort();
    return {
      name: b.name,
      amount: formatAmount(b.has ? scaleAmount(b.amount, b.unit, 1) : null, b.unit),
      category: b.cat,
      is_stock: b.stock,
      source_label: dates.length === 1 && b.names.size === 1 ? `${weekdayShort(dates[0])} \xB7 ${[...b.names][0]}` : dates.map((d) => weekdayShort(d)).join(" + "),
      source_week: wk,
      source_recipe_ids: [...b.rids]
    };
  });
}
function shortName(name) {
  return name.split(/\s+(mit|und|an|auf|vom|im)\s+/i)[0].trim();
}

// src/mila/recipe-view.ts
var norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/\d+([.,]\d+)?\s*(g|ml|el|tl|stück)?\b/g, "").replace(/\s+/g, " ").trim();
function matchIngredient(statt, ings) {
  const s = norm(statt);
  if (!s || s === "\u2013" || s === "-") return null;
  let best = null;
  let bestLen = 0;
  for (const i of ings) {
    const n = norm(i.name);
    if (!n) continue;
    if ((s.includes(n) || n.includes(s)) && n.length > bestLen) {
      best = i;
      bestLen = n.length;
    }
  }
  if (best) return best;
  const stem = s.split(" ")[0].replace(/fleisch$/, "");
  if (stem.length >= 3) return ings.find((i) => norm(i.name).includes(stem)) ?? null;
  return null;
}
var isAddition = (statt) => /^\s*[–-]?\s*$/.test(statt);
function variantOf(r, v) {
  if (v === "original") return null;
  return r.variants?.[v] ?? null;
}
function variantShopping(r, ings, v) {
  const variant = variantOf(r, v);
  if (!variant) return ings;
  const out = ings.map((i) => ({ ...i }));
  variant.tausch.forEach((t, k) => {
    if (isAddition(t.statt)) {
      out.push({ ...ings[0], id: `${r.id}-v${k}`, name: t.nimm, amount: null, unit: "", pantry_basic: false, shop_category: categorize(t.nimm), hint: null, blend_key: null, hf_original: null, anna_swap: false });
      return;
    }
    const hit = matchIngredient(t.statt, ings);
    const row = hit ? out.find((x) => x.id === hit.id) : null;
    if (row) row.name = `${row.name} (${v === "light" ? "Light" : "Protein"}: ${t.nimm})`;
  });
  return out;
}

// src/lib/freizeit.ts
var FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function berlin(iso) {
  const p = Object.fromEntries(FMT.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}
function tippEvent(t, radar) {
  const a = t.start ? berlin(t.start) : null;
  const date = a?.date ?? radar?.wochenende ?? null;
  if (!date) return null;
  const b = t.ende ? berlin(t.ende) : null;
  const span = b && a && b.date > a.date && b.date <= addDays(a.date, 3);
  const timed = !!a && !t.ganztags && !span;
  return {
    title: t.titel,
    date,
    end_date: span ? b.date : null,
    start_time: timed ? a.time : null,
    end_time: timed && b && b.date === a.date && b.time > a.time ? b.time : null,
    note: [t.ort, t.link].filter(Boolean).join(" \xB7 ") || null
  };
}
export {
  shoppingFor,
  shortName,
  tippEvent,
  variantShopping,
  weekKey
};
