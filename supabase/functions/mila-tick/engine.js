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
function weekday(s) {
  const js = fromISO(s).getDay();
  return js === 0 ? 7 : js;
}
function startOfWeek(s) {
  return addDays(s, 1 - weekday(s));
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

// src/lib/recur.ts
function shift(date, repeat, n) {
  const d = fromISO(date);
  if (repeat === "weekly") d.setDate(d.getDate() + 7 * n);
  if (repeat === "monthly") {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  if (repeat === "yearly") {
    const m = d.getMonth();
    const day = d.getDate();
    d.setFullYear(d.getFullYear() + n, m, 1);
    const last = new Date(d.getFullYear(), m + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return toISO(d);
}
function occurrences(events, from, to) {
  const out = [];
  for (const e of events) {
    const span = e.end_date && e.end_date > e.date ? (fromISO(e.end_date).getTime() - fromISO(e.date).getTime()) / 864e5 : 0;
    const push = (start, isRepeat) => {
      const end = span ? addDays(start, Math.round(span)) : start;
      if (end < from || start > to) return;
      out.push({ ...e, occ_date: start, occ_end: end, base_id: e.id, is_repeat: isRepeat });
    };
    if (!e.repeat) {
      push(e.date, false);
      continue;
    }
    let n = 0;
    while (n < 400) {
      const start = shift(e.date, e.repeat, n);
      if (start > to) break;
      if (e.repeat_until && start > e.repeat_until) break;
      push(start, n > 0);
      n++;
    }
  }
  return out.sort((a, b) => a.occ_date.localeCompare(b.occ_date) || (a.start_time ?? "99").localeCompare(b.start_time ?? "99"));
}

// src/lib/week.ts
var SLOT_ORDER = ["valerie_bringen", "valerie_holen", "valerie_tag", "anna_arbeit", "nachmittag", "abend_essen", "abend_bett", "wochenende"];
function dayState(date, template, overrides) {
  const wd = weekday(date);
  const out = {};
  for (const row of template) {
    if (row.weekday !== wd) continue;
    out[row.slot] = {
      slot: row.slot,
      value: row.value,
      at: row.at,
      is_open: row.is_open,
      note: row.note,
      overridden: false,
      template: row
    };
  }
  for (const o of overrides) {
    if (o.date !== date) continue;
    const base = out[o.slot];
    out[o.slot] = {
      slot: o.slot,
      value: o.value,
      at: o.at ?? base?.at ?? null,
      is_open: false,
      note: o.note,
      overridden: true,
      override: o,
      template: base?.template
    };
  }
  return out;
}

// src/lib/effects.ts
var NO_EFFECTS = { valerieWeg: null, kitaZu: null, away: [], messe: null, isFirst: false, isLast: false };
function dayEffects(date, occ, members) {
  const fx = { ...NO_EFFECTS, away: [] };
  for (const o of occ) {
    if (o.occ_date > date || o.occ_end < date) continue;
    if (o.effect === "valerie_weg") {
      if (!fx.valerieWeg || o.occ_end > fx.valerieWeg.occ_end) fx.valerieWeg = o;
    } else if (o.effect === "kita_zu") {
      if (!fx.kitaZu || o.occ_end > fx.kitaZu.occ_end) fx.kitaZu = o;
    } else if (o.effect === "eltern_weg" && o.member_id) {
      const m = members.find((x) => x.id === o.member_id);
      if (m && !fx.away.some((a) => a.member.id === m.id)) fx.away.push({ member: m, occ: o });
    } else if (o.effect === "messe") {
      fx.messe = o;
      for (const m of members.filter((x) => x.role === "partner")) {
        if (!fx.away.some((a) => a.member.id === m.id)) fx.away.push({ member: m, occ: o });
      }
    }
  }
  if (fx.valerieWeg) {
    fx.isFirst = fx.valerieWeg.occ_date === date;
    fx.isLast = fx.valerieWeg.occ_end === date;
  }
  return fx;
}
function sameName(value, name) {
  return !!value && value.trim().toLowerCase() === name.trim().toLowerCase();
}
function applyEffects(state, fx) {
  const out = { ...state };
  if (fx.valerieWeg) {
    delete out.valerie_bringen;
    delete out.valerie_holen;
    delete out.valerie_tag;
    if (!fx.isLast) delete out.abend_bett;
  } else if (fx.kitaZu) {
    delete out.valerie_bringen;
    delete out.valerie_holen;
    if (!out.valerie_tag) {
      out.valerie_tag = { slot: "valerie_tag", value: null, at: null, is_open: true, note: null, overridden: false };
    }
  } else {
    delete out.valerie_tag;
  }
  for (const a of fx.away) {
    const name = a.member.display_name;
    if (sameName("anna", name) && out.anna_arbeit && !out.anna_arbeit.overridden) delete out.anna_arbeit;
    for (const s of SLOT_ORDER) {
      const cur = out[s];
      if (!cur || cur.overridden || !sameName(cur.value, name)) continue;
      const open = { ...cur, value: null, is_open: true, note: `${name} ist weg` };
      out[s] = open;
    }
  }
  return out;
}

// src/mila/shop-rules.json
var shop_rules_default = {
  order: ["obst_gemuese", "kuehl", "trocken", "getraenke", "sonstiges"],
  labels: {
    obst_gemuese: "Obst & Gem\xFCse",
    kuehl: "K\xFChlregal",
    trocken: "Trocken & Vorrat",
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
      cat: "kuehl",
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
      keywords: ["wein", "bier", "limonad", "cola", "prosecco"]
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
function hashCode(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) | 0;
  return h >>> 0;
}

// src/mila/engine.ts
var DEFAULT_RHYTHM = {
  lunches: 3,
  dinners: 3,
  card_weekday: 5,
  card_time: "18:00",
  close_weekday: 6,
  close_time: "12:00",
  adopt_weekday: 6,
  adopt_time: "14:00",
  shop_weekday: 6,
  prep_weekday: 7,
  prep_time: "17:00"
};
var stamp = (date, time) => `${date}T${time.slice(0, 5)}`;
function cardWeek(now, r) {
  const next = addDays(startOfWeek(now.slice(0, 10)), 7);
  return now >= menuTimes(next, r).opens ? next : null;
}
function menuTimes(week, r) {
  const base = addDays(week, -7);
  const opens = stamp(addDays(base, r.card_weekday - 1), r.card_time);
  let closes = stamp(addDays(base, r.close_weekday - 1), r.close_time);
  if (closes < opens) closes = opens;
  let adopt = stamp(addDays(base, r.adopt_weekday - 1), r.adopt_time);
  if (adopt < closes) adopt = closes;
  return { opens, closes, adopt };
}
function prepDate(week, r) {
  return addDays(week, -7 + r.prep_weekday - 1);
}
function workDays(week) {
  return [0, 1, 2, 3, 4].map((i) => addDays(week, i));
}
var CARD_SIZE = 8;
function fitsMeal(r, meal) {
  if (r.category === "fruehstueck") return false;
  return r.meal === "beides" || r.meal === meal;
}
function stats(weekDays, votes, before) {
  const last = /* @__PURE__ */ new Map();
  const eaten = /* @__PURE__ */ new Map();
  for (const d of weekDays) {
    if (!d.recipe_id || d.is_leftover || d.date >= before) continue;
    eaten.set(d.recipe_id, (eaten.get(d.recipe_id) ?? 0) + 1);
    if ((last.get(d.recipe_id) ?? "") < d.date) last.set(d.recipe_id, d.date);
  }
  const liked = /* @__PURE__ */ new Map();
  for (const v of votes) if (v.vote !== "nein") liked.set(v.recipe_id, (liked.get(v.recipe_id) ?? 0) + (v.vote === "joker" ? 2 : 1));
  return { last, eaten, liked };
}
function generateCard(input) {
  const { week, recipes, weekDays, votes, rhythm } = input;
  const recent = new Set(weekDays.filter((d) => d.recipe_id && d.date >= addDays(week, -7) && d.date <= addDays(week, 6)).map((d) => d.recipe_id));
  const pool = recipes.filter((r) => r.category !== "fruehstueck" && !recent.has(r.id));
  const st = stats(weekDays, votes, week);
  const dice = (id, salt) => hashCode(week + salt + id);
  const fav = pool.filter((r) => (st.liked.get(r.id) ?? 0) + (st.eaten.get(r.id) ?? 0) > 0).sort((a, b) => (st.liked.get(b.id) ?? 0) + (st.eaten.get(b.id) ?? 0) - ((st.liked.get(a.id) ?? 0) + (st.eaten.get(a.id) ?? 0)) || dice(a.id, "f") - dice(b.id, "f"));
  const long = pool.filter((r) => st.last.has(r.id)).sort((a, b) => st.last.get(a.id).localeCompare(st.last.get(b.id)) || dice(a.id, "l") - dice(b.id, "l"));
  const rare = pool.filter((r) => (st.eaten.get(r.id) ?? 0) <= 1).sort((a, b) => dice(a.id, "n") - dice(b.id, "n"));
  const any = [...pool].sort((a, b) => dice(a.id, "a") - dice(b.id, "a"));
  const lists = { fav, long, rare };
  const pattern = ["fav", "long", "rare", "fav", "long", "fav", "long", "rare"];
  const used = /* @__PURE__ */ new Set();
  const cards = { abend: [], mittag: [] };
  const size = { abend: rhythm.dinners > 0 ? CARD_SIZE : 0, mittag: rhythm.lunches > 0 ? CARD_SIZE : 0 };
  for (let i = 0; i < CARD_SIZE; i++) {
    for (const meal of ["abend", "mittag"]) {
      if (cards[meal].length >= size[meal]) continue;
      const ok = (r) => !used.has(r.id) && fitsMeal(r, meal);
      const pick = lists[pattern[i]].find(ok) ?? any.find(ok);
      if (!pick) continue;
      used.add(pick.id);
      cards[meal].push(pick.id);
    }
  }
  return { dinner_ids: cards.abend, lunch_ids: cards.mittag };
}
function dayInfo(date, ctx) {
  const occ = occurrences(ctx.events, date, date).filter((o) => o.occ_date <= date && o.occ_end >= date);
  const fx = dayEffects(date, occ, ctx.members);
  const partners = ctx.members.filter((m) => m.role === "partner");
  const adults = partners.filter((p) => !fx.away.some((a) => a.member.id === p.id)).length;
  const valerieHome = !fx.valerieWeg;
  const essen = applyEffects(dayState(date, ctx.normalWeek, ctx.overrides), fx).abend_essen;
  const v = (essen?.value ?? "").trim();
  const eatOut = !!essen && !essen.is_open && !!v && !/^beide$/i.test(v) && !/^[A-ZÄÖÜ][a-zäöüß]+$/.test(v);
  return {
    date,
    adults,
    valerieDinner: valerieHome || fx.isLast,
    valerieLunch: valerieHome && !!fx.kitaZu,
    skip: adults === 0,
    eatOut
  };
}
function servingsFor(info, meal) {
  const v = meal === "abend" ? info.valerieDinner : info.valerieLunch;
  return Math.max(1, info.adults + (v ? 1 : 0));
}
function cookOn(date, ctx) {
  const occ = occurrences(ctx.events, date, date).filter((o) => o.occ_date <= date && o.occ_end >= date);
  const st = applyEffects(dayState(date, ctx.normalWeek, ctx.overrides), dayEffects(date, occ, ctx.members));
  const e = st.abend_essen;
  if (!e) return { value: null, open: false, member: null };
  const open = e.is_open || !e.value;
  const member = !open ? ctx.members.find((m) => m.display_name.trim().toLowerCase() === (e.value ?? "").trim().toLowerCase()) ?? null : null;
  return { value: open ? null : e.value, open, member };
}
function rank(menu, ids, meal, votes, voters) {
  const order = { joker: 0, treffer: 1, aufgefuellt: 2 };
  return ids.map((id) => {
    const vs = votes.filter((v) => v.recipe_id === id && v.meal === meal && voters.includes(v.member_id));
    const pos = vs.filter((v) => v.vote !== "nein");
    const points = vs.reduce((n, v) => n + (v.vote === "joker" ? 2 : v.vote === "ja" ? 1 : 0), 0);
    const joker_by = vs.filter((v) => v.vote === "joker").map((v) => v.member_id);
    const all = voters.length > 0 && voters.every((m) => pos.some((v) => v.member_id === m));
    const kind = joker_by.length ? "joker" : all ? "treffer" : "aufgefuellt";
    return { recipe_id: id, meal, kind, joker_by, points, vetoed: pos.length === 0 && vs.length > 0, dice: hashCode(menu.id + meal + id) };
  }).sort((a, b) => order[a.kind] - order[b.kind] || b.points - a.points || a.dice - b.dice);
}
function choose(ranked, need) {
  const chosen = ranked.filter((r) => r.kind === "joker");
  const hits = ranked.filter((r) => r.kind === "treffer");
  const reserve = [];
  for (const h of hits) (chosen.length < need ? chosen : reserve).push(h);
  for (const r of ranked) {
    if (chosen.length >= need) break;
    if (r.kind === "aufgefuellt" && !r.vetoed) chosen.push(r);
  }
  return { chosen, reserve };
}
var strip = ({ recipe_id, meal, kind, joker_by, points }) => ({ recipe_id, meal, kind, joker_by, points });
function layout(dinners, lunches, days, recipes, r) {
  const avail = days.filter((d) => !d.skip);
  const evenings = avail.filter((d) => !d.eatOut);
  const byDate = new Map(avail.map((d) => [d.date, d]));
  const recipe = (id) => recipes.find((x) => x.id === id);
  const slots = [];
  const lunchTaken = /* @__PURE__ */ new Set();
  let budget = r.lunches;
  dinners.slice(0, evenings.length).forEach((id, i) => {
    const d = evenings[i];
    slots.push({ date: d.date, meal: "abend", recipe_id: id, leftover: false, servings: servingsFor(d, "abend") });
    const next = byDate.get(addDays(d.date, 1));
    if (recipe(id)?.cook_double && next && budget > 0 && !lunchTaken.has(next.date)) {
      slots.push({ date: next.date, meal: "mittag", recipe_id: id, leftover: true, servings: servingsFor(next, "mittag") });
      lunchTaken.add(next.date);
      budget--;
    }
  });
  const placedLunches = [];
  for (const id of lunches) {
    if (budget <= 0) break;
    const d = avail.find((x) => !lunchTaken.has(x.date));
    if (!d) break;
    slots.push({ date: d.date, meal: "mittag", recipe_id: id, leftover: false, servings: servingsFor(d, "mittag") });
    lunchTaken.add(d.date);
    placedLunches.push(id);
    budget--;
  }
  slots.sort((a, b) => a.date.localeCompare(b.date) || (a.meal === "mittag" ? -1 : 1) - (b.meal === "mittag" ? -1 : 1));
  return { slots, placedLunches };
}
function votersOf(menu, votes, members) {
  return members.filter((m) => m.role === "partner" && votes.some((v) => v.menu_id === menu.id && v.member_id === m.id)).map((m) => m.id);
}
function computePlan(menu, allVotes, recipes, r, ctx) {
  const votes = allVotes.filter((v) => v.menu_id === menu.id);
  const voters = votersOf(menu, votes, ctx.members);
  const known = new Set(recipes.map((x) => x.id));
  const days = workDays(menu.week).map((d) => dayInfo(d, ctx));
  const avail = days.filter((d) => !d.skip);
  const evenings = avail.filter((d) => !d.eatOut);
  const recipe = (id) => recipes.find((x) => x.id === id);
  const dRanked = rank(menu, menu.dinner_ids.filter((id) => known.has(id)), "abend", votes, voters);
  const dNeed = Math.min(r.dinners, evenings.length);
  const dPick = choose(dRanked, dNeed);
  const pool = [...dPick.chosen];
  const dinners = [];
  let budget = r.lunches;
  const count = Math.min(pool.length, evenings.length);
  for (let i = 0; i < count; i++) {
    const d = evenings[i];
    const nextFree = avail.some((x) => x.date === addDays(d.date, 1));
    const wantDouble = nextFree && budget > 0;
    let k = pool.findIndex((p2) => !!recipe(p2.recipe_id)?.cook_double === wantDouble);
    if (k < 0) k = 0;
    const [p] = pool.splice(k, 1);
    dinners.push(p.recipe_id);
    if (wantDouble && recipe(p.recipe_id)?.cook_double) budget--;
  }
  dinners.push(...pool.map((p) => p.recipe_id));
  const lunchDays = avail.length - (r.lunches - budget);
  const lNeed = Math.max(0, Math.min(budget, lunchDays));
  const lRanked = rank(menu, menu.lunch_ids.filter((id) => known.has(id)), "mittag", votes, voters);
  const lPick = choose(lRanked, lNeed);
  const lunches = lPick.chosen.map((p) => p.recipe_id);
  const { slots } = layout(dinners, lunches, days, recipes, r);
  return {
    hits: [...dPick.chosen, ...lPick.chosen].map(strip),
    reserve: [...dPick.reserve, ...lPick.reserve].map(strip),
    dinners,
    lunches,
    slots,
    skipped: days.filter((d) => d.skip).map((d) => d.date),
    voters
  };
}
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
var dayTag = (date, meal) => meal === "mittag" ? `${weekdayShort(date)} \xB7 Mittag` : weekdayShort(date);
function prepPlan(rows, prepDay, recipes, prepSteps) {
  const items = [];
  const boxes = [];
  const tasks = [];
  const sorted = [...rows].filter((r) => r.recipe_id && !r.is_leftover).sort((a, b) => a.date.localeCompare(b.date) || (a.meal === "mittag" ? -1 : 1) - (b.meal === "mittag" ? -1 : 1));
  for (const row of sorted) {
    const r = recipes.find((x) => x.id === row.recipe_id);
    if (!r) continue;
    const tag = dayTag(row.date, row.meal);
    const steps = prepSteps.filter((s) => s.recipe_id === r.id).sort((a, b) => a.position - b.position);
    if (steps.length) {
      steps.forEach((s, k) => {
        const before = addDays(row.date, -1);
        if (s.day_before && before !== prepDay) {
          tasks.push({ date: before, title: `${s.text} \xB7 f\xFCr ${tag}: ${r.name}`, forDate: row.date, meal: row.meal });
          return;
        }
        const meta = [s.duration_min ? `${s.duration_min} Min` : null, s.runs_alongside ? "l\xE4uft nebenbei" : null, `f\xFCr ${tag} \xB7 ${r.name}`].filter(Boolean).join(" \xB7 ");
        items.push({ key: `${row.date}|${row.meal}|${k}`, text: s.text, meta, duration: s.duration_min, alongside: s.runs_alongside });
        if (s.box_label?.trim()) boxes.push({ key: `${row.date}|${row.meal}|${k}`, day: tag, what: s.box_label.trim(), lunch: row.meal === "mittag" });
      });
      continue;
    }
    if (row.meal === "mittag" || r.prep_box) {
      const verbTxt = row.meal === "mittag" ? "komplett vorkochen und in die Box" : "vorbereiten und in die Box";
      items.push({ key: `${row.date}|${row.meal}|0`, text: `${r.name} ${verbTxt}`, meta: [r.time_min ? `${r.time_min} Min` : null, `f\xFCr ${tag}`].filter(Boolean).join(" \xB7 "), duration: r.time_min, alongside: false });
      boxes.push({ key: `${row.date}|${row.meal}|0`, day: tag, what: r.name, lunch: row.meal === "mittag" });
    }
  }
  items.sort((a, b) => Number(b.alongside) - Number(a.alongside) || (b.duration ?? 0) - (a.duration ?? 0));
  const active = items.filter((i) => !i.alongside).reduce((n, i) => n + (i.duration ?? 0), 0);
  const along = Math.max(0, ...items.filter((i) => i.alongside).map((i) => i.duration ?? 0));
  return { items, boxes, tasks, total: Math.max(active, along) };
}
function adoptWrites(menu, plan, recipes, ingredients, prepSteps, r, ctx) {
  const weekDays = plan.slots.map((s) => ({ date: s.date, meal: s.meal, recipe_id: s.recipe_id, is_leftover: s.leftover, servings: s.servings }));
  const items = shoppingFor(menu.week, plan.slots, recipes, ingredients);
  const prep = prepPlan(weekDays, prepDate(menu.week, r), recipes, prepSteps);
  const tasks = prep.tasks.map((t) => {
    const cook = cookOn(t.meal === "abend" ? t.forDate : t.date, ctx);
    return { title: t.title, due_date: t.date, owner_member_id: cook.member?.id ?? null };
  });
  return { weekDays, items, tasks };
}

// src/lib/mwf.ts
var FAIR_EVENT_PREFIX = "fair:";
function fairEvents(fairs) {
  return fairs.map((f) => ({
    id: FAIR_EVENT_PREFIX + f.id,
    household_id: f.household_id,
    title: "Messe",
    date: f.date,
    end_date: null,
    start_time: null,
    end_time: null,
    member_id: null,
    person_id: null,
    note: f.note,
    repeat: null,
    repeat_until: null,
    effect: "messe",
    dropoff_by: null,
    dropoff_at: null,
    pickup_by: null,
    pickup_at: null,
    created_by: null,
    updated_by: null,
    created_at: f.created_at,
    updated_at: f.created_at
  }));
}
export {
  DEFAULT_RHYTHM,
  adoptWrites,
  cardWeek,
  computePlan,
  fairEvents,
  generateCard,
  menuTimes,
  weekKey,
  workDays
};
