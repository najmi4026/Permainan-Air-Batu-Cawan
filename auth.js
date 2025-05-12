// auth.js
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const messageArea = document.getElementById('message-area');

// Pantau status pengesahan
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Jika pengguna log masuk dan berada di halaman login/signup, arahkan ke index.html
    if (window.location.pathname.includes('loginSignup.html')) {
      window.location.href = 'index.html';
    }
  } else {
    // Jika pengguna tidak log masuk dan berada di halaman index.html, arahkan ke loginSignup.html
    // Kecuali jika kita sedang dalam proses logout dari index.html
    if (window.location.pathname.includes('index.html') && !sessionStorage.getItem('loggingOut')) {
        window.location.href = 'loginSignup.html';
    }
    sessionStorage.removeItem('loggingOut'); // Bersihkan flag selepas digunakan
  }
});

// Fungsi untuk memaparkan mesej
function showMessage(message, isSuccess = true) {
  messageArea.textContent = message;
  messageArea.className = 'message-area'; // Reset kelas
  if (isSuccess) {
    messageArea.classList.add('success');
  } else {
    messageArea.classList.add('error');
  }
  setTimeout(() => {
    messageArea.textContent = '';
    messageArea.className = 'message-area';
  }, 5000); // Mesej hilang selepas 5 saat
}

// Event listener untuk borang pendaftaran (Signup)
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      showMessage("Kata laluan dan sahkan kata laluan tidak sepadan.", false);
      return;
    }

    if (password.length < 6) {
      showMessage("Kata laluan mestilah sekurang-kurangnya 6 aksara.", false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Simpan maklumat tambahan pengguna (nama pertama, nama akhir) ke Realtime Database
      await set(ref(db, 'users/' + user.uid), {
        firstName: firstName,
        lastName: lastName,
        email: email
      });

      showMessage("Pendaftaran berjaya! Anda akan dialihkan...", true);
      // Tidak perlu redirect manual di sini, onAuthStateChanged akan uruskan
      // setTimeout(() => {
      //   window.location.href = 'index.html';
      // }, 2000);
    } catch (error) {
      console.error("Ralat pendaftaran:", error);
      let friendlyMessage = "Pendaftaran gagal. Sila cuba lagi.";
      if (error.code === 'auth/email-already-in-use') {
        friendlyMessage = "Alamat emel ini sudah digunakan.";
      } else if (error.code === 'auth/weak-password') {
        friendlyMessage = "Kata laluan terlalu lemah.";
      }
      showMessage(friendlyMessage, false);
    }
  });
}

// Event listener untuk borang log masuk (Login)
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showMessage("Log masuk berjaya! Anda akan dialihkan...", true);
      // Tidak perlu redirect manual di sini, onAuthStateChanged akan uruskan
      // setTimeout(() => {
      //   window.location.href = 'index.html';
      // }, 2000);
    } catch (error) {
      console.error("Ralat log masuk:", error);
      let friendlyMessage = "Log masuk gagal. Sila semak emel dan kata laluan anda.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        friendlyMessage = "Emel atau kata laluan tidak sah.";
      }
      showMessage(friendlyMessage, false);
    }
  });
}

// Event listener untuk pautan "Lupa kata laluan"
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = prompt("Sila masukkan alamat emel anda untuk set semula kata laluan:");
    if (email) {
      try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Emel set semula kata laluan telah dihantar ke " + email, true);
      } catch (error) {
        console.error("Ralat hantar emel set semula kata laluan:", error);
        showMessage("Gagal menghantar emel set semula kata laluan. Pastikan emel adalah sah.", false);
      }
    }
  });
}

// Fungsi Logout (akan dipanggil dari index.html)
// Pastikan ia dieksport jika perlu atau letakkan dalam skop global jika index.html memanggilnya secara terus
window.handleLogout = async function() { // Jadikan global untuk dipanggil dari index.html
  sessionStorage.setItem('loggingOut', 'true'); // Set flag sebelum logout
  try {
    await signOut(auth);
    // onAuthStateChanged akan menguruskan pengalihan ke loginSignup.html
    // Tidak perlu redirect manual di sini
    // window.location.href = 'loginSignup.html';
  } catch (error) {
    console.error("Ralat log keluar: ", error);
    showMessage("Gagal untuk log keluar.", false);
    sessionStorage.removeItem('loggingOut'); // Bersihkan flag jika ada ralat
  }
};