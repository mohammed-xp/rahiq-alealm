// يبني الموقع من content.json إلى مجلد dist/
// لتغيير محتوى الموقع عدّل content.json — مش محتاج تلمس الملف ده.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'content.json');

class ContentError extends Error {}

// ---------- Helpers ----------

const ar = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace('.', '٫');
const num2 = i => ar(String(i + 1).padStart(2, '0'));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lines = v => (Array.isArray(v) ? v : [v]).map(esc).join('<br>');
const waLink = (number, message) => `https://wa.me/${number}` + (message ? `?text=${encodeURIComponent(message)}` : '');
// data-wa-msg بيخلّي main.js يضيف اسم الفرع للرسالة لما الزائر يختار فرع
const waAttrs = (number, message) => `href="${esc(waLink(number, message))}" data-wa-msg="${esc(message)}"`;
const branchLabel = b => b.label || b.name;
const mapQuery = ({ map: m }) => (m.query ? m.query : `${m.lat},${m.lng}`);
const mapLink = b => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(b))}`;
const mapEmbed = b => `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery(b))}&z=${b.map.zoom || 17}&output=embed`;
const ranked = students => [...students].sort((a, b) => b.percent - a.percent);
const icon = (id, size) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const sectionHead = (s, extra = '') => `
    <div class="section-head${extra ? ' section-head--loose' : ''}">
      <div class="eyebrow">${esc(s.eyebrow)}</div>
      <h2 class="section-title">${esc(s.title)}</h2>${extra}
    </div>`;

// ---------- Load + validate ----------

function loadContent() {
  const raw = fs.readFileSync(CONTENT, 'utf8').replace(/^﻿/, '');
  try {
    return JSON.parse(raw);
  } catch (e) {
    const at = i => { const before = raw.slice(0, i); return [before.split('\n').length, i - before.lastIndexOf('\n')]; };
    const lc = /line (\d+) column (\d+)/.exec(e.message);
    const pos = /position (\d+)/.exec(e.message);
    const trailing = /,(\s*[\]}])/.exec(raw);
    let loc = null;
    let hint = 'غالباً فاصلة (,) ناقصة بين عنصرين، أو علامة " مش مقفولة.';
    if (lc) loc = [lc[1], lc[2]];
    else if (pos) loc = at(+pos[1]);
    else if (trailing) { loc = at(trailing.index); hint = 'في فاصلة (,) زيادة بعد آخر عنصر في القائمة — امسحها.'; }
    throw new ContentError(
      `ملف content.json فيه خطأ في الكتابة${loc ? ` عند السطر ${loc[0]}، العمود ${loc[1]}` : ''}.\n` +
      `${hint}\n(${e.message.replace(/\s+/g, ' ')})`
    );
  }
}

function validate(c) {
  const errors = [];
  const get = p => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), c);
  const need = p => { const v = get(p); if (v === undefined || v === null || v === '') errors.push(`"${p}" ناقص أو فاضي`); };
  const list = p => { const v = get(p); if (!Array.isArray(v) || !v.length) errors.push(`"${p}" لازم يكون قائمة [ ... ] وفيها عنصر واحد على الأقل`); };

  ['site.name', 'site.title', 'site.description', 'site.tagline', 'site.logo',
    'contact.whatsappMessage', 'buttons.header', 'buttons.whatsapp', 'buttons.call', 'buttons.callShort',
    'hero.title', 'hero.video', 'honor.threshold', 'cta.title', 'footer.slogan'].forEach(need);
  ['contact.phones', 'branches.items', 'stages.items', 'why.items', 'honor.years', 'teachers.items',
    'fees.items', 'gallery.images', 'reviews.items', 'faq.items'].forEach(list);

  if (get('site.url') && !/^https?:\/\//.test(get('site.url'))) errors.push('"site.url" لازم يبدأ بـ https:// (أو سيبه فاضي "")');
  (get('contact.phones') || []).forEach((p, i) => {
    if (!p.number) errors.push(`contact.phones[${i}] مفيهوش "number"`);
    if (i === 0 && !p.whatsapp) errors.push('أول رقم في contact.phones لازم يكون معاه "whatsapp" (أزرار التسجيل بتستخدمه)');
  });

  (get('honor.years') || []).forEach((y, i) => {
    if (typeof y.year !== 'number') errors.push(`honor.years[${i}].year لازم يكون رقم إنجليزي، مثلاً 2027`);
    if (!Array.isArray(y.students)) { errors.push(`honor.years[${i}].students لازم يكون قائمة`); return; }
    y.students.forEach((s, j) => {
      if (!s.name) errors.push(`honor.years[${i}].students[${j}] مفيهوش "name"`);
      if (typeof s.percent !== 'number') errors.push(`النسبة بتاعة "${s.name || j}" لازم تكون رقم إنجليزي من غير علامات تنصيص، مثلاً 91.3`);
    });
  });

  const ids = new Set();
  (get('branches.items') || []).forEach((b, i) => {
    const at = `branches.items[${i}]`;
    if (!b.id || !/^[a-z0-9-]+$/.test(b.id)) errors.push(`${at} لازم يكون معاه "id" بحروف إنجليزي صغيرة، مثلاً "zuma"`);
    else if (ids.has(b.id)) errors.push(`الـ "id" بتاع ${at} ("${b.id}") متكرر — كل فرع لازم يبقى له id مختلف`);
    ids.add(b.id);
    if (!b.name) errors.push(`${at} مفيهوش "name"`);
    if (!Array.isArray(b.address) || !b.address.length) errors.push(`${at}.address لازم يكون قائمة فيها سطر واحد على الأقل`);
    const m = b.map || {};
    if (!m.query && (typeof m.lat !== 'number' || typeof m.lng !== 'number')) {
      errors.push(`${at}.map لازم يكون فيه "lat" و "lng" (أرقام)، أو "query" (اسم المكان على الخرائط)`);
    }
  });

  if (errors.length) throw new ContentError('في مشاكل في content.json:\n  - ' + errors.join('\n  - '));

  // الصور والفيديو: تحذير بس لو ملف مش موجود
  const files = [c.site.logo, c.hero.video, c.hero.poster, ...c.gallery.images.map(g => g.src), ...c.branches.items.map(b => b.image)].filter(Boolean);
  return files.filter(f => !fs.existsSync(path.join(SRC, f))).map(f => `الملف "${f}" مش موجود جوه مجلد src/`);
}

// ---------- Sections ----------

const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-chat" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2z"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></g></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></symbol>
</svg>`;

