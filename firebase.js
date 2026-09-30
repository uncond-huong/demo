// Nhập các hàm cần thiết từ Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
// Database
const firebaseConfig = {
  apiKey: "AIzaSyBGqOyIaK8K_pCfuym9YqrRR4g83jBvbYc",
  authDomain: "hikari-space-e6f88.firebaseapp.com",
  projectId: "hikari-space-e6f88",
  storageBucket: "hikari-space-e6f88.firebasestorage.app",
  messagingSenderId: "132300026099",
  appId: "1:132300026099:web:3a1790b84d5433c1310786",
  measurementId: "G-FQNGCW6RH2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, collection, addDoc, doc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, serverTimestamp, query, orderBy };