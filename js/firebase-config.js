/* הגדרות Firebase לסנכרון בין הטלפונים (לא חובה — בלי זה האתר עובד מקומית + "שתף קישור").
 *
 * איך ממלאים: Firebase Console ← ⚙ Project settings ← General ← Your apps ← (</>) Web app
 * ← העתיקו את האובייקט firebaseConfig והדביקו את הערכים כאן במקום ה-PASTE_...
 * הערכים האלה אינם סוד (הם מזהים ציבוריים של הפרויקט) — ההגנה היא ב-firestore.rules.
 * הוראות מלאות: README.md
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDR439BH5jE5oQs99JDye12eJYECgjHlUM",
  authDomain: "eliram-fitness.firebaseapp.com",
  projectId: "eliram-fitness",
  storageBucket: "eliram-fitness.firebasestorage.app",
  messagingSenderId: "49707435270",
  appId: "1:49707435270:web:e5b178a38a7bc570c28a87"
};
