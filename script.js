/* =========================================================
   SCRIPT.JS — Voting site logic
   ========================================================= */

let currentUser = null;      // { email, googleId, name, picture }
let hasVoted = false;
let isVotingClosed = false;
let liveData = {};           // last known results keyed by candidate id
let pollTimer = null;

const grid = document.getElementById('candidatesGrid');
const statusBanner = document.getElementById('statusBanner');

/* ---------------------------------------------------------
   1. INITIAL RENDER (static shell, before first live fetch)
   --------------------------------------------------------- */
function buildCardHTML(candidate, rankIndex) {
  const rankClasses = ['rank-gold', 'rank-silver', 'rank-bronze'];
  const rankNumbers = ['1', '2', '3'];
  const rankClass = rankClasses[rankIndex] ?? 'rank-bronze';

  return `
    <div class="candidate-card fade-in-up glass-card rounded-3xl p-6 pt-10 relative flex flex-col items-center text-center"
         style="animation-delay:${rankIndex * 0.12}s"
         data-id="${candidate.id}">

      <div class="absolute -top-6 rank-badge ${rankClass}" data-role="rank-badge">
        ${rankNumbers[rankIndex] ?? rankIndex + 1}
      </div>

      <span class="ribbon mb-4 text-sm" data-role="ribbon">Option ${['One', 'Two', 'Three'][rankIndex] ?? rankIndex + 1}</span>

      <div class="w-full aspect-[4/3] rounded-2xl overflow-hidden border border-[rgba(212,175,55,0.3)] mb-4 bg-black/40 flex items-center justify-center">
        <img src="${candidate.image}" alt="${candidate.name}" class="w-full h-full object-contain">
      </div>

      <p class="text-gray-400 text-sm mb-1">Candidate</p>
      <h3 class="text-lg font-bold mb-3">${candidate.name}</h3>

      <div class="w-2/3 h-px bg-[rgba(212,175,55,0.3)] mb-3"></div>

      <p class="text-gray-400 text-sm mb-1">Votes</p>
      <p class="text-2xl font-black gold-text mb-3">
        <span data-role="votes">0</span>
      </p>

      <div class="progress-track mb-1">
        <div class="progress-fill" data-role="progress" style="width:0%"></div>
      </div>
      <p class="text-xs text-gray-400 mb-4"><span data-role="percentage">0</span>%</p>

      <button data-role="vote-btn"
              class="vote-btn w-full py-3 rounded-xl flex items-center justify-center gap-2"
              onclick="handleVoteClick(event, '${candidate.id}', '${candidate.name.replace(/'/g, "\\'")}')">
        <span>✅</span> صوّت الآن
      </button>
    </div>
  `;
}

function renderInitialCards() {
  grid.innerHTML = CONFIG.CANDIDATES.map((c, i) => buildCardHTML(c, i)).join('');
}

/* ---------------------------------------------------------
   2. NUMBER / PROGRESS ANIMATION HELPERS
   --------------------------------------------------------- */
function animateNumber(el, from, to, duration = 800) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value = Math.round(from + (to - from) * progress);
    el.textContent = value.toLocaleString('en-US');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------------------------------------------------------
   3. LIVE RESULTS: FETCH + UPDATE DOM
   --------------------------------------------------------- */
async function fetchResults() {
  try {
    const res = await axios.get(`${CONFIG.APPS_SCRIPT_URL}?action=results`);
    updateResults(res.data);
  } catch (err) {
    console.error('Failed to fetch results', err);
  }
}