function head(c) {
  const og = c.site.url ? `
<link rel="canonical" href="${esc(c.site.url)}">
<meta property="og:url" content="${esc(c.site.url)}">
<meta property="og:image" content="${esc(new URL(c.site.logo, c.site.url).href)}">` : '';
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.site.title)}</title>
<meta name="description" content="${esc(c.site.description)}">
<meta name="theme-color" content="#1f3d23">
<link rel="icon" type="image/png" href="${esc(c.site.logo)}">
<link rel="apple-touch-icon" href="${esc(c.site.logo)}">

<meta property="og:type" content="website">
<meta property="og:locale" content="ar_AR">
<meta property="og:site_name" content="${esc(c.site.name)}">
<meta property="og:title" content="${esc(c.site.title)}">
<meta property="og:description" content="${esc(c.site.description)}">${og}

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;700&amp;family=Tajawal:wght@400;500;700;800&amp;display=swap">
<link rel="stylesheet" href="assets/css/style.css">
<script>document.documentElement.classList.add('js')</script>
<script src="assets/js/main.js" defer></script>
</head>`;
}

function header(c, ctx) {
  const t = c.topBanner;
  const banner = t && t.show ? `
<div class="top-banner">
  ${t.badge ? `<span class="top-banner-badge">${esc(t.badge)}</span>` : '<span class="dot dot--gold" aria-hidden="true"></span>'}
  <span>${esc(t.text)}</span>
  <a href="${esc(t.link || '#contact')}">${esc(t.linkText)}</a>
</div>
` : '';
  return `${banner}
