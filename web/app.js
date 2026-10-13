"use strict";

const DEMO = new URLSearchParams(location.search).has("demo");
// Enquanto o 2º turno não tem votos, o endereço principal mostra o 1º turno
// (a mesma pasta da demo). Quando o coletor publica os primeiros votos, a
// página recarrega sozinha no modo ao vivo.
let PRIMEIRO_TURNO = DEMO;
let DATA_DIR = DEMO ? "data-demo" : "data";
async function segundoTurnoTemVotos() {
  try { const s = await getJSON("data/states.json"); return !!(s.national && s.national.valid); } catch { return false; }
}
async function detectarModo() {
  if (DEMO) return;
  const aoVivo = await segundoTurnoTemVotos();
  PRIMEIRO_TURNO = !aoVivo;
  DATA_DIR = aoVivo ? "data" : "data-demo";
  document.getElementById("aviso").hidden = aoVivo;
}
const REFRESH_MS = 60_000;
const C13 = "#e66767", C22 = "#3987e5", BASELINE = "#383835";
// Tom pela margem de vantagem (pontos percentuais dos votos válidos): até 5,
// 5–15, mais de 15. Cada tom mistura a cor do candidato com um cinza neutro de
// mesma luminosidade (55%, 78%, 100% em OKLab) — disputa apertada fica
// acinzentada, não escura, então lê igual em tema claro ou escuro. Os tons
// mais fracos de Lula e Flávio ainda ficam distinguíveis entre si (ΔE ≥ 15,
// ≥ 10 pra daltonismo) e com contraste ≥ 4,8:1 sobre o painel.
const SHADES = { "13": ["#c07a76", "#d4726e", C13], "22": ["#648bbc", "#5089d1", C22] };
const marginStep = margin => margin < 5 ? 0 : margin < 15 ? 1 : 2;
function leaderShade(v13, v22, valid) {
  if (!v13 && !v22) return BASELINE;
  const margin = 100 * Math.abs(v13 - v22) / (valid || v13 + v22);
  return SHADES[v13 >= v22 ? "13" : "22"][marginStep(margin)];
}
const votesOf = r => Object.fromEntries(r.candidates.map(c => [c.number, c.votes]));
const CAND_NAME = { "13": "Lula", "22": "Flávio Bolsonaro" };

const REGIOES = {
  "Norte": ["AC","AP","AM","PA","RO","RR","TO"],
  "Nordeste": ["AL","BA","CE","MA","PB","PE","PI","RN","SE"],
  "Centro-Oeste": ["DF","GO","MS","MT"],
  "Sudeste": ["ES","MG","RJ","SP"],
  "Sul": ["PR","RS","SC"],
};

