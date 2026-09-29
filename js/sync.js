// Firebase Firestore sync for one "pair" document: pairs/{PAIR-CODE}.
// Loaded lazily (dynamic import) only when js/firebase-config.js is filled in.
// SDK comes straight from Google's CDN — no npm, no build step.
const V = '12.19.0';
const CDN = `https://www.gstatic.com/firebasejs/${V}/`;

let sdk = null, app = null;

async function load(config){
  if(!sdk){
    const [appMod, authMod, fsMod] = await Promise.all([
      import(CDN + 'firebase-app.js'),
      import(CDN + 'firebase-auth.js'),
      import(CDN + 'firebase-firestore.js')
    ]);
    sdk = {appMod, authMod, fsMod};
  }
  if(!app) app = sdk.appMod.initializeApp(config);
  return sdk;
}

export async function connect(config, code, {onData, onError}){
  const {authMod, fsMod} = await load(config);
  const auth = authMod.getAuth(app);
  await auth.authStateReady();
  // Anonymous sign-in: no accounts or passwords, but blocks unauthenticated scripts (see firestore.rules)
  if(!auth.currentUser) await authMod.signInAnonymously(auth);

  const db = fsMod.getFirestore(app);
  const ref = fsMod.doc(db, 'pairs', code);
  const unsub = fsMod.onSnapshot(ref,
    snap => {
      if(snap.metadata.hasPendingWrites) return;         // echo of our own write
      onData(snap.exists() ? snap.data() : null, snap.metadata.fromCache);
    },
    err => onError(err)
  );
  return {
    // fields: {plan: '<json>', done_a: '<json>', ...} — merged per field
    push: fields => fsMod.setDoc(ref, {...fields, updatedAt: fsMod.serverTimestamp()}, {merge: true}),
    close: () => unsub()
  };
}
