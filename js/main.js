// ALN Elektro AG — page behaviour. Every section is readable without this file.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal on scroll. An element is only hidden ("armed") while it is still below the screen,
// so content reached by a jump link or a fast scroll is never left invisible.
(() => {
  const targets = [...document.querySelectorAll('[data-reveal]')];
  if (!targets.length || reduceMotion || !('IntersectionObserver' in window)) return;
  const order = new Map();
  for (const el of targets) {
    const section = el.closest('section, footer') || document.body;
    const i = order.get(section) || 0;
    el.style.setProperty('--d', `${Math.min(i, 6) * 80}ms`);
    order.set(section, i + 1);
  }
  const show = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      show.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  const arm = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.boundingClientRect.top < innerHeight) continue;
      entry.target.classList.add('is-armed');
      arm.unobserve(entry.target);
      requestAnimationFrame(() => show.observe(entry.target));
    }
  }, { rootMargin: '0px 0px 100% 0px' });
  targets.forEach((el) => arm.observe(el));
})();

// Header: hairline once the page scrolls, menu panel below 1024px.
(() => {
  const head = document.querySelector('.head');
  const toggle = document.querySelector('.menu');
  if (!head) return;
  const onScroll = () => head.classList.toggle('is-scrolled', scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setOpen = (open) => {
    head.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle?.addEventListener('click', () => setOpen(!head.classList.contains('is-open')));
  head.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
})();

// Navigation: mark the section in view as current; the black highlight follows hover and rests on it.
(() => {
  const nav = document.getElementById('nav');
  const pill = nav?.querySelector('.nav__pill');
  const links = [...document.querySelectorAll('.nav__link')];
  if (!nav || !pill) return;

  const current = () => links.find((a) => a.getAttribute('aria-current') === 'page');
  const moveTo = (link) => {
    links.forEach((a) => a.classList.toggle('is-lit', a === link));
    if (!link || !link.offsetWidth) { nav.classList.remove('has-pill'); return; }
    nav.style.setProperty('--pill-x', `${link.offsetLeft}px`);
    nav.style.setProperty('--pill-w', `${link.offsetWidth}px`);
    nav.classList.add('has-pill');
  };
  // first placement without a slide in from the left
  pill.style.transition = 'none';
  moveTo(current());
  requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.transition = ''; }));

  links.forEach((a) => {
    a.addEventListener('pointerenter', () => moveTo(a));
    a.addEventListener('focus', () => moveTo(a));
  });
  nav.addEventListener('pointerleave', () => moveTo(current()));
  nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) moveTo(current()); });
  window.addEventListener('resize', () => moveTo(current()));
  document.fonts?.ready.then(() => moveTo(current()));

  const sections = links.map((a) => document.querySelector(a.hash)).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const a of links) {
        if (a.hash === `#${entry.target.id}`) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
      if (!nav.matches(':hover')) moveTo(current());
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => io.observe(s));
})();

