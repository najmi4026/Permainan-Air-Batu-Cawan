// game.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set, get, onValue, push, remove, serverTimestamp, query, orderByChild } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Elemen DOM (pastikan ID ini sepadan dengan index.html anda)
const playerNameDisplay = document.getElementById('playerNameDisplay');
const logoutButton = document.getElementById('logoutButton');
const matchTitle = document.getElementById('matchTitle');
const triesCountDisplay = document.getElementById('triesCountDisplay');
const btnBatu = document.getElementById('btnBatu');
const btnAir = document.getElementById('btnAir');
const btnCawan = document.getElementById('btnCawan');
const playerChoiceDisplay = document.getElementById('playerChoiceDisplay');
const computerChoiceDisplay = document.getElementById('computerChoiceDisplay');
const resultDisplay = document.getElementById('result-display');
const overallScoreDisplay = document.getElementById('overallScore');
const currentRoundScoreDisplay = document.getElementById('currentRoundScoreDisplay');
const resetMatchButton = document.getElementById('resetMatchButton');
const matchHistoryTableBody = document.getElementById('matchHistoryTableBody');

let currentUser = null;
let currentUserId = null;
let currentMatchId = null;

let roundWins = 0;
let roundLosses = 0;
let roundDraws = 0;
let roundsPlayed = 0;
const maxRoundsPerMatch = 3;

let totalPlayerWins = 0;
let totalPlayerLosses = 0;
let totalPlayerDraws = 0;

function updateOverallScoreDisplay() {
    if (overallScoreDisplay) {
        overallScoreDisplay.textContent = `${totalPlayerWins}-${totalPlayerLosses}-${totalPlayerDraws}`;
    }
}

onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged: User status changed", user); // DEBUG
    if (user) {
        currentUser = user;
        currentUserId = user.uid;
        console.log("onAuthStateChanged: User logged in, UID:", currentUserId); // DEBUG
        const userRef = ref(db, 'users/' + currentUserId);
        try {
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                const userData = snapshot.val();
                playerNameDisplay.textContent = `${userData.firstName} ${userData.lastName}` || user.email;
            } else {
                playerNameDisplay.textContent = user.email;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            playerNameDisplay.textContent = user.email; // Fallback
        }
        await loadPlayerOverallScore(); // Muat skor keseluruhan dahulu
        startNewMatch(); // Mulakan perlawanan baru selepas skor dimuatkan
        loadMatchHistory();
    } else {
        console.log("onAuthStateChanged: User logged out, redirecting to loginSignup.html"); // DEBUG
        sessionStorage.setItem('loggingOut', 'true'); // Elak redirect loop jika ada
        window.location.href = 'loginSignup.html';
    }
});

if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        console.log("Logout button clicked"); // DEBUG
        sessionStorage.setItem('loggingOut', 'true');
        try {
            await signOut(auth);
            // onAuthStateChanged akan menguruskan pengalihan
            console.log("User signed out successfully"); // DEBUG
        } catch (error) {
            console.error("Ralat log keluar: ", error);
            if (resultDisplay) {
                resultDisplay.textContent = "Gagal untuk log keluar.";
                resultDisplay.className = 'lose';
            }
            sessionStorage.removeItem('loggingOut'); // Bersihkan flag jika ada ralat
        }
    });
}

const choices = ['Batu', 'Air', 'Cawan'];
const emojiMap = {
    'Batu': '🗿',
    'Air': '💧',
    'Cawan': '🥤'
};

function getRandomChoice() {
    return choices[Math.floor(Math.random() * choices.length)];
}

function determineWinner(playerChoice, computerChoice) {
    if (playerChoice === computerChoice) return 'Seri';
    if (
        (playerChoice === 'Batu' && computerChoice === 'Cawan') ||
        (playerChoice === 'Air' && computerChoice === 'Batu') ||
        (playerChoice === 'Cawan' && computerChoice === 'Air')
    ) return 'Menang';
    return 'Kalah';
}

async function playRound(playerChoice) {
    console.log(`playRound: Player chose ${playerChoice}. Rounds played: ${roundsPlayed}, Max rounds: ${maxRoundsPerMatch}`); // DEBUG

    if (roundsPlayed >= maxRoundsPerMatch) {
        console.log("playRound: Max rounds reached. Match should have ended."); // DEBUG
        if (resultDisplay) {
            resultDisplay.textContent = "Perlawanan ini telah tamat. Klik 'Main Semula'.";
            resultDisplay.className = 'draw';
        }
        toggleChoiceButtons(true); // Pastikan butang dilumpuhkan jika perlawanan sudah tamat
        return;
    }

    toggleChoiceButtons(true); // Lumpuhkan butang semasa pusingan berjalan
    if (playerChoiceDisplay) playerChoiceDisplay.textContent = emojiMap[playerChoice];
    if (computerChoiceDisplay) computerChoiceDisplay.innerHTML = `<span class="status-message">Memikir...</span>`;
    if (resultDisplay) {
        resultDisplay.textContent = "Komputer sedang membuat pilihan...";
        resultDisplay.className = '';
    }

    // Simulasi "pemikiran" komputer
    setTimeout(async () => {
        console.log("playRound (setTimeout): Computer making choice."); // DEBUG
        const computerChoice = getRandomChoice();
        if (computerChoiceDisplay) computerChoiceDisplay.textContent = emojiMap[computerChoice];

        const roundResult = determineWinner(playerChoice, computerChoice);
        roundsPlayed++;
        console.log(`playRound (setTimeout): Round ${roundsPlayed} result: ${roundResult}`); // DEBUG

        let resultText = '';
        let resultClass = '';

        if (roundResult === 'Menang') {
            roundWins++;
            resultText = `Anda Menang! ${emojiMap[playerChoice]} mengalahkan ${emojiMap[computerChoice]}.`;
            resultClass = 'win highlight-winner';
        } else if (roundResult === 'Kalah') {
            roundLosses++;
            resultText = `Anda Kalah! ${emojiMap[computerChoice]} mengalahkan ${emojiMap[playerChoice]}.`;
            resultClass = 'lose';
        } else {
            roundDraws++;
            resultText = `Seri! Kedua-duanya memilih ${emojiMap[playerChoice]}.`;
            resultClass = 'draw';
        }

        if (resultDisplay) {
            resultDisplay.textContent = resultText;
            resultDisplay.className = resultClass;
        }
        updateCurrentRoundScoreDisplay();
        updateTriesDisplay();

        // Simpan rekod pusingan individu ke Firebase
        if (currentMatchId && currentUserId) {
            const roundData = {
                playerChoice: playerChoice,
                computerChoice: computerChoice,
                roundResult: roundResult,
                timestamp: serverTimestamp()
            };
            const roundsRef = ref(db, `matchDetails/${currentUserId}/${currentMatchId}/rounds`);
            const newRoundRef = push(roundsRef);
            try {
                await set(newRoundRef, roundData);
                console.log("playRound (setTimeout): Round details saved to Firebase."); // DEBUG
            } catch (error) {
                console.error("playRound (setTimeout): Error saving round details:", error); //DEBUG
            }
        }

        console.log(`playRound (setTimeout): Rounds played: ${roundsPlayed}, Max rounds: ${maxRoundsPerMatch}`); // DEBUG
        if (roundsPlayed >= maxRoundsPerMatch) {
            console.log("playRound (setTimeout): Max rounds reached. Finalizing match."); // DEBUG
            finalizeMatch();
            // Butang akan dilumpuhkan oleh toggleChoiceButtons(true) dalam finalizeMatch atau di sini
            toggleChoiceButtons(true);
            if (resetMatchButton) resetMatchButton.style.display = 'inline-block';
        } else {
            console.log("playRound (setTimeout): Enabling choice buttons for next round."); // DEBUG
            toggleChoiceButtons(false); // PENTING: Aktifkan semula butang untuk pusingan seterusnya
        }
    }, 1500); // Tunggu 1.5 saat
}

function updateCurrentRoundScoreDisplay() {
    if (currentRoundScoreDisplay) {
        currentRoundScoreDisplay.textContent = `Skor Pusingan Ini: Menang: ${roundWins} | Kalah: ${roundLosses} | Seri: ${roundDraws}`;
    }
}

function updateTriesDisplay() {
    if (triesCountDisplay) {
        triesCountDisplay.textContent = `Percubaan Pusingan Ini: ${roundsPlayed}/${maxRoundsPerMatch}`;
    }
}

function toggleChoiceButtons(disable) {
    console.log("toggleChoiceButtons: Setting disabled to", disable); // DEBUG
    if (btnBatu) btnBatu.disabled = disable;
    if (btnAir) btnAir.disabled = disable;
    if (btnCawan) btnCawan.disabled = disable;
}

