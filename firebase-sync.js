// Pinkspring Firebase Synchronization Module (Real-Time Connector)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Check if a valid Firebase configuration is provided
if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
    console.log("Pinkspring: Live Firebase configuration found. Initializing public real-time database...");

    const app = initializeApp(window.FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);

    window.FIREBASE_ACTIVE = true;

    // --- REAL-TIME DATA SYNC ---
    
    // 1. Sync Owner Document
    const ownerDocRef = doc(db, "owners", "rue");
    
    // Ensure owner document exists in database
    getDoc(ownerDocRef).then((snap) => {
        if (!snap.exists()) {
            const initialOwner = JSON.parse(localStorage.getItem("pinkspring_owner")) || {
                id: "owner_rue",
                handle: "wlwruweh",
                displayName: "rue",
                avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23ffccd5'/><text x='50' y='60' font-size='40' text-anchor='middle'>🌸</text></svg>",
                header: "linear-gradient(45deg, #ff9a9e 0%, #fecfef 100%)",
                bio: "From the moment humanity left the universe, we all forgot about God. But if belief in God is human. If all I can do as a human is to believe... My God, my universe.",
                sidebarBio: "rue 20+\nshe/her\nhonyeitsu on tiktok\nwriting only for every ship that i love",
                website: "x.com",
                askPrompt: "Type your question here...",
                askPlaceholder: "Type your question here...",
                theme: "sakura",
                allowAnonymous: true,
                followers: 1,
                following: 1,
                twitter: "wlwruweh",
                twitter2: "",
                tiktok: "honyeitsu",
                tiktok2: "",
                discord: "",
                discord2: "",
                discordServer: "",
                ao3: "",
                adminEmail: ""
            };
            setDoc(ownerDocRef, initialOwner);
        }
    });

    onSnapshot(ownerDocRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            let needsUpdate = false;
            if (data.adminEmail === undefined) {
                data.adminEmail = "";
                needsUpdate = true;
            }
            if (needsUpdate) {
                setDoc(ownerDocRef, { adminEmail: data.adminEmail || "" }, { merge: true });
            }
            
            localStorage.setItem("pinkspring_owner", JSON.stringify(data));
            // Notify auth and app elements to re-render
            if (window.auth && window.auth.notify) {
                // If logged in locally, update auth currentUser reference
                if (localStorage.getItem("pinkspring_owner_logged_in") === "true") {
                    window.auth.currentUser = data;
                }
                window.auth.notify();
            }
            window.dispatchEvent(new Event("pinkspring_db_sync"));
        }
    });

    // 2. Sync Questions Collection
    const questionsCol = collection(db, "questions");
    
    // Seed database if questions collection is completely empty
    getDocs(questionsCol).then((snap) => {
        if (snap.empty) {
            const initialQs = JSON.parse(localStorage.getItem("pinkspring_questions")) || [];
            initialQs.forEach(q => {
                addDoc(questionsCol, {
                    senderName: q.senderName,
                    text: q.text,
                    createdAt: q.createdAt,
                    answeredAt: q.answeredAt,
                    answer: q.answer,
                    likes: q.likes || [],
                    isAnonymous: q.isAnonymous || false
                });
            });
        }
    });

    onSnapshot(questionsCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
        });
        
        // Save to local storage for synchronous app reads
        localStorage.setItem("pinkspring_questions", JSON.stringify(list));
        
        // Refresh counts and trigger visual updates
        if (window.auth && window.auth.notify) {
            window.auth.notify();
        }
        window.dispatchEvent(new Event("pinkspring_db_sync"));
    });

    // --- WRITE ACTIONS (EXPOSED OVERRIDES) ---

    window.firebaseAskQuestion = async (text, senderName, isAnonymous, parentQuestionId = null) => {
        try {
            await addDoc(questionsCol, {
                senderName: isAnonymous ? "Anonymous" : (senderName ? senderName.trim() : "Friend"),
                text: text,
                createdAt: new Date().toISOString(),
                answeredAt: null,
                answer: null,
                likes: [],
                comments: [],
                parentQuestionId: parentQuestionId,
                isAnonymous: !!isAnonymous
            });
        } catch (e) {
            console.error("Firebase askQuestion error", e);
        }
    };

    window.firebaseCreatePost = async (text) => {
        try {
            await addDoc(questionsCol, {
                senderName: null,
                text: "",
                isPost: true,
                createdAt: new Date().toISOString(),
                answeredAt: new Date().toISOString(),
                answer: text,
                likes: [],
                comments: []
            });
        } catch (e) {
            console.error("Firebase createPost error", e);
        }
    };

    window.firebaseAddComment = async (itemId, text, senderName) => {
        try {
            const docRef = doc(db, "questions", itemId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const comments = data.comments || [];
                comments.push({
                    id: "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                    senderName: senderName ? senderName.trim() : "Anonymous",
                    text: text,
                    createdAt: new Date().toISOString()
                });
                await updateDoc(docRef, { comments: comments });
            }
        } catch (e) {
            console.error("Firebase addComment error", e);
        }
    };

    window.firebaseAnswerQuestion = async (questionId, answerText) => {
        try {
            const docRef = doc(db, "questions", questionId);
            await updateDoc(docRef, {
                answer: answerText,
                answeredAt: new Date().toISOString()
            });
        } catch (e) {
            console.error("Firebase answerQuestion error", e);
        }
    };

    window.firebaseUpdateSenderName = async (questionId, newName) => {
        try {
            const docRef = doc(db, "questions", questionId);
            await updateDoc(docRef, {
                senderName: newName ? newName.trim() : "Anonymous"
            });
        } catch (e) {
            console.error("Firebase updateSenderName error", e);
        }
    };

    window.firebaseDeleteQuestion = async (questionId) => {
        try {
            const docRef = doc(db, "questions", questionId);
            await deleteDoc(docRef);
        } catch (e) {
            console.error("Firebase deleteQuestion error", e);
        }
    };

    window.firebaseLikeAnswer = async (questionId, visitorSessionId) => {
        try {
            const docRef = doc(db, "questions", questionId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const likes = data.likes || [];
                const idx = likes.indexOf(visitorSessionId);
                if (idx === -1) {
                    likes.push(visitorSessionId);
                } else {
                    likes.splice(idx, 1);
                }
                await updateDoc(docRef, { likes: likes });
            }
        } catch (e) {
            console.error("Firebase likeAnswer error", e);
        }
    };

    window.firebaseSaveOwner = async (ownerData) => {
        try {
            await setDoc(ownerDocRef, ownerData, { merge: true });
        } catch (e) {
            console.error("Firebase saveOwner error", e);
        }
    };

    // --- GOOGLE AUTHENTICATION INTEGRATION ---

    const provider = new GoogleAuthProvider();

    window.firebaseLogin = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Check owner administration whitelist logic
            const docSnap = await getDoc(ownerDocRef);
            let adminEmail = "";
            if (docSnap.exists()) {
                const data = docSnap.data();
                adminEmail = data.adminEmail || "";
                
                if (!adminEmail) {
                    // First login locks ownership!
                    adminEmail = user.email;
                    await setDoc(ownerDocRef, { adminEmail: user.email }, { merge: true });
                    console.log(`Pinkspring: ${user.email} claimed sole ownership of this Q&A site!`);
                }
            } else {
                // Safe fallback creation
                adminEmail = user.email;
                await setDoc(ownerDocRef, {
                    id: "owner_rue",
                    handle: "wlwruweh",
                    displayName: "rue",
                    bio: "⊹₊˚‧︵‿₊୨ᰔ Roryaskme! ᰔ ୧₊‿︵‧˚₊⊹\n╰┈➤ Rue’s official digital fallout shelter.\n\n.ᐟ Welcome! I’m Rue—part-time AU enthusiast, full-time struggling uni student, and professional multi-shipper XD. 𐔌՞. .՞𐦯 I spend 90% of my time writing alternative universes and 10% fighting for my life sa uni para lang tumagos. My shipping tastes are \"yes,\" and my fandoms are \"all of them.\"\n\n⤹⤷ System Log: This page is my digital fallout shelter in case revospring pulls a cc and crashes permanently, since the internet loves deleting our favorite Q&A sites. Feed my inbox with prompts, questions, or your favorite ships before the servers realize I'm here! 𑣲⋆",
                    sidebarBio: "rue 20+\nshe/her\nhonyeitsu on tiktok\nwriting only for every ship that i love",
                    theme: "sakura",
                    allowAnonymous: true,
                    adminEmail: user.email
                }, { merge: true });
            }
            
            if (user.email !== adminEmail) {
                await signOut(auth);
                localStorage.setItem("pinkspring_owner_logged_in", "false");
                alert(`Access Denied: ${user.email} is not authorized to manage this dashboard.`);
                if (window.auth) {
                    window.auth.currentUser = null;
                    window.auth.notify();
                }
                const owner = JSON.parse(localStorage.getItem("pinkspring_owner"));
                window.location.hash = `#u/${owner ? owner.handle : "wlwruweh"}`;
                return;
            }
            
            localStorage.setItem("pinkspring_owner_logged_in", "true");
            
            // Sync owner profile values with auth
            const owner = JSON.parse(localStorage.getItem("pinkspring_owner")) || docSnap.data();
            if (window.auth) {
                window.auth.currentUser = owner;
                window.auth.notify();
            }
            window.location.hash = "#dashboard";
        } catch (e) {
            console.error("Google Authentication failed", e);
        }
    };

    window.firebaseLogout = async () => {
        try {
            await signOut(auth);
            localStorage.setItem("pinkspring_owner_logged_in", "false");
            if (window.auth) {
                window.auth.currentUser = null;
                window.auth.notify();
            }
            window.location.hash = "#";
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    // Listen to Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docSnap = await getDoc(ownerDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const adminEmail = data.adminEmail || "";
                
                if (adminEmail && user.email !== adminEmail) {
                    // Block access and sign out
                    await signOut(auth);
                    localStorage.setItem("pinkspring_owner_logged_in", "false");
                    if (window.auth) {
                        window.auth.currentUser = null;
                        window.auth.notify();
                    }
                    const owner = JSON.parse(localStorage.getItem("pinkspring_owner"));
                    window.location.hash = `#u/${owner ? owner.handle : "wlwruweh"}`;
                    return;
                }
            }
            localStorage.setItem("pinkspring_owner_logged_in", "true");
            let owner = JSON.parse(localStorage.getItem("pinkspring_owner"));
            if (!owner && docSnap && docSnap.exists()) {
                owner = docSnap.data();
                localStorage.setItem("pinkspring_owner", JSON.stringify(owner));
            }
            if (window.auth) {
                window.auth.currentUser = owner;
                window.auth.notify();
            }
        } else {
            localStorage.setItem("pinkspring_owner_logged_in", "false");
            if (window.auth) {
                window.auth.currentUser = null;
                window.auth.notify();
            }
        }
    });

} else {
    window.FIREBASE_ACTIVE = false;
}
