// Pinkspring Personal Authentication Service (Single-User Owner)

class AuthService {
    constructor() {
        this.currentUser = null;
        this.listeners = [];
        this.init();
    }

    init() {
        const savedSession = localStorage.getItem("pinkspring_owner_logged_in");
        if (savedSession === "true") {
            // Fetch owner profile from db
            this.currentUser = window.db.getOwner();
        }
    }

    onAuthStateChanged(callback) {
        this.listeners.push(callback);
        callback(this.currentUser);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notify() {
        this.listeners.forEach(cb => cb(this.currentUser));
    }

    // Google Sign-In: Links the owner to their account
    loginWithOwnerGoogle(googleEmail) {
        if (window.FIREBASE_ACTIVE && window.firebaseLogin) {
            window.firebaseLogin();
            return;
        }
        // Simulating that the owner logs in with their Google account email
        const owner = window.db.getOwner();
        
        this.currentUser = owner;
        localStorage.setItem("pinkspring_owner_logged_in", "true");
        this.notify();
        return owner;
    }

    logout() {
        if (window.FIREBASE_ACTIVE && window.firebaseLogout) {
            window.firebaseLogout();
            return;
        }
        this.currentUser = null;
        localStorage.setItem("pinkspring_owner_logged_in", "false");
        this.notify();
    }

    updateOwnerProfile(updatedData) {
        const updated = window.db.saveOwner(updatedData);
        this.currentUser = updated;
        this.notify();
        return updated;
    }
}

window.auth = new AuthService();
