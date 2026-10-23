// Un mes de ejemplo que se recalcula al mover el día: el resumen de la portada y la gráfica de proyección

const DAYS = 31;
const INCOME = 3_300_000;

/** Pagos que se repiten cada mes: Qadre ya los conoce por los meses anteriores. */
const FIXED = [
  [2, "Arriendo", 850_000],
  [2, "Diezmo", 290_000],
  [8, "Air-e", 134_500],
  [12, "Claro hogar", 89_900],
  [15, "Triple A", 61_600],
  [15, "Netflix", 26_900],
  [18, "Disney+", 23_900],
  [20, "YouTube Premium", 19_900],
  [22, "Spotify", 17_900],
  [25, "Plan Tigo", 45_000],
];

const CATS = [
  { id: "mercado", name: "Mercado", budget: 600_000 },
  { id: "domicilios", name: "Domicilios y restaurantes", budget: 220_000 },
  { id: "cafe", name: "Café y antojos", budget: 80_000 },
  { id: "transporte", name: "Transporte", budget: 160_000 },
];

/** Gasto variable: [día, categoría, valor]. */
const VARIABLE = [
  [3, "mercado", 142_000], [10, "mercado", 118_300], [17, "mercado", 128_900], [24, "mercado", 136_000], [30, "mercado", 74_000],
  [4, "domicilios", 32_300], [7, "domicilios", 38_900], [9, "domicilios", 41_000], [11, "domicilios", 29_500],
  [14, "domicilios", 45_600], [16, "domicilios", 36_200], [18, "domicilios", 52_100], [19, "domicilios", 53_400],
  [23, "domicilios", 31_000], [27, "domicilios", 28_000],
];
[1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 15, 16, 17, 19, 22, 24, 26, 29].forEach((d, i) => VARIABLE.push([d, "cafe", [7_400, 8_300, 6_900, 7_600][i % 4]]));
for (let d = 1; d <= DAYS; d++) if (d % 7 !== 0) VARIABLE.push([d, "transporte", 5_500]);

const FIXED_TOTAL = FIXED.reduce((s, [, , v]) => s + v, 0);
const sumUpTo = (list, day, cat) => list.reduce((s, [d, c, v]) => (d <= day && (!cat || c === cat) ? s + v : s), 0);
const variableUpTo = (day, cat) => sumUpTo(VARIABLE, day, cat);
const spentUpTo = (day) => sumUpTo(FIXED, day) + variableUpTo(day);
const REAL_TOTAL = spentUpTo(DAYS);

/** Lo que diría cada método el día `day` sobre el total del mes. */
const naive = (day) => (spentUpTo(day) * DAYS) / day;
const smart = (day) => FIXED_TOTAL + (variableUpTo(day) * DAYS) / day;

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const cop = (n) => money.format(Math.round(n)).replace(/\s/g, "");
const round1k = (n) => Math.round(n / 1_000) * 1_000;
const pct = (n) => `${Math.round(n * 100)} %`;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


// Portada: el resumen del mes

const catList = $("[data-cats]");
catList.innerHTML = CATS.map(
  (c) => `<li class="cat" data-cat="${c.id}">
    <div class="cat__row"><span class="cat__name">${c.name}</span><span class="cat__num"></span></div>
    <div class="cat__bar"><span class="cat__fill"></span><span class="cat__mark"></span></div>
  </li>`,
).join("");

