// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCd_qDf8R1DyNQL06OpWDvH1S-6XO14w2w",
  authDomain: "loot-4b9ac.firebaseapp.com",
  projectId: "loot-4b9ac",
  storageBucket: "loot-4b9ac.firebasestorage.app",
  messagingSenderId: "687537841365",
  appId: "1:687537841365:web:3b3b3ff977d35df3946e5c",
  measurementId: "G-37MMD0THQN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);