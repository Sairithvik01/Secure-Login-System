/* ================================================================
   Firebase Configuration
   Using Firebase Compat SDK (v10.12.0)
   ================================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBz6znSTvXCEX3eluhSCJT4LGcFLbWUQpk",
  authDomain: "login-36e5f.firebaseapp.com",
  projectId: "login-36e5f",
  storageBucket: "login-36e5f.firebasestorage.app",
  messagingSenderId: "283593870033",
  appId: "1:283593870033:web:e78ea86024bbacd31fd3f0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Configure auth persistence - keep user logged in across browser sessions
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

// Make globally available
window.auth = auth;
window.db = db;

console.log("%c🔒 SecureAuth Firebase initialized", "color: #6366f1; font-weight: bold;");