function renderMonth(day) {
  const spent = spentUpTo(day);
  const left = INCOME - spent;
  const used = spent / INCOME;
  const elapsed = day / DAYS;
  $('[data-out="dayLabel"]').textContent = `día ${day} de ${DAYS}`;
  $('[data-out="dayLabel2"]').textContent = `Día ${day} de ${DAYS}`;
  $('[data-out="left"]').textContent = cop(left);
  $('[data-out="sub"]').innerHTML = `Entraron <b>${cop(INCOME)}</b> y salieron <b>${cop(spent)}</b>.`;
  $('[data-bar="pace"]').style.width = `${Math.min(100, used * 100)}%`;
  $('[data-bar="pace"]').dataset.tone = used > elapsed + 0.05 ? "warn" : "ok";
  $('[data-mark="today"]').style.left = `${elapsed * 100}%`;
  $('[data-out="pace"]').textContent =
    `Has usado el ${pct(used)} de lo que entró y va el ${pct(elapsed)} del mes.` +
    (day < DAYS ? ` Puedes gastar unos ${cop(round1k(left / (DAYS - day)))} diarios.` : "");

  let alert = null;
  for (const c of CATS) {
    const value = variableUpTo(day, c.id);
    const projected = (value * DAYS) / day;
    const li = $(`[data-cat="${c.id}"]`, catList);
    const tone = value > c.budget ? "over" : projected > c.budget * 1.05 && day < DAYS ? "warn" : "ok";
    li.dataset.tone = tone;
    $(".cat__num", li).innerHTML = `<b>${cop(value)}</b> de ${cop(c.budget)}`;
    $(".cat__fill", li).style.width = `${Math.min(100, (value / c.budget) * 100)}%`;
    $(".cat__mark", li).style.left = `${elapsed * 100}%`;
    if (tone === "over" && alert?.tone !== "over") {
      alert = { tone, text: `Te pasaste en ${c.name.toLowerCase()}: llevas ${cop(value)} de ${cop(c.budget)}.` };
    } else if (tone === "warn" && !alert) {
      alert = { tone, text: `A este ritmo te pasas en ${c.name.toLowerCase()}: cerrarías cerca de ${cop(round1k(projected))}.` };
    }
  }
  const box = $('[data-out="alert"]');
  box.dataset.tone = alert ? alert.tone : "ok";
  box.textContent = alert ? alert.text : day < DAYS ? "Vas bien: ninguna categoría va por encima de su ritmo." : "Mes cerrado sin pasarte en ninguna categoría.";
}

// Gráfica de proyección

const svg = $("[data-svg]");
const W = 760, H = 360, PAD = { l: 56, r: 12, t: 20, b: 36 };
const Y_MAX = 6_000_000;
const x = (d) => PAD.l + ((d - 1) / (DAYS - 1)) * (W - PAD.l - PAD.r);
const y = (v) => PAD.t + (1 - Math.min(v, Y_MAX * 1.04) / Y_MAX) * (H - PAD.t - PAD.b);
const NS = "http://www.w3.org/2000/svg";
const el = (name, attrs, parent = svg) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.appendChild(node);
  return node;
};

function drawChart() {
  for (let v = 0; v <= Y_MAX; v += 2_000_000) {
    el("line", { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), class: "grid" });
    el("text", { x: PAD.l - 10, y: y(v) + 4, class: "tick", "text-anchor": "end" }).textContent = v === 0 ? "$0" : `$${v / 1_000_000} M`;
  }
  for (const d of [1, 5, 10, 15, 20, 25, 31]) {
    el("text", { x: x(d), y: H - 10, class: "tick", "text-anchor": "middle" }).textContent = d;
  }
  el("line", { x1: PAD.l, x2: W - PAD.r, y1: y(REAL_TOTAL), y2: y(REAL_TOTAL), class: "line line--real" });
  const days = Array.from({ length: DAYS }, (_, i) => i + 1);
  const clip = el("clipPath", { id: "area" });
  el("rect", { x: 0, y: PAD.t - 6, width: W, height: H - PAD.t - PAD.b + 6 }, clip);
  const g = el("g", { "clip-path": "url(#area)" });
  el("polyline", { points: days.map((d) => `${x(d)},${y(naive(d))}`).join(" "), class: "line line--naive" }, g);
  el("polyline", { points: days.map((d) => `${x(d)},${y(smart(d))}`).join(" "), class: "line line--smart" }, g);
  // La regla de tres se sale de la gráfica los primeros días: se dice cuánto.
  const peak = days.reduce((a, d) => (naive(d) > naive(a) ? d : a), 1);
  el("text", { x: x(peak) + 8, y: PAD.t + 6, class: "off" }).textContent = `↑ ${cop(round1k(naive(peak)))} el día ${peak}`;
  el("line", { x1: 0, x2: 0, y1: PAD.t, y2: H - PAD.b, class: "cursor", "data-cursor": "" });
  el("circle", { r: 5, class: "dot dot--naive", "data-dot": "naive" });
  el("circle", { r: 5, class: "dot dot--smart", "data-dot": "smart" });
}

