/* =========================================================
   CONFIG.JS
   -----------------------------------------------------------
   This is the ONLY file you should need to edit to get the
   site running with your own Google account, Apps Script
   deployment, and candidates. See SETUP_GUIDE.md for the
   full step-by-step walkthrough.
   ========================================================= */

const CONFIG = {

  // 1) Replace this with your actual Firebase config object
  //    found in your Firebase Project Settings > General > Your apps.
  FIREBASE_CONFIG: {
  apiKey: "AIzaSyAuM29zEj6hXtWjANnuNUFSBLv8GKQtzlo",
  authDomain: "voteing-bf34c.firebaseapp.com",
  projectId: "voteing-bf34c",
  storageBucket: "voteing-bf34c.firebasestorage.app",
  messagingSenderId: "629775256044",
  appId: "1:629775256044:web:39b886b590137b74fe98c9",
  measurementId: "G-QJ9Q2D5ZEF"
  },

  // 2) Paste the URL you get after deploying the Apps Script as a
  //    Web App (Deploy > New deployment > Web app). It looks like:
  //    https://script.google.com/macros/s/XXXXXXXXXXXX/exec
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxeOqCTHgaHURMXAjhrylVAjPrBpMmXNBXoEEPwm0VhNQ9Lhk3s9Q0yp6mPdArc17JJ/exec",

  // 3) How often (ms) the live results are refreshed.
  REFRESH_INTERVAL_MS: 5000,

  // 4) Candidates. "id" must match what you store in the sheet.
  //    "image" can be any public image URL or a local path.
  CANDIDATES: [
    {
      id: "C1",
      name: "مشاركة سيف فهد الحازمي",
      image: "allimg/v1.jpeg"
    },
    {
      id: "C2",
      name: "مشاركة مسلم العتيبي",
      image: "allimg/v2.jpeg"
    },
    {
      id: "C3",
      name: "مشاركة ناجح عوض العنزي ",
      image: "allimg/v3.jpeg"
    }
  ]
};
