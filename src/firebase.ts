import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDmJAd_DE8uV_RFG52z2XsUor-TqAjatN8',
  authDomain: 'make10-47c34.firebaseapp.com',
  databaseURL: 'https://make10-47c34-default-rtdb.firebaseio.com',
  projectId: 'make10-47c34',
  storageBucket: 'make10-47c34.firebasestorage.app',
  messagingSenderId: '181201672060',
  appId: '1:181201672060:web:a0993c9fd3a8f2b4f9b6f9',
  measurementId: 'G-5SV38Q20L6',
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

let signInStarted = false;

/** 匿名認証でUIDを発行する。既にサインイン済みならそれを返す。 */
export function ensureAnonymousAuth(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user);
          return;
        }
        if (!signInStarted) {
          signInStarted = true;
          signInAnonymously(auth).catch((error) => {
            signInStarted = false;
            unsub();
            console.error('匿名認証に失敗:', error.code, error.message);
            reject(error);
          });
        }
      },
      (error) => {
        unsub();
        reject(error);
      },
    );
  });
}