async function startNewMatch() {
    console.log("startNewMatch: Starting new match setup."); // DEBUG
    roundWins = 0;
    roundLosses = 0;
    roundDraws = 0;
    roundsPlayed = 0; // PENTING: Reset roundsPlayed untuk setiap perlawanan baru

    // Pastikan currentUserId wujud sebelum menghasilkan currentMatchId
    if (!currentUserId) {
        console.error("startNewMatch: currentUserId is null. Cannot create new match ID."); // DEBUG
        if (matchTitle) matchTitle.textContent = "Ralat: Sila log masuk semula.";
        // Mungkin perlu pemberitahuan kepada pengguna atau cuba semula selepas kelewatan
        return; // Hentikan fungsi jika tiada currentUserId
    }

    currentMatchId = push(ref(db, `matchHistory/${currentUserId}`)).key;
    console.log("startNewMatch: New match ID created:", currentMatchId); // DEBUG

    if (matchTitle) matchTitle.textContent = `Perlawanan #${currentMatchId.substring(currentMatchId.length - 5)}`;
    
    updateCurrentRoundScoreDisplay();
    updateTriesDisplay();

    if (resultDisplay) {
        resultDisplay.textContent = "Pilih salah satu untuk mulakan!";
        resultDisplay.className = '';
    }
    if (playerChoiceDisplay) playerChoiceDisplay.textContent = "❓";
    if (computerChoiceDisplay) computerChoiceDisplay.textContent = "❓";
    
    toggleChoiceButtons(false); // Pastikan butang aktif untuk perlawanan baru
    if (resetMatchButton) resetMatchButton.style.display = 'none';
    console.log("startNewMatch: New match setup complete. Buttons enabled."); // DEBUG
}

async function finalizeMatch() {
    console.log("finalizeMatch: Finalizing match."); // DEBUG
    let matchOutcome = 'Seri';
    if (roundWins > roundLosses) {
        matchOutcome = 'Menang';
        totalPlayerWins++;
    } else if (roundLosses > roundWins) {
        matchOutcome = 'Kalah';
        totalPlayerLosses++;
    } else {
        totalPlayerDraws++;
    }

    if (resultDisplay) {
        resultDisplay.textContent = `Perlawanan Tamat! Keputusan: Anda ${matchOutcome} (${roundWins}-${roundLosses}-${roundDraws}). Klik 'Main Semula'.`;
        resultDisplay.className = matchOutcome === 'Menang' ? 'win' : (matchOutcome === 'Kalah' ? 'lose' : 'draw');
    }
    
    toggleChoiceButtons(true); // Lumpuhkan butang selepas perlawanan tamat
    if (resetMatchButton) resetMatchButton.style.display = 'inline-block'; // Tunjukkan butang Main Semula

    if (currentUserId && currentMatchId) {
        const matchData = {
            matchId: currentMatchId,
            userId: currentUserId,
            finalScore: `${roundWins}-${roundLosses}-${roundDraws}`,
            outcome: matchOutcome,
            timestamp: serverTimestamp()
        };
        try {
            await set(ref(db, `matchHistory/${currentUserId}/${currentMatchId}`), matchData);
            console.log("finalizeMatch: Match record saved to Firebase."); // DEBUG
        } catch(error) {
            console.error("finalizeMatch: Error saving match record:", error); // DEBUG
        }
    }
    await updatePlayerOverallScore(); // Kemas kini skor keseluruhan pemain di Firebase
    updateOverallScoreDisplay(); // Kemas kini paparan skor keseluruhan
    loadMatchHistory(); // Muat semula sejarah perlawanan
}

if (btnBatu) btnBatu.addEventListener('click', () => playRound('Batu'));
if (btnAir) btnAir.addEventListener('click', () => playRound('Air'));
if (btnCawan) btnCawan.addEventListener('click', () => playRound('Cawan'));
if (resetMatchButton) resetMatchButton.addEventListener('click', startNewMatch);

async function loadPlayerOverallScore() {
    if (!currentUserId) {
        console.log("loadPlayerOverallScore: No currentUserId, cannot load score."); // DEBUG
        return;
    }
    console.log("loadPlayerOverallScore: Loading overall score for user:", currentUserId); // DEBUG
    const scoreRef = ref(db, `playerScores/${currentUserId}`);
    try {
        const snapshot = await get(scoreRef);
        if (snapshot.exists()) {
            const scores = snapshot.val();
            totalPlayerWins = scores.wins || 0;
            totalPlayerLosses = scores.losses || 0;
            totalPlayerDraws = scores.draws || 0;
            console.log("loadPlayerOverallScore: Score loaded:", scores); // DEBUG
        } else {
            totalPlayerWins = 0;
            totalPlayerLosses = 0;
            totalPlayerDraws = 0;
            console.log("loadPlayerOverallScore: No score record found, initialized to 0."); // DEBUG
        }
    } catch (error) {
        console.error("loadPlayerOverallScore: Error loading player score:", error); // DEBUG
        // Tetapkan skor kepada 0 jika ada ralat memuatkan
        totalPlayerWins = 0;
        totalPlayerLosses = 0;
        totalPlayerDraws = 0;
    }
    updateOverallScoreDisplay();
}

