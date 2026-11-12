// Shared Firebase setup for the planner and registry pages (ES module, CDN SDK).
export const FIREBASE_VERSION = '13.1.0';
const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const [appMod, appCheckMod, authMod, fsMod] = await Promise.all([
  import(`${base}/firebase-app.js`),
  import(`${base}/firebase-app-check.js`),
  import(`${base}/firebase-auth.js`),
  import(`${base}/firebase-firestore.js`),
]);

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

// Web config is public by design: security rules, not these values, guard the data.
const firebaseConfig = {
  apiKey: 'AIzaSyBl94KszbYaQF4RgBcSbaV9_6WJZv-XggY',
  authDomain: 'sunnyandtrupti.com',
  projectId: isLocal ? 'demo-wedding' : 'sunnyandtrupti',
  appId: '1:810840998149:web:74bfb8bebe373b44def76c',
};

export const app = appMod.initializeApp(firebaseConfig);
export const auth = authMod.getAuth(app);
export const db = fsMod.getFirestore(app);

if (isLocal) {
  fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
} else {
  appCheckMod.initializeAppCheck(app, {
    provider: new appCheckMod.ReCaptchaEnterpriseProvider('6LfLohwuAAAAAEEav9jGlH2zQXB_Cy2nsYlpMX0h'),
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