<header class="site-header">
  <div class="header-bar">
    <a href="#home" class="brand">
      <img src="${esc(c.site.logo)}" alt="شعار ${esc(c.site.name)}" width="60" height="44" class="brand-logo">
      <span class="brand-text">
        <span class="brand-name">${esc(c.site.name)}</span>
        <span class="brand-tag">${esc(c.site.tagline)}</span>
      </span>
    </a>
    <nav class="nav-desktop" aria-label="القائمة الرئيسية">
      <a href="#stages">المراحل</a>
      <a href="#branches">فروعنا</a>
      <a href="#why">ليه رحيق العلم</a>
      <a href="#honor">المتفوقون</a>
      <a href="#teachers">الأساتذة</a>
      <a href="#fees">الرسوم</a>
      <a href="#faq">الأسئلة</a>
      <a href="#contact">العنوان</a>
    </nav>
    <div class="header-actions">
      <a class="btn btn--primary btn--sm" ${ctx.wa} target="_blank" rel="noopener" aria-label="${esc(c.buttons.header)} عبر واتساب">
        ${icon('chat', 18)}
        <span class="btn-label">${esc(c.buttons.header)}</span>
      </a>
      <button class="menu-toggle" type="button" aria-label="القائمة" aria-expanded="false" aria-controls="mobile-menu">
        <svg class="icon-open" width="20" height="20" aria-hidden="true"><use href="#i-menu"/></svg>
        <svg class="icon-close" width="20" height="20" aria-hidden="true"><use href="#i-close"/></svg>
      </button>
    </div>
  </div>
  <nav id="mobile-menu" class="nav-mobile" aria-label="القائمة" hidden>
    <a href="#stages">المراحل الدراسية</a>
    <a href="#branches">فروعنا</a>
    <a href="#why">ليه رحيق العلم</a>
    <a href="#honor">لوحة الشرف</a>
    <a href="#teachers">الأساتذة</a>
    <a href="#fees">الرسوم والخصومات</a>
    <a href="#gallery">معرض الصور</a>
    <a href="#faq">الأسئلة الشائعة</a>
    <a href="#contact" class="is-accent">العنوان والتواصل</a>
  </nav>
</header>`;
}

function hero(c, ctx) {
  const h = c.hero;
  return `
<section id="home" class="hero">
  <div class="hero-blob" aria-hidden="true"></div>
  <div class="hero-inner">
    <div class="hero-copy">
      <div class="badge-gold">
        <span class="dot dot--green" aria-hidden="true"></span>
        ${esc(h.badge)}
      </div>
      <h1 class="hero-title">${esc(h.title)}${h.titleHighlight ? ` <span class="hl">${esc(h.titleHighlight)}</span>` : ''}</h1>
      <p class="hero-lead">${esc(h.text)}</p>
      <div class="hero-ctas">
        <a class="btn btn--primary" ${ctx.wa} target="_blank" rel="noopener">
          ${icon('chat', 20)}
          ${esc(c.buttons.whatsapp)}
        </a>
        <a class="btn btn--outline" href="${esc(ctx.tel)}">
          ${icon('phone', 19)}
          ${esc(c.buttons.call)}
        </a>
      </div>
    </div>
    <div class="hero-media">
      <div class="hero-frame">
        <video class="hero-video" src="${esc(h.video)}"${h.poster ? ` poster="${esc(h.poster)}"` : ''} autoplay muted loop playsinline preload="metadata" aria-label="${esc(h.videoLabel)}"></video>
      </div>
      <div class="hero-seal" aria-hidden="true">${lines(h.seal)}</div>
    </div>
  </div>
</section>`;
}

function stats(c, ctx) {
  return `
<div class="stats-wrap">
  <div class="stats">
    <div class="stat">
      <div class="stat-num">${ar(c.stages.items.length)}</div>
      <div class="stat-label">${esc(c.stages.statLabel)}</div>
    </div>
    <div class="stat">
      <div class="stat-num">${ar(ctx.aboveCount)}</div>
      <div class="stat-label">متفوقين فوق ${ar(c.honor.threshold)}٪</div>
    </div>
    <div class="stat">
      <div class="stat-num stat-num--amber">${ctx.top ? ar(ctx.top.percent) + '٪' : ''}</div>
      <div class="stat-label">أعلى نسبة في ${esc(ctx.latest.cert)} ${ar(ctx.latest.year)}</div>
    </div>
  </div>
