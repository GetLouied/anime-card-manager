// ⚠️ IMPORTANT: Replace this with YOUR Firebase configuration
// Get this from: Firebase Console → Project Settings → Your apps → Web app

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD0whH46vSTADsO-L9Ljrti2NydJ-b0Pb4",
  authDomain: "pvp-filter.firebaseapp.com",
  databaseURL: "https://pvp-filter-default-rtdb.firebaseio.com",
  projectId: "pvp-filter",
  storageBucket: "pvp-filter.firebasestorage.app",
  messagingSenderId: "915240558490",
  appId: "1:915240558490:web:558dbf1a34cf19f97ba423",
  measurementId: "G-MFBDPDM186"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);