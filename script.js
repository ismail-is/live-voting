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
function initFirebaseAuth() {
  // Initialize Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
  }
  
  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();
  // Optional: provider.setCustomParameters({ prompt: 'select_account' });

  // Handle the Sign In Button Click
  const signInBtn = document.getElementById('googleSignInBtn');
  const escapeAppBtn = document.getElementById('escapeAppBtn');
  
  // In-App Browser Detection
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /android/i.test(ua);
  const isInApp = /FBAV|FBAN|Instagram|Line|Snapchat|Viber|WhatsApp|Threads|TikTok|Twitter|XApp|twttr/i.test(ua);

  if (isInApp && escapeAppBtn && signInBtn) {
    // Hide Google Sign In, Show Escape Button
    signInBtn.classList.add('hidden');
    signInBtn.classList.remove('flex');
    escapeAppBtn.classList.remove('hidden');
    escapeAppBtn.classList.add('flex');

    escapeAppBtn.addEventListener('click', () => {
      if (isIOS) {
        window.location.href = "googlechromes://voting.darkmedia.tech/";
        setTimeout(() => {
          Swal.fire({
            icon: 'info',
            title: 'Action Required',
            text: 'To vote, please tap the compass icon (Safari) at the bottom right, or tap the 3 dots at the top right and select "Open in Browser".',
            background: '#0d0b08',
            color: '#f4d976',
            confirmButtonColor: '#d4af37'
          });
        }, 800);
      } else if (isAndroid) {
        window.location.href = "intent://voting.darkmedia.tech/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" + encodeURIComponent("https://voting.darkmedia.tech/") + ";end";
        setTimeout(() => {
          Swal.fire({
            icon: 'info',
            title: 'Action Required',
            text: 'To vote, please tap the 3 dots at the top right and select "Open in Chrome".',
            background: '#0d0b08',
            color: '#f4d976',
            confirmButtonColor: '#d4af37'
          });
        }, 800);
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Action Required',
          text: 'Please open this link in a normal web browser (Chrome, Safari, Edge) to vote securely.',
          background: '#0d0b08',
          color: '#f4d976',
          confirmButtonColor: '#d4af37'
        });
      }
    });
  } else if (signInBtn) {
    // Normal Secure Browser behavior
    signInBtn.addEventListener('click', () => {
      // Use signInWithPopup to avoid iOS Safari partitioned storage redirect errors
      auth.signInWithPopup(provider).catch(err => {
        console.error('Popup Sign-In Error:', err);
        // Fallback if popup is somehow blocked
        if (err.code === 'auth/popup-blocked') {
          auth.signInWithRedirect(provider);
        }
      });
    });
  }

  // Listen for authentication state changes
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = {
        email: user.email,
        googleId: user.uid,
        name: user.displayName,
        picture: user.photoURL
      };

      localStorage.setItem('live_vote_user', JSON.stringify(currentUser));

      if (signInBtn) signInBtn.classList.add('hidden');
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
  });
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
    // Send the vote as a GET request to completely eliminate Google Apps Script POST/CORS redirect bugs.
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.append('action', 'vote');
    url.searchParams.append('email', currentUser.email);
    url.searchParams.append('googleId', currentUser.googleId);
    url.searchParams.append('candidateId', candidateId);
    url.searchParams.append('candidateName', candidateName);

    const res = await axios.get(url.toString());
    const resData = res.data;

    if (resData.success) {
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
      if (resData.message === 'Voting is closed') {
        isVotingClosed = true;
        buttons.forEach(btn => {
          btn.disabled = true;
          btn.innerHTML = '<span>⛔</span> Voting Closed';
        });
        Swal.fire({
          icon: 'error',
          title: 'Voting Closed',
          text: 'Sorry, voting has been closed.',
          background: '#0d0b08',
          color: '#f4d976',
          confirmButtonColor: '#d4af37'
        });
        fetchResults(); // Re-fetch to sync actual backend state
      } else if (resData.message === 'Already Voted') {
        const previousVote = resData.candidateId || '1';
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
      } else {
        buttons.forEach(b => b.disabled = false);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: resData.message || 'Could not record your vote.',
          background: '#0d0b08',
          color: '#f4d976',
          confirmButtonColor: '#d4af37'
        });
      }
    }
  } catch (err) {
    console.error('Submit Vote Error:', err);
    buttons.forEach(b => b.disabled = false);
    Swal.fire({
      icon: 'error',
      title: 'Connection Error',
      text: 'Could not connect to the server. Please ensure your Google Apps Script is deployed with "Who has access: Anyone".',
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
    initFirebaseAuth();
  }
});
