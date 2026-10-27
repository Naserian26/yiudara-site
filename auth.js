// =========================================================
//  Customer accounts: Firebase Authentication + Firestore
//  Setup: paste your project's settings into firebase-config.js
// =========================================================
import { enabled, A, F, auth, db, isAdmin } from './firebase.js';

const params = new URLSearchParams(location.search);
const loginForm = document.getElementById('authForm');
const accountMain = document.getElementById('accountMain');

const MESSAGES = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in instead.',
  'auth/weak-password': 'Please choose a password with at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Please allow pop-ups and try again.',
  'auth/unauthorized-domain': 'This website address is not allowed yet. Add it in Firebase under Authentication -> Settings -> Authorized domains.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.'
};
const errorText = err => MESSAGES[err.code] || 'Something went wrong. Please try again.';

// only allow redirects back to one of our own pages
function nextPage() {
  const next = params.get('next') || '';
  return /^[a-z-]+\.html(#[\w-]+)?$/.test(next) ? next : 'account.html';
}
const thisPage = () => location.pathname.split('/').pop() || 'index.html';

if (enabled) {
  start();
} else {
  // accounts not switched on yet: login links stay hidden, the account pages explain why
  const setup = document.getElementById('authSetup');
  if (setup) setup.hidden = false;
  document.querySelectorAll('#authForm input, #authForm button, #googleBtn').forEach(el => { el.disabled = true; });
  const loading = document.getElementById('acctLoading');
  if (loading) loading.textContent = 'Customer accounts are not switched on yet.';
}

function start() {
  let user = null;
  let busy = false;        // a login form is mid-submit; it handles its own redirect
  const favs = new Set();
  const userCol = name => F.collection(db, 'users', user.uid, name);

  // ---------- "Log in" / "My Trips" links ----------
  const accountLinks = document.querySelectorAll('[data-account]');
  function updateLinks() {
    accountLinks.forEach(a => {
      a.hidden = false;
      a.href = user ? 'account.html' : 'login.html';
      (a.querySelector('.account-label') || a).textContent = user ? 'My Trips' : 'Log in';
    });
  }
  updateLinks(); // show "Log in" right away; switches to "My Trips" once Firebase confirms a session

  // ---------- Favourite (heart) buttons ----------
  const favBtns = document.querySelectorAll('.fav-btn');
  const paintFavs = () => favBtns.forEach(b => b.setAttribute('aria-pressed', String(favs.has(b.dataset.fav))));

  async function toggleFav(name) {
    if (!user) { location.href = 'login.html?next=' + encodeURIComponent(thisPage()); return; }
    const ref = F.doc(db, 'users', user.uid, 'favourites', name);
    const saved = favs.has(name);
    saved ? favs.delete(name) : favs.add(name);
    paintFavs();
    try {
      saved ? await F.deleteDoc(ref) : await F.setDoc(ref, { name, savedAt: F.serverTimestamp() });
    } catch (err) {
      console.warn(err);
      saved ? favs.add(name) : favs.delete(name); // undo on failure
      paintFavs();
    }
  }
  favBtns.forEach(b => {
    b.hidden = false;
    b.addEventListener('click', () => toggleFav(b.dataset.fav));
  });

  // ---------- Remember trip requests sent while logged in ----------
  async function saveEnquiry(text) {
    if (!user || !text) return;
    try { await F.addDoc(userCol('enquiries'), { text, createdAt: F.serverTimestamp() }); }
    catch (err) { console.warn(err); }
  }
  document.addEventListener('trip-enquiry', e => saveEnquiry(e.detail.text));
  // delegated, so buttons added later (e.g. packages loaded by content.js) are covered too
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-enquiry]');
    if (a) saveEnquiry(a.dataset.wa);
  });

  // ---------- React to login / logout ----------
  A.onAuthStateChanged(auth, async u => {
    user = u;
    updateLinks();
    favs.clear();
    if (user && (favBtns.length || accountMain)) {
      try { (await F.getDocs(userCol('favourites'))).forEach(d => favs.add(d.id)); }
      catch (err) { console.warn(err); }
    }
    paintFavs();

    if (loginForm && user && !busy) location.replace(nextPage());
    if (accountMain && !busy) user ? renderAccount() : location.replace('login.html?next=account.html');
  });

  if (loginForm) setupLoginPage();

  // ---------- Login / sign-up page ----------
  function setupLoginPage() {
    const tabs = document.querySelectorAll('[data-mode]');
    const nameField = document.getElementById('nameField');
    const nameInput = document.getElementById('authName');
    const emailInput = document.getElementById('authEmail');
    const passInput = document.getElementById('authPassword');
    const forgotBtn = document.getElementById('forgotBtn');
    const submitBtn = document.getElementById('authSubmit');
    const googleBtn = document.getElementById('googleBtn');
    const note = document.getElementById('authNote');
    const COPY = {
      signin: { title: 'Welcome back', sub: 'Log in to see your trips and saved destinations.', btn: 'Log In' },
      signup: { title: 'Create your account', sub: 'Save your favourite destinations and keep track of your trip requests.', btn: 'Create Account' }
    };
    let mode = 'signin';

    const say = (text, isError) => { note.textContent = text; note.classList.toggle('error', Boolean(isError)); };

    function setMode(m) {
      mode = m;
      tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.mode === m)));
      nameField.hidden = m !== 'signup';
      forgotBtn.hidden = m === 'signup';
      passInput.autocomplete = m === 'signup' ? 'new-password' : 'current-password';
      document.getElementById('authTitle').textContent = COPY[m].title;
      document.getElementById('authSub').textContent = COPY[m].sub;
      submitBtn.textContent = COPY[m].btn;
      say('');
    }
    tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
    setMode(params.get('mode') === 'signup' ? 'signup' : 'signin');

    async function run(button, task) {
      busy = true;
      button.disabled = true;
      try {
        await task();
        location.replace(nextPage());
      } catch (err) {
        say(errorText(err), true);
      } finally {
        busy = false;
        button.disabled = false;
      }
    }

    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passInput.value;
      const name = nameInput.value.trim();
      if (mode === 'signup' && !name) { say('Please enter your name.', true); nameInput.focus(); return; }
      if (!emailInput.checkValidity() || !email) { say('Please enter a valid email address.', true); emailInput.focus(); return; }
      if (password.length < 6) { say('Your password needs at least 6 characters.', true); passInput.focus(); return; }

      run(submitBtn, async () => {
        if (mode === 'signup') {
          const cred = await A.createUserWithEmailAndPassword(auth, email, password);
          await A.updateProfile(cred.user, { displayName: name });
        } else {
          await A.signInWithEmailAndPassword(auth, email, password);
        }
      });
    });

    googleBtn.addEventListener('click', () => run(googleBtn, () => A.signInWithPopup(auth, new A.GoogleAuthProvider())));

    forgotBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!emailInput.checkValidity() || !email) { say('Type your email address above first, then tap "Forgot password?" again.', true); emailInput.focus(); return; }
      try {
        await A.sendPasswordResetEmail(auth, email);
        say('If an account exists for that email, a password reset link is on its way. Check your inbox.');
      } catch (err) {
        say(errorText(err), true);
      }
    });
  }

  // ---------- My Trips page ----------
  async function renderAccount() {
    const first = (user.displayName || '').split(' ')[0];
    document.getElementById('acctGreeting').textContent = first ? `Hello, ${first}` : 'My Trips';
    document.getElementById('acctEmail').textContent = user.email || '';
    renderFavs();

    const enqList = document.getElementById('enqList');
    enqList.replaceChildren();
    try {
      const snap = await F.getDocs(F.query(userCol('enquiries'), F.orderBy('createdAt', 'desc'), F.limit(20)));
      snap.forEach(d => {
        const { text, createdAt } = d.data();
        const li = document.createElement('li');
        const p = document.createElement('p');
        p.textContent = text;
        const time = document.createElement('span');
        time.textContent = createdAt ? createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now';
        li.append(p, time);
        enqList.append(li);
      });
      document.getElementById('enqEmpty').hidden = !snap.empty;
    } catch (err) {
      console.warn(err);
      document.getElementById('enqEmpty').hidden = false;
    }

    document.getElementById('acctLoading').hidden = true;
    accountMain.hidden = false;
    isAdmin(user).then(ok => { document.getElementById('adminLink').hidden = !ok; });
  }

  function renderFavs() {
    const list = document.getElementById('favList');
    list.replaceChildren();
    [...favs].sort().forEach(name => {
      const li = document.createElement('li');
      const label = document.createElement('strong');
      label.textContent = name;
      const ask = document.createElement('a');
      ask.className = 'btn btn-wa btn-sm';
      ask.textContent = 'Enquire';
      ask.target = '_blank';
      ask.rel = 'noopener';
      ask.href = waLink(`I'd like to know more about trips to ${name}.`); // waLink comes from script.js
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link-btn';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        await toggleFav(name);
        renderFavs();
      });
      const actions = document.createElement('div');
      actions.append(ask, remove);
      li.append(label, actions);
      list.append(li);
    });
    document.getElementById('favEmpty').hidden = favs.size > 0;
  }

  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    busy = true;
    await A.signOut(auth);
    location.href = 'index.html';
  });
}