function fmtPct(n) { return (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"; }
function fmtInt(n) { return (n ?? 0).toLocaleString("pt-BR"); }

async function getJSON(path) {
  // no-cache: o navegador pergunta ao servidor se mudou (304 vazio quando não) em vez
  // de baixar tudo de novo a cada minuto; o número chega igual de rápido.
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ---------------- stat panel ----------------
// Todas as porcentagens são sobre votos válidos (como o TSE divulga), nunca
// só entre Lula e Flávio — no 1º turno os outros candidatos entram na conta.
const displayName = c => CAND_NAME[c.number] || titleCase(c.name);
const candColor = number => number === "13" ? C13 : number === "22" ? C22 : "var(--ink-2)";
const fmtVotosExtenso = v => v >= 1e6
  ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} milhões de votos`
  : v >= 1e3 ? `${Math.round(v / 1e3).toLocaleString("pt-BR")} mil votos` : `${fmtInt(v)} votos`;
const ranked = candidates => [...candidates].sort((a, b) => b.votes - a.votes);

function renderStats(national) {
  const valid = national.valid || 0;
  const todos = ranked(national.candidates);
  const c13 = todos.find(c => c.number === "13") || { number: "13", votes: 0 };
  const c22 = todos.find(c => c.number === "22") || { number: "22", votes: 0 };
  const pct = c => shareOf(c.votes, valid);
  const [first, second] = todos;
  const nome = c => `<span style="color:${candColor(c.number)}">${escapeHtml(displayName(c))}</span>`;
  const apurado = national.sections_total ? 100 * national.sections_counted / national.sections_total : 0;

  let headline;
  if (!valid) headline = "A apuração ainda não começou";
  else if (national.decided && pct(first) > 50) headline = `${nome(first)} é eleito presidente`;
  else if (national.decided) headline = `${nome(first)} e ${nome(second)} vão ao 2º turno`;
  else headline = `${nome(first)} lidera a apuração`;
  document.getElementById("headline").innerHTML = headline;
  const [data, hora] = (national.as_of || "").split(" ");
  document.getElementById("dek").textContent = national.as_of ? `Atualizado em ${data.slice(0, 5)} às ${hora}` : "";

  const badge = document.getElementById("status-badge");
  badge.hidden = !valid;
  badge.classList.toggle("definido", !!national.decided);
  badge.textContent = national.decided ? "Resultado definido" : `Apurando · ${fmtPct(apurado)}`;

  document.getElementById("candidates").innerHTML = [c13, c22].map(c => `
    <div class="cand c${c.number}"><span class="name"><span class="swatch" style="background:${candColor(c.number)}"></span>${CAND_NAME[c.number]} (${c.number === "13" ? "PT" : "PL"})</span>
      <span class="pct">${fmtPct(pct(c))}</span><span class="votes">${fmtInt(c.votes)} votos</span></div>`).join("");
  // Lula cresce da esquerda, Flávio da direita; o vão no meio é o voto dos outros candidatos.
  document.getElementById("share-bar").innerHTML =
    `<i class="c13" style="width:${pct(c13)}%"></i><i class="c22" style="width:${pct(c22)}%"></i><div class="majority"></div>`;

  document.getElementById("diff-row").innerHTML = valid
    ? `<span>Diferença</span><span><strong>${Math.abs(pct(c13) - pct(c22)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pontos</strong> · ${fmtVotosExtenso(Math.abs(c13.votes - c22.votes))}</span>`
    : "";

  const outros = todos.filter(c => c.number !== "13" && c.number !== "22" && c.votes > 0);
  const linhaCand = c => `<div class="outro-row"><span class="nome">${escapeHtml(displayName(c))}<span class="partido">${escapeHtml(c.party || "")} ${escapeHtml(c.number)}</span></span><span class="pct">${fmtPct(pct(c))}</span></div>`;
  const resto = outros.slice(3);
  document.getElementById("outros").innerHTML = outros.length ? `
    ${outros.slice(0, 3).map(linhaCand).join("")}
    ${resto.length ? `<p class="resto">Mais ${resto.length} candidatura${resto.length > 1 ? "s" : ""} soma${resto.length > 1 ? "m" : ""} ${fmtPct(d3.sum(resto, pct))}</p>` : ""}
    <details><summary>Todos os ${todos.length} candidatos</summary>${todos.map(linhaCand).join("")}</details>` : "";

  const eleitorado = national.electorate_counted || national.electorate || 0;
  const tile = (l, v) => `<div><div class="l">${l}</div><div class="v">${v}</div></div>`;
  document.getElementById("totais").innerHTML = valid ? [
    tile("Votos válidos", fmtInt(valid)),
    tile("Comparecimento", fmtPct(shareOf(national.turnout || 0, eleitorado))),
    tile("Brancos e nulos", fmtPct(shareOf((national.blank || 0) + (national.null || 0), national.turnout || 0))),
  ].join("") : "";

  document.getElementById("sections-label").textContent =
    `${fmtInt(national.sections_counted)} de ${fmtInt(national.sections_total)} (${fmtPct(apurado)})`;
  document.getElementById("progress-fill").style.width = apurado + "%";
}

// ---------------- line chart ----------------
function renderChart(pontos) {
  const el = document.getElementById("chart");
  const w = el.clientWidth || 380, h = 150, m = { top: 8, right: 10, bottom: 18, left: 28 };
  el.innerHTML = "";
  if (!pontos || pontos.length < 2) {
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("class", "chart");
    svg.append("text").attr("class", "empty-msg").attr("x", w / 2).attr("y", h / 2).text("O gráfico aparece quando a apuração começar");
    return;
  }
  const x = d3.scaleLinear().domain([0, 100]).range([m.left, w - m.right]);
  // Eixo vertical ajustado aos dados (sempre incluindo a linha de 50%), com
  // no mínimo 10 pts de amplitude pra não exagerar oscilações pequenas.
  const valores = pontos.flatMap(p => [p["13"], p["22"]]).concat(50);
  let lo = d3.min(valores) - 1, hi = d3.max(valores) + 1;
  if (hi - lo < 10) { const meio = (hi + lo) / 2; lo = meio - 5; hi = meio + 5; }
  const y = d3.scaleLinear().domain([lo, hi]).nice().range([h - m.bottom, m.top]);
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("class", "chart");
  y.ticks(4).forEach(v => svg.append("text").attr("class", "tick-label").attr("x", m.left - 4).attr("y", y(v) + 3)
    .attr("text-anchor", "end").text(v + "%"));

  svg.append("line").attr("class", "axis-line").attr("x1", m.left).attr("x2", w - m.right).attr("y1", y(50)).attr("y2", y(50))
    .attr("stroke-dasharray", "2 2");
  [0, 50, 100].forEach(v => svg.append("text").attr("class", "tick-label").attr("x", x(v)).attr("y", h - 4).attr("text-anchor", v === 0 ? "start" : v === 100 ? "end" : "middle").text(v + "%"));

  const line13 = d3.line().x(p => x(p.pct_apurado)).y(p => y(p["13"]));
  const line22 = d3.line().x(p => x(p.pct_apurado)).y(p => y(p["22"]));
  svg.append("path").datum(pontos).attr("class", "series-13").attr("d", line13);
  svg.append("path").datum(pontos).attr("class", "series-22").attr("d", line22);

  const crosshair = svg.append("line").attr("class", "crosshair").attr("y1", m.top).attr("y2", h - m.bottom);
  const dot13 = svg.append("circle").attr("class", "hover-dot").attr("r", 3).attr("fill", C13);
  const dot22 = svg.append("circle").attr("class", "hover-dot").attr("r", 3).attr("fill", C22);
  let tooltip = el.querySelector(".chart-tooltip");
  if (!tooltip) { tooltip = document.createElement("div"); tooltip.className = "chart-tooltip"; el.appendChild(tooltip); }

  svg.append("rect").attr("fill", "transparent").attr("x", m.left).attr("y", 0).attr("width", w - m.left - m.right).attr("height", h)
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const pct = x.invert(mx);
      const closest = pontos.reduce((a, b) => Math.abs(b.pct_apurado - pct) < Math.abs(a.pct_apurado - pct) ? b : a);
      crosshair.attr("x1", x(closest.pct_apurado)).attr("x2", x(closest.pct_apurado)).style("opacity", 1);
      dot13.attr("cx", x(closest.pct_apurado)).attr("cy", y(closest["13"])).style("opacity", 1);
      dot22.attr("cx", x(closest.pct_apurado)).attr("cy", y(closest["22"])).style("opacity", 1);
      tooltip.style.left = x(closest.pct_apurado) + "px";
      tooltip.style.top = Math.min(y(closest["13"]), y(closest["22"])) + "px";
      tooltip.style.opacity = 1;
      tooltip.innerHTML = `${fmtPct(closest.pct_apurado)} apurado<br><span style="color:${C13}">Lula ${fmtPct(closest["13"])}</span><br><span style="color:${C22}">Flávio ${fmtPct(closest["22"])}</span>`;
    })
    .on("mouseleave", () => { crosshair.style("opacity", 0); dot13.style("opacity", 0); dot22.style("opacity", 0); tooltip.style.opacity = 0; });
}

// ---------------- regioes ----------------
function renderRegioes(states) {
  const linha = (nome, t, extra = "") => {
    const p13 = shareOf(t["13"], t.valid), p22 = shareOf(t["22"], t.valid);
    const lula = t["13"] >= t["22"];
    return `<div class="regiao-row${extra}">
      <span class="nome">${nome}</span>
      <span class="lider"><span class="swatch" style="background:${lula ? C13 : C22}"></span>${lula ? "Lula" : "Flávio"}</span>
      <span class="pct">${t.valid ? fmtPct(lula ? p13 : p22) : "—"}</span>
      <div class="mini-track"><i style="background:${C13};width:${p13}%"></i><i style="background:${C22};width:${p22}%;margin-left:auto"></i></div>
    </div>`;
  };
  const soma = rs => {
    const t = { valid: 0, "13": 0, "22": 0 };
    for (const r of rs) { if (!r) continue; const by = votesOf(r); t.valid += r.valid || 0; t["13"] += by["13"] || 0; t["22"] += by["22"] || 0; }
    return t;
  };
  document.getElementById("regioes-list").innerHTML =
    Object.entries(REGIOES).map(([nome, ufs]) => linha(nome, soma(ufs.map(uf => states.states[uf])))).join("") +
    (states.abroad ? linha("Exterior", soma([states.abroad]), " exterior") : "");
}

// ---------------- correção de winding do IBGE ----------------
// As malhas do IBGE vêm com o anel externo no sentido errado pra o d3-geo
// (que usa o clipper de antimeridiano da esfera, não a regra plana do
// GeoJSON) — sem isso, cada polígono desenha "o resto do mundo" em vez do
// próprio estado/município, colado no retângulo da projeção.
function fixWinding(geojson) {
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === "Polygon") geom.coordinates = geom.coordinates.map(ring => ring.slice().reverse());
    else if (geom.type === "MultiPolygon") geom.coordinates = geom.coordinates.map(poly => poly.map(ring => ring.slice().reverse()));
  }
  return geojson;
}

// ---------------- mapa por estado ----------------
// ---------------- mapa do Brasil (estados ou municípios) ----------------
const UF_NOME = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
// % de seções apuradas: 5 faixas de cinza, do escuro (nada) ao claro (tudo).
const APURADO_BREAKS = [0.25, 0.5, 0.75, 0.999];
const APURADO_COLORS = ["#2f2f2c", "#4b4a46", "#6c6b66", "#94938c", "#d6d4cc"];
const apuradoColor = d3.scaleThreshold().domain(APURADO_BREAKS).range(APURADO_COLORS);
const fracApurada = r => r && r.sections_total ? r.sections_counted / r.sections_total : 0;

// Malha de municípios e lookup TSE↔IBGE: carregados uma vez, só quando alguém usa
// (o mapa de municípios ou a aba Virada), e compartilhados entre os dois.
let muniGeoP = null, lookupP = null;
const loadLookup = () => lookupP ||= getJSON("data/municipality_lookup.json");
const loadMuniGeo = () => muniGeoP ||= Promise.all([getJSON("geo/municipalities.geojson").then(fixWinding), loadLookup()])
  .then(([geo, lookup]) => {
    // O geojson do IBGE usa código do IBGE (7 dígitos); os dados de votação
    // usam código do TSE (5 dígitos) — precisa do lookup pra converter.
    const ibgeToTse = {};
    for (const [tse, place] of Object.entries(lookup)) ibgeToTse[place.ibge] = tse;
    for (const f of geo.features) f.tse = ibgeToTse[String(f.properties.codarea)];
    return geo;
  });

const mapa = { nivel: "estados", modo: "vantagem", states: null, munis: null, lookup: null };
let mapBuilt = false;

function buildMap(ufGeo) {
  const root = document.getElementById("map-root");
  root.innerHTML = "";
  const w = root.clientWidth || 600;
  const projection = d3.geoMercator().fitWidth(w, ufGeo);
  const path = d3.geoPath(projection);
  const h = Math.ceil(path.bounds(ufGeo)[1][1]);
  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("class", "map-svg");
  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip";
  root.appendChild(tooltip);
  const showTip = (event, html) => {
    tooltip.innerHTML = html;
    const [px, py] = d3.pointer(event, root);
    const flip = px > root.clientWidth - 200;
    tooltip.style.left = (flip ? px - 14 - tooltip.offsetWidth : px + 14) + "px";
    tooltip.style.top = py + "px";
    tooltip.style.opacity = 1;
  };
  const hideTip = () => { tooltip.style.opacity = 0; };

  Object.assign(mapa, {
    path, showTip, hideTip,
    gMuni: svg.append("g"),
    ufPaths: svg.append("g").selectAll("path").data(ufGeo.features).join("path")
      .attr("class", "uf").attr("d", path).attr("fill", BASELINE)
      .on("mousemove", (event, d) => showTip(event, tooltipEstado(d.properties.uf)))
      .on("mouseleave", hideTip),
    outline: svg.append("path").datum(ufGeo).attr("class", "uf-outline").attr("d", path),
    muniPaths: null,
  });
  const labels = svg.append("g").selectAll("g").data(ufGeo.features).join("g")
    .attr("transform", d => `translate(${path.centroid(d)})`);
  labels.append("text").attr("class", "uf-label").attr("y", -4).text(d => d.properties.uf);
  mapa.ufPct = labels.append("text").attr("class", "uf-pct").attr("y", 7);
  mapBuilt = true;
  paintMap();
}

function linhasTooltip(candidates, valid, extraOutros = 0) {
  const top = ranked(candidates).slice(0, 3);
  const outros = valid - d3.sum(top, c => c.votes);
  return top.map(c => `<div class="t-row"><span style="color:${candColor(c.number)}">${escapeHtml(displayName(c))}</span><span>${fmtPct(shareOf(c.votes, valid))}</span></div>`).join("") +
    (outros > 0 ? `<div class="t-row"><span>Outros</span><span>${fmtPct(shareOf(outros, valid))}</span></div>` : "");
}

function tooltipEstado(uf) {
  const r = mapa.states && mapa.states[uf];
  const cab = `<div class="t-name">${escapeHtml(UF_NOME[uf] || uf)}</div>`;
  if (!r) return cab;
  return cab + `<div class="t-meta">${fmtPct(100 * fracApurada(r))} apurado · ${fmtMil(r.electorate || 0)} de eleitores</div>` +
    (r.valid ? linhasTooltip(r.candidates, r.valid) : `<div class="c">Sem votos ainda</div>`);
}

function tooltipMunicipio(code) {
  const place = mapa.lookup && mapa.lookup[code];
  const m = mapa.munis && mapa.munis[code];
  const cab = `<div class="t-name">${place ? `${escapeHtml(titleCase(place.name))} <span class="c">· ${escapeHtml(place.uf)}</span>` : "Município"}</div>`;
  if (!m) return cab + `<div class="c">Sem dados</div>`;
  // O arquivo de municípios só traz Lula e Flávio; o resto dos válidos vira "Outros".
  const cands = [{ number: "13", votes: m["13"] || 0 }, { number: "22", votes: m["22"] || 0 }];
  return cab + `<div class="t-meta">${fmtPct(100 * fracApurada(m))} apurado · ${fmtInt(m.electorate || 0)} eleitores</div>` +
    (m.valid ? linhasTooltip(cands, m.valid) : `<div class="c">Sem votos ainda</div>`);
}

async function ensureMunicipios() {
  const [geo, lookup, dados] = await Promise.all([
    loadMuniGeo(), loadLookup(), getJSON(`${DATA_DIR}/municipalities_2026.json`),
  ]);
  mapa.lookup = lookup;
  mapa.munis = dados.municipalities;
  if (!mapa.muniPaths && mapBuilt) {
    mapa.muniPaths = mapa.gMuni.selectAll("path").data(geo.features).join("path")
      .attr("class", "muni").attr("d", mapa.path)
      .on("mousemove", (event, f) => mapa.showTip(event, tooltipMunicipio(f.tse)))
      .on("mouseleave", mapa.hideTip);
  }
  paintMap();
}

function fillPorResultado(v13, v22, valid, frac) {
  if (mapa.modo === "apurado") return apuradoColor(frac);
  return valid ? leaderShade(v13, v22, valid) : BASELINE;
}

function paintMap() {
  if (!mapBuilt || !mapa.states) return;
  const municipios = mapa.nivel === "municipios";
  mapa.ufPaths.style("display", municipios ? "none" : null).attr("fill", d => {
    const r = mapa.states[d.properties.uf];
    if (!r) return BASELINE;
    const by = votesOf(r);
    return fillPorResultado(by["13"] || 0, by["22"] || 0, r.valid, fracApurada(r));
  });
  if (mapa.muniPaths) {
    mapa.gMuni.style("display", municipios ? null : "none");
    mapa.muniPaths.attr("fill", f => {
      const m = mapa.munis && mapa.munis[f.tse];
      return m ? fillPorResultado(m["13"] || 0, m["22"] || 0, m.valid, fracApurada(m)) : BASELINE;
    });
  }
  // Rótulo de cada estado: % do líder (vantagem) ou % apurado.
  mapa.ufPct.text(d => {
    const r = mapa.states[d.properties.uf];
    if (!r) return "";
    if (mapa.modo === "apurado") return fmtPct(100 * fracApurada(r)).replace(",0%", "%");
    if (!r.valid) return "";
    return Math.round(shareOf(ranked(r.candidates)[0].votes, r.valid)) + "%";
  });

  // Contagem e legenda.
  const count = document.getElementById("map-count");
  if (mapa.modo === "apurado") {
    const lista = municipios ? Object.values(mapa.munis || {}) : Object.values(mapa.states);
    const completos = lista.filter(r => fracApurada(r) >= 0.999).length;
    count.innerHTML = `<b>${fmtInt(completos)}</b> de ${fmtInt(lista.length)} ${municipios ? "municípios" : "estados"} com 100% das seções apuradas`;
  } else {
    const lista = municipios
      ? Object.values(mapa.munis || {}).map(m => [m["13"] || 0, m["22"] || 0])
      : Object.values(mapa.states).map(r => { const b = votesOf(r); return [b["13"] || 0, b["22"] || 0]; });
    const pl = lista.filter(([a, b]) => b > a).length, pt = lista.filter(([a, b]) => a > b).length;
    const sem = lista.length - pl - pt;
    count.innerHTML = (municipios && !mapa.munis) ? "Carregando municípios…" :
      `<span style="color:${C22}">PL</span> lidera em <b>${fmtInt(pl)}</b> · <span style="color:${C13}">PT</span> em <b>${fmtInt(pt)}</b> ${municipios ? "municípios" : "estados"}` +
      (sem ? ` · ${fmtInt(sem)} sem votos ou empatados` : "");
  }
  document.getElementById("map-legend").innerHTML = mapa.modo === "apurado"
    ? `<div class="map-legend"><span class="key">Seções apuradas</span>
         ${APURADO_COLORS.map((c, i) => `<span class="key"><span class="swatch" style="background:${c}"></span>${["< 25%", "25–50%", "50–75%", "75–99%", "100%"][i]}</span>`).join("")}</div>`
    : `<div class="map-legend">
         <span class="key"><span class="swatch" style="background:var(--c13)"></span>Lula (PT)</span>
         <span class="key"><span class="swatch" style="background:var(--c22)"></span>Flávio Bolsonaro (PL)</span>
       </div><div class="map-legend">${marginLegendHtml()}</div>`;
}

function marginLegendHtml() {
  const chip = step =>
    `<span class="swatch" style="background:linear-gradient(90deg, ${SHADES["13"][step]} 50%, ${SHADES["22"][step]} 50%)"></span>`;
  return `<span class="key">Vantagem</span>
     <span class="key">${chip(0)}até 5 pts</span>
     <span class="key">${chip(1)}5–15 pts</span>
     <span class="key">${chip(2)}mais de 15 pts</span>`;
}

document.querySelectorAll(".margin-legend").forEach(el => { el.innerHTML = marginLegendHtml(); });

function updateMapColors(statesData) {
  mapa.states = statesData;
  paintMap();
  if (mapa.nivel === "municipios") ensureMunicipios();
}

for (const [grupo, chave] of [["map-nivel", "nivel"], ["map-modo", "modo"]]) {
  document.querySelectorAll(`#${grupo} button`).forEach(btn => btn.addEventListener("click", () => {
    mapa[chave] = btn.dataset.v;
    document.querySelectorAll(`#${grupo} button`).forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
    paintMap();
    if (mapa.nivel === "municipios") ensureMunicipios();
  }));
}

