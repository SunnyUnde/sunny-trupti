// Shared Firebase setup for the planner and registry pages (ES module, CDN SDK).
export const FIREBASE_VERSION = '13.1.0';
const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const [appMod, appCheckMod, authMod, fsMod] = await Promise.all([
  import(`${base}/firebase-app.js`),
  import(`${base}/firebase-app-check.js`),
  import(`${base}/firebase-auth.js`),
  import(`${base}/firebase-firestore.js`),
]);

// Placeholders: the real project values arrive at go-live.
const firebaseConfig = {
  apiKey: 'PLACEHOLDER',
  authDomain: 'sunnyandtrupti.com',
  projectId: 'PLACEHOLDER',
  appId: 'PLACEHOLDER',
};

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

export const app = appMod.initializeApp(firebaseConfig);
export const auth = authMod.getAuth(app);
export const db = fsMod.getFirestore(app);

if (isLocal) {
  fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
} else {
  appCheckMod.initializeAppCheck(app, {
    provider: new appCheckMod.ReCaptchaV3Provider('PLACEHOLDER_RECAPTCHA_SITE_KEY'),
    isTokenAutoRefreshEnabled: true,
  });
}

export const fs = {
  doc: fsMod.doc,
  collection: fsMod.collection,
  collectionGroup: fsMod.collectionGroup,
  getDoc: fsMod.getDoc,
  getDocs: fsMod.getDocs,
  onSnapshot: fsMod.onSnapshot,
  query: fsMod.query,
  where: fsMod.where,
  orderBy: fsMod.orderBy,
  runTransaction: fsMod.runTransaction,
  writeBatch: fsMod.writeBatch,
  serverTimestamp: fsMod.serverTimestamp,
  Timestamp: fsMod.Timestamp,
  increment: fsMod.increment,
  arrayUnion: fsMod.arrayUnion,
  arrayRemove: fsMod.arrayRemove,
  deleteField: fsMod.deleteField,
};

export const authFns = {
  GoogleAuthProvider: authMod.GoogleAuthProvider,
  signInWithPopup: authMod.signInWithPopup,
  signInWithRedirect: authMod.signInWithRedirect,
  getRedirectResult: authMod.getRedirectResult,
  onAuthStateChanged: authMod.onAuthStateChanged,
  signOut: authMod.signOut,
};
