import { icons } from "./assets/lucide-icons.js";
import { routeAliases } from "./routes.js";

const appURL = new URL(".", import.meta.url);
const basePath = appURL.pathname;
const staticPreview = document.documentElement.dataset.preview === "static";
const localURL = path => new URL(path.replace(/^\//, ""), appURL).pathname;

let content;
let lang = "fr";
let revealObserver;
let menuTimer;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileViewport = window.matchMedia("(max-width: 1100px)");
// Version 2 : trois sous-pages par rubrique (Présentation, Offre, Marchés), Actualités en page unique.
const groups = [
  // noLink : la rubrique de la barre n'est pas une page, seuls ses sous-onglets mènent quelque part.
  { id: "presentation", icon: "Factory", noLink: true, children: ["presentation", "histoire", "outil-industriel"] },
  { id: "offre", icon: "Layers", noLink: true, children: ["ceramiques-techniques", "serigraphie", "traitements-de-surface"] },
  { id: "materiaux", icon: "Hexagon", children: ["porcelaine-technique", "alumine", "zta", "zircone"] },
  { id: "marches", icon: "ShieldCheck", noLink: true, children: ["defense", "horlogerie", "industrie"] },
  { id: "actualites", icon: "ScanLine", children: [] }
];
const offers = groups[1].children;
const materials = groups[2].children;
const markets = groups[3].children;
const chemistry = ["Silicates", "Al₂O₃", "Al₂O₃ + ZrO₂", "ZrO₂"];
const esc = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const get = path => path.split(".").reduce((value, key) => value?.[key], content?.[lang]);
const t = path => path.split(".").reduce((value, key) => value?.[key], content?.website?.[lang]);
const page = id => t(`pages.${id}`);
const currentId = () => {
  const raw = location.pathname.slice(basePath.length).replace(/^\/|\/$/g, "") || "home";
  return routeAliases[raw] || raw;
};
const parent = id => groups.find(group => group.id === id || group.children.includes(id))?.id || "";
const title = id => page(id)?.short || page(id)?.title || "";

function icon(name, className = "") {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(icons[name] || icons.ArrowUpRight).map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${esc(value)}"`).join(" ")}></${tag}>`).join("")}</svg>`;
}

function link(id, label = title(id), className = "", arrow = false) {
  return `<a class="${className}" href="${localURL(id === "home" ? "" : `${id}${staticPreview ? "/" : ""}`)}">${label}${arrow ? icon("ArrowUpRight") : ""}</a>`;
}

function picture(slot, alt = "", className = "", eager = false) {
  return `<img class="${className}" src="${esc(localURL(content.images[slot]))}" alt="${esc(alt)}" loading="${eager ? "eager" : "lazy"}" ${eager ? 'fetchpriority="high"' : ""} decoding="async">`;
}

// Emplacements photo nommés (content.slots) : une photo = un nom, repris tel quel pour tout le site.
// Sans photo, l'emplacement s'affiche en encart avec son nom ; ajouter ?reperes=1 à une adresse affiche le nom de chaque photo (?reperes=0 l'efface).
const slotInfo = ref => {
  const slot = content.slots?.[ref];
  return typeof slot === "string" ? { image: slot } : slot || {};
};

function slotFigure(ref, alt = "") {
  const info = slotInfo(ref);
  const cls = `point-visual${info.fit === "contain" ? " is-contain" : info.fit === "vignette" ? " is-vignette" : ""}`;
  const data = `data-ref="${esc(ref)}"${info.ratio ? ` data-ratio="${esc(info.ratio)}"` : ""}${info.pos ? ` data-pos="${esc(info.pos)}"` : ""}`;
  if (!info.image) return `<figure class="${cls} photo-placeholder" ${data} role="img" aria-label="${esc(t("ui.photoToChoose"))} ${esc(ref)}"><span>${esc(t("ui.photoToChoose"))}</span><strong>${esc(ref)}</strong></figure>`;
  const caption = info.caption?.[lang] ? `<figcaption>${esc(info.caption[lang])}</figcaption>` : "";
  return `<figure class="${cls}" ${data}><div class="point-frame"><img src="${esc(localURL(info.image))}" alt="${esc(alt)}" loading="lazy" decoding="async"></div>${caption}</figure>`;
}

function navigationLinks(group) {
  return group.children.map((id, i) => link(id, `<span class="menu-number">${String(i + 1).padStart(2, "0")}</span><span>${esc(title(id))}</span>`, "mega-link", true)).join("");
}

function navGroup(group, index, active) {
  const label = esc(t("ui.sections")[index]);
  if (!group.children.length) return `<div class="nav-group"><div class="nav-item ${group.id === active ? "is-active" : ""}">${link(group.id, label)}</div></div>`;
  const overview = group.noLink || group.children.includes(group.id) ? "" : link(group.id, esc(t("ui.all")), "text-link", true);
  const head = group.noLink
    ? `<button type="button" class="nav-toggle nav-toggle-label" aria-expanded="false" aria-controls="nav-${group.id}">${label}${icon("ChevronDown")}</button>`
    : `${link(group.id, label)}<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="nav-${group.id}" aria-label="${esc(t("ui.overview"))} ${esc(title(group.id))}">${icon("ChevronDown")}</button>`;
  return `<div class="nav-group" data-nav-group="${group.id}">
        <div class="nav-item ${group.id === active ? "is-active" : ""}">${head}</div>
        <div class="mega-menu" id="nav-${group.id}" hidden><div class="mega-intro">${icon(group.icon)}<p class="eyebrow">${label}</p><p>${esc(page(group.id).intro)}</p>${overview}</div><div class="mega-links">${navigationLinks(group)}</div></div>
      </div>`;
}

function renderHeader() {
  const active = parent(currentId());
  document.querySelector("#siteHeader").innerHTML = `<div class="header-inner">
    <a class="brand" href="${basePath}" aria-label="${esc(content.settings.siteName)}">${picture("logo", content.settings.siteName, "", true)}</a>
    <nav class="main-nav" id="mainNav" aria-label="${lang === "fr" ? "Navigation principale" : "Main navigation"}">
      ${groups.map((group, index) => navGroup(group, index, active)).join("")}
      ${link("contact", esc(t("ui.contact")), "mobile-contact", true)}
    </nav>
    <div class="header-actions"><div class="language-control"><button type="button" class="language-trigger" aria-label="${esc(t("ui.language"))}" aria-expanded="false" aria-controls="languageOptions">${icon("Globe")}<span>${lang.toUpperCase()}</span>${icon("ChevronDown")}</button><div class="language-options" id="languageOptions" hidden>${["fr", "en"].map(code => `<button type="button" data-lang="${code}" lang="${code}" aria-pressed="${lang === code}"><span>${code === "fr" ? "Français" : "English"}</span>${lang === code ? icon("Check") : ""}</button>`).join("")}</div></div>${link("contact", esc(get("nav.contact")), "header-contact", true)}<button type="button" class="mobile-toggle" aria-label="${esc(t("ui.menu"))}" aria-expanded="false" aria-controls="mainNav">${icon("Menu")}</button></div>
    </div><div class="scroll-progress" aria-hidden="true"></div>`;
  document.querySelector("#mainNav").inert = mobileViewport.matches;
  document.querySelector(".skip-link").textContent = t("ui.skip");
  document.querySelector(".skip-link").href = `${location.pathname}#app`;
}

function metrics(list, className = "") {
  return `<section class="metrics ${className}" aria-label="${lang === "fr" ? "Chiffres clés" : "Key figures"}"><div class="container metric-grid">${list.map(metric => `<div data-reveal><strong class="${metric.value.startsWith("ISO") ? "metric-certifications" : ""}">${esc(metric.value.replace("m2", "m²"))}</strong><span>${esc(metric.label)}</span></div>`).join("")}</div></section>`;
}

function heading(eyebrow, name, intro, action = "") {
  return `<div class="section-heading ${intro ? "" : "heading-only"}" data-reveal><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(name)}</h2></div>${intro ? `<div class="section-description"><p>${esc(intro)}</p>${action}</div>` : ""}</div>`;
}

// Accueil : titres et visuels seulement, sans texte sous les cartes.
function offerCards() {
  const slots = ["technicalParts", "serigraphyBirds", "pvd"];
  const items = page("offre").items;
  return `<div class="offer-grid offer-grid-3">${offers.map((id, i) => `<article class="offer-card" data-reveal>${link(id, `<div class="offer-photo">${picture(slots[i], items[i].title)}<span class="photo-arrow">${icon("ArrowUpRight")}</span></div><div class="offer-copy"><span class="offer-number">0${i + 1}</span><h3>${esc(items[i].title)}</h3></div>`)}</article>`).join("")}</div>`;
}

function marketCards(detailed = false) {
  const slots = ["marketDefense", "marketWatch", "marketIndustry"];
  // La photo de l'Industrie est un gros plan déjà serré : on la montre en entier plutôt que rognée.
  const whole = ["", "", " is-whole"];
  return `<div class="offer-grid offer-grid-3">${markets.map((id, i) => `<article class="offer-card" data-reveal>${link(id, `<div class="offer-photo${whole[i]}">${picture(slots[i], title(id))}<span class="photo-arrow">${icon("ArrowUpRight")}</span></div><div class="offer-copy"><span class="offer-number">0${i + 1}</span><h3>${esc(title(id))}</h3>${detailed ? `<p>${esc(page("marches").cards[id])}</p>` : ""}</div>`)}</article>`).join("")}</div>`;
}

function subTabs(id) {
  const group = groups.find(item => item.children.includes(id));
  if (!group || group.children.length < 2) return "";
  return `<nav class="material-tabs" aria-label="${esc(t("ui.sections")[groups.indexOf(group)])}"><div class="container">${group.children.map(item => link(item, esc(title(item)), item === id ? "active" : "")).join("")}</div></nav>`;
}

function submitBlock(data) {
  return `<section class="section submit-section"><div class="container submit-layout" data-reveal><div><h2>${esc(data.title)}</h2><p>${esc(data.body)}</p></div>${link("contact", esc(data.button), "button primary", true)}</div></section>`;
}

// « Maîtrise en N étapes » : le même gabarit pour les trois offres.
function stepsBlock(steps) {
  if (steps[0]?.refs) return `<section class="section steps-section points-section"><div class="container"><div class="steps-heading" data-reveal><p class="eyebrow">${esc(t("ui.expertise"))}</p><h2>${esc(t("ui.steps").replace("{n}", steps.length))}</h2></div>${points(steps)}</div></section>`;
  return `<section class="section steps-section"><div class="container"><div class="steps-heading" data-reveal><p class="eyebrow">${esc(t("ui.expertise"))}</p><h2>${esc(t("ui.steps").replace("{n}", steps.length))}</h2></div><div class="manufacturing-flow no-link">${steps.map((step, i) => `<article data-reveal><span class="flow-number">0${i + 1}</span><div><h3>${esc(step.title)}</h3><p>${esc(step.body)}</p>${step.points?.length ? `<ul>${step.points.map(point => `<li>${icon("Check")}${esc(point)}</li>`).join("")}</ul>` : ""}</div></article>`).join("")}</div></div></section>`;
}

function overviewBlock(paragraphs, image = "", alt = "") {
  const text = paragraphs.map(text => `<p>${esc(text)}</p>`).join("");
  return `<section class="section overview-section"><div class="container overview-layout ${image ? "" : "no-image"}"><div class="overview-text" data-reveal>${text}</div>${image ? `<figure class="overview-figure" data-reveal>${picture(image, alt)}</figure>` : ""}</div></section>`;
}

// Actualités : tableau des salons, avec le logo de chaque événement quand il existe.
function agendaTable(data) {
  const rows = data.rows.map((row, i) => `<tr><th scope="row"><span class="agenda-event">${data.logos?.[i] ? picture(data.logos[i], "", "agenda-logo") : '<span class="agenda-logo" aria-hidden="true"></span>'}<span>${esc(row[0])}</span></span></th>${row.slice(1).map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("");
  return `<h2 class="table-heading">${esc(data.title)}</h2><div class="table-scroll" role="region" aria-label="${esc(data.title)}" tabindex="0"><table class="agenda-table"><thead><tr>${data.headings.map(label => `<th scope="col">${esc(label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function ceramicsDetail() {
  const id = "ceramiques-techniques";
  return `${pageTop(id)}${stepsBlock(page(id).steps)}`;
}

// Vidéo d'ambiance de l'accueil (facultative) : emplacement HERO-VIDEO de content.slots (video = MP4, webm = WebM, l'un ou l'autre).
// Muette, en boucle, sans commandes ; elle ne se charge pas si le visiteur a demandé moins d'animations ou économise ses données.
// La photo reste dessous : elle s'affiche seule tant que la vidéo ne démarre pas, ou si elle ne peut pas démarrer.
function heroVideo() {
  const info = content.slots?.["HERO-VIDEO"] || {};
  if (!info.video && !info.webm) return "";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.connection?.saveData) return "";
  const sources = [info.webm && `<source src="${esc(localURL(info.webm))}" type="video/webm">`, info.video && `<source src="${esc(localURL(info.video))}" type="video/mp4">`].filter(Boolean).join("");
  return `<video class="hero-video" muted loop playsinline preload="auto" aria-hidden="true" tabindex="-1" poster="${esc(localURL(content.images.hero))}">${sources}</video>`;
}

function startHeroVideo() {
  document.querySelectorAll(".hero-video").forEach(video => {
    video.muted = true;
    video.addEventListener("playing", () => video.classList.add("is-playing"), { once: true });
    video.play().catch(() => {});
  });
}

function home() {
  return `<section class="home-hero"><div class="hero-media">${picture("hero", lang === "fr" ? "Vue aérienne du site Bernardaud d’Oradour-sur-Glane" : "Aerial view of the Bernardaud site in Oradour-sur-Glane", "hero-photo", true)}${heroVideo()}</div>
    <div class="container hero-content"><p class="hero-eyebrow">${esc(t("home.eyebrow"))}</p><h1><span>${esc(t("home.title"))}</span> ${esc(t("home.subtitle"))}</h1><p class="hero-lead">${esc(t("home.intro"))}</p><div class="hero-actions">${link("contact", esc(t("home.primary")), "button light", true)}</div></div>
    <div class="hero-bottom container"><a class="scroll-link" href="#savoir-faire">${icon("ArrowDown")}<span>${esc(t("home.scroll"))}</span></a><span class="hero-caption"><span class="image-caption">${esc(t("home.caption"))}</span></span></div></section>
    <section class="section" id="savoir-faire"><div class="container">${heading(t("ui.expertise"), t("home.offerTitle"), t("home.offerIntro"))}${offerCards()}</div></section>
    <section class="section"><div class="container">${heading(t("ui.applications"), t("home.marketsTitle"), t("home.marketsIntro"))}${marketCards()}</div></section>${contactBand()}`;
}

function breadcrumb(id) {
  const group = groups.find(item => item.id === parent(id));
  const section = group?.noLink
    ? `<span class="crumb-label">${esc(t("ui.sections")[groups.indexOf(group)])}</span>${icon("ChevronRight")}`
    : group && group.id !== id ? `${link(group.id, esc(title(group.id)))}${icon("ChevronRight")}` : "";
  return `<nav class="breadcrumbs" aria-label="${lang === "fr" ? "Fil d’Ariane" : "Breadcrumb"}">${link("home", esc(t("ui.home")))}${icon("ChevronRight")}${section}<span aria-current="page">${esc(page(id) ? title(id) : t("ui.notFound"))}</span></nav>`;
}

// Bandeau de page : même dessin que l'accueil (photo sous un fondu bleu), titre seul.
// La photo est l'emplacement « BAN-<code de la page> » de content.slots ; sans photo, le bandeau reste bleu.
function pageHero(id) {
  const data = page(id);
  const ref = data?.ref ? `BAN-${data.ref}` : "";
  const info = ref ? slotInfo(ref) : {};
  const photo = info.image ? `<img class="banner-photo" src="${esc(localURL(info.image))}" alt="" fetchpriority="high" decoding="async">` : "";
  return `<section class="page-banner${info.image ? " has-photo" : ""}"${ref ? ` data-ref="${ref}"` : ""}${info.pos ? ` data-pos="${esc(info.pos)}"` : ""}><div class="banner-media">${photo}</div><div class="container">${breadcrumb(id)}<div class="banner-heading"><p class="eyebrow">Bernardaud Solutions Industrielles</p><h1>${esc(data?.title || t("ui.notFound"))}</h1></div></div></section>`;
}

// Le texte qui était à droite du titre ouvre désormais la page, sous le bandeau.
function pageIntro(id) {
  const data = page(id);
  return data?.intro ? `<section class="page-intro"><div class="container">${[data.intro, ...(data.introExtra || [])].map(text => `<p data-reveal>${esc(text)}</p>`).join("")}</div></section>` : "";
}

const pageTop = id => `${pageHero(id)}${subTabs(id)}${pageIntro(id)}`;

// Points numérotés, chacun avec sa photo à droite (emplacements de content.slots).
// Certificats ISO : deux liens de téléchargement sous le texte du point (pas d'aperçu des pages bleues).
function certificateLinks() {
  const fileName = item => {
    const source = content.images[item.image];
    const base = item.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return base + (source.match(/\.[a-z0-9]+$/i)?.[0] || "");
  };
  return `<ul class="download-list">${page("presentation").certificates.map(item => `<li><a class="download-link" href="${esc(localURL(content.images[item.image]))}" download="${esc(fileName(item))}">${icon("Download")}<span class="download-title">${esc(item.title)}</span><span class="download-action">${esc(t("ui.download"))}</span></a></li>`).join("")}</ul>`;
}

function points(items = []) {
  return `<div class="points">${items.map((item, i) => `<article data-reveal><div class="point-text"><span class="detail-number">${String(i + 1).padStart(2, "0")}</span><h2>${esc(item.title)}</h2>${item.body ? `<p>${esc(item.body)}</p>` : ""}${(item.paragraphs || []).map(text => `<p>${esc(text)}</p>`).join("")}${bulletList(item.points)}${item.certificates ? certificateLinks() : ""}</div><div class="point-media${item.gallery ? ` is-gallery cols-${item.refs.length}` : ""}">${(item.refs || []).map(ref => slotFigure(ref, item.title)).join("")}</div></article>`).join("")}</div>`;
}

function bulletList(items = []) {
  return items.length ? `<ul class="editorial-list">${items.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : "";
}

function sections(items = [], className = "") {
  return `<div class="detail-sections ${className}">${items.map((item, i) => `<article data-reveal><span class="detail-number">${String(i + 1).padStart(2, "0")}</span><div><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p>${bulletList(item.points)}${(item.paragraphs || []).map(text => `<p>${esc(text)}</p>`).join("")}</div></article>`).join("")}</div>`;
}

function technicalGrid(items, columns = 3) {
  return `<div class="technical-grid technical-grid-${columns}">${items.map((item, i) => `<article data-reveal><span class="detail-number">${String(i + 1).padStart(2, "0")}</span><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></article>`).join("")}</div>`;
}

function mediaGallery(data, columns = 2) {
  return `<section class="section media-section"><div class="container">${heading(t("ui.expertise"), data.title, data.intro)}<div class="media-gallery media-gallery-${columns}">${data.items.map(item => `<figure data-reveal><div class="media-frame">${picture(item.image, item.title)}</div><figcaption><h3>${esc(item.title)}</h3><span>${esc(item.credit)}</span></figcaption></figure>`).join("")}</div></div></section>`;
}

// Bandeau de photos à leur taille naturelle (captures de diapositives découpées).
function photoStrip(group) {
  return `<div class="photo-strip" data-reveal><h3>${esc(group.title)}</h3><div class="photo-strip-row">${group.images.map(slot => `<figure>${picture(slot, group.title)}</figure>`).join("")}</div></div>`;
}

function screenPrintingDetail() {
  const id = "serigraphie";
  return `${pageTop(id)}${stepsBlock(page(id).steps)}`;
}

function surfaceTreatmentDetail() {
  const id = "traitements-de-surface";
  return `${pageTop(id)}${stepsBlock(page(id).steps)}`;
}

function applicationGroups(items) {
  if (!items?.length) return "";
  return `<section class="section application-section"><div class="container"><p class="eyebrow">${esc(t("ui.applications"))}</p><div class="application-grid">${items.map((item, i) => `<article data-reveal><span class="detail-number">${String(i + 1).padStart(2, "0")}</span><h2>${esc(item.title)}</h2>${bulletList(item.points)}</article>`).join("")}</div></div></section>`;
}

function sites(list) {
  return `<section class="section sites-section"><div class="container">${heading(title("outil-industriel"), t("ui.sites"))}<div class="site-grid">${list.map((site, i) => `<article data-reveal>${icon(["Factory", "ScanLine", "Layers", "Package"][i])}<p class="eyebrow">${esc(site.role)}</p><h3>${esc(site.name)}</h3><p>${esc(site.details)}</p>${bulletList(site.points)}</article>`).join("")}</div></div></section>`;
}

function generalPresentation() {
  const id = "presentation";
  const data = page(id);
  const group = data.groupTitle ? `<div class="steps-heading" data-reveal><h2>${esc(data.groupTitle)}</h2></div>` : "";
  return `${pageTop(id)}${data.metrics ? metrics(data.metrics) : ""}<section class="section points-section"><div class="container">${group}${points(data.sections)}</div></section>`;
}

// Frise de l'histoire : une date, un titre, un texte ; la photo de l'étape (refs) est à droite quand il y en a une.
function timeline(items = []) {
  return `<ol class="timeline">${items.map(item => `<li data-reveal><p class="timeline-year">${esc(item.year)}</p><div class="timeline-text"><h3>${esc(item.title)}</h3>${item.paragraphs.map(text => `<p>${esc(text)}</p>`).join("")}</div>${item.refs?.length ? `<div class="timeline-media">${item.refs.map(ref => slotFigure(ref, item.alt || item.title)).join("")}</div>` : ""}</li>`).join("")}</ol>`;
}

function historyPage() {
  const id = "histoire";
  const data = page(id);
  return `${pageTop(id)}<section class="section timeline-section"><div class="container"><div class="steps-heading" data-reveal><h2>${esc(data.timelineTitle)}</h2></div>${timeline(data.timeline)}</div></section>`;
}

function industrial() {
  const id = "outil-industriel";
  const data = page(id);
  const photos = `<section class="section site-photos-section"><div class="container"><div class="site-photos">${data.photos.map(item => `<figure data-reveal>${picture(item.image, item.caption)}<figcaption>${esc(item.caption)}</figcaption></figure>`).join("")}</div></div></section>`;
  // La carte n'apparaît que lorsque sa photo est renseignée dans content.slots (OUTIL-CARTE) : pas d'encart vide en attendant.
  const map = slotInfo("OUTIL-CARTE").image ? `<section class="section site-map-section"><div class="container"><div class="site-map" data-reveal>${slotFigure("OUTIL-CARTE", lang === "fr" ? "Carte de France situant les sites de production Bernardaud" : "Map of France showing the Bernardaud production sites")}</div></div></section>` : "";
  return `${pageTop(id)}${photos}${map}${sites(data.sites)}`;
}

function marketsIndex() {
  return `${pageTop("marches")}<section class="section"><div class="container">${marketCards(true)}</div></section>${submitBlock(page("marches").submit)}`;
}

// Défense : le déroulé de la plaquette (photo de couverture, protection, applications, composants, proposition de valeur, conclusion).
function defensePage() {
  const id = "defense";
  const data = page(id);
  const products = data.products;
  const system = data.protection.system;
  const protection = `<section class="section protection-section"><div class="container">${heading(data.protection.eyebrow, data.protection.title, data.protection.body)}<div class="armour-system" data-reveal>${slotFigure(system.ref, system.alt)}<div><h3>${esc(system.title)}</h3><ol>${system.steps.map((step, i) => `<li><span>${i + 1}</span><div><strong>${esc(step.title)}</strong><p>${esc(step.body)}</p></div></li>`).join("")}</ol></div></div></div></section>`;
  const applications = `<section class="section application-section"><div class="container"><p class="eyebrow">${esc(t("ui.applications"))}</p><div class="defense-apps">${data.applications.map(item => `<article data-reveal>${slotFigure(item.ref, item.title)}<h3>${esc(item.title)}</h3>${bulletList(item.points)}</article>`).join("")}</div></div></section>`;
  const parts = `<section class="section"><div class="container">${heading(products.title, t("ballistic.title"), products.intro)}<div class="ballistic-gallery">${t("ballistic.products").map(product => `<article data-reveal>${slotFigure(product.ref, product.title)}<div><h3>${esc(product.title)}</h3><p>${esc(product.body)}</p></div></article>`).join("")}</div><div class="material-chips" data-reveal><span>${esc(products.materialsTitle)}</span><ul>${products.materials.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div></div></section>`;
  const value = `<section class="section"><div class="container">${heading(title(id), data.value.title, "")}<div class="capability-grid is-large">${data.value.items.map((item, i) => `<article data-reveal><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></article>`).join("")}</div></div></section>`;
  const closing = `<section class="section closing-section"><div class="container closing-layout" data-reveal><div><h2>${esc(data.closing.title)}</h2>${data.closing.body ? `<p>${esc(data.closing.body)}</p>` : ""}</div><div class="closing-actions">${link("contact", esc(data.closing.button), "button primary", true)}<a class="text-link" href="${localURL("assets/protection-balistique.pdf")}" target="_blank" rel="noopener">${esc(t("ui.downloadBrochure"))}${icon("Download")}</a></div></div></section>`;
  return `${pageTop(id)}${protection}${applications}${parts}${value}${closing}`;
}

function watchPage() {
  const id = "horlogerie";
  const data = page(id);
  return `${pageTop(id)}<section class="section points-section"><div class="container">${points(data.blocks)}</div></section>`;
}

function industryPage() {
  const id = "industrie";
  const data = page(id);
  return `${pageTop(id)}<section class="section points-section"><div class="container"><div class="steps-heading" data-reveal><p class="eyebrow">${esc(t("ui.applications"))}</p><h2>${esc(data.applicationsTitle)}</h2></div>${points(data.applications)}</div></section>${submitBlock(data.submit)}`;
}

function materialIndex() {
  const data = page("materiaux");
  const props = data.properties;
  const rows = materials.map((id, i) => link(id, `<div class="material-thumb">${slotFigure(`MAT-0${i + 1}`)}</div><div><span class="material-id">0${i + 1}</span><h2>${esc(title(id))}</h2><p>${esc(page(id).summary)}</p></div>${icon("ArrowUpRight")}`, "material-row")).join("");
  return `${pageTop("materiaux")}<section class="section"><div class="container"><div class="properties-block" data-reveal><h2>${esc(props.title)}</h2>${props.paragraphs.map(text => `<p>${esc(text)}</p>`).join("")}<ul class="property-chips">${props.chips.map(chip => `<li>${esc(chip)}</li>`).join("")}</ul></div><div class="material-index">${rows}</div></div></section>`;
}

// Une page de matériau reprend les éléments de l'ancien site : texte, avantages, applications, vignette de la structure, tableau.
function materialBlock(block) {
  const advantages = block.advantages ? `<p class="material-label">${esc(block.advantages.title)}</p><p>${esc(block.advantages.body)}</p>` : "";
  const applications = block.applications ? `<h3>${esc(block.applications.title)}</h3>${bulletList(block.applications.points)}` : "";
  return `<article class="material-block" data-reveal><div class="material-text">${block.heading ? `<h2>${esc(block.heading)}</h2>` : ""}${block.subtitle ? `<p class="material-subtitle">${esc(block.subtitle)}</p>` : ""}${(block.description || []).map(text => `<p>${esc(text)}</p>`).join("")}${advantages}${applications}</div><div class="material-media">${slotFigure(block.ref)}</div></article>`;
}

const propertyGroup = i => (i < 3 ? 0 : i < 8 ? 1 : i === 8 ? 2 : 3);

function propertiesTable(id, heading) {
  const table = content.materialTables[id];
  const units = ["%", "g/cm³", "%", "", "MPa·m½", "GPa", "MPa", "m/s", "W·m⁻¹·K⁻¹", "Ω·cm"];
  const groups = t("ui.propertyGroups");
  const number = value => (lang === "fr" ? value.replaceAll(".", ",") : value);
  const rows = table.values.map((values, i) => `<tr><td class="group-cell">${i === 0 || propertyGroup(i) !== propertyGroup(i - 1) ? esc(groups[propertyGroup(i)]) : ""}</td><th scope="row">${esc(t("ui.propertyLabels")[i])}</th><td>${esc(units[i])}</td>${values.map(value => `<td>${esc(number(value))}</td>`).join("")}</tr>`).join("");
  return `<section class="section material-table-section"><div class="container"><h2 class="table-heading">${esc(heading)}</h2><div class="table-scroll" role="region" aria-label="${esc(heading)}" tabindex="0"><table class="property-table"><thead><tr><th scope="col">${esc(t("ui.characteristics"))}</th><th scope="col">${esc(t("ui.property"))}</th><th scope="col">${esc(t("ui.unit"))}</th>${table.grades.map(grade => `<th scope="col">${esc(grade === "Porcelaine" ? title(id) : grade)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div></section>`;
}

function materialDetail(id) {
  const data = page(id);
  const tabs = `<nav class="material-tabs" aria-label="${esc(t("ui.materials"))}"><div class="container">${materials.map(item => link(item, esc(title(item)), item === id ? "active" : "")).join("")}</div></nav>`;
  return `${pageHero(id)}${tabs}${pageIntro(id)}<section class="section material-section"><div class="container">${data.blocks.map(materialBlock).join("")}</div></section>${propertiesTable(id, data.tableTitle)}`;
}

function news() {
  const id = "actualites";
  const data = page(id);
  const agenda = data.agenda;
  return `${pageTop(id)}<section class="section"><div class="container">${agendaTable(agenda)}</div></section><section class="section publication-section"><div class="container"><article class="publication" data-reveal><div class="publication-image">${picture("defense", title("defense"))}</div><div><p class="eyebrow">${esc(data.publication.eyebrow)}</p><h2>${esc(data.publication.title)}</h2><p>${esc(data.publication.body)}</p><a class="button primary" href="${localURL("assets/protection-balistique.pdf")}" target="_blank" rel="noopener">${esc(t("ui.downloadBrochure"))}${icon("Download")}</a></div></article></div></section>`;
}

function contactBand() {
  return `<section class="contact-band"><div class="container" data-reveal><p class="eyebrow">Bernardaud Solutions Industrielles</p><div><h2>${esc(page("contact").title)}</h2>${link("contact", `<span class="sr-only">${esc(t("ui.contact"))}</span>${icon("ArrowUpRight")}`, "contact-arrow")}</div><p>${esc(page("contact").intro)}</p></div></section>`;
}

// Formulaire de contact de l'aperçu. Cette page est statique (GitHub Pages) : elle ne peut envoyer aucun e-mail.
// Le formulaire est donc complet et contrôlé comme celui du site définitif, mais il n'envoie rien et le dit clairement.
const topicPages = ["ceramiques-techniques", "serigraphie", "traitements-de-surface"];
const formLabel = name => t(`ui.form${name[0].toUpperCase()}${name.slice(1)}`);

function contactForm() {
  const optional = ` <span class="optional">(${esc(t("ui.formOptional"))})</span>`;
  const row = (name, control, required, isOptional = false) => `<div class="field"><label class="field-label" for="cf-${name}">${esc(formLabel(name))}${required ? ' <span aria-hidden="true">*</span>' : ""}${isOptional ? optional : ""}</label>${control}${required ? `<p class="field-error" id="cf-${name}-error" hidden></p>` : ""}</div>`;
  const input = (name, type, autocomplete, max, required) => `<input id="cf-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" maxlength="${max}"${type === "email" ? ' inputmode="email"' : type === "tel" ? ' inputmode="tel"' : ""}${required ? ` required aria-required="true" aria-describedby="cf-${name}-error"` : ""}>`;
  const topics = `${topicPages.map(id => `<label class="topic"><input type="radio" name="topic" value="${id}"><span>${esc(title(id))}</span></label>`).join("")}<label class="topic"><input type="radio" name="topic" value="autre"><span>${esc(t("ui.formTopicOther"))}</span></label>`;
  return `<form class="contact-form" novalidate data-contact-form>`
    + `<div class="form-summary" role="alert" tabindex="-1" data-form-summary hidden></div><p class="form-note">${esc(t("ui.formRequiredNote"))}</p>`
    + `<div class="form-grid">${row("name", input("name", "text", "name", 120, true), true)}${row("company", input("company", "text", "organization", 120, false), false, true)}${row("email", input("email", "email", "email", 254, true), true)}${row("phone", input("phone", "tel", "tel", 40, false), false, true)}</div>`
    + `<fieldset class="field"><legend class="field-label">${esc(t("ui.formTopic"))}${optional}</legend><div class="topic-options">${topics}</div></fieldset>`
    + row("message", `<textarea id="cf-message" name="message" rows="6" maxlength="5000" required aria-required="true" aria-describedby="cf-message-error"></textarea>`, true)
    + `<div class="field consent"><label class="check"><input id="cf-consent" type="checkbox" name="consent" value="1" required aria-required="true" aria-describedby="cf-consent-error"><span>${esc(t("ui.formConsent"))} <a href="${localURL(`confidentialite${staticPreview ? "/" : ""}`)}">${esc(t("ui.formPrivacyLink"))}</a></span></label><p class="field-error" id="cf-consent-error" hidden></p></div>`
    + `<div class="form-actions"><button type="submit" class="button primary"><span data-send-label>${esc(t("ui.formSend"))}</span>${icon("Mail")}</button></div></form>`;
}

function bindContactForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;
  const summary = form.querySelector("[data-form-summary]");
  const required = ["name", "email", "message", "consent"];
  const messageFor = code => t(`ui.formErr${code[0].toUpperCase()}${code.slice(1)}`);

  const setFieldError = (name, code) => {
    const input = form.elements[name];
    input.closest(".field").setAttribute("data-invalid", "");
    input.setAttribute("aria-invalid", "true");
    const error = form.querySelector(`#cf-${name}-error`);
    error.textContent = messageFor(code);
    error.hidden = false;
  };
  const clearFieldError = name => {
    const input = form.elements[name];
    input.closest(".field").removeAttribute("data-invalid");
    input.removeAttribute("aria-invalid");
    const error = form.querySelector(`#cf-${name}-error`);
    error.hidden = true;
    error.textContent = "";
    // Plus aucun champ en erreur : le résumé n'a plus de raison d'être.
    if (!form.querySelector(".field[data-invalid]")) {
      summary.hidden = true;
      summary.textContent = "";
    }
  };
  const clearErrors = () => {
    summary.hidden = true;
    summary.textContent = "";
    required.forEach(clearFieldError);
  };
  const check = name => {
    const value = form.elements[name].value.trim();
    if (name === "name") return value ? "" : "required";
    if (name === "email") return !value ? "required" : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "email";
    if (name === "message") return !value ? "required" : value.length < 10 ? "short" : value.length > 5000 ? "long" : "";
    return form.elements.consent.checked ? "" : "consent";
  };
  const showErrors = errors => {
    clearErrors();
    const items = [];
    for (const [name, code] of Object.entries(errors)) {
      setFieldError(name, code);
      items.push(`<li><a href="#cf-${name}" data-focus="cf-${name}">${name === "consent" ? "" : `${esc(formLabel(name))} : `}${esc(messageFor(code))}</a></li>`);
    }
    summary.innerHTML = `<p>${esc(t("ui.formErrorTitle"))}</p><ul>${items.join("")}</ul>`;
    summary.hidden = false;
    summary.focus();
  };

  summary.addEventListener("click", event => {
    const anchor = event.target.closest("a[data-focus]");
    if (!anchor) return;
    event.preventDefault();
    form.querySelector(`#${anchor.dataset.focus}`)?.focus();
  });
  form.addEventListener("focusout", event => {
    const name = event.target.name;
    if (!["name", "email", "message"].includes(name)) return;
    const code = check(name);
    if (code && event.target.value.trim()) setFieldError(name, code);
    else if (!code) clearFieldError(name);
  });
  form.addEventListener("input", event => {
    const name = event.target.name;
    if (required.includes(name) && event.target.closest(".field").hasAttribute("data-invalid") && !check(name)) clearFieldError(name);
  });
  form.elements.consent.addEventListener("change", () => {
    if (!check("consent")) clearFieldError("consent");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const errors = {};
    required.forEach(name => {
      const code = check(name);
      if (code) errors[name] = code;
    });
    if (Object.keys(errors).length) {
      showErrors(errors);
      return;
    }
    // Aperçu : rien n'est envoyé, et la page le dit à la place du formulaire.
    const panel = document.createElement("div");
    panel.className = "form-success";
    panel.setAttribute("role", "status");
    panel.tabIndex = -1;
    panel.innerHTML = `${icon("Mail")}<div><h3>${esc(t("ui.formPreviewTitle"))}</h3><p>${esc(t("ui.formPreviewBody"))}</p></div>`;
    form.replaceWith(panel);
    panel.focus();
  });
}

function contact() {
  const settings = content.settings;
  return `${pageTop("contact")}<section class="section contact-section"><div class="container contact-layout"><div class="contact-copy" data-reveal><h2>${esc(t("ui.contactDetails"))}</h2><p>${esc(t("ui.contactIntro"))}</p>${contactForm()}</div><div class="contact-details" data-reveal><div>${icon("Mail")}<div><span>${esc(t("ui.email"))}</span><a href="mailto:${esc(settings.contactEmail)}">${esc(settings.contactEmail)}</a></div></div><div>${icon("Phone")}<div><span>${esc(t("ui.phone"))}</span><a href="tel:${esc(settings.contactPhone.replace("(0)", "").replace(/[^+\d]/g, ""))}">${esc(settings.contactPhone)}</a></div></div><div>${icon("MapPin")}<div><span>${esc(t("ui.address"))}</span><p>${esc(settings.address)}</p></div></div></div></div></section><section class="contact-photo">${picture("industrial", lang === "fr" ? "La manufacture Bernardaud à Limoges" : "The Bernardaud manufacture in Limoges")}</section>`;
}

function renderFooter() {
  document.querySelector("#siteFooter").innerHTML = `<div class="container"><div class="footer-top"><div class="footer-brand">${picture("logo", content.settings.siteName)}<p>${esc(t("home.footerBaseline"))}</p><a class="text-link" href="mailto:${esc(content.settings.contactEmail)}">${esc(content.settings.contactEmail)}${icon("ArrowUpRight")}</a></div>${[groups[0], groups[2], groups[3]].map(group => `<div class="footer-column"><h3>${esc(t("ui.sections")[groups.indexOf(group)])}</h3>${group.children.map(id => link(id, esc(title(id)))).join("")}</div>`).join("")}</div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(content.settings.siteName)} · ${esc(t("ui.versionLabel"))}</span><div>${link("confidentialite", esc(t("ui.privacy")))}<button type="button" data-cookie-settings>${esc(t("ui.cookieSettings"))}</button><a href="/admin">${icon("LockKeyhole")}${esc(t("ui.admin"))}</a></div></div></div>`;
}

function renderRoute() {
  const id = currentId();
  if (id === "home") return home();
  if (!page(id)) return `<section class="section container not-found"><h1>${esc(t("ui.notFound"))}</h1>${link("home", esc(t("ui.backHome")), "button primary", true)}</section>`;
  if (id === "materiaux") return materialIndex();
  if (materials.includes(id)) return materialDetail(id);
  if (id === "marches") return marketsIndex();
  if (id === "presentation") return generalPresentation();
  if (id === "histoire") return historyPage();
  if (id === "outil-industriel") return industrial();
  if (id === "ceramiques-techniques") return ceramicsDetail();
  if (id === "serigraphie") return screenPrintingDetail();
  if (id === "traitements-de-surface") return surfaceTreatmentDetail();
  if (id === "defense") return defensePage();
  if (id === "horlogerie") return watchPage();
  if (id === "industrie") return industryPage();
  if (id === "actualites") return news();
  if (id === "contact") return contact();
  if (id === "confidentialite") return `${pageTop(id)}<section class="section container">${sections(page(id).sections)}<button type="button" class="button primary" data-cookie-settings>${esc(t("ui.cookieSettings"))}</button></section>`;
  return `<section class="section container not-found"><h1>${esc(t("ui.notFound"))}</h1>${link("home", esc(t("ui.backHome")), "button primary", true)}</section>`;
}

function cookieBanner() {
  document.querySelector("[data-cookie-title]").textContent = get("cookies.title");
  document.querySelector("[data-cookie-body]").textContent = lang === "fr" ? "Nous conservons votre choix de langue et vos préférences sur cet appareil. Aucun traceur publicitaire ni outil de mesure d’audience n’est activé." : "We keep your language choice and preferences on this device. No advertising trackers or audience measurement tools are active.";
  document.querySelector('[data-cookie-choice="reject"]').textContent = get("cookies.reject");
  document.querySelector('[data-cookie-choice="accept"]').textContent = get("cookies.accept");
  document.querySelector("[data-cookie-policy]").textContent = t("ui.privacy");
  document.querySelector("#cookieBanner").hidden = Boolean(localStorage.getItem("bsi_cookie_choice"));
}

function setGroup(node, open) {
  node.dataset.open = String(open);
  node.querySelector(".nav-toggle").setAttribute("aria-expanded", String(open));
  node.querySelector(".mega-menu").hidden = !open;
}

function closeMenus() {
  document.querySelectorAll("[data-nav-group]").forEach(node => setGroup(node, false));
  document.querySelector(".language-trigger")?.setAttribute("aria-expanded", "false");
  const options = document.querySelector("#languageOptions");
  if (options) options.hidden = true;
}

function setMobileMenu(open) {
  const header = document.querySelector("#siteHeader");
  header.dataset.mobileOpen = String(open);
  const button = header.querySelector(".mobile-toggle");
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", t(open ? "ui.close" : "ui.menu"));
  button.innerHTML = icon(open ? "X" : "Menu");
  header.querySelector("#mainNav").inert = mobileViewport.matches && !open;
  document.body.classList.toggle("menu-open", open && mobileViewport.matches);
  document.querySelector("#app").inert = open && mobileViewport.matches;
  document.querySelector("#siteFooter").inert = open && mobileViewport.matches;
}

function bindHeader() {
  document.querySelectorAll("[data-nav-group]").forEach(node => {
    node.querySelector(".nav-toggle").addEventListener("click", event => {
      const open = !mobileViewport.matches && event.detail > 0 ? true : node.dataset.open !== "true";
      clearTimeout(menuTimer);
      closeMenus();
      setGroup(node, open);
    });
    node.addEventListener("pointerenter", event => {
      if (mobileViewport.matches || event.pointerType === "touch") return;
      clearTimeout(menuTimer);
      closeMenus();
      setGroup(node, true);
    });
    node.addEventListener("pointerleave", () => {
      if (!mobileViewport.matches) menuTimer = setTimeout(() => setGroup(node, false), 180);
    });
    node.addEventListener("focusout", event => {
      if (!node.contains(event.relatedTarget)) setGroup(node, false);
    });
  });
  document.querySelector(".language-trigger").addEventListener("click", event => {
    const open = event.currentTarget.getAttribute("aria-expanded") !== "true";
    closeMenus();
    event.currentTarget.setAttribute("aria-expanded", String(open));
    document.querySelector("#languageOptions").hidden = !open;
  });
  document.querySelector(".mobile-toggle").addEventListener("click", () => setMobileMenu(document.querySelector("#siteHeader").dataset.mobileOpen !== "true"));
}

function initMotion() {
  revealObserver?.disconnect();
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
  const nodes = document.querySelectorAll("[data-reveal]");
  revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  }), { threshold: 0.08 });
  nodes.forEach(node => {
    node.classList.add("reveal");
    node.style.setProperty("--reveal-delay", `${Math.min([...node.parentElement.children].indexOf(node) * 65, 195)}ms`);
    revealObserver.observe(node);
  });
}

function updateScroll() {
  const header = document.querySelector("#siteHeader");
  header.dataset.scrolled = String(window.scrollY > 20);
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  header.style.setProperty("--scroll", distance > 0 ? Math.min(window.scrollY / distance, 1) : 0);
  if (!reducedMotion.matches) {
    const hero = document.querySelector(".hero-photo");
    if (hero && window.scrollY < window.innerHeight) hero.style.setProperty("--parallax", `${Math.min(window.scrollY * 0.12, 85)}px`);
  }
}

function render() {
  clearTimeout(menuTimer);
  document.body.classList.remove("menu-open");
  document.querySelector("#siteHeader").dataset.mobileOpen = "false";
  document.querySelector("#app").inert = false;
  document.querySelector("#siteFooter").inert = false;
  document.documentElement.lang = lang;
  document.title = `${currentId() === "home" ? "" : `${page(currentId())?.title || t("ui.notFound")} | `}${content.settings.siteName}`;
  document.querySelector('meta[name="description"]').content = currentId() === "home" ? t("home.intro") : page(currentId())?.intro || content.settings.baseline;
  renderHeader();
  document.querySelector("#app").innerHTML = renderRoute();
  renderFooter();
  if (staticPreview) document.querySelector('#siteFooter a[href="/admin"]')?.remove();
  document.querySelector("[data-cookie-policy]").href = localURL("confidentialite/");
  document.querySelectorAll('a[href="/assets/protection-balistique.pdf"]').forEach(anchor => { anchor.href = localURL("assets/protection-balistique.pdf"); });
  cookieBanner();
  bindHeader();
  applySlotStyles();
  startHeroVideo();
  bindContactForm();
  initMotion();
  updateScroll();
}

// Cadrage des photos : lu dans content.slots (data-ratio, data-pos), appliqué ici plutôt qu'en style en ligne.
function applySlotStyles() {
  document.querySelectorAll("[data-ratio]").forEach(node => node.style.setProperty("--ratio", node.dataset.ratio));
  document.querySelectorAll("[data-pos]").forEach(node => node.style.setProperty("--pos", node.dataset.pos));
}

// ?reperes=1 affiche le nom de chaque photo (retenu dans ce navigateur), ?reperes=0 l'efface.
function applyReperes() {
  try {
    const asked = new URLSearchParams(location.search).get("reperes");
    if (asked !== null) localStorage.setItem("bsi_reperes", asked === "0" ? "0" : "1");
    document.documentElement.dataset.reperes = localStorage.getItem("bsi_reperes") === "1" ? "on" : "";
  } catch {
    document.documentElement.dataset.reperes = "";
  }
}

document.addEventListener("click", event => {
  const language = event.target.closest("[data-lang]");
  if (language && content) {
    lang = language.dataset.lang;
    localStorage.setItem("bsi_lang", lang);
    render();
    document.querySelector(".language-trigger").focus();
    return;
  }
  const choice = event.target.closest("[data-cookie-choice]");
  if (choice) {
    localStorage.setItem("bsi_cookie_choice", choice.dataset.cookieChoice);
    document.querySelector("#cookieBanner").hidden = true;
    return;
  }
  if (event.target.closest("[data-cookie-settings]")) {
    document.querySelector("#cookieBanner").hidden = false;
    document.querySelector("#cookieBanner button").focus();
    return;
  }
  const anchor = event.target.closest("a");
  if (anchor && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && !anchor.target && !anchor.download) {
    const url = new URL(anchor.href, location.href);
    if (url.origin === location.origin && url.pathname.startsWith(basePath) && !url.pathname.startsWith(localURL("assets/")) && url.pathname !== localURL("admin") && !url.hash && content) {
      event.preventDefault();
      history.pushState({}, "", url.pathname);
      window.scrollTo({ top: 0, behavior: "instant" });
      render();
      document.querySelector("#app").focus({ preventScroll: true });
      return;
    }
  }
  if (!event.target.closest(".nav-group, .language-control")) closeMenus();
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const expanded = document.querySelector('.nav-toggle[aria-expanded="true"], .language-trigger[aria-expanded="true"]');
  closeMenus();
  if (document.querySelector("#siteHeader").dataset.mobileOpen === "true") {
    setMobileMenu(false);
    document.querySelector(".mobile-toggle").focus();
  } else expanded?.focus();
});

window.addEventListener("popstate", () => { if (content) render(); });
window.addEventListener("scroll", updateScroll, { passive: true });
mobileViewport.addEventListener("change", () => { if (content) { closeMenus(); setMobileMenu(false); } });
reducedMotion.addEventListener("change", () => { if (content) render(); });

async function load() {
  try {
    const response = await fetch(new URL(staticPreview ? "content.json" : "api/content", appURL), { cache: "no-cache" });
    if (!response.ok) throw new Error("Content unavailable");
    content = await response.json();
    const saved = localStorage.getItem("bsi_lang");
    lang = ["fr", "en"].includes(saved) ? saved : navigator.language?.startsWith("en") ? "en" : content.settings.defaultLang;
    applyReperes();
    render();
  } catch (error) {
    console.error(error);
    document.querySelector("#app").innerHTML = '<section class="section container not-found"><h1>Le contenu n’a pas pu être chargé.</h1><button class="button primary" type="button" id="retryLoad">Réessayer</button></section>';
    document.querySelector("#retryLoad").addEventListener("click", load);
  }
}
load();
