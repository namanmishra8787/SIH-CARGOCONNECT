// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  projectId: 'studio-5486242680-a5871',
  appId: '1:958931735470:web:fb62c8e73e7e9a75b6ee3f',
  storageBucket: 'studio-5486242680-a5871.firebasestorage.app',
  apiKey: 'AIzaSyCo2p4nmzpQhsMavnP03i5W7YAeOyls99E',
  authDomain: 'studio-5486242680-a5871.firebaseapp.com',
  measurementId: '',
  messagingSenderId: '958931735470',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export default app;
