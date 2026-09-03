import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB7m1aXpOED9SDO3KWcL_GwnAFprfRMpSw",
    authDomain: "scheme-sathi-sih.firebaseapp.com",
    projectId: "scheme-sathi-sih",
    storageBucket: "scheme-sathi-sih.firebasestorage.app",
    messagingSenderId: "988256179826",
    appId: "1:988256179826:web:501c6674206e113f0794eb",
    measurementId: "G-75YP32HKL8"
  };

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);