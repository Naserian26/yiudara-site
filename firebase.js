// =========================================================
//  Shared Firebase connection used by auth.js, content.js and admin.js
// =========================================================
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const enabled = Boolean(FIREBASE_CONFIG.apiKey);

let A, F, auth, db;
if (enabled) {
  let initializeApp;
  [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  auth = A.getAuth(app);
  db = F.getFirestore(app);
}
export { A, F, auth, db };

// Admins are listed in Firestore as admins/{email}. Only that person can read their own entry,
// so this returns true just for admins, without the list ever being public.
export async function isAdmin(user) {
  if (!enabled || !user || !user.email) return false;
  try {
    return (await F.getDoc(F.doc(db, 'admins', user.email.toLowerCase()))).exists();
  } catch {
    return false;
  }
}

// Shrinks an uploaded photo to web size and returns it as a JPEG data URL,
// small enough to store directly in the database (no paid file storage needed).
export async function shrinkImage(file, maxSide = 1400) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Please choose a JPG or PNG image.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.82;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (url.length > 600000 && quality > 0.45) {
    quality -= 0.08;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  if (url.length > 750000) throw new Error('That image is too detailed to upload. Try a smaller version.');
  return url;
}