function updateResults(data) {
  // data: { totalVotes, candidates: { C1:{name,votes,percentage}, ... }, votingStatus: 'OPEN'|'CLOSED' }
  if (!data || !data.candidates) return;

  if (data.votingStatus === 'CLOSED') {
    isVotingClosed = true;
    if (!hasVoted) {
      document.querySelectorAll('[data-role="vote-btn"]').forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = '<span>⛔</span> Voting Closed';
      });
    }
  } else {
    isVotingClosed = false;
    if (!hasVoted) {
      document.querySelectorAll('[data-role="vote-btn"]').forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = '<span>✅</span> صوّت الآن';
      });
    }
  }

  animateNumber(document.getElementById('totalVotes'),
    parseInt(document.getElementById('totalVotes').textContent.replace(/,/g, '')) || 0,
    data.totalVotes || 0);

  // Build a sortable array containing ALL candidates, even those with 0 votes
  // (the backend omits candidates with 0 votes).
  const entries = CONFIG.CANDIDATES.map(c => {
    const liveInfo = data.candidates[c.id] || {};
    return {
      id: c.id,
      name: c.name,
      votes: liveInfo.votes || 0,
      percentage: liveInfo.percentage || 0
    };
  });
  entries.sort((a, b) => (b.votes || 0) - (a.votes || 0));

  if (entries.length > 0 && entries[0].votes > 0) {
    const highestVotes = entries[0].votes;
    const leaders = entries.filter(c => c.votes === highestVotes);

    const topBox = document.getElementById('topCandidateBox');
    if (topBox) {
      topBox.classList.remove('hidden');
      topBox.classList.add('flex');

      const leaderLabel = document.getElementById('leaderLabel');
      if (leaders.length > 1) {
        if (leaderLabel) leaderLabel.textContent = 'Leading (Tie):';
        document.getElementById('topCandidateName').textContent = leaders.map(c => c.name).join(' & ');
      } else {
        if (leaderLabel) leaderLabel.textContent = 'Leading:';
        document.getElementById('topCandidateName').textContent = leaders[0].name;
      }

      const topVotesEl = document.getElementById('topCandidateVotes');
      const prevTopVotes = parseInt(topVotesEl.textContent.replace(/,/g, '')) || 0;
      animateNumber(topVotesEl, prevTopVotes, highestVotes);
    }
  }

  entries.forEach((entry, rankIndex) => {
    const card = grid.querySelector(`.candidate-card[data-id="${entry.id}"]`);
    if (!card) return;

    const votesEl = card.querySelector('[data-role="votes"]');
    const pctEl = card.querySelector('[data-role="percentage"]');
    const fillEl = card.querySelector('[data-role="progress"]');
    const rankBadge = card.querySelector('[data-role="rank-badge"]');
    const ribbon = card.querySelector('[data-role="ribbon"]');

    const prevVotes = liveData[entry.id]?.votes ?? 0;
    animateNumber(votesEl, prevVotes, entry.votes || 0);
    pctEl.textContent = (entry.percentage ?? 0).toFixed(1);
    fillEl.style.width = `${entry.percentage ?? 0}%`;

    // We intentionally do NOT update the rank badges here so that they remain
    // permanently fixed to their original Option numbering (1, 2, 3) 
    // exactly as they were initially rendered.

    // We intentionally do NOT reorder the DOM so that the cards stay in 
    // their static 1-2-3 layout permanently, as requested by the user.


    liveData[entry.id] = entry;
  });
}

function startPolling() {
  fetchResults();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchResults, CONFIG.REFRESH_INTERVAL_MS || 5000);
}

/* ---------------------------------------------------------
   4. GOOGLE IDENTITY SERVICES (LOGIN)
   --------------------------------------------------------- */
function decodeJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''));
  return JSON.parse(json);
}

function handleCredentialResponse(response) {
  const payload = decodeJwt(response.credential);
  currentUser = {
    email: payload.email,
    googleId: payload.sub,
    name: payload.name,
    picture: payload.picture
  };

  localStorage.setItem('live_vote_user', JSON.stringify(currentUser));

  document.getElementById('googleSignInBtn').classList.add('hidden');
  const chip = document.getElementById('userChip');
  chip.classList.remove('hidden');
  chip.classList.add('flex');
  document.getElementById('userAvatar').src = currentUser.picture;
  document.getElementById('userName').textContent = currentUser.name;

  checkLocalVoteFlag(); // Apply optimistic lock
  verifyVoteStatus(currentUser.email); // Validate against server

  // If the user was mid-vote (clicked Vote before logging in), continue.
  if (window.__pendingVote) {
    submitVote(window.__pendingVote.id, window.__pendingVote.name);
    window.__pendingVote = null;
  }
}

