# Pinkspring 🌸✨

Pinkspring is a premium, beautiful, and private Q&A social network with gorgeous glassmorphic cards and customizable pink theme palettes. It is inspired by Revospring/Retrospring and allows users to receive questions (both identified and anonymous), reply to them, like answers, and share profiles.

---

## Features

1. **Four Unique Pink Themes**: 
   - **Sakura Soft (Default)**: Sweet, pastel pink with cream tones.
   - **Bubblegum Pop**: Playful, vibrant pink with high contrast.
   - **Cyber Magenta (Dark Mode)**: Rich dark background with glowing neon-pink details.
   - **Rose Quartz (Warm Dark)**: Soft warm chocolate and gold-rose tones.
2. **Google OAuth Simulation**: Secure log in simulation showing Google popup consent forms and mock database creation.
3. **Q&A Dashboard**:
   - **Inbox**: Receive questions anonymously or from logged-in users. Click "Answer" to drop-down a reply field, or click "Delete/Block".
   - **My Q&As**: View your answered questions and delete any if you change your mind.
   - **Profile Settings**: Dynamically update your display name, handle username, bio, anonymous setting toggle, and theme.
4. **Explore Space**: Find and search other user profiles, and view a global social timeline of public Q&As.
5. **Liking & Sharing**: Heart button likes on answers, and copyable profile share links.

---

## How to Run Locally

Since this is built as a zero-dependency, static Single Page Application (SPA) using HTML, Vanilla CSS, and JavaScript, you can run it instantly:

