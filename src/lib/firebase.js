import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
const firebaseConfig = {
  apiKey: "AIzaSyCf1FyrKRxUx9YnHYZQlJseqvGf6B_6-38",
  authDomain: "what1-298f7.firebaseapp.com",
  projectId: "what1-298f7",
  storageBucket: "what1-298f7.appspot.com",
  messagingSenderId: "89423469689",
  appId: "1:89423469689:web:516ad6a2f41975d86888a8"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth()
export const db = getFirestore()
export const storage = getStorage()
export const database = getDatabase(app);