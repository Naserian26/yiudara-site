// =========================================================
//  SETTINGS - edit these
// =========================================================
const WHATSAPP_NUMBER = '254704456164';
const CONTACT_EMAIL = 'info@yiudaraadventures.com';

// Paste your full profile URLs here. Icons with an empty URL stay hidden.
const SOCIAL_LINKS = {
  facebook: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  linkedin: ''
};

// Optional: a form endpoint from Formspree (https://formspree.io) or similar.
// While empty, the newsletter form opens the visitor's email app instead.
const NEWSLETTER_ENDPOINT = '';

// =========================================================
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const waLink = text => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello Yiudara Adventures! ' + text)}`;

// ---------- WhatsApp links: <a data-wa="message"> ----------
document.querySelectorAll('[data-wa]').forEach(a => { a.href = waLink(a.dataset.wa); });

// ---------- Social icons ----------
document.querySelectorAll('[data-social]').forEach(a => {
  const url = SOCIAL_LINKS[a.dataset.social];
  if (url) { a.href = url; a.hidden = false; }
});
document.querySelectorAll('.socials').forEach(s => {
  if (!s.querySelector('a:not([hidden])')) s.hidden = true;
});

// ---------- Mobile menu ----------
const toggle = document.getElementById('navToggle');
const nav = document.getElementById('mainNav');

function setMenu(open) {
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('resize', () => { if (window.innerWidth > 1100) setMenu(false); });

// ---------- Header shadow + back-to-top button on scroll ----------
const header = document.querySelector('.site-header');
const toTop = document.querySelector('.to-top');
function onScroll() {
  header.classList.toggle('scrolled', window.scrollY > 10);
  if (toTop) toTop.classList.toggle('show', window.scrollY > 600);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Highlight the nav link for the section in view (same-page links only) ----------
const links = [...nav.querySelectorAll('a[href^="#"]')];
const sections = links
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window && sections.length) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => io.observe(s));
}

// ---------- Fade elements in as they scroll into view ----------
const revealEls = document.querySelectorAll('.reveal');
if (reduceMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach(el => el.classList.remove('reveal'));
} else {
  // stagger siblings that appear together (e.g. a row of cards)
  revealEls.forEach(el => {
    const siblings = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.setProperty('--d', (Math.min(siblings.indexOf(el), 5) * 0.08) + 's');
  });
  const revealer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('in');
      revealer.unobserve(el);
      // hand the element back to its own hover transitions once it has appeared
      setTimeout(() => { el.classList.remove('reveal', 'in'); el.style.removeProperty('--d'); }, 1300);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach(el => revealer.observe(el));
}

// ---------- Hero slideshow ----------
const slides = document.querySelectorAll('.hero-slide');
if (slides.length > 1 && !reduceMotion) {
  let current = 0;
  setInterval(() => {
    if (document.hidden) return;
    slides[current].classList.remove('is-active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('is-active');
  }, 6000);
}

// ---------- Rotating word in the hero heading ----------
const rotator = document.querySelector('.rotator');
if (rotator && !reduceMotion) {
  const words = rotator.dataset.words.split('|');
  let i = 0;
  setInterval(() => {
    rotator.classList.add('out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      rotator.textContent = words[i];
      rotator.classList.remove('out');
    }, 350);
  }, 3000);
}

// ---------- Testimonial slider ----------
const track = document.getElementById('storiesTrack');
const dotsWrap = document.getElementById('storyDots');
if (track && dotsWrap) {
  const stories = [...track.children];
  const dots = stories.map((story, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Show story ${n + 1}`);
    b.addEventListener('click', () => goTo(n));
    dotsWrap.appendChild(b);
    return b;
  });

  const goTo = n => track.scrollTo({ left: stories[n].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });

  function activeIndex() {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) return stories.length - 1;
    let best = 0;
    stories.forEach((s, n) => {
      if (Math.abs(s.offsetLeft - track.scrollLeft) < Math.abs(stories[best].offsetLeft - track.scrollLeft)) best = n;
    });
    return best;
  }
  function update() {
    dotsWrap.hidden = track.scrollWidth <= track.clientWidth + 4; // everything fits: no slider needed
    const a = activeIndex();
    dots.forEach((d, n) => d.setAttribute('aria-current', String(n === a)));
  }
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  let paused = false;
  ['mouseenter', 'focusin', 'touchstart'].forEach(ev => track.addEventListener(ev, () => { paused = true; }, { passive: true }));
  ['mouseleave', 'focusout'].forEach(ev => track.addEventListener(ev, () => { paused = false; }));
  if (!reduceMotion) {
    setInterval(() => {
      if (paused || document.hidden || dotsWrap.hidden) return;
      const a = activeIndex();
      goTo(a === stories.length - 1 ? 0 : a + 1);
    }, 5000);
  }
}

// ---------- Destination filter (destinations page) ----------
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => btn.addEventListener('click', () => {
  const f = btn.dataset.filter;
  filterBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  document.querySelectorAll('[data-tags]').forEach(card => {
    card.hidden = f !== 'all' && !card.dataset.tags.split(' ').includes(f);
  });
}));

// ---------- Destination cards pre-fill the trip search ----------
const destSelect = document.getElementById('destination');
if (destSelect) {
  document.querySelectorAll('.dest-card').forEach(card => {
    card.addEventListener('click', () => { destSelect.value = card.dataset.dest; });
  });
}

// ---------- Trip search -> WhatsApp enquiry ----------
const tripForm = document.getElementById('tripForm');
if (tripForm) {
  const formNote = document.getElementById('formNote');
  const dateInput = document.getElementById('dates');

  // no past dates
  dateInput.min = new Date().toISOString().split('T')[0];

  tripForm.addEventListener('submit', e => {
    e.preventDefault();
    const destination = destSelect.value;
    const travelers = document.getElementById('travelers').value;
    const date = dateInput.value;

    if (!destination) {
      formNote.textContent = 'Please choose a destination first.';
      formNote.classList.add('error');
      destSelect.focus();
      return;
    }
    formNote.classList.remove('error');

    const when = date
      ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'flexible dates';
    const text = `I'd like a quote for ${destination}. Travel date: ${when}. Travelers: ${travelers}.`;

    formNote.textContent = 'Opening WhatsApp so you can send your request…';
    document.dispatchEvent(new CustomEvent('trip-enquiry', { detail: { text } })); // auth.js saves it to My Trips
    window.open(waLink(text), '_blank', 'noopener');
  });
}

// ---------- Newsletter ----------
const subForm = document.getElementById('subscribeForm');
const subNote = document.getElementById('subNote');
subForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('subEmail');
  if (!email.checkValidity() || !email.value.trim()) {
    subNote.textContent = 'Please enter a valid email address.';
    return;
  }

  if (!NEWSLETTER_ENDPOINT) {
    const body = `Please add ${email.value.trim()} to the Yiudara Adventures newsletter.`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Newsletter sign-up')}&body=${encodeURIComponent(body)}`;
    subNote.textContent = 'Opening your email app - just press send to subscribe.';
    return;
  }

  subNote.textContent = 'Subscribing…';
  try {
    const res = await fetch(NEWSLETTER_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(subForm)
    });
    if (!res.ok) throw new Error(res.status);
    subNote.textContent = 'Thanks for subscribing!';
    subForm.reset();
  } catch {
    subNote.textContent = 'Something went wrong. Please try again or email us.';
  }
});
