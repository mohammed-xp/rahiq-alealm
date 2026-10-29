(() => {
  'use strict';

  const ar = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace('.', '٫');
  const wideMq = window.matchMedia('(min-width: 1060px)');
  const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- قائمة الموبايل ----------
  const menuBtn = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');

  const setMenu = open => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };

  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  wideMq.addEventListener('change', e => { if (e.matches) setMenu(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
  });

  // ---------- الأسئلة الشائعة: سؤال واحد مفتوح في كل مرة ----------
  const faqItems = [...document.querySelectorAll('.faq-item')];

  const setFaq = (item, open) => {
    item.classList.toggle('is-open', open);
    item.querySelector('.faq-btn').setAttribute('aria-expanded', String(open));
  };

  faqItems.forEach(item => {
    item.querySelector('.faq-btn').addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      faqItems.forEach(other => setFaq(other, other === item && willOpen));
    });
  });

  // ---------- لوحة الشرف (البيانات من content.json عن طريق سكريبت البناء) ----------
  const honorData = document.getElementById('honor-data');
  const years = honorData ? JSON.parse(honorData.textContent).sort((a, b) => b.year - a.year) : [];
  if (years.length) initHonor(years);

  function initHonor(years) {
    const section = document.getElementById('honor');
    const tabsEl = document.getElementById('honor-tabs');
    const captionEl = document.getElementById('honor-caption');
    const listEl = document.getElementById('honor-list');
    const midEl = document.getElementById('honor-mid');
    const restWrap = document.getElementById('honor-rest-wrap');
    const restEl = document.getElementById('honor-rest');
    const toggleBtn = document.getElementById('honor-toggle');
    const toggleLabel = toggleBtn.querySelector('span');
    const podium = [...section.querySelectorAll('.podium-card')];

    // الترتيب حسب النسبة من الأعلى للأقل
    const ranked = y => [...y.list].sort((a, b) => b[1] - a[1]);
    let rows = [];
    let open = false;

    const el = (cls, text) => {
      const d = document.createElement('div');
      d.className = cls;
      if (text !== undefined) d.textContent = text;
      return d;
    };

    const rowEl = ([name, pct], i) => {
      const row = el('honor-row');
      const body = el('honor-body');
      const bar = el('honor-bar');
      const fill = el('honor-bar-fill');
      fill.style.width = pct + '%';
      bar.append(fill);
      body.append(el('honor-name', name), bar);
      row.append(el('honor-rank', ar(i + 1)), body, el('honor-pct', ar(pct) + '٪'));
      return row;
    };

    const setOpen = v => {
      open = v;
      restWrap.classList.toggle('is-open', v);
      restWrap.setAttribute('aria-hidden', String(!v));
      toggleBtn.setAttribute('aria-expanded', String(v));
      toggleLabel.textContent = v ? 'إخفاء القائمة' : 'عرض كل المتفوقين (' + ar(rows.length) + ')';
    };

    const tabs = years.map(y => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'honor-tab';
      b.setAttribute('role', 'tab');
      b.textContent = 'دفعة ' + ar(y.year);
      b.addEventListener('click', () => render(y));
      tabsEl.append(b);
      return b;
    });

    function render(y) {
      rows = ranked(y);
      tabs.forEach((b, i) => b.setAttribute('aria-selected', String(years[i] === y)));
      captionEl.textContent = 'نتائج امتحانات ' + y.cert + ' ' + ar(y.year);

      podium.forEach((card, i) => {
        const r = rows[i];
        card.hidden = !r;
        card.querySelector('.podium-pct').textContent = r ? ar(r[1]) + '٪' : '';
        card.querySelector('.podium-name').textContent = r ? r[0] : '';
      });

      midEl.replaceChildren(...rows.slice(3, 12).map((r, i) => rowEl(r, i + 3)));
      restEl.replaceChildren(...rows.slice(12).map((r, i) => rowEl(r, i + 12)));
      listEl.hidden = rows.length <= 3;
      toggleBtn.hidden = rows.length <= 12;
      setOpen(false);
    }

    toggleBtn.addEventListener('click', () => {
      const closing = open;
      setOpen(!closing);
      if (closing) {
        const top = section.getBoundingClientRect().top;
        if (top < 0) window.scrollTo({ top: top + window.scrollY - 70, behavior: reducedMq.matches ? 'auto' : 'smooth' });
      }
    });

    render(years[0]);
  }

  // ---------- الفروع: تبديل العنوان والخريطة، وإضافة اسم الفرع لرسائل واتساب ----------
  const branchesData = document.getElementById('branches-data');
  const branches = branchesData ? JSON.parse(branchesData.textContent) : [];
  if (branches.length) initBranches(branches);

  function initBranches(branches) {
    const KEY = 'rahiq-branch';
    const tabs = [...document.querySelectorAll('.branch-tab')];
    const addressEl = document.getElementById('branch-address');
    const mapLinkEl = document.getElementById('branch-map-link');
    const mapEl = document.getElementById('branch-map');
    const waLinks = [...document.querySelectorAll('[data-wa-msg]')];
    const find = id => branches.find(b => b.id === id);

    function pick(b, remember) {
      tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.branch === b.id)));
      addressEl.replaceChildren(...b.address.flatMap((line, i) => (i ? [document.createElement('br'), line] : [line])));
      mapLinkEl.href = b.mapLink;
      if (mapEl.src !== b.mapEmbed) mapEl.src = b.mapEmbed;
      waLinks.forEach(a => {
        a.href = a.href.split('?')[0] + '?text=' + encodeURIComponent(a.dataset.waMsg + ' – فرع ' + b.label);
      });
      if (remember) {
        try { localStorage.setItem(KEY, b.id); } catch (e) {}
      }
    }

    tabs.forEach(t => t.addEventListener('click', () => pick(find(t.dataset.branch), true)));
    // زرار "الموقع على الخريطة" لينك عادي لـ #contact، فبنختار الفرع بس ونسيب المتصفح ينزل
    document.querySelectorAll('[data-branch-pick]').forEach(a => {
      a.addEventListener('click', () => pick(find(a.dataset.branchPick), true));
    });

    // ?branch=kalakla في اللينك، وإلا آخر فرع اختاره الزائر
    const stored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
    const start = find(new URLSearchParams(location.search).get('branch')) || find(stored());
    if (start) pick(start, false);
  }

  // ---------- فيديو الواجهة ----------
  const video = document.querySelector('.hero-video');
  if (video) {
    const syncVideo = () => {
      if (reducedMq.matches) {
        video.pause();
      } else {
        video.muted = true;
        const p = video.play();
        if (p) p.catch(() => {});
      }
    };
    syncVideo();
    reducedMq.addEventListener('change', syncVideo);
  }
})();
