/* =========================================================
   CONFIG.JS
   -----------------------------------------------------------
   This is the ONLY file you should need to edit to get the
   site running with your own Google account, Apps Script
   deployment, and candidates. See SETUP_GUIDE.md for the
   full step-by-step walkthrough.
   ========================================================= */

const CONFIG = {

  // 1) Paste the OAuth 2.0 "Web application" Client ID you create
  //    in Google Cloud Console (Google Identity Services).
  GOOGLE_CLIENT_ID: "56178672870-k8fc18v0l3s7thjbo59scthqfijmjnet.apps.googleusercontent.com",

  // 2) Paste the URL you get after deploying the Apps Script as a
  //    Web App (Deploy > New deployment > Web app). It looks like:
  //    https://script.google.com/macros/s/XXXXXXXXXXXX/exec
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzLCkhs9zYBadGfqa42RMvdkUgtseM5MLrNsbNE0lZyDIEHZFcFYv09tR4KKcrQnmhI/exec",

  // 3) How often (ms) the live results are refreshed.
  REFRESH_INTERVAL_MS: 5000,

  // 4) Candidates. "id" must match what you store in the sheet.
  //    "image" can be any public image URL or a local path.
  CANDIDATES: [
    {
      id: "C1",
      name: "سعود ماجد الطنباوي",
      image: "allimg/1.jpeg"
    },
    {
      id: "C2",
      name: "عيسى العازمي",
      image: "allimg/2.jpeg"
    },
    {
      id: "C3",
      name: "عماش خالد الحنتوشي",
      image: "allimg/3.jpeg"
    }
  ]
};