// ---------------- exterior ----------------
const shareOf = (votes, valid) => valid ? 100 * votes / valid : 0;
const escapeHtml = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

// Linha "líder + %" e barrinha Lula|Flávio, usadas na lista de regiões e de cidades.
function leaderCell(v13, v22, valid) {
  if (!v13 && !v22) return `<span class="c">sem votos ainda</span>`;
  const lula = v13 >= v22;
  return `<span style="color:${lula ? C13 : C22}">${lula ? "Lula" : "Flávio"} ${fmtPct(shareOf(lula ? v13 : v22, valid))}</span>`;
}
const miniTrack = (v13, v22, valid) =>
  `<div class="mini-track"><i style="background:${C13};width:${shareOf(v13, valid)}%"></i><i style="background:${C22};width:${shareOf(v22, valid)}%"></i></div>`;

let exteriorMap = null;  // { svg, projection, radius, tooltip } — o mapa base é desenhado uma vez só
async function buildExteriorMap() {
  const topo = await getJSON("geo/countries-110m.json");
  const root = document.getElementById("exterior-map-root");
  const w = root.clientWidth || 600;
  const land = topojson.feature(topo, topo.objects.countries);
  land.features = land.features.filter(f => f.properties.name !== "Antarctica");
  const projection = d3.geoNaturalEarth1().fitWidth(w, land);
  const h = Math.ceil(d3.geoPath(projection).bounds(land)[1][1]);
  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("class", "map-svg");
  svg.append("g").selectAll("path").data(land.features).join("path")
    .attr("d", d3.geoPath(projection)).attr("fill", "#2c2c2a").attr("stroke", "#0d0d0d").attr("stroke-width", 0.5);
  svg.append("g").attr("class", "bubbles");
  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip";
  root.appendChild(tooltip);
  // Raio proporcional à raiz dos votos (área ∝ votos); maior bolha ≈ 2,6% da largura.
  exteriorMap = { svg, projection, tooltip, root, maxR: w * 0.026 };
}