</div>`;
}

function branches(c, ctx) {
  const br = c.branches;
  // الفروع الجديدة ("new": true) بتظهر الأول وبالكارت الغامق
  const items = [...br.items].sort((a, b) => !!b.new - !!a.new);
  const lead = br.text ? `\n      <p class="section-lead">${esc(br.text)}</p>` : '';
  return `
<section id="branches" class="section section--sage">
  <div class="container">
    <div class="section-head section-head--loose">
      <div class="eyebrow">${esc(br.eyebrow)}</div>
      <h2 class="section-title">${esc(br.title)}${br.titleHighlight ? ` <span class="hl">${esc(br.titleHighlight)}</span>` : ''}</h2>${lead}
    </div>
    <div class="branches">${items.map(b => `
      <article class="branch-card${b.new ? ' branch-card--new' : ''}">
        <div class="branch-media">${b.image ? `
          <img src="${esc(b.image)}" alt="${esc(b.imageAlt || 'فرع ' + b.name)}" loading="lazy" decoding="async"${b.imagePosition ? ` style="object-position:${esc(b.imagePosition)}"` : ''}>` : ''}${b.badge ? `
          <div class="branch-badge">${b.new ? '<span class="dot dot--green" aria-hidden="true"></span>' : ''}${esc(b.badge)}</div>` : ''}
        </div>
        <div class="branch-body">
          <div class="branch-heading">${b.region ? `
            <div class="branch-region">${esc(b.region)}</div>` : ''}
            <h3>${esc(b.name)}</h3>
          </div>
          <div class="branch-address">${esc(b.address.join(' – '))}</div>${(b.stages || []).length ? `
          <div class="branch-stages">${b.stages.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
          <div class="branch-actions">
            <a class="btn ${b.new ? 'btn--gold' : 'btn--primary'}" href="${esc(waLink(ctx.phone.whatsapp, `${c.contact.whatsappMessage} – فرع ${branchLabel(b)}`))}" target="_blank" rel="noopener">${esc(br.registerButton)}</a>
            <a class="btn ${b.new ? 'btn--ghost-gold' : 'btn--outline'}" href="#contact" data-branch-pick="${esc(b.id)}">${esc(br.mapButton)}</a>
          </div>
        </div>
      </article>`).join('')}
    </div>
  </div>
</section>`;
}

function news(c) {
  const n = c.news;
  if (!n || !n.show || !Array.isArray(n.items)) return '';
  const tags = ['tag--green', 'tag--gold', 'tag--amber'];
  return `
<section id="news" class="section section--sand">
  <div class="container container--news">${sectionHead(n)}
    <div class="h-scroll h-scroll--news">${n.items.map((it, i) => `
      <article class="news-card${i % 2 ? ' news-card--dark' : ''}">
        <div class="tag ${tags[i % 3]}">${esc(it.tag)}</div>
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.text)}</p>
        ${it.linkText ? `<a href="${esc(it.link || '#contact')}">${esc(it.linkText)}</a>` : ''}
      </article>`).join('')}
    </div>
  </div>
</section>`;
}

function stages(c) {
  const variants = ['stage-card--green', 'stage-card--gold', 'stage-card--dark'];
  return `
<section id="stages" class="section section--cream">
  <div class="container">${sectionHead(c.stages)}
    <div class="stages">${c.stages.items.map((s, i) => `
      <article class="stage-card ${variants[i % 3]}">
        <div class="stage-num" aria-hidden="true">${ar(i + 1)}</div>
        <div class="chip">${esc(s.for)}</div>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.text)}</p>
      </article>`).join('')}
    </div>
  </div>
</section>`;
}

function why(c) {
  const w = c.why;
  return `
<section id="why" class="section section--dark why">
  <div class="why-mark" aria-hidden="true">؟</div>
  <div class="container container--why">
    <div class="section-head">
      <div class="eyebrow eyebrow--gold">${esc(w.eyebrow)}</div>
      <h2 class="why-title">${esc(w.title)} <span>${esc(w.titleHighlight)}</span>${esc(w.titleEnd)}</h2>
    </div>
    <div class="why-grid">${w.items.map((it, i) => `
      <div class="why-item">
        <div class="why-num">${num2(i)}</div>
        <div class="why-body"><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div>
      </div>`).join('')}
    </div>
  </div>
</section>`;
}

