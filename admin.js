// =========================================================
//  Admin dashboard: manage tour packages and fliers
//  Access: the signed-in Google account must be listed in Firestore as admins/{email}
// =========================================================
import { enabled, A, F, auth, db, isAdmin, shrinkImage } from './firebase.js';

const $ = id => document.getElementById(id);
const gate = $('adminGate');
const panel = $('adminPanel');

// ---------- Access gate ----------
function showGate(message, canSwitch) {
  $('gateMsg').textContent = message;
  $('gateGoogle').hidden = canSwitch;
  $('gateSwitch').hidden = !canSwitch;
  gate.hidden = false;
  panel.hidden = true;
}

function googleSignIn() {
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return A.signInWithPopup(auth, provider).catch(err => {
    if (err.code !== 'auth/popup-closed-by-user') $('gateMsg').textContent = 'Sign-in did not complete. Please try again.';
  });
}

if (!enabled) {
  showGate('Accounts are not switched on for this website.', false);
  $('gateGoogle').hidden = true;
} else {
  $('gateGoogle').addEventListener('click', googleSignIn);
  $('gateSwitch').addEventListener('click', async () => { await A.signOut(auth); googleSignIn(); });
  $('adminSignOut').addEventListener('click', async () => { await A.signOut(auth); location.href = 'index.html'; });

  A.onAuthStateChanged(auth, async user => {
    if (!user) return showGate('Sign in with the Google account that has admin access.', false);
    if (!(await isAdmin(user))) {
      return showGate(`${user.email} does not have admin access. Admins must sign in with Google using an approved email address.`, true);
    }
    $('adminWho').textContent = user.email;
    gate.hidden = true;
    panel.hidden = false;
    loadPackages();
    loadFliers();
  });
}

// ---------- Tabs ----------
document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
  document.querySelectorAll('.admin-section').forEach(s => { s.hidden = s.id !== tab.dataset.tab; });
}));

// ---------- Helpers ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
const slugify = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function say(noteId, text, isError) {
  const note = $(noteId);
  note.textContent = text;
  note.classList.toggle('error', Boolean(isError));
}

function previewFile(input, img) {
  input.addEventListener('change', () => {
    const file = input.files[0];
    img.hidden = !file;
    if (file) img.src = URL.createObjectURL(file);
  });
}

function listItem(image, title, details, buttons) {
  const li = el('li', 'admin-item');
  const thumb = el('img');
  thumb.src = image || '';
  thumb.alt = '';
  const text = el('div', 'admin-item-text');
  text.append(el('strong', '', title));
  details.forEach(d => text.append(d));
  const actions = el('div', 'admin-item-actions');
  buttons.forEach(b => actions.append(b));
  li.append(thumb, text, actions);
  return li;
}