function updateExteriorMap(cities) {
  const { svg, projection, tooltip, root, maxR } = exteriorMap;
  const maxValid = d3.max(cities, c => c.valid) || 1;
  const radius = d3.scaleSqrt().domain([0, maxValid]).range([0, maxR]);
  const r = c => Math.max(2, radius(c.valid || 0));
  const placed = cities
    .map(c => ({ ...c, xy: projection([c.lon, c.lat]) }))
    .filter(c => c.xy)
    .sort((a, b) => (b.valid || 0) - (a.valid || 0));  // grandes atrás, pequenas por cima

  const bubbles = svg.select("g.bubbles").selectAll("circle").data(placed, d => d.code).join("circle")
    .attr("class", "bubble")
    .attr("cx", d => d.xy[0]).attr("cy", d => d.xy[1]).attr("r", r)
    .attr("fill", d => { const by = votesOf(d); return leaderShade(by["13"] || 0, by["22"] || 0, d.valid); });
  bubbles.order();

  // Hover pela cidade mais próxima do cursor (Delaunay): as bolhas pequenas da
  // Europa ficam coladas, então mirar exatamente no círculo seria frustrante.
  const delaunay = d3.Delaunay.from(placed, d => d.xy[0], d => d.xy[1]);
  svg.on("mousemove", event => {
    const [mx, my] = d3.pointer(event);
    const d = placed[delaunay.find(mx, my)];
    const near = d && Math.hypot(d.xy[0] - mx, d.xy[1] - my) <= r(d) + 10;
    bubbles.classed("hover", b => near && b.code === d.code);
    if (!near) { tooltip.style.opacity = 0; return; }
    const by = votesOf(d);
    tooltip.innerHTML = `<div class="t-name">${escapeHtml(d.city)} <span class="c">· ${escapeHtml(d.country)}</span></div>
      <div class="t-row"><span style="color:${C13}">Lula</span><span>${fmtPct(shareOf(by["13"] || 0, d.valid))}</span></div>
      <div class="t-row"><span style="color:${C22}">Flávio</span><span>${fmtPct(shareOf(by["22"] || 0, d.valid))}</span></div>
      <div class="t-row"><span>votos válidos</span><span>${fmtInt(d.valid)}</span></div>`;
    const [px, py] = d3.pointer(event, root);
    const flip = px > root.clientWidth - 190;
    tooltip.style.left = (flip ? px - 14 - tooltip.offsetWidth : px + 14) + "px";
    tooltip.style.top = py + "px";
    tooltip.style.opacity = 1;
  }).on("mouseleave", () => { tooltip.style.opacity = 0; bubbles.classed("hover", false); });

  // Legenda de tamanho: 3 bolhas de referência com valores redondos.
  const niceFloor = v => { const k = 10 ** Math.floor(Math.log10(v)); return Math.floor(v / k) * k; };
  const ref = [...new Set([maxValid / 10, maxValid / 3, maxValid].filter(v => v >= 1).map(niceFloor))];
  const big = radius(ref[ref.length - 1]);
  let x = 0;
  const items = ref.map(v => { const rr = Math.max(2, radius(v)); const cx = x + rr; x += 2 * rr + 34; return { v, rr, cx }; });
  document.getElementById("size-legend").innerHTML =
    `<svg width="${x}" height="${2 * big + 2}" aria-hidden="true">${items.map(({ v, rr, cx }) =>
      `<circle cx="${cx}" cy="${2 * big + 1 - rr}" r="${rr}" fill="none" stroke="var(--ink-muted)"/>
       <text x="${cx + rr + 4}" y="${2 * big - 1}">${fmtInt(v)}</text>`).join("")}</svg>
     <span>votos válidos</span>`;
}