function honor(c, ctx) {
  const places = ['المركز الأول', 'المركز الثاني', 'المركز الثالث'];
  // البيانات اللي main.js بيستخدمها لتبديل الدفعات وعرض القائمة
  const data = c.honor.years.map(y => ({ year: y.year, cert: y.cert, list: y.students.map(s => [s.name, s.percent]) }));
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `
<section id="honor" class="section section--cream">
  <div class="container">
    <div class="section-head">
      <div class="eyebrow">${esc(c.honor.eyebrow)}</div>
      <h2 class="section-title">${esc(c.honor.title)}</h2>
      <div class="honor-caption" id="honor-caption">نتائج امتحانات ${esc(ctx.latest.cert)} ${ar(ctx.latest.year)}</div>
    </div>
    <div class="honor-tabs" id="honor-tabs" role="tablist" aria-label="الدفعات"></div>
    <div class="podium">${places.map((place, i) => {
      const s = ctx.latestRanked[i];
      return `
      <div class="podium-card podium-card--${i + 1}"${s ? '' : ' hidden'}>
        <div class="podium-top"><div class="medal">${ar(i + 1)}</div><div class="podium-place">${place}</div></div>
        <div class="podium-pct">${s ? ar(s.percent) + '٪' : ''}</div>
        <div class="podium-name">${s ? esc(s.name) : ''}</div>
      </div>`;
    }).join('')}
    </div>
    <div class="honor-list" id="honor-list">
      <div class="honor-grid" id="honor-mid"></div>
      <div class="honor-collapse" id="honor-rest-wrap" aria-hidden="true">
        <div class="honor-collapse-inner">
          <div class="honor-grid honor-grid--rest" id="honor-rest"></div>
        </div>
      </div>
    </div>
    <button class="honor-toggle" id="honor-toggle" type="button" aria-expanded="false" aria-controls="honor-rest-wrap" hidden>
      <span>عرض كل المتفوقين</span>
      ${icon('chevron', 18)}
    </button>
    <script type="application/json" id="honor-data">${json}</script>
  </div>
</section>`;
}

function teachers(c) {
  const t = c.teachers;
  const lead = t.text ? `\n      <p class="section-lead">${esc(t.text)}</p>` : '';
  return `
<section id="teachers" class="section section--sage">
  <div class="container">${sectionHead(t, lead)}
    <div class="teachers">${t.items.map((it, i) => `
      <div class="teacher-card">
        <div class="subject${Math.floor(i / 2) % 2 ? ' subject--amber' : ''}">${esc(it.subject)}</div>
        <div class="teacher-names">${(it.names || []).map(n => `<span>${esc(n)}</span>`).join('')}</div>
      </div>`).join('')}
    </div>
  </div>
</section>`;
}

function fees(c, ctx) {
  const f = c.fees;
  const variants = ['', ' fee-card--gold', ' fee-card--green'];
  return `
<section id="fees" class="section section--cream">
  <div class="container">${sectionHead(f)}
    <div class="fees">${f.items.map((it, i) => `
      <div class="fee-card${variants[i % 3]}">
        <div class="fee-num">${num2(i)}</div>
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.text)}</p>
      </div>`).join('')}
    </div>
    <div class="fees-note">
      <div class="fees-note-text">${esc(f.note)}</div>
      <a class="btn btn--primary btn--md" ${waAttrs(ctx.phone.whatsapp, f.whatsappMessage)} target="_blank" rel="noopener">${esc(f.button)}</a>
    </div>
  </div>
</section>`;
}

function gallery(c) {
  const sizes = { big: ' g-item--big', wide: ' g-item--wide' };
  return `
<section id="gallery" class="section section--sand">
  <div class="container">${sectionHead(c.gallery)}
    <div class="gallery">${c.gallery.images.map(g => `
      <div class="g-item${sizes[g.size] || ''}"><img src="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy" decoding="async"${g.position ? ` style="object-position:${esc(g.position)}"` : ''}></div>`).join('')}
    </div>
  </div>
</section>`;
}