function initGoogleSignIn() {
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(
    document.getElementById('googleSignInBtn'),
    { theme: 'filled_black', shape: 'pill', text: 'signin_with', locale: 'en' }
  );
}

/* ---------------------------------------------------------
   5. VOTING
   --------------------------------------------------------- */
function localVoteKey(email) {
  return `voted_${email}`;
}

function checkLocalVoteFlag() {
  if (!currentUser) return;
  const storedVal = localStorage.getItem(localVoteKey(currentUser.email));
  if (storedVal) {
    lockVoting('You have already voted.', storedVal !== '1' ? storedVal : null);
  }
}

function unlockVoting() {
  hasVoted = false;
  statusBanner.classList.add('hidden');
  document.querySelectorAll('[data-role="vote-btn"]').forEach(btn => {
    btn.disabled = false;
    btn.innerHTML = '<span>✅</span> صوّت الآن';
    
    const card = btn.closest('.candidate-card');
    if (card) {
      card.style.boxShadow = '';
      card.style.borderColor = '';
      card.style.transform = '';
      card.style.zIndex = '';
      card.style.opacity = '1';
    }
  });
}

async function verifyVoteStatus(email) {
  if (!email) return;
  try {
    const res = await axios.get(`${CONFIG.APPS_SCRIPT_URL}?action=check&email=${encodeURIComponent(email)}`);
    if (res.data.voted) {
      localStorage.setItem(localVoteKey(email), res.data.candidateId);
      lockVoting('You have already voted.', res.data.candidateId !== '1' ? res.data.candidateId : null);
    } else {
      // The server says they haven't voted! (e.g. admin deleted their row)
      // We must clear the local storage and unlock the UI!
      localStorage.removeItem(localVoteKey(email));
      unlockVoting();
    }
  } catch (err) {
    console.error('Error verifying vote status', err);
  }
}

function lockVoting(message, votedCandidateId = null) {
  hasVoted = true;
  document.querySelectorAll('[data-role="vote-btn"]').forEach(btn => {
    btn.disabled = true;

    const card = btn.closest('.candidate-card');
    const cid = card ? card.getAttribute('data-id') : null;

    if (votedCandidateId && cid === votedCandidateId) {
      btn.innerHTML = '<span>⭐</span> Your Vote';
      card.style.boxShadow = '0 0 25px rgba(212,175,55,0.6)';
      card.style.borderColor = 'var(--gold-2)';
      card.style.transform = 'scale(1.02)';
      card.style.zIndex = '10';
    } else if (votedCandidateId) {
      btn.innerHTML = '<span>✔️</span> Voted';
      card.style.opacity = '0.6';
    } else {
      btn.innerHTML = '<span>✔️</span> Voted';
    }
  });
  showBanner(message, 'info');
}

function showBanner(message, type = 'info') {
  statusBanner.textContent = message;
  statusBanner.classList.remove('hidden');
  statusBanner.className = 'text-center mb-8 py-3 px-4 rounded-xl border text-sm font-semibold ' +
    (type === 'error'
      ? 'bg-red-950/40 border-red-500/40 text-red-300'
      : 'bg-[rgba(212,175,55,0.1)] border-[rgba(212,175,55,0.4)] text-[var(--gold-1)]');
}