async function renderExterior(abroadData) {
  const total = abroadData.total, valid = total.valid || 0;
  const by = votesOf(total), v13 = by["13"] || 0, v22 = by["22"] || 0;
  const p13 = shareOf(v13, valid), p22 = shareOf(v22, valid);
  const lula = v13 >= v22;
  document.getElementById("ext-headline").innerHTML = valid
    ? `<span style="color:${lula ? C13 : C22}">${CAND_NAME[lula ? "13" : "22"]}</span> lidera no exterior`
    : "A apuração no exterior ainda não começou";
  document.getElementById("ext-dek").textContent =
    `${fmtInt(valid)} votos válidos em ${fmtInt(abroadData.cities.length)} cidades`;
  document.getElementById("ext-candidates").innerHTML = `
    <div class="cand c13"><span class="name"><span class="swatch" style="background:${C13}"></span>${CAND_NAME["13"]} (PT)</span>
      <span class="pct">${fmtPct(p13)}</span><span class="votes">${fmtInt(v13)} votos</span></div>
    <div class="cand c22"><span class="name"><span class="swatch" style="background:${C22}"></span>${CAND_NAME["22"]} (PL)</span>
      <span class="pct">${fmtPct(p22)}</span><span class="votes">${fmtInt(v22)} votos</span></div>`;
  document.getElementById("ext-share-bar").innerHTML =
    `<i class="c13" style="width:${p13}%"></i><i class="c22" style="width:${p22}%"></i><div class="majority"></div>`;

  // Regiões do mundo, da que tem mais votos pra que tem menos.
  const regioes = d3.rollups(abroadData.cities, cs => {
    const t = { valid: 0, "13": 0, "22": 0 };
    for (const c of cs) { const b = votesOf(c); t.valid += c.valid || 0; t["13"] += b["13"] || 0; t["22"] += b["22"] || 0; }
    return t;
  }, c => c.region).sort((a, b) => b[1].valid - a[1].valid);
  document.getElementById("ext-regioes").innerHTML = regioes.map(([regiao, t]) => `
    <div class="regiao-row">
      <span class="nome">${escapeHtml(regiao)} <span class="c">· ${fmtInt(t.valid)} votos</span></span>
      <span class="lider">${leaderCell(t["13"], t["22"], t.valid)}</span><span></span>
      ${miniTrack(t["13"], t["22"], t.valid)}
    </div>`).join("");

  // Tabela de cidades — também é a versão acessível (sem depender de cor) do mapa.
  const sorted = [...abroadData.cities].sort((a, b) => (b.valid || 0) - (a.valid || 0));
  document.getElementById("city-list").innerHTML =
    `<div class="city-row head" role="row"><span>Cidade</span><span class="n">Votos válidos</span><span>Lula × Flávio</span><span class="lider">Lidera</span></div>` +
    sorted.map(c => {
      const b = votesOf(c);
      return `<div class="city-row" role="row">
        <span>${escapeHtml(c.city)} <span class="c">· ${escapeHtml(c.country)}</span></span>
        <span class="n">${fmtInt(c.valid)}</span>
        ${miniTrack(b["13"] || 0, b["22"] || 0, c.valid)}
        <span class="lider">${leaderCell(b["13"] || 0, b["22"] || 0, c.valid)}</span>
      </div>`;
    }).join("");

  if (!exteriorMap) await buildExteriorMap();
  updateExteriorMap(abroadData.cities);
}

