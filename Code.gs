/**
 * =========================================================
 * CODE.GS — Apps Script backend for the voting site
 * -----------------------------------------------------------
 * Deploy this bound to a Google Sheet with one sheet named
 * "Votes" and this header row in row 1:
 *
 *   Timestamp | Google User ID | Email | Candidate Name | Candidate ID
 *
 * See SETUP_GUIDE.md for deployment steps.
 * ========================================================= */

const SHEET_NAME = 'Votes';

// Column indexes (0-based) matching the header row above.
const COL_TIMESTAMP = 0;
const COL_GOOGLE_ID = 1;
const COL_EMAIL = 2;
const COL_CANDIDATE_NAME = 3;
const COL_CANDIDATE_ID = 4;

/**
 * API 1 — Submit Vote
 * Expects a POST body (text/plain, JSON-encoded) with:
 *   { email, googleId, candidateId, candidateName }
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const data = JSON.parse(e.postData.contents);

    if (!data.email || !data.candidateId) {
      return jsonResponse({ success: false, message: 'Missing required fields' });
    }

    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();

    // Server-side duplicate check — never trust the frontend.
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][COL_EMAIL]).toLowerCase() === String(data.email).toLowerCase()) {
        const previousVoteId = values[i][COL_CANDIDATE_ID];
        return jsonResponse({ success: false, message: 'Already Voted', candidateId: previousVoteId });
      }
    }

    sheet.appendRow([
      new Date(),
      data.googleId || '',
      data.email,
      data.candidateName || '',
      data.candidateId
    ]);

    return jsonResponse({ success: true, message: 'Vote Submitted Successfully' });

  } catch (err) {
    return jsonResponse({ success: false, message: 'Server Error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * API 2 — Get Live Results
 * GET .../exec?action=results
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'results') {
    return jsonResponse(getResults_());
  }
  if (action === 'check') {
    return jsonResponse(checkVote_(e.parameter.email));
  }

  return ContentService.createTextOutput('Voting API is running.');
}

function getResults_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();

  const counts = {};   // candidateId -> vote count
  const names = {};     // candidateId -> candidate name

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const cid = row[COL_CANDIDATE_ID];
    if (!cid) continue;
    counts[cid] = (counts[cid] || 0) + 1;
    names[cid] = row[COL_CANDIDATE_NAME];
  }

  const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);

  const candidates = {};
  Object.keys(counts).forEach(cid => {
    candidates[cid] = {
      name: names[cid],
      votes: counts[cid],
      percentage: totalVotes > 0 ? Math.round((counts[cid] / totalVotes) * 1000) / 10 : 0
    };
  });

  return { totalVotes, candidates };
}

function checkVote_(email) {
  if (!email) return { voted: false };
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][COL_EMAIL]).toLowerCase() === String(email).toLowerCase()) {
      return { voted: true, candidateId: values[i][COL_CANDIDATE_ID] };
    }
  }
  return { voted: false };
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Google User ID', 'Email', 'Candidate Name', 'Candidate ID']);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