function reviews(c) {
  return `
<section id="reviews" class="section section--cream">
  <div class="container">${sectionHead(c.reviews)}
    <div class="h-scroll h-scroll--reviews">${c.reviews.items.map((r, i) => `
      <figure class="review${i % 2 ? ' review--green' : ''}">
        <div class="review-mark" aria-hidden="true">”</div>
        <blockquote>${esc(r.text)}</blockquote>
        <figcaption>${esc(r.author)}</figcaption>
      </figure>`).join('')}
    </div>
  </div>
</section>`;
}

function faq(c) {
  return `
<section id="faq" class="section section--sage">
  <div class="container container--narrow">${sectionHead(c.faq)}
    <div class="faq-list">${c.faq.items.map((it, i) => `
      <div class="faq-item${i === 0 ? ' is-open' : ''}">
        <h3 class="faq-q"><button type="button" class="faq-btn" id="faq-q-${i}" aria-expanded="${i === 0}" aria-controls="faq-a-${i}"><span>${esc(it.q)}</span><span class="faq-icon" aria-hidden="true">+</span></button></h3>
        <div class="faq-panel" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}"><div class="faq-panel-inner"><p>${esc(it.a)}</p></div></div>
      </div>`).join('')}
    </div>
  </div>
</section>`;
}

function contact(c) {
  const k = c.contact;
  const list = c.branches.items;
  const first = list[0];
  const many = list.length > 1;
  const addressLines = b => [`${b.name} – ${b.address[0]}`, ...b.address.slice(1)];
  const tabs = many ? `
      <div class="branch-tabs" role="tablist" aria-label="الفروع">${list.map((b, i) => `
        <button type="button" class="branch-tab" role="tab" aria-selected="${i === 0}" aria-controls="branch-panel" data-branch="${esc(b.id)}">
          <span>${esc(branchLabel(b))}</span>${b.new ? '<span class="pill-new">جديد</span>' : ''}
        </button>`).join('')}
      </div>` : '';
  // البيانات اللي main.js بيستخدمها للتبديل بين الفروع
  const data = list.map(b => ({ id: b.id, label: branchLabel(b), address: addressLines(b), mapLink: mapLink(b), mapEmbed: mapEmbed(b) }));
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `
<section id="contact" class="section section--cream">
  <div class="container">${sectionHead(k, tabs)}
    <div class="contact" id="branch-panel"${many ? ' role="tabpanel"' : ''}>
      <div class="contact-card">
        <div class="contact-address">
          <div class="icon-box">${icon('pin', 22)}</div>
          <div class="contact-address-text">
            <div class="contact-label">العنوان</div>
            <div class="contact-address-value" id="branch-address">${lines(addressLines(first))}</div>
          </div>
        </div>
        <div class="phones">
          <div class="contact-label">للاستفسار</div>${k.phones.map((p, i) => `
          <div class="phone-row${i ? ' phone-row--divided' : ''}">
            <div class="phone-num" dir="ltr">${esc(p.number)}</div>
            <div class="phone-actions">
              <a class="icon-btn icon-btn--outline" href="tel:${esc(p.number)}" aria-label="اتصال على ${esc(p.number)}">${icon('phone', 19)}</a>${p.whatsapp ? `
              <a class="icon-btn icon-btn--solid" href="${esc(waLink(p.whatsapp))}" target="_blank" rel="noopener" aria-label="واتساب ${esc(p.number)}">${icon('chat', 19)}</a>` : ''}
            </div>
          </div>`).join('')}
        </div>
        <a class="maps-link" id="branch-map-link" href="${esc(mapLink(first))}" target="_blank" rel="noopener">${esc(k.mapButton)}</a>
      </div>
      <div class="map-card">
        <iframe id="branch-map" title="خريطة موقع المدرسة" src="${esc(mapEmbed(first))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </div>
    <script type="application/json" id="branches-data">${json}</script>
  </div>
</section>`;
}