// ---------------- virada ----------------
// Base de comparação: o 2º turno de 2026 é comparado com o 2º turno de 2022
// (Lula × Jair); na demo, que usa o 1º turno de 2026, com o 1º de 2022.
// Comparar turnos diferentes faria os dois parecerem crescer só porque os
// votos de terceiros somem no 2º turno.
const vrBaseFor = primeiroTurno => primeiroTurno
  ? { file: "data/municipalities_2022.json", label: "1º turno de 2022", agora: "1º turno de 2026" }
  : { file: "data/municipalities_2022_t2.json", label: "2º turno de 2022", agora: "2º turno de 2026" };
let VR_BASE = vrBaseFor(PRIMEIRO_TURNO);
const MIN_APURADO = 0.9;  // parcial cedo é enviesado; só compara município com ≥ 90% das seções
// Variação da margem PL − PT em pontos: 7 faixas. Cada lado tem matiz fixo e
// luminosidade crescente (validado: ΔL ≥ 0,06 entre degraus; vermelho e azul
// do mesmo degrau com ΔE ≥ 15, ≥ 12 pra daltonismo). Centro cinza = estável.
const SWING_BREAKS = [-20, -10, -3, 3, 10, 20];
const SWING_COLORS = ["#ed6868", "#c05b5a", "#954e4d", "#4d4d4d", "#3f689b", "#4580ca", "#4999fb"];
const swingColor = d3.scaleThreshold().domain(SWING_BREAKS).range(SWING_COLORS);
const FLIP_COLORS = { "22": "#4999fb", "13": "#ed6868", held: "#2e2e2c" };