// Referenzprojekte: arrows scroll the row by one card.
(() => {
  const track = document.getElementById('projects');
  const buttons = [...document.querySelectorAll('[data-scroll="projects"]')];
  if (!track) return;
  const step = () => {
    const card = track.querySelector('.project');
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
  };
  const update = () => {
    const max = track.scrollWidth - track.clientWidth - 4;
    buttons.forEach((b) => { b.disabled = Number(b.dataset.dir) < 0 ? track.scrollLeft < 4 : track.scrollLeft > max; });
  };
  buttons.forEach((b) => b.addEventListener('click', () => {
    track.scrollBy({ left: Number(b.dataset.dir) * step(), behavior: reduceMotion ? 'auto' : 'smooth' });
  }));
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// Referenzprojekte: each card opens a detail view with its photos, partner and location.
(() => {
  const dialog = document.getElementById('project-dialog');
  const cards = [...document.querySelectorAll('.project')];
  if (!dialog || !cards.length || typeof dialog.showModal !== 'function') return;

  const projects = cards.map((card) => ({
    name: card.querySelector('.project__open').textContent.trim(),
    kind: card.dataset.kind,
    role: card.dataset.role,
    partner: card.dataset.partner,
    place: card.dataset.place,
    canton: card.dataset.canton,
    images: card.dataset.images.split(';').map((entry) => {
      const [src, width, height, alt] = entry.split('|');
      return { src: `assets/img/${src}`, width, height, alt };
    }),
  }));

  const img = dialog.querySelector('.pd__img');
  const thumbs = dialog.querySelector('.pd__thumbs');
  const imgCount = dialog.querySelector('.pd__imgcount');
  const steps = [...dialog.querySelectorAll('[data-pd-image]')];
  const field = (name) => dialog.querySelector(`[data-pd="${name}"]`);
  const cta = dialog.querySelector('.pd__cta');
  let current = 0;
  let shown = 0;
  let opener = null;
  let swapToken = 0;

  const showImage = (i) => {
    const list = projects[current].images;
    shown = (i + list.length) % list.length;
    const { src, width, height, alt } = list[shown];
    const label = `${projects[current].name}: ${alt}`;
    const token = ++swapToken;
    const reveal = () => { if (token === swapToken) img.classList.remove('is-fading'); };
    const swap = () => {
      if (token !== swapToken) return;
      img.src = src;
      img.width = Number(width);
      img.height = Number(height);
      img.alt = label;
      if (img.complete) reveal();
      else {
        img.addEventListener('load', reveal, { once: true });
        img.addEventListener('error', reveal, { once: true });
      }
    };
    if (img.getAttribute('src') === src) swap();
    else {
      img.classList.add('is-fading');
      setTimeout(swap, reduceMotion ? 0 : 160);
    }
    imgCount.textContent = list.length > 1 ? `${shown + 1} / ${list.length}` : '';
    thumbs.querySelectorAll('.pd__thumb').forEach((t, n) => t.setAttribute('aria-current', String(n === shown)));
    // warm the cache for the next photo
    if (list.length > 1) new Image().src = list[(shown + 1) % list.length].src;
  };

  const render = (i) => {
    current = (i + projects.length) % projects.length;
    const p = projects[current];
    dialog.querySelector('.pd__count').textContent = `Referenzprojekt ${current + 1} / ${projects.length}`;
    dialog.querySelector('.pd__title').textContent = p.name;
    field('kind').textContent = p.kind;
    field('role').textContent = p.role;
    field('partner').textContent = p.partner;
    field('place').textContent = p.place;
    field('canton').textContent = p.canton;
    const body = ['Guten Tag', '', `Wir planen ein ähnliches Projekt wie „${p.name}“ und interessieren uns für eine Offerte.`, '', 'Ort:', 'Art des Projekts:', 'Gewünschter Termin:', '', 'Freundliche Grüsse'].join('\n');
    cta.href = `mailto:info@aln-elektro.ch?subject=${encodeURIComponent(`Anfrage: Projekt wie ${p.name}`)}&body=${encodeURIComponent(body)}`;

    thumbs.replaceChildren(...(p.images.length > 1 ? p.images.map((image, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pd__thumb';
      b.setAttribute('aria-label', `Bild ${n + 1}: ${image.alt}`);
      const t = document.createElement('img');
      t.src = image.src;
      t.alt = '';
      t.loading = 'lazy';
      b.append(t);
      b.addEventListener('click', () => showImage(n));
      return b;
    }) : []));
    steps.forEach((s) => { s.hidden = p.images.length < 2; });
    showImage(0);
  };

  const close = () => {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    dialog.classList.add('is-closing');
    dialog.addEventListener('animationend', () => {
      dialog.classList.remove('is-closing');
      dialog.close();
    }, { once: true });
    if (reduceMotion) dialog.dispatchEvent(new Event('animationend'));
  };

  cards.forEach((card, i) => {
    card.querySelector('.project__open').addEventListener('click', (e) => {
      opener = e.currentTarget;
      render(i);
      document.documentElement.classList.add('has-dialog');
      dialog.showModal();
      dialog.scrollTop = 0;
    });
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-dialog');
    opener?.focus();
  });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.querySelector('.pd__close').addEventListener('click', close);
  steps.forEach((b) => b.addEventListener('click', () => showImage(shown + Number(b.dataset.pdImage))));
  dialog.querySelectorAll('[data-pd-project]').forEach((b) => b.addEventListener('click', () => render(current + Number(b.dataset.pdProject))));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') showImage(shown + 1);
    if (e.key === 'ArrowLeft') showImage(shown - 1);
  });

  // swipe through photos on touch screens
  const stage = dialog.querySelector('.pd__stage');
  let startX = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') startX = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) showImage(shown + (dx < 0 ? 1 : -1));
    startX = null;
  });
})();

// Team: one person at a time, arrows and swipe.
(() => {
  const list = document.getElementById('people');
  const count = document.getElementById('people-count');
  if (!list) return;
  const people = [...list.children];
  let current = 0;
  const go = (i) => {
    current = (i + people.length) % people.length;
    people.forEach((p, n) => {
      p.classList.toggle('is-active', n === current);
      p.toggleAttribute('inert', n !== current);
    });
    count.textContent = `${current + 1} / ${people.length}`;
  };
  list.classList.add('is-live');
  document.querySelectorAll('[data-people]').forEach((b) => b.addEventListener('click', () => go(current + Number(b.dataset.people))));
  let startX = null;
  list.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  list.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
    startX = null;
  });
  go(0);
})();

// The big figure counts up once.
(() => {
  const figures = document.querySelectorAll('[data-count]');
  if (reduceMotion || !figures.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      const el = entry.target;
      const end = Number(el.dataset.count);
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1200);
        el.textContent = String(Math.round(end * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  figures.forEach((el) => io.observe(el));
})();

// Rückruf: there is no form backend, so a valid number opens a finished e-mail to the office.
// Returns the number in the form "+41 79 123 45 67", or null if it is not a usable Swiss number.
function normalisePhone(value) {
  // TODO(human)
  return value.trim() || null;
}

(() => {
  const form = document.getElementById('callback');
  const msg = document.getElementById('callback-msg');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = normalisePhone(form.telefon.value);
    if (!phone) {
      msg.textContent = 'Bitte geben Sie eine Schweizer Telefonnummer ein, z. B. 079 123 45 67.';
      msg.classList.add('is-error');
      form.telefon.focus();
      return;
    }
    msg.classList.remove('is-error');
    msg.textContent = `Ihr E-Mail-Programm öffnet sich mit der Rückrufbitte an ${phone}.`;
    const body = ['Guten Tag', '', `Bitte rufen Sie mich zurück: ${phone}`, '', 'Freundliche Grüsse'].join('\n');
    window.location.href = `mailto:info@aln-elektro.ch?subject=${encodeURIComponent('Rückrufbitte')}&body=${encodeURIComponent(body)}`;
  });
})();
