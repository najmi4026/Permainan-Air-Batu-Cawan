// firebase-config.js

// Import fungsi yang anda perlukan daripada SDK yang anda perlukan
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCkA7XZf1DYk1YgAHyFxFuzVMgAO-dFHGM",
  authDomain: "permainan-batu-air-cawan-65bf8.firebaseapp.com",
  databaseURL: "https://permainan-batu-air-cawan-65bf8-default-rtdb.firebaseio.com",
  projectId: "permainan-batu-air-cawan-65bf8",
  storageBucket: "permainan-batu-air-cawan-65bf8.firebasestorage.app",
  messagingSenderId: "297311002773",
  appId: "1:297311002773:web:89c5526afdcc973cd73b9c"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db };