function cta(c, ctx) {
  return `
<section class="cta-band" aria-label="${esc(c.cta.title)}">
  <div class="cta-blob" aria-hidden="true"></div>
  <div class="cta-inner">
    <div class="cta-text">
      <h2>${esc(c.cta.title)}</h2>
      <p>${esc(c.cta.text)}</p>
    </div>
    <div class="cta-actions">
      <a class="btn btn--gold" ${ctx.wa} target="_blank" rel="noopener">${esc(c.buttons.whatsapp)}</a>
      <a class="btn btn--ghost-gold" href="${esc(ctx.tel)}">${esc(c.buttons.call)}</a>
    </div>
  </div>
</section>`;
}

function footer(c) {
  const list = c.branches.items;
  return `
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-brand">
        <div class="footer-logo"><img src="${esc(c.site.logo)}" alt="شعار ${esc(c.site.name)}" width="58" height="43" loading="lazy"></div>
        <div class="footer-brand-text">
          <div class="footer-name">${esc(c.site.name)}</div>
          <div>${esc(c.site.tagline)}</div>
        </div>
      </div>
      <div class="footer-col">
        <div class="footer-heading">${list.length > 1 ? 'فروعنا' : 'العنوان'}</div>${list.map(b => `
        <div>${esc(`${b.name} – ${b.address.join('، ')}`)}</div>`).join('')}
      </div>
      <div class="footer-col">
        <div class="footer-heading">للاستفسار</div>${c.contact.phones.map(p => `
        <a class="footer-tel" href="tel:${esc(p.number)}" dir="ltr">${esc(p.number)}</a>`).join('')}
      </div>
    </div>
    <div class="footer-bottom">
      <span>${esc(c.footer.slogan)}</span>
      <span>© ${ar(new Date().getFullYear())} ${esc(c.site.name)}</span>
    </div>
  </div>
</footer>`;
}

function mobileBar(c, ctx) {
  if (c.mobileBar && c.mobileBar.show === false) return '';
  return `
<div class="mobile-bar">
  <a class="mobile-bar-call" href="${esc(ctx.tel)}">
    ${icon('phone', 18)}
    ${esc(c.buttons.callShort)}
  </a>
  <a class="mobile-bar-wa" ${ctx.wa} target="_blank" rel="noopener">
    ${icon('chat', 18)}
    ${esc(c.buttons.whatsapp)}
  </a>
</div>`;
}

function page(c) {
  const phone = c.contact.phones[0];
  const latest = [...c.honor.years].sort((a, b) => b.year - a.year)[0];
  const latestRanked = ranked(latest.students);
  const ctx = {
    phone,
    tel: 'tel:' + phone.number,
    wa: waAttrs(phone.whatsapp, c.contact.whatsappMessage),
    latest,
    latestRanked,
    top: latestRanked[0],
    aboveCount: latestRanked.filter(s => s.percent > c.honor.threshold).length,
  };
  return `<!DOCTYPE html>
<!-- الملف ده بيتعمل تلقائياً من content.json — ماتعدّلوش هنا، عدّل content.json وشغّل npm run build -->
<html lang="ar" dir="rtl">
${head(c)}
<body${c.mobileBar && c.mobileBar.show === false ? ' class="no-mobile-bar"' : ''}>

${SPRITE}
${header(c, ctx)}

<main>
${hero(c, ctx)}
${stats(c, ctx)}
${branches(c, ctx)}
${news(c)}
${stages(c)}
${why(c)}
${honor(c, ctx)}
${teachers(c)}
${fees(c, ctx)}
${gallery(c)}
${reviews(c)}
${faq(c)}
${contact(c)}
${cta(c, ctx)}

</main>
${footer(c)}
${mobileBar(c, ctx)}

</body>
</html>
`;
}

// ---------- Build ----------

function build() {
  const content = loadContent();
  const warnings = validate(content);
  const html = page(content);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.cpSync(SRC, DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'index.html'), html);

  return warnings;
}

module.exports = { build, ContentError, DIST, SRC, CONTENT, ROOT };

if (require.main === module) {
  try {
    const warnings = build();
    warnings.forEach(w => console.warn('⚠ تحذير: ' + w));
    console.log('✓ الموقع اتبنى في مجلد dist/');
  } catch (e) {
    console.error('\n✗ ' + (e instanceof ContentError ? e.message : e.stack) + '\n');
    process.exit(1);
  }
}