const fmtPts = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtMil = v => Math.abs(v) >= 1e6
  ? (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi"
  : Math.abs(v) >= 1e3 ? Math.round(v / 1e3).toLocaleString("pt-BR") + " mil" : fmtInt(Math.round(v));
const PREP = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "D'"]);
const titleCase = s => s.toLowerCase().split(" ").map((w, i) =>
  i > 0 && PREP.has(w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const sideOf = margin => margin > 0 ? "22" : margin < 0 ? "13" : null;  // margem = PL − PT
const sideName = side => side === "22" ? "PL" : "PT";
// Margem como "PL +4,2" / "PT +9,5" (pontos, não %); colorida opcionalmente.
const margemTxt = (m, colorir = false) => {
  if (Math.abs(m) < 0.05) return "empate";
  const lado = m > 0 ? "22" : "13";
  const nome = colorir ? `<span style="color:${lado === "22" ? C22 : C13}">${sideName(lado)}</span>` : sideName(lado);
  return `${nome} ${fmtPts(Math.abs(m))}`;
};

let vr = null;  // estado da aba: geometria, base 2022, lookup, último cálculo, modo do mapa
let vrSetup = null;  // promessa da montagem, pra dois cliques seguidos não montarem o mapa duas vezes

// Compara cada município apurado com ele mesmo em 2022.
function computeVirada(atual) {
  const linhas = [];
  let aguardando = 0;
  for (const [code, now] of Object.entries(atual.municipalities)) {
    const was = vr.base[code], place = vr.lookup[code];
    if (!was || !place) continue;  // ex.: Boa Esperança do Norte (MT) não existia em 2022
    if (!now.sections_total || now.sections_counted / now.sections_total < MIN_APURADO || !now.valid) { aguardando++; continue; }
    const s13 = shareOf(now["13"], now.valid), s22 = shareOf(now["22"], now.valid);
    const w13 = shareOf(was["13"], was.valid), w22 = shareOf(was["22"], was.valid);
    const margem = s22 - s13, margemAntes = w22 - w13;
    linhas.push({
      code, place, now, was, s13, s22, w13, w22, margem, margemAntes,
      swing: margem - margemAntes,
      votosMargem: (margem - margemAntes) / 100 * now.valid,
      antes: sideOf(margemAntes), depois: sideOf(margem),
    });
  }
  for (const l of linhas) l.virou = l.antes && l.depois && l.antes !== l.depois;
  return { linhas, aguardando, porCodigo: new Map(linhas.map(l => [l.code, l])) };
}

// Soma um conjunto de municípios (nacional ou por UF), sempre os mesmos lugares nos dois anos.
function somaVirada(linhas) {
  const t = { v: 0, n13: 0, n22: 0, wv: 0, w13: 0, w22: 0, eleitorado: 0 };
  for (const l of linhas) {
    t.v += l.now.valid; t.n13 += l.now["13"]; t.n22 += l.now["22"];
    t.wv += l.was.valid; t.w13 += l.was["13"]; t.w22 += l.was["22"]; t.eleitorado += l.now.electorate || 0;
  }
  const s13 = shareOf(t.n13, t.v), s22 = shareOf(t.n22, t.v), w13 = shareOf(t.w13, t.wv), w22 = shareOf(t.w22, t.wv);
  return { ...t, s13, s22, w13, w22, margem: s22 - s13, margemAntes: w22 - w13, swing: (s22 - s13) - (w22 - w13) };
}

async function setupVirada() {
  const [geo, ufGeo, base, lookup] = await Promise.all([
    loadMuniGeo(),
    getJSON("geo/states.geojson").then(fixWinding),
    getJSON(VR_BASE.file),
    loadLookup(),
  ]);

  const root = document.getElementById("virada-map-root");
  const w = root.clientWidth || 800;
  const projection = d3.geoMercator().fitWidth(w, geo);
  const path = d3.geoPath(projection);
  const h = Math.ceil(path.bounds(geo)[1][1]);
  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("class", "map-svg");
  svg.append("defs").append("pattern").attr("id", "apurando").attr("width", 5).attr("height", 5)
    .attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)")
    .call(p => { p.append("rect").attr("width", 5).attr("height", 5).attr("fill", "#242423");
                 p.append("line").attr("y2", 5).attr("stroke", "#3a3a38").attr("stroke-width", 2); });
  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip";
  root.appendChild(tooltip);

  const paths = svg.append("g").selectAll("path").data(geo.features).join("path")
    .attr("class", "muni").attr("d", path)
    .on("mousemove", (event, f) => {
      tooltip.innerHTML = viradaTooltip(f.tse);
      const [px, py] = d3.pointer(event, root);
      const flip = px > root.clientWidth - 240;
      tooltip.style.left = (flip ? px - 14 - tooltip.offsetWidth : px + 14) + "px";
      tooltip.style.top = py + "px";
      tooltip.style.opacity = 1;
    })
    .on("mouseleave", () => { tooltip.style.opacity = 0; });
  svg.append("path").datum({ type: "FeatureCollection", features: ufGeo.features })
    .attr("class", "uf-borders").attr("d", path);

  vr = { paths, base, lookup, modo: "margem", calc: null };
  document.querySelectorAll("#view-virada .segmented button").forEach(btn => btn.addEventListener("click", () => {
    vr.modo = btn.dataset.modo;
    document.querySelectorAll("#view-virada .segmented button").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
    paintVirada();
  }));
}

function viradaTooltip(code) {
  const place = vr.lookup[code];
  if (!place) return `<div class="t-name">Sem dados</div>`;
  const nome = `<div class="t-name">${escapeHtml(titleCase(place.name))} <span class="c">· ${escapeHtml(place.uf)}</span></div>`;
  const l = vr.calc && vr.calc.porCodigo.get(code);
  if (!l) return nome + `<div class="c">${vr.base[code] ? "Menos de 90% das seções apuradas" : "Não existia em 2022"}</div>`;
  const lado = side => side === "22" ? `<span style="color:${C22}">PL</span>` : `<span style="color:${C13}">PT</span>`;
  const swingSide = l.swing > 0 ? "22" : "13";
  return nome + `<table>
      <tr><th></th><th>Lula</th><th>Bolsonaro</th><th>Margem</th></tr>
      <tr><td>${VR_BASE.label.replace(" de ", " ")}</td><td>${fmtPct(l.w13)}</td><td>${fmtPct(l.w22)}</td><td>${margemTxt(l.margemAntes, true)}</td></tr>
      <tr><td>${VR_BASE.agora.replace(" de ", " ")}</td><td>${fmtPct(l.s13)}</td><td>${fmtPct(l.s22)}</td><td>${margemTxt(l.margem, true)}</td></tr>
    </table>
    <div class="t-swing">${Math.abs(l.swing) < 0.05 ? "Margem estável" : `${fmtPts(Math.abs(l.swing))} pts pro ${lado(swingSide)}`}${l.virou ? ` · virou pro ${lado(l.depois)}` : ""}</div>
    <div class="c">${fmtInt(l.now.electorate)} eleitores</div>`;
}

function paintVirada() {
  if (!vr || !vr.calc) return;
  const { porCodigo } = vr.calc;
  vr.paths.attr("fill", f => {
    const l = porCodigo.get(f.tse);
    if (!l) return vr.base[f.tse] ? "url(#apurando)" : "#1f1f1e";
    if (vr.modo === "virou") return l.virou ? FLIP_COLORS[l.depois] : FLIP_COLORS.held;
    return swingColor(l.swing);
  });
  const viradas = vr.calc.linhas.filter(l => l.virou);
  const pro = side => viradas.filter(l => l.depois === side).length;
  const sw = c => `<span class="swatch" style="background:${c}"></span>`;
  const apurando = `<span class="key">${sw("url(#apurando)").replace("url(#apurando)", "repeating-linear-gradient(45deg,#242423 0 2px,#3a3a38 2px 4px)")}Apurando</span>`;
  document.getElementById("vr-legend").innerHTML = vr.modo === "virou"
    ? `<span class="key">${sw(FLIP_COLORS["22"])}Virou pro PL (${fmtInt(pro("22"))})</span>
       <span class="key">${sw(FLIP_COLORS["13"])}Virou pro PT (${fmtInt(pro("13"))})</span>
       <span class="key">${sw(FLIP_COLORS.held)}Não mudou</span>${apurando}`
    : `<span class="key">Pro PT</span>
       <span class="key" style="flex-direction:column;align-items:stretch;gap:2px">
         <span class="legend-ramp">${SWING_COLORS.map(c => `<span style="background:${c}"></span>`).join("")}</span>
       </span>
       <span class="key">Pro PL</span>
       <span class="key c">faixas: 3 · 10 · 20 pts</span>${apurando}`;
}

function renderUfBars(linhas) {
  const porUf = d3.rollups(linhas, somaVirada, l => l.place.uf).sort((a, b) => b[1].swing - a[1].swing);
  const el = document.getElementById("vr-ufs");
  const w = el.clientWidth || 300, rowH = 17, m = { left: 28, right: 40 }, h = porUf.length * rowH + 4;
  const max = d3.max(porUf, d => Math.abs(d[1].swing)) || 1;
  const x = d3.scaleLinear().domain([-max, max]).range([m.left + 30, w - m.right]);
  el.className = "uf-bars";
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Variação da margem por estado">
    ${porUf.map(([uf, t], i) => {
      const y = i * rowH + 2, x0 = x(0), x1 = x(t.swing);
      const label = `${uf}: ${fmtPts(t.swing)} pts (margem ${margemTxt(t.margemAntes)} → ${margemTxt(t.margem)})`;
      return `<g><title>${escapeHtml(label)}</title>
        <text class="uf-name" x="0" y="${y + 11}">${escapeHtml(uf)}</text>
        <rect x="${Math.min(x0, x1)}" y="${y + 3}" width="${Math.max(1, Math.abs(x1 - x0))}" height="${rowH - 6}" rx="2" fill="${swingColor(t.swing)}"/>
        <text x="${t.swing >= 0 ? x1 + 4 : x1 - 4}" y="${y + 11}" text-anchor="${t.swing >= 0 ? "start" : "end"}">${fmtPts(t.swing)}</text></g>`;
    }).join("")}
    <line class="zero" x1="${x(0)}" x2="${x(0)}" y1="0" y2="${h}"/>
  </svg>`;
}

function renderViradaListas(linhas) {
  const grandes = (l) => `${escapeHtml(titleCase(l.place.name))} <span class="c">· ${escapeHtml(l.place.uf)}</span>`;
  const linha = (l, lado) => `<div class="move-row">
      <span class="nome">${grandes(l)}</span>
      <span class="n" style="color:${lado === "22" ? C22 : C13}">${fmtMil(Math.abs(l.votosMargem))}</span>
      <span class="s">${fmtPts(Math.abs(l.swing))} pts · margem ${margemTxt(l.margemAntes)} → ${margemTxt(l.margem)}</span>
    </div>`;
  const lista = (side) => {
    const sel = linhas.filter(l => side === "22" ? l.votosMargem > 0 : l.votosMargem < 0)
      .sort((a, b) => Math.abs(b.votosMargem) - Math.abs(a.votosMargem)).slice(0, 6);
    return sel.length ? sel.map(l => linha(l, side)).join("") : `<p class="empty-msg-html">Nenhum município andou nessa direção.</p>`;
  };
  document.getElementById("vr-impacto").innerHTML =
    `<div><h3 style="color:${C22}">Pro PL</h3>${lista("22")}</div><div><h3 style="color:${C13}">Pro PT</h3>${lista("13")}</div>`;

  const viradas = linhas.filter(l => l.virou).sort((a, b) => (b.now.electorate || 0) - (a.now.electorate || 0)).slice(0, 8);
  document.getElementById("vr-viradas").innerHTML = viradas.length
    ? viradas.map(l => `<div class="move-row">
        <span class="nome">${grandes(l)}</span>
        <span class="n"><span class="flip-tag" style="background:${FLIP_COLORS[l.antes]}">${sideName(l.antes)}</span> → <span class="flip-tag" style="background:${FLIP_COLORS[l.depois]}">${sideName(l.depois)}</span></span>
        <span class="s">${fmtInt(l.now.electorate)} eleitores · margem ${margemTxt(l.margemAntes)} → ${margemTxt(l.margem)}</span>
      </div>`).join("")
    : `<p class="empty-msg-html">Nenhum município virou até agora.</p>`;
}

function renderViradaKpis(calc) {
  const t = somaVirada(calc.linhas);
  const viradas = calc.linhas.filter(l => l.virou);
  const pro = side => viradas.filter(l => l.depois === side);
  const eleitoradoViradas = d3.sum(viradas, l => l.now.electorate || 0);
  const cor = v => v > 0 ? C22 : v < 0 ? C13 : "var(--ink)";
  const ladoDe = v => v > 0 ? "PL" : "PT";
  const kpi = (l, v, s, c) => `<div class="kpi"><div class="l">${l}</div><div class="v" style="color:${c}">${v}</div><div class="s">${s}</div></div>`;
  document.getElementById("vr-kpis").innerHTML = calc.linhas.length ? [
    kpi("Saldo da margem", `${fmtPts(Math.abs(t.swing))} pts pro ${ladoDe(t.swing)}`,
      `margem ${margemTxt(t.margemAntes)} em 2022 → ${margemTxt(t.margem)} agora`, cor(t.swing)),
    kpi("Lula", `${fmtPts(t.s13 - t.w13)} pts`, `${fmtPct(t.w13)} → ${fmtPct(t.s13)} dos válidos`, C13),
    kpi("PL", `${fmtPts(t.s22 - t.w22)} pts`, `Jair ${fmtPct(t.w22)} → Flávio ${fmtPct(t.s22)}`, C22),
    kpi("Municípios que viraram", fmtInt(viradas.length),
      `${fmtInt(pro("22").length)} pro PL · ${fmtInt(pro("13").length)} pro PT · ${fmtMil(eleitoradoViradas)} de eleitores`, "var(--ink)"),
  ].join("") : kpi("Virada desde 2022", "Aguardando", "Aparece quando os municípios passarem de 90% apurado.", "var(--ink-muted)");

  const total = calc.linhas.length + calc.aguardando;
  document.getElementById("vr-dek").textContent =
    `${VR_BASE.agora} × ${VR_BASE.label}. ` +
    `${fmtInt(calc.linhas.length)} de ${fmtInt(total)} municípios com 90% ou mais apurado.`;
  document.getElementById("vr-nota").innerHTML =
    `Margem: % do PL menos % do PT nos votos válidos. Cada município é comparado com ele mesmo no ${VR_BASE.label}; ` +
    `os totais somam só municípios com 90% ou mais apurado. No nº 22, Flávio (2026) é comparado com Jair (2022). ` +
    `${PRIMEIRO_TURNO ? "No 2º turno, a comparação passa a ser com o 2º turno de 2022. " : ""}` +
    `Boa Esperança do Norte (MT) não existia em 2022.`;
}

async function renderVirada() {
  try {
    if (!vr) await (vrSetup ||= setupVirada());
    const atual = await getJSON(`${DATA_DIR}/municipalities_2026.json`);
    vr.calc = computeVirada(atual);
    paintVirada();
    renderViradaKpis(vr.calc);
    renderUfBars(vr.calc.linhas);
    renderViradaListas(vr.calc.linhas);
  } catch (err) { console.error(err); }
}

// ---------------- tabs ----------------
const tabs = [...document.querySelectorAll(".tab")];
function selectTab(tab) {
  tabs.forEach(t => {
    const sel = t === tab;
    t.setAttribute("aria-selected", sel);
    document.getElementById(t.getAttribute("aria-controls")).hidden = !sel;
  });
  if (tab.id === "tab-virada") renderVirada();
}
tabs.forEach(t => t.addEventListener("click", () => selectTab(t)));

// ---------------- boot / poll ----------------
async function refresh() {
  try {
    if (!DEMO && PRIMEIRO_TURNO && await segundoTurnoTemVotos()) { location.reload(); return; }
    const states = await getJSON(`${DATA_DIR}/states.json`);
    if (!mapBuilt) {
      const geo = await getJSON("geo/states.geojson").then(fixWinding);
      buildMap(geo);
    }
    renderStats(states.national);
    renderRegioes(states);
    updateMapColors(states.states);
    const liveEl = document.getElementById("live-indicator");
    const fetchedAt = new Date(states.fetched_at);
    document.getElementById("live-text").textContent =
      DEMO ? "demonstração · dados do 1º turno (4/10)"
      : PRIMEIRO_TURNO ? "1º turno · resultado final (4/10)"
      : `ao vivo · atualizado ${fetchedAt.toLocaleTimeString("pt-BR")}`;
    liveEl.classList.toggle("on", !PRIMEIRO_TURNO);

    try {
      const history = await getJSON(`${DATA_DIR}/history.json`);
      renderChart((history.pontos || []).filter(p => p.as_of));
    } catch { renderChart(null); }

    if (exteriorMap) refreshExterior();
    if (vr) renderVirada();
  } catch (err) {
    document.getElementById("live-text").textContent = "sem dados ainda";
    console.error(err);
  }
}

// O exterior só é baixado depois que a aba é aberta pela primeira vez; a
// partir daí acompanha o mesmo ciclo de atualização do resto da página.
async function refreshExterior() {
  try { await renderExterior(await getJSON(`${DATA_DIR}/abroad.json`)); } catch (err) { console.error(err); }
}
document.getElementById("tab-exterior").addEventListener("click", () => { if (!exteriorMap) refreshExterior(); });

document.getElementById("fullscreen-btn").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
});

detectarModo().then(() => {
  VR_BASE = vrBaseFor(PRIMEIRO_TURNO);
  refresh();
  setInterval(refresh, REFRESH_MS);
});
window.addEventListener("resize", () => { mapBuilt = false; refresh(); });