async function updatePlayerOverallScore() {
    if (!currentUserId) {
        console.log("updatePlayerOverallScore: No currentUserId, cannot update score."); // DEBUG
        return;
    }
    console.log("updatePlayerOverallScore: Updating overall score for user:", currentUserId); // DEBUG
    const scoreData = {
        wins: totalPlayerWins,
        losses: totalPlayerLosses,
        draws: totalPlayerDraws,
        lastUpdated: serverTimestamp()
    };
    try {
        await set(ref(db, `playerScores/${currentUserId}`), scoreData);
        console.log("updatePlayerOverallScore: Overall score updated in Firebase."); // DEBUG
    } catch(error) {
        console.error("updatePlayerOverallScore: Error updating player score:", error); // DEBUG
    }
}

function loadMatchHistory() {
    if (!currentUserId || !matchHistoryTableBody) {
        console.log("loadMatchHistory: Conditions not met (no currentUserId or table body)."); // DEBUG
        if (matchHistoryTableBody) { // Jika table body ada tapi tiada user
             matchHistoryTableBody.innerHTML = '<tr><td colspan="6">Sila log masuk untuk melihat sejarah perlawanan.</td></tr>';
        }
        return;
    }
    console.log("loadMatchHistory: Loading match history for user:", currentUserId); // DEBUG

    const matchHistoryRef = query(ref(db, `matchHistory/${currentUserId}`), orderByChild('timestamp'));
    onValue(matchHistoryRef, (snapshot) => {
        matchHistoryTableBody.innerHTML = '';
        if (snapshot.exists()) {
            console.log("loadMatchHistory: Match history data found."); // DEBUG
            let matchesArray = [];
            snapshot.forEach((childSnapshot) => {
                matchesArray.push({ key: childSnapshot.key, ...childSnapshot.val() });
            });
            matchesArray.reverse();

            matchesArray.forEach((matchData) => {
                const row = matchHistoryTableBody.insertRow();
                row.insertCell().textContent = matchData.timestamp ? new Date(matchData.timestamp).toLocaleString('ms-MY', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                row.insertCell().textContent = "-";
                row.insertCell().textContent = "-";
                row.insertCell().textContent = matchData.outcome || 'N/A';
                row.insertCell().textContent = matchData.finalScore || 'N/A';

                const actionsCell = row.insertCell();
                actionsCell.classList.add('action-buttons');
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Padam';
                deleteButton.classList.add('delete-btn');
                deleteButton.onclick = () => deleteMatchRecord(matchData.key);
                actionsCell.appendChild(deleteButton);
            });
        } else {
            console.log("loadMatchHistory: No match history data found for user."); // DEBUG
            matchHistoryTableBody.innerHTML = '<tr><td colspan="6">Tiada rekod perlawanan lagi.</td></tr>';
        }
    }, (error) => { // Tambah error callback untuk onValue
        console.error("loadMatchHistory: Error listening to match history:", error); // DEBUG
        matchHistoryTableBody.innerHTML = '<tr><td colspan="6">Ralat memuatkan sejarah perlawanan.</td></tr>';
    });
}

async function deleteMatchRecord(matchId) {
    if (!currentUserId || !matchId) return;
    console.log(`deleteMatchRecord: Attempting to delete match ${matchId} for user ${currentUserId}`); // DEBUG
    if (confirm("Adakah anda pasti mahu memadam rekod perlawanan ini?")) {
        try {
            await remove(ref(db, `matchHistory/${currentUserId}/${matchId}`));
            await remove(ref(db, `matchDetails/${currentUserId}/${matchId}`));
            console.log(`deleteMatchRecord: Match ${matchId} deleted successfully.`); // DEBUG
            if (resultDisplay) {
                resultDisplay.textContent = "Rekod perlawanan berjaya dipadam.";
                resultDisplay.className = 'win';
            }
        } catch (error) {
            console.error("Ralat memadam rekod:", error); // DEBUG
            if (resultDisplay) {
                resultDisplay.textContent = "Gagal memadam rekod.";
                resultDisplay.className = 'lose';
            }
        }
    }
}

// Pastikan startNewMatch hanya dipanggil selepas auth state disahkan dan user ada.
// onAuthStateChanged sudah menguruskan ini.