function renderChart(day) {
  const cx = x(day);
  const cur = $("[data-cursor]", svg);
  cur.setAttribute("x1", cx);
  cur.setAttribute("x2", cx);
  const n = naive(day), s = smart(day);
  const dn = $('[data-dot="naive"]', svg);
  dn.setAttribute("cx", cx);
  dn.setAttribute("cy", y(n));
  dn.style.opacity = n > Y_MAX ? 0 : 1;
  const ds = $('[data-dot="smart"]', svg);
  ds.setAttribute("cx", cx);
  ds.setAttribute("cy", y(s));
  $('[data-out="naive"]').textContent = cop(round1k(n));
  $('[data-out="smart"]').textContent = cop(round1k(s));
  $('[data-out="real"]').textContent = cop(round1k(REAL_TOTAL));
}

drawChart();

// Un solo día para toda la página

// La tira de 31 días: cada día es un botón; los que ya pasaron quedan marcados.
const strip = $("[data-days]");
strip.innerHTML = Array.from(
  { length: DAYS },
  (_, i) => `<button type="button" class="day" data-d="${i + 1}" aria-label="Día ${i + 1}">${i + 1}</button>`,
).join("");
const dayButtons = $$(".day", strip);
strip.addEventListener("click", (e) => {
  const b = e.target.closest(".day");
  if (b) setDay(Number(b.dataset.d));
});

const sliders = $$("[data-day]");
function setDay(day) {
  sliders.forEach((s) => {
    s.value = day;
    s.style.setProperty("--p", `${((day - 1) / (DAYS - 1)) * 100}%`);
  });
  dayButtons.forEach((b, i) => {
    b.classList.toggle("is-past", i + 1 < day);
    b.setAttribute("aria-pressed", String(i + 1 === day));
  });
  // En el celular la tira se desliza: el día elegido queda a la vista sin mover la página.
  if (strip.scrollWidth > strip.clientWidth) {
    const b = dayButtons[day - 1];
    strip.scrollLeft = b.offsetLeft - strip.clientWidth / 2 + b.offsetWidth / 2;
  }
  renderMonth(day);
  renderChart(day);
}
sliders.forEach((s) => s.addEventListener("input", () => setDay(Number(s.value))));

// Al abrir, el mes "corre" del día 1 al 20 una sola vez.
if (reduced) setDay(20);
else {
  const start = performance.now();
  const run = (t) => {
    const k = Math.min(1, (t - start) / 1600);
    const eased = 1 - Math.pow(1 - k, 3);
    setDay(Math.max(1, Math.round(1 + eased * 19)));
    if (k < 1) requestAnimationFrame(run);
  };
  setDay(1);
  requestAnimationFrame(run);
}

// Galería y entradas al hacer scroll

const gallery = $("[data-gallery]");
$$("[data-scroll]").forEach((b) =>
  b.addEventListener("click", () => {
    const step = gallery.querySelector(".shot").getBoundingClientRect().width + 24;
    gallery.scrollBy({ left: Number(b.dataset.scroll) * step, behavior: reduced ? "auto" : "smooth" });
  }),
);

if ("IntersectionObserver" in window && !reduced) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }),
    { rootMargin: "0px 0px -10% 0px" },
  );
  $$(".reveal").forEach((n) => io.observe(n));
} else {
  $$(".reveal").forEach((n) => n.classList.add("is-in"));
}
