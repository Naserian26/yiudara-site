// =========================================================
//  Packages and fliers managed in admin.html, shown to visitors
//  - Tours page: replaces the built-in cards once at least one package exists
//  - Home page: "Current Offers" section with fliers that haven't expired
// =========================================================
import { enabled, F, db } from './firebase.js';

const tourGrid = document.getElementById('tourGrid');
const offerGrid = document.getElementById('offerGrid');

if (enabled && tourGrid) showPackages();
if (enabled && offerGrid) showOffers();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function waButton(message, label, className) {
  const a = el('a', className, label);
  a.href = waLink(message); // waLink comes from script.js
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.wa = message;
  a.dataset.enquiry = '';
  return a;
}

async function showPackages() {
  let snap;
  try {
    snap = await F.getDocs(F.query(F.collection(db, 'packages'), F.orderBy('order')));
  } catch (err) {
    console.warn(err);
    return; // keep the built-in cards
  }
  if (snap.empty) return;

  const cards = snap.docs.map(d => {
    const p = d.data();
    const card = el('article', 'card');
    if (p.slug) card.id = p.slug;

    const img = el('div', 'card-img');
    img.setAttribute('role', 'img');
    img.setAttribute('aria-label', p.title);
    if (p.image) img.style.backgroundImage = `url("${p.image}")`;

    const body = el('div', 'card-body');
    if (p.duration) body.append(el('p', 'card-meta', p.duration));
    body.append(el('h3', '', p.title));
    if (p.price) body.append(el('p', 'card-price', p.price));
    if (p.summary) body.append(el('p', '', p.summary));
    if (p.tags && p.tags.length) {
      const tags = el('div', 'tags');
      p.tags.forEach(t => tags.append(el('span', 'tag', t)));
      body.append(tags);
    }
    const actions = el('div', 'card-actions');
    actions.append(waButton(`I'd like a quote for the ${p.title} tour.`, 'Get a Quote', 'btn btn-wa'));
    if (p.link) {
      const more = el('a', 'btn btn-outline', 'View Itinerary');
      more.href = p.link;
      actions.append(more);
    }
    body.append(actions);
    card.append(img, body);
    return card;
  });
  tourGrid.replaceChildren(...cards);

  // the page may have been opened at tours.html#greece before the cards existed
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

async function showOffers() {
  let snap;
  try {
    snap = await F.getDocs(F.query(F.collection(db, 'fliers'), F.orderBy('createdAt', 'desc')));
  } catch (err) {
    console.warn(err);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const live = snap.docs.map(d => d.data()).filter(f => !f.until || f.until >= today);
  if (!live.length) return;

  const lightbox = document.getElementById('lightbox');
  const lightImg = lightbox.querySelector('img');
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.close(); });

  offerGrid.replaceChildren(...live.map(f => {
    const card = el('article', 'offer-card');
    const open = el('button', 'offer-img');
    open.type = 'button';
    open.setAttribute('aria-label', `View flier: ${f.title}`);
    const img = el('img');
    img.src = f.image;
    img.alt = f.title;
    img.loading = 'lazy';
    open.append(img);
    open.addEventListener('click', () => {
      lightImg.src = f.image;
      lightImg.alt = f.title;
      lightbox.showModal();
    });

    const body = el('div', 'offer-body');
    body.append(el('h3', '', f.title));
    if (f.caption) body.append(el('p', '', f.caption));
    if (f.until) {
      const until = new Date(f.until + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      body.append(el('p', 'offer-until', `Offer ends ${until}`));
    }
    body.append(waButton(`I'm interested in your offer: ${f.title}.`, 'Ask About This Offer', 'btn btn-wa btn-sm'));
    card.append(open, body);
    return card;
  }));
  document.getElementById('offers').hidden = false;
}
