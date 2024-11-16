import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCTO-MBdW27e2tixsNybGZWi4sHX0w9nB4",
  authDomain: "praya2-37af3.firebaseapp.com",
  projectId: "praya2-37af3",
  storageBucket: "praya2-37af3.appspot.com",
  messagingSenderId: "899338911090",
  appId: "1:899338911090:web:0d1ae72cdce99441a6b1eb",
  measurementId: "G-NMX3QGV96G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };