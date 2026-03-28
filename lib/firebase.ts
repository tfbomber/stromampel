// ============================================================
// lib/firebase.ts — Firebase initialization (JS SDK)
// Used for: Firestore (feedback storage)
// Note: Analytics uses @react-native-firebase (native, Phase 2)
// ============================================================

import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyABl4IWQpeut7cAzqHZWPxCBF644SdpTPs",
  authDomain:        "stromampel.firebaseapp.com",
  projectId:         "stromampel",
  storageBucket:     "stromampel.firebasestorage.app",
  messagingSenderId: "118861545814",
  appId:             "1:118861545814:web:e456a0e6cbb0c0989256f7",
  measurementId:     "G-7ZTLYRP5KW",
};

// Guard against hot-reload re-initialization
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const db = getFirestore(app);