1. **Direct File System**: Double-click [index.html](file:///C:/Users/arang/.gemini/antigravity/scratch/pinkspring/index.html) in your Windows File Explorer. It will open and run perfectly in Chrome, Edge, Firefox, or any modern browser.
2. **Local Server (Optional)**: If you'd like to run it on a local HTTP port, you can run this command in PowerShell:
   ```powershell
   Start-Process "http://localhost:8000"; php -S localhost:8000
   # or with Python:
   python -m http.server 8000
   ```

---

## Project Structure

- [index.html](file:///C:/Users/arang/.gemini/antigravity/scratch/pinkspring/index.html): Defines the structure of all pages (Landing, Dashboard, Profile, Explore) and the layout modal.
- [styles.css](file:///C:/Users/arang/.gemini/antigravity/scratch/pinkspring/styles.css): Complete styling sheets detailing CSS custom variables for pink themes, glassmorphism, responsive grid layouts, custom scrollbars, and card micro-animations.
- [db.js](file:///C:/Users/arang/.gemini/antigravity/scratch/pinkspring/db.js): Handles database CRUD actions (fetching/saving questions, answers, likes) using `localStorage`. Pre-populated with mock users like Sakura Princess and Candy Peach.
- [auth.js](file:///C:/Users/arang/.gemini/antigravity/scratch/pinkspring/auth.js): Handles session management, logging in as mock profiles, and simulating Google Sign-in payload creations.
- [app.js](file:///C:/Users/arang/.gemini/antigravity/scratch/pinkspring/app.js): App controller orchestrating view switches (hash routing), binding event listeners, dynamically creating and destroying DOM elements, and triggering toast notifications.

---

## Upgrading to Real Firebase & Google Authentication

To make Pinkspring fully public so "many users can use it" with real Google logins and shared databases, follow these steps:

### 1. Set Up Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Create a Project**.
2. Go to **Build > Authentication** and click **Get Started**. Enable the **Google** sign-in provider.
3. Go to **Build > Firestore Database** and click **Create Database**. Start in "production mode" or "test mode".

### 2. Connect Firebase Client in Javascript
Inside `C:/Users/arang/.gemini/antigravity/scratch/pinkspring/`, load Firebase modules directly from the official Google CDN via ES6 import script tags.

For example, update your script loading in `index.html` to:
```html
<script type="module">
  // Import the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
  import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
  import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Link these to window.auth and window.db to replace the local mock files!
</script>
```

### 3. Replace Auth Methods with Firebase Auth
In `auth.js`, replace `loginWithGoogle` with the real Firebase popup code:
```javascript
const provider = new GoogleAuthProvider();

async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user already exists in Firestore users collection
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    let profileData;
    if (!userSnap.exists()) {
      // Create new user profile in DB
      profileData = {
        id: user.uid,
        handle: user.email.split('@')[0],
        displayName: user.displayName,
        avatar: user.photoURL,
        bio: "New Pinkspringer 🌸",
        theme: "sakura",
        allowAnonymous: true,
        followers: 0
      };
      await setDoc(userRef, profileData);
    } else {
      profileData = userSnap.data();
    }
    
    // Update local app state
    window.auth.currentUser = profileData;
    window.auth.notify();
  } catch (error) {
    console.error("Sign in failed", error);
  }
}
```

---

## Hosting & Sharing

Since the app has no backend server code (serverless client-side), you can host it for free on any static web host:

1. **GitHub Pages**: Upload the folder to a GitHub repository and enable Pages in settings.
2. **Vercel / Netlify**: Connect your repository or drag-and-drop the folder onto their dashboard. It will deploy in 5 seconds.
3. **Firebase Hosting**: Run `firebase init hosting` and set the public folder to the current directory, then run `firebase deploy`.

---

## Setting Up Clickable Card Previews (Dynamic Open Graph Metadata)

When sharing a profile or a Q&A on social networks like X (Twitter), Facebook, or Bluesky, the platforms scrape the target website's header meta tags to generate the clickable preview card (image, title, description).

Because this is a client-side Single Page Application (SPA), the standard `index.html` header has static fallback tags. To achieve dynamic cards showing the exact question and answer content (e.g. *"Sakura Princess answered: [Question]"* and the card description showing *"Answer text..."*), you should implement a simple edge function to intercept crawlers.

### Node.js / Vercel Edge Serverless Function Example
Create a file named `api/share.js` (for Vercel/Netlify deployments):

```javascript
// api/share.js
export default async function handler(req, res) {
  const { handle, qId } = req.query;
  const userAgent = req.headers['user-agent'] || '';

  // 1. Detect if the requester is a social media crawler bot
  const isBot = /Twitterbot|facebookexternalhit|Bluesky|LinkedInBot|Discordbot/i.test(userAgent);

  if (isBot) {
    // 2. Fetch Q&A details from your database (e.g. Firestore)
    // const user = await db.getUserByHandle(handle);
    // const q = await db.getQuestionById(qId);
    
    const title = handle ? `${handle} answered a question on Pinkspring:` : "Pinkspring Q&A";
    const desc = "Click here to read the conversation and ask questions!";
    const image = "https://roryaskme.netlify.app/assets/default-logo.png"; // Fallback banner or user photo
    const url = `https://roryaskme.netlify.app/#u/${handle}`;

    // 3. Return a minimal HTML response filled with Open Graph meta tags for the crawler
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <!-- Open Graph -->
          <meta property="og:type" content="website">
          <meta property="og:title" content="${title}">
          <meta property="og:description" content="${desc}">
          <meta property="og:image" content="${image}">
          <meta property="og:url" content="${url}">
          <!-- Twitter Cards -->
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="${title}">
          <meta name="twitter:description" content="${desc}">
          <meta name="twitter:image" content="${image}">
        </head>
        <body>
          <p>Redirecting to profile...</p>
          <script>window.location.href = "${url}";</script>
        </body>
      </html>
    `);
  }

  // 4. If a normal human user clicks it, redirect them to the SPA view
  return res.redirect(302, `/#u/${handle}`);
}
```
Using this setup, social platforms will display the dynamic clickable card preview containing your specific profile photo and the exact Q&A response, while users are instantly routed to your pink profile dashboard!
