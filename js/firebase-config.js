/* הגדרות Firebase לסנכרון בין הטלפונים (לא חובה — בלי זה האתר עובד מקומית + "שתף קישור").
 *
 * איך ממלאים: Firebase Console ← ⚙ Project settings ← General ← Your apps ← (</>) Web app
 * ← העתיקו את האובייקט firebaseConfig והדביקו את הערכים כאן במקום ה-PASTE_...
 * הערכים האלה אינם סוד (הם מזהים ציבוריים של הפרויקט) — ההגנה היא ב-firestore.rules.
 * הוראות מלאות: README.md
 */
window.FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