function createRipple(event, button) {
  const circle = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - button.getBoundingClientRect().left - diameter / 2}px`;
  circle.style.top = `${event.clientY - button.getBoundingClientRect().top - diameter / 2}px`;
  circle.classList.add('ripple');
  button.appendChild(circle);
  setTimeout(() => circle.remove(), 600);
}

function handleVoteClick(event, candidateId, candidateName) {
  const button = event.currentTarget;
  createRipple(event, button);

  if (hasVoted || isVotingClosed) return;

  if (!currentUser) {
    window.__pendingVote = { id: candidateId, name: candidateName };
    showBanner('Please sign in with Google first to vote.', 'info');
    google.accounts.id.prompt();
    return;
  }

  submitVote(candidateId, candidateName);
}

async function submitVote(candidateId, candidateName) {
  const buttons = document.querySelectorAll('[data-role="vote-btn"]');
  buttons.forEach(b => b.disabled = true);

  // Optimistic UI Update for instant feedback
  if (liveData && liveData[candidateId]) {
    const currentTotal = parseInt(document.getElementById('totalVotes').textContent.replace(/,/g, '')) || 0;
    const newTotal = currentTotal + 1;
    let optimisticData = { totalVotes: newTotal, candidates: {} };
    for (const id in liveData) {
      let c = { ...liveData[id] };
      if (id === candidateId) {
        c.votes = (c.votes || 0) + 1;
      }
      c.percentage = newTotal > 0 ? (c.votes / newTotal) * 100 : 0;
      optimisticData.candidates[id] = c;
    }
    updateResults(optimisticData);
  }

  try {
    const payload = {
      email: currentUser.email,
      googleId: currentUser.googleId,
      candidateId,
      candidateName
    };

    // Sent as text/plain to avoid a CORS preflight against Apps Script.
    const res = await axios.post(CONFIG.APPS_SCRIPT_URL, JSON.stringify(payload), {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });

    if (res.data.success) {
      localStorage.setItem(localVoteKey(currentUser.email), candidateId);
      lockVoting('Your vote has been recorded. Thank you!', candidateId);
      Swal.fire({
        icon: 'success',
        title: 'Vote Successful',
        text: 'Your vote has been successfully recorded!',
        background: '#0d0b08',
        color: '#f4d976',
        confirmButtonColor: '#d4af37'
      });
      fetchResults();
    } else {
      // Backend rejected the vote. Check if they returned the previously voted candidate ID!
      const previousVote = res.data.candidateId || '1';
      localStorage.setItem(localVoteKey(currentUser.email), previousVote);
      lockVoting('You have already voted.', previousVote !== '1' ? previousVote : null);
      
      Swal.fire({
        icon: 'error',
        title: 'Already Voted',
        text: 'You have already voted.',
        background: '#0d0b08',
        color: '#f4d976',
        confirmButtonColor: '#d4af37'
      });
    }
  } catch (err) {
    console.error(err);
    buttons.forEach(b => b.disabled = false);
    Swal.fire({
      icon: 'error',
      title: 'Error Occurred',
      text: 'Could not record your vote, please try again.',
      background: '#0d0b08',
      color: '#f4d976',
      confirmButtonColor: '#d4af37'
    });
  }
}

function checkStoredUser() {
  const storedUser = localStorage.getItem('live_vote_user');
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      document.getElementById('googleSignInBtn').classList.add('hidden');
      const chip = document.getElementById('userChip');
      chip.classList.remove('hidden');
      chip.classList.add('flex');
      document.getElementById('userAvatar').src = currentUser.picture;
      document.getElementById('userName').textContent = currentUser.name;
      checkLocalVoteFlag(); // Apply optimistic lock
      verifyVoteStatus(currentUser.email); // Validate against server
      return true;
    } catch (e) {
      localStorage.removeItem('live_vote_user');
    }
  }
  return false;
}

/* ---------------------------------------------------------
   6. BOOTSTRAP
   --------------------------------------------------------- */
window.addEventListener('load', () => {
  renderInitialCards();
  startPolling();

  const isLoggedIn = checkStoredUser();

  if (!isLoggedIn) {
    // google script loads async — poll for it briefly before init
    const waitForGoogle = setInterval(() => {
      if (window.google && google.accounts && google.accounts.id) {
        clearInterval(waitForGoogle);
        initGoogleSignIn();
      }
    }, 150);
  }
});