function button(label, className, onClick) {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// =========================================================
//  Packages
// =========================================================
const pkgForm = $('pkgForm');
let packages = [];
let editingId = null;
previewFile($('pkgPhoto'), $('pkgPreview'));

async function loadPackages() {
  try {
    const snap = await F.getDocs(F.query(F.collection(db, 'packages'), F.orderBy('order')));
    packages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(err);
    say('pkgListNote', 'Could not load packages. Check your connection and refresh.', true);
    return;
  }
  $('pkgList').replaceChildren(...packages.map(p => listItem(
    p.image, p.title,
    [el('span', '', [p.duration, p.price].filter(Boolean).join(' · ') || 'No length or price set')],
    [button('Edit', 'link-btn', () => editPackage(p)), button('Delete', 'link-btn danger', () => deletePackage(p))]
  )));
  $('pkgEmpty').hidden = packages.length > 0;
  $('importBox').hidden = packages.length > 0;
}

function resetPackageForm() {
  editingId = null;
  pkgForm.reset();
  $('pkgPreview').hidden = true;
  $('pkgFormTitle').textContent = 'Add a Package';
  $('pkgSave').textContent = 'Save Package';
  $('pkgCancel').hidden = true;
  $('pkgPhotoHint').textContent = 'JPG or PNG. It will be resized for the web automatically.';
}

function editPackage(p) {
  editingId = p.id;
  $('pkgTitle').value = p.title || '';
  $('pkgDuration').value = p.duration || '';
  $('pkgPrice').value = p.price || '';
  $('pkgSummary').value = p.summary || '';
  $('pkgTags').value = (p.tags || []).join(', ');
  $('pkgOrder').value = p.order ?? '';
  $('pkgPreview').src = p.image || '';
  $('pkgPreview').hidden = !p.image;
  $('pkgFormTitle').textContent = `Edit: ${p.title}`;
  $('pkgSave').textContent = 'Save Changes';
  $('pkgCancel').hidden = false;
  $('pkgPhotoHint').textContent = 'Leave empty to keep the current photo.';
  say('pkgNote', '');
  pkgForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deletePackage(p) {
  if (!confirm(`Delete the package "${p.title}"? This cannot be undone.`)) return;
  try {
    await F.deleteDoc(F.doc(db, 'packages', p.id));
    if (editingId === p.id) resetPackageForm();
    loadPackages();
  } catch (err) {
    console.warn(err);
    alert('Could not delete the package. Please try again.');
  }
}

$('pkgCancel').addEventListener('click', resetPackageForm);

pkgForm.addEventListener('submit', async e => {
  e.preventDefault();
  const title = $('pkgTitle').value.trim();
  const summary = $('pkgSummary').value.trim();
  const file = $('pkgPhoto').files[0];
  if (!title) return say('pkgNote', 'Please give the package a title.', true);
  if (!summary) return say('pkgNote', 'Please add a short description.', true);
  if (!file && !editingId) return say('pkgNote', 'Please choose a photo for the package.', true);

  const data = {
    title,
    summary,
    duration: $('pkgDuration').value.trim(),
    price: $('pkgPrice').value.trim(),
    tags: $('pkgTags').value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5),
    order: Number($('pkgOrder').value) || packages.length + 1,
    slug: slugify(title),
    updatedAt: F.serverTimestamp()
  };

  $('pkgSave').disabled = true;
  say('pkgNote', 'Saving…');
  try {
    if (file) data.image = await shrinkImage(file, 1200);
    if (editingId) {
      await F.updateDoc(F.doc(db, 'packages', editingId), data);
    } else {
      await F.addDoc(F.collection(db, 'packages'), { ...data, link: '', createdAt: F.serverTimestamp() });
    }
    resetPackageForm();
    say('pkgNote', 'Saved! It is now live on the Tours page.');
    loadPackages();
  } catch (err) {
    console.warn(err);
    say('pkgNote', err.message && !err.code ? err.message : 'Could not save. Please try again.', true);
  } finally {
    $('pkgSave').disabled = false;
  }
});

// one-off: copy the four tours that were built into the website into the dashboard
const STARTERS = [
  { title: 'Kenya Safari & Beach', duration: '8 days · Safari + Beach', tags: ['Featured', 'Wildlife', 'Beach'], slug: 'kenya-safari', link: 'kenya-safari.html', photo: 'assets/images/kenya.jpg',
    summary: 'Game drives in the Maasai Mara followed by sun, sand and snorkelling on Diani Beach — Kenya’s two best experiences in one trip.' },
  { title: 'Greek Island Hopping', duration: '8–10 days · Athens + Islands', tags: ['Islands', 'Culture', 'Romance'], slug: 'greece', link: '', photo: 'assets/images/greece.jpg',
    summary: 'Start with the Acropolis in Athens, then ferry between Santorini, Mykonos and Naxos for sunsets, beaches and village tavernas.' },
  { title: 'Thailand Highlights', duration: '10 days · Bangkok + Islands', tags: ['Beach', 'Culture', 'Food'], slug: 'thailand', link: '', photo: 'assets/images/thailand.jpg',
    summary: 'Temples and markets in Bangkok, elephants and old-town charm in Chiang Mai, then island time in Phuket or Krabi.' },
  { title: 'Hong Kong City Break', duration: '4–5 days · City', tags: ['City', 'Food', 'Shopping'], slug: 'hongkong', link: '', photo: 'assets/images/hongkong.jpg',
    summary: 'Ride the Star Ferry, take the tram up Victoria Peak, eat your way through dim sum and night markets, and hike the Dragon’s Back.' }
];

$('importBtn').addEventListener('click', async () => {
  $('importBtn').disabled = true;
  say('importNote', 'Importing…');
  try {
    for (const [i, s] of STARTERS.entries()) {
      const blob = await (await fetch(s.photo)).blob();
      const { photo, ...rest } = s;
      await F.setDoc(F.doc(db, 'packages', s.slug), {
        ...rest, price: '', order: i + 1, image: await shrinkImage(blob, 1200),
        createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp()
      });
    }
    say('importNote', '');
    loadPackages();
  } catch (err) {
    console.warn(err);
    say('importNote', 'Import failed. Please try again.', true);
  } finally {
    $('importBtn').disabled = false;
  }
});

// =========================================================
//  Fliers
// =========================================================
const flForm = $('flForm');
previewFile($('flImage'), $('flPreview'));

async function loadFliers() {
  let fliers;
  try {
    const snap = await F.getDocs(F.query(F.collection(db, 'fliers'), F.orderBy('createdAt', 'desc')));
    fliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(err);
    say('flListNote', 'Could not load fliers. Check your connection and refresh.', true);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  $('flList').replaceChildren(...fliers.map(f => {
    const live = !f.until || f.until >= today;
    const status = el('span', live ? 'badge live' : 'badge expired', live ? 'Showing on website' : 'Expired — hidden');
    const when = el('span', '', f.until
      ? `Until ${new Date(f.until + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : 'No end date');
    return listItem(f.image, f.title, [status, when], [button('Delete', 'link-btn danger', async () => {
      if (!confirm(`Delete the flier "${f.title}"? This cannot be undone.`)) return;
      try { await F.deleteDoc(F.doc(db, 'fliers', f.id)); loadFliers(); }
      catch (err) { console.warn(err); alert('Could not delete the flier. Please try again.'); }
    })]);
  }));
  $('flEmpty').hidden = fliers.length > 0;
}

$('flUntil').min = new Date().toISOString().slice(0, 10);

flForm.addEventListener('submit', async e => {
  e.preventDefault();
  const title = $('flTitle').value.trim();
  const file = $('flImage').files[0];
  if (!title) return say('flNote', 'Please give the flier a title.', true);
  if (!file) return say('flNote', 'Please choose the flier image.', true);

  $('flSave').disabled = true;
  say('flNote', 'Uploading…');
  try {
    await F.addDoc(F.collection(db, 'fliers'), {
      title,
      caption: $('flCaption').value.trim(),
      until: $('flUntil').value,
      image: await shrinkImage(file, 1400),
      createdAt: F.serverTimestamp()
    });
    flForm.reset();
    $('flPreview').hidden = true;
    say('flNote', 'Uploaded! It now shows under "Current Offers" on the home page.');
    loadFliers();
  } catch (err) {
    console.warn(err);
    say('flNote', err.message && !err.code ? err.message : 'Could not upload. Please try again.', true);
  } finally {
    $('flSave').disabled = false;
  }
});
