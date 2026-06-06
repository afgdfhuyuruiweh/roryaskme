// --- CONFIG & GLOBAL STATE ---
let activeTab = 'inbox'; // inbox, answers, settings
let tempAvatarBase64 = null;
let tempHeaderBase64 = null;
let activePublicTab = 'answers'; // answers, posts
let activeAskMode = 'write-post'; // write-post, ask-question
let activeQuoteItem = null;

// --- UTILITY: RENDER CONSISTENT IOS EMOJIS VIA TWEMOJI & APPLE EMOJI DATASOURCE ---
function applyIosEmojis(target) {
    if (typeof twemoji === 'undefined') return;
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    twemoji.parse(el, {
        callback: (iconId) => `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${iconId}.png`
    });
}

// Global capture-phase error listener for emoji images to handle variation selector mismatches (e.g., 2764.png vs 2764-fe0f.png)
window.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG' && e.target.classList.contains('emoji')) {
        const img = e.target;
        if (!img.getAttribute('data-fallback')) {
            img.setAttribute('data-fallback', 'true');
            const src = img.src;
            if (src.includes('-fe0f.png')) {
                img.src = src.replace('-fe0f.png', '.png');
            } else if (src.includes('.png')) {
                img.src = src.replace('.png', '-fe0f.png');
            }
        }
    }
}, true);

// --- UTILITY: VISITOR SESSION ID FOR LIKES ---
function getVisitorSessionId() {
    let visitorId = localStorage.getItem("pinkspring_visitor_id");
    if (!visitorId) {
        visitorId = "visitor_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem("pinkspring_visitor_id", visitorId);
    }
    return visitorId;
}

// --- UTILITY: APPLY HEADER BANNER ---
function applyHeaderBanner(element, headerVal) {
    if (!element) return;
    const val = headerVal || "linear-gradient(45deg, #ff9a9e 0%, #fecfef 100%)";
    if (val.startsWith('linear-gradient') || val.startsWith('radial-gradient') || val.startsWith('rgb') || val.startsWith('#')) {
        element.style.backgroundImage = 'none';
        element.style.background = val;
    } else {
        element.style.background = 'none';
        element.style.backgroundImage = `url(${val})`;
    }
}

// --- UTILITY: GET CLEAN WEBSITE LABEL ---
function getWebsiteLabel(url) {
    if (!url) return '';
    try {
        let cleaned = url.trim();
        if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
            cleaned = 'https://' + cleaned;
        }
        const parsed = new URL(cleaned);
        const host = parsed.hostname.toLowerCase().replace('www.', '');
        
        if (host.includes('archiveofourown.org') || host.includes('archiveofourown.com')) {
            return 'AO3';
        }
        if (host.includes('twitter.com') || host.includes('x.com')) {
            return 'Twitter';
        }
        if (host.includes('tiktok.com')) {
            return 'TikTok';
        }
        if (host.includes('discord.gg') || host.includes('discord.com')) {
            return 'Discord';
        }
        if (host.includes('carrd.co')) {
            return 'Carrd';
        }
        if (host.includes('linktr.ee')) {
            return 'Linktree';
        }
        if (host.includes('github.com')) {
            return 'GitHub';
        }
        if (host.includes('ko-fi.com')) {
            return 'Ko-fi';
        }
        if (host.includes('patreon.com')) {
            return 'Patreon';
        }
        if (host.includes('tumblr.com')) {
            return 'Tumblr';
        }
        if (host.includes('instagram.com')) {
            return 'Instagram';
        }
        
        return host;
    } catch (e) {
        return url.length > 25 ? url.substring(0, 22) + '...' : url;
    }
}

// --- UTILITY: TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-container');
    const toastMsg = document.getElementById('toast-message');
    
    toast.className = `toast active ${type}`;
    toastMsg.textContent = message;
    applyIosEmojis(toastMsg);
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// --- UTILITY: TIME FORMATTER ---
function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// --- UTILITY: CHECK IF QUESTION IS ANONYMOUS ---
function isQuestionAnonymous(q) {
    if (q.isAnonymous === true) return true;
    if (q.isAnonymous === false) return false;
    return !q.senderName || q.senderName === "Anonymous" || q.senderName.toLowerCase().startsWith("anon");
}

// --- UTILITY: UPDATE SHARE LINKS ---
function updateShareUrls(tweetText, profileUrl) {
    const twitterLink = document.getElementById('share-opt-twitter');
    twitterLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(profileUrl)}`;
    
    const bskyLink = document.getElementById('share-opt-bluesky');
    bskyLink.href = `https://bsky.app/intent/compose?text=${encodeURIComponent(tweetText + ' ' + profileUrl)}`;
    
    const fbLink = document.getElementById('share-opt-facebook');
    fbLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`;
}

// --- UTILITY: OPEN SHARE MODAL ---
function openShareModal(type, data = null) {
    const modal = document.getElementById('share-modal');
    const user = db.getOwner();
    
    // Construct the public URL for this user profile page
    let profileUrl;
    let originUrl = window.location.origin;
    if (originUrl === 'null' || !originUrl || originUrl.startsWith('file') || originUrl.includes('localhost')) {
        profileUrl = `https://roryaskme.netlify.app/#u/${user.handle}`;
    } else {
        profileUrl = `${originUrl}${window.location.pathname}#u/${user.handle}`;
    }
    
    let defaultTweetText = '';
    let cardTitle = '';
    let cardDesc = '';
    let cardBanner = user.avatar; // Use avatar image for summary card preview
    
    if (type === 'qa') {
        const q = data;
        document.getElementById('share-modal-title').textContent = "Share Q&A Answer";
        document.getElementById('share-modal-subtitle').textContent = "Customize your tweet text and share this answer";
        defaultTweetText = `${q.text} — ${q.answer}`;
        cardTitle = `${user.handle} answered: ${q.text}`;
        cardDesc = `Ask ${user.displayName.split(' ')[0]} anything on ask rue!`;
    } else {
        // profile share
        document.getElementById('share-modal-title').textContent = "Share Profile";
        document.getElementById('share-modal-subtitle').textContent = "Customize your tweet text and share your profile";
        defaultTweetText = `Ask me anything on ask rue! 🌸`;
        cardTitle = user.bio || `Ask ${user.displayName.split(' ')[0]} anything!`;
        cardDesc = `Ask ${user.displayName.split(' ')[0]} anything on ask rue!`;
    }
    
    // Populate X Post Preview elements
    document.getElementById('share-preview-avatar').src = user.avatar;
    document.getElementById('share-preview-name').textContent = user.displayName;
    document.getElementById('share-preview-handle').textContent = `@${user.handle}`;
    applyIosEmojis('share-preview-name');
    
    // Populate Link Card inside Post Preview
    const cardBannerEl = document.getElementById('share-preview-card-banner');
    applyHeaderBanner(cardBannerEl, cardBanner);
    document.getElementById('share-preview-card-title').textContent = cardTitle;
    document.getElementById('share-preview-card-desc').textContent = cardDesc;
    applyIosEmojis('share-preview-card-title');
    applyIosEmojis('share-preview-card-desc');
    
    // Populate Domain inside Post Preview Link Card
    const domainEl = document.getElementById('share-preview-card-domain');
    if (domainEl) {
        try {
            const urlObj = new URL(profileUrl);
            domainEl.textContent = urlObj.hostname;
        } catch (e) {
            domainEl.textContent = 'roryaskme.netlify.app';
        }
    }
    
    // Set custom tweet text input value and preview
    const textarea = document.getElementById('share-custom-text');
    textarea.value = defaultTweetText;
    const previewTextEl = document.getElementById('share-preview-text');
    previewTextEl.textContent = defaultTweetText;
    applyIosEmojis(previewTextEl);
    
    // Setup initial intent URLs
    updateShareUrls(defaultTweetText, profileUrl);
    
    // Bind real-time input to textarea to update preview & URLs live
    const newTextarea = textarea.cloneNode(true);
    textarea.parentNode.replaceChild(newTextarea, textarea);
    
    newTextarea.addEventListener('input', (e) => {
        const val = e.target.value;
        const pText = document.getElementById('share-preview-text');
        pText.textContent = val;
        applyIosEmojis(pText);
        updateShareUrls(val, profileUrl);
    });
    
    // Clicking the preview card opens the link
    document.querySelector('.preview-link-card').onclick = () => {
        window.open(profileUrl, '_blank');
    };
    
    // Setup Copy Link action
    const copyBtn = document.getElementById('share-opt-copy');
    const newCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
    
    newCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(profileUrl).then(() => {
            showToast("Profile link copied to clipboard!", "success");
            modal.classList.remove('active');
        }).catch(() => {
            showToast("Failed to copy link", "error");
        });
    });
    
    // Show Modal
    modal.classList.add('active');
}

// --- UTILITY: NAVIGATION TO PARENT Q&A / POST ---
function jumpToDashboardAnswer(parentQuestionId) {
    if (activeTab !== 'answers') {
        activeTab = 'answers';
        renderDashboard();
    }
    setTimeout(() => {
        const el = document.getElementById(`qa-card-dashboard-${parentQuestionId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'all 0.3s ease';
            el.style.boxShadow = '0 0 20px var(--accent-color)';
            el.style.borderColor = 'var(--accent-color)';
            setTimeout(() => {
                el.style.boxShadow = '';
                el.style.borderColor = '';
            }, 1500);
        } else {
            showToast("Quoted parent Q&A could not be found.", "error");
        }
    }, 100);
}

function jumpToPublicItem(itemId) {
    const parentQ = db.getQuestions().find(item => item.id === itemId);
    if (!parentQ) {
        showToast("Quoted post/Q&A has been deleted.", "error");
        return;
    }
    const isPost = parentQ.isPost || !parentQ.text;
    const targetTab = isPost ? 'posts' : 'answers';
    
    if (activePublicTab !== targetTab) {
        activePublicTab = targetTab;
        renderPublicProfile(db.getOwner());
    }
    
    setTimeout(() => {
        const el = document.getElementById(`qa-card-public-${itemId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'all 0.3s ease';
            el.style.boxShadow = '0 0 20px var(--accent-color)';
            el.style.borderColor = 'var(--accent-color)';
            setTimeout(() => {
                el.style.boxShadow = '';
                el.style.borderColor = '';
            }, 1500);
        }
    }, 100);
}

// --- AUTHENTICATION STATE OBSERVER ---
auth.onAuthStateChanged((user) => {
    updateNavbarAuth(user);
    if (user) {
        activeAskMode = 'write-post';
        // Update dashboard details
        document.getElementById('dash-sidebar-avatar').src = user.avatar;
        document.getElementById('dash-sidebar-name').textContent = user.displayName;
        applyIosEmojis('dash-sidebar-name');
        document.getElementById('dash-sidebar-handle').textContent = `@${user.handle}`;
        applyHeaderBanner(document.getElementById('dash-sidebar-banner'), user.header);
        
        const viewPublicBtn = document.getElementById('btn-view-public-profile');
        if (viewPublicBtn) {
            viewPublicBtn.href = `#u/${user.handle}`;
        }
        const landingProfileBtn = document.getElementById('btn-landing-profile');
        if (landingProfileBtn) {
            landingProfileBtn.href = `#u/${user.handle}`;
        }
        
        // Load settings inputs
        document.getElementById('settings-display-name').value = user.displayName;
        document.getElementById('settings-handle').value = user.handle;
        document.getElementById('settings-bio').value = user.bio;
        document.getElementById('settings-sidebar-bio').value = user.sidebarBio || '';
        document.getElementById('settings-website').value = user.website || '';
        document.getElementById('settings-twitter').value = user.twitter || '';
        document.getElementById('settings-twitter2').value = user.twitter2 || '';
        document.getElementById('settings-tiktok').value = user.tiktok || '';
        document.getElementById('settings-tiktok2').value = user.tiktok2 || '';
        document.getElementById('settings-discord').value = user.discord || '';
        document.getElementById('settings-discord2').value = user.discord2 || '';
        document.getElementById('settings-discord-server').value = user.discordServer || '';
        document.getElementById('settings-ao3').value = user.ao3 || '';
        document.getElementById('settings-allow-anon').checked = user.allowAnonymous;
        document.getElementById('settings-ask-prompt').value = user.askPrompt || '';
        document.getElementById('settings-ask-placeholder').value = user.askPlaceholder || '';
        
        // Previews in settings
        document.getElementById('preview-avatar-img').src = user.avatar;
        applyHeaderBanner(document.getElementById('preview-header-img'), user.header);
        tempAvatarBase64 = null;
        tempHeaderBase64 = null;
        
        // Apply user theme preferences
        document.documentElement.setAttribute('data-theme', user.theme || 'sakura');
        document.querySelectorAll('.theme-card').forEach(card => {
            if (card.dataset.themeId === user.theme) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
        
        // Refresh counts
        refreshDashboardCounts();
    } else {
        activeAskMode = 'ask-question';
        // If logged out, default to owner's choice of theme
        const owner = db.getOwner();
        document.documentElement.setAttribute('data-theme', owner.theme || 'sakura');
        
        const landingProfileBtn = document.getElementById('btn-landing-profile');
        if (landingProfileBtn && owner) {
            landingProfileBtn.href = `#u/${owner.handle}`;
        }
    }
    
    // Refresh routing to guarantee view alignment
    handleRouting();
});

// Update the Navbar based on current user
function updateNavbarAuth(user) {
    const container = document.getElementById('nav-auth-container');
    if (user) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="user-badge" id="nav-user-badge" style="cursor: pointer;">
                    <img src="${user.avatar}" alt="Avatar">
                    <span>${user.displayName.split(' ')[0]}</span>
                </div>
                <button class="btn-secondary btn-sm" id="btn-logout" style="padding: 6px 12px;">Logout</button>
            </div>
        `;
        
        document.getElementById('nav-user-badge').addEventListener('click', () => {
            window.location.hash = '#dashboard';
        });
        
        document.getElementById('btn-logout').addEventListener('click', () => {
            auth.logout();
            showToast("Logged out successfully", "info");
            window.location.hash = '#';
        });
    } else {
        container.innerHTML = `
            <button class="btn-primary btn-sm" id="btn-login-trigger">
                <span>sign in as rue</span>
            </button>
        `;
        document.getElementById('btn-login-trigger').addEventListener('click', () => {
            auth.loginWithOwnerGoogle("rue@google.com");
        });
    }
}

function refreshDashboardCounts() {
    const user = auth.currentUser;
    if (!user) return;
    const inboxQ = db.getInboxQuestions();
    const publicQA = db.getPublicQA();
    
    document.getElementById('badge-inbox-count').textContent = inboxQ.length;
    document.getElementById('badge-inbox-count').style.display = inboxQ.length > 0 ? 'inline-block' : 'none';
    
    // Count answers vs posts
    const answersCount = publicQA.filter(q => !q.isPost && q.text).length;
    const postsCount = publicQA.filter(q => q.isPost || !q.text).length;
    
    document.getElementById('dash-stat-answers').textContent = answersCount;
    const postsEl = document.getElementById('dash-stat-posts');
    if (postsEl) {
        postsEl.textContent = postsCount;
    }
}

// --- ROUTING MANAGER ---
function handleRouting() {
    const hash = window.location.hash || '#';
    
    // Hide all views
    document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
    
    if (hash === '#dashboard') {
        if (!auth.currentUser) {
            auth.loginWithOwnerGoogle("rue@google.com");
            return;
        }
        document.getElementById('dashboard-view').classList.add('active');
        renderDashboard();
    } else if (hash.startsWith('#u/')) {
        // Render Public Profile view for a specific user handle
        const owner = db.getOwner();
        document.getElementById('profile-view').classList.add('active');
        renderPublicProfile(owner);
    } else {
        // Show welcome landing portal
        document.getElementById('landing-view').classList.add('active');
        applyIosEmojis('landing-welcome-message');
    }
}

window.addEventListener('hashchange', handleRouting);
window.addEventListener('pinkspring_db_sync', handleRouting);
window.addEventListener('DOMContentLoaded', () => {
    handleRouting();
    setupEventListeners();
});

// --- DASHBOARD RENDERING (INBOX, ANSWERS, SETTINGS) ---
function renderDashboard() {
    const user = auth.currentUser;
    if (!user) return;
    
    // Manage tab buttons
    document.querySelectorAll('.sidebar-menu button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Active correct tab view
    document.querySelectorAll('.dash-content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    if (activeTab === 'inbox') {
        document.getElementById('btn-dash-inbox').classList.add('active');
        document.getElementById('dash-section-inbox').classList.add('active');
        renderInbox();
    } else if (activeTab === 'answers') {
        document.getElementById('btn-dash-answers').classList.add('active');
        document.getElementById('dash-section-answers').classList.add('active');
        renderMyAnswers();
    } else if (activeTab === 'settings') {
        document.getElementById('btn-dash-settings').classList.add('active');
        document.getElementById('dash-section-settings').classList.add('active');
    }
    
    refreshDashboardCounts();
}

// Render Inbox Questions
function renderInbox() {
    const container = document.getElementById('inbox-questions-container');
    const questions = db.getInboxQuestions();
    
    if (questions.length === 0) {
        container.innerHTML = `
            <div class="empty-state glass-panel">
                <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                <p>Your inbox is empty. Share your profile link with others to receive questions! 🌸</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = questions.map(q => {
        let quoteHtml = '';
        if (q.parentQuestionId) {
            const parentQ = db.getQuestions().find(item => item.id === q.parentQuestionId);
            if (parentQ) {
                const parentIsPost = parentQ.isPost || !parentQ.text;
                const quoteText = parentIsPost ? parentQ.answer : `Q: ${parentQ.text} — A: ${parentQ.answer}`;
                quoteHtml = `
                    <div class="quoted-card" style="background: rgba(0, 0, 0, 0.05); border-left: 4px solid var(--accent-color); padding: 10px 12px; border-radius: 8px; margin: 8px 0; font-size: 0.85rem; text-align: left; cursor: pointer; border: 1px solid var(--glass-border); border-left-width: 4px;" onclick="jumpToDashboardAnswer('${parentQ.id}')">
                        <div style="font-weight: 700; color: var(--text-secondary); font-size: 0.72rem; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            <span>Quoting @${db.getOwner().handle}</span>
                        </div>
                        <div style="color: var(--text-primary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight: 500;">
                            ${quoteText}
                        </div>
                    </div>
                `;
            }
        }
        
        const isAnon = isQuestionAnonymous(q);
        const editButton = isAnon ? `
            <button class="btn-edit-sender-name" data-id="${q.id}" title="Edit anonymous name" style="background: none; border: none; cursor: pointer; color: var(--accent-color); font-size: 0.85rem; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px; border-radius: 4px; transition: all 0.2s; vertical-align: middle;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity: 0.8;">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span style="font-size: 0.72rem; text-decoration: underline;">Edit Name</span>
            </button>
        ` : '';

        return `
            <div class="q-card glass-panel" id="q-card-${q.id}">
                <div class="q-meta">
                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    <span>Sent by <strong>${q.senderName || 'Anonymous'}</strong> ${editButton}</span>
                    <span>•</span>
                    <span>${getRelativeTime(q.createdAt)}</span>
                </div>
                <div class="q-text">${q.text}</div>
                
                ${quoteHtml}
                
                <div class="q-actions">
                    <button class="btn-primary btn-sm btn-reply-toggle" data-id="${q.id}">Answer</button>
                    <button class="btn-secondary btn-sm btn-danger btn-delete-question" data-id="${q.id}">Delete</button>
                </div>
                
                <div class="reply-form" id="reply-form-${q.id}">
                    <textarea class="input-field reply-textarea" placeholder="Type your beautiful answer here..." id="reply-text-${q.id}"></textarea>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary btn-sm btn-post-answer" data-id="${q.id}">Post Answer</button>
                        <button class="btn-secondary btn-sm btn-reply-cancel" data-id="${q.id}">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Bind actions
    container.querySelectorAll('.btn-reply-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            document.getElementById(`reply-form-${id}`).classList.toggle('active');
        });
    });
    
    container.querySelectorAll('.btn-reply-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            document.getElementById(`reply-form-${id}`).classList.remove('active');
        });
    });
    
    container.querySelectorAll('.btn-delete-question').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            db.deleteQuestion(id);
            showToast("Question deleted", "info");
            renderDashboard();
        });
    });
    
    container.querySelectorAll('.btn-post-answer').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const answerText = document.getElementById(`reply-text-${id}`).value.trim();
            if (!answerText) {
                showToast("Please enter an answer", "error");
                return;
            }
            db.answerQuestion(id, answerText);
            showToast("Answer posted successfully!", "success");
            renderDashboard();
        });
    });

    container.querySelectorAll('.btn-edit-sender-name').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const q = questions.find(item => item.id === id);
            if (q) {
                const newName = prompt("Edit display name for this anonymous sender:", q.senderName || "Anonymous");
                if (newName !== null) {
                    db.updateQuestionSenderName(id, newName);
                    showToast("Sender name updated successfully! 🎀", "success");
                    renderDashboard();
                }
            }
        });
    });
    
    applyIosEmojis(container);
}

// Render answered questions under dashboard
function renderMyAnswers() {
    const container = document.getElementById('answered-questions-container');
    const qas = db.getPublicQA();
    
    if (qas.length === 0) {
        container.innerHTML = `
            <div class="empty-state glass-panel">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                <p>You haven't answered any questions yet. Go to your Inbox to reply to questions! 💖</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = qas.map(q => {
        let quoteHtml = '';
        if (q.parentQuestionId) {
            const parentQ = db.getQuestions().find(item => item.id === q.parentQuestionId);
            if (parentQ) {
                const parentIsPost = parentQ.isPost || !parentQ.text;
                const quoteText = parentIsPost ? parentQ.answer : `Q: ${parentQ.text} — A: ${parentQ.answer}`;
                quoteHtml = `
                    <div class="quoted-card" style="background: rgba(0, 0, 0, 0.05); border-left: 4px solid var(--accent-color); padding: 10px 12px; border-radius: 8px; margin: 8px 0; font-size: 0.85rem; text-align: left; cursor: pointer; border: 1px solid var(--glass-border); border-left-width: 4px;" onclick="jumpToDashboardAnswer('${parentQ.id}')">
                        <div style="font-weight: 700; color: var(--text-secondary); font-size: 0.72rem; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            <span>Quoting @${db.getOwner().handle}</span>
                        </div>
                        <div style="color: var(--text-primary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight: 500;">
                            ${quoteText}
                        </div>
                    </div>
                `;
            }
        }

        const isAnon = isQuestionAnonymous(q);
        const editButton = isAnon ? `
            <button class="btn-edit-sender-name" data-id="${q.id}" title="Edit anonymous name" style="background: none; border: none; cursor: pointer; color: var(--accent-color); font-size: 0.85rem; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px; border-radius: 4px; transition: all 0.2s; vertical-align: middle; margin-left: 4px;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity: 0.8;">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span style="font-size: 0.72rem; text-decoration: underline;">Edit Name</span>
            </button>
        ` : '';

        return `
            <div class="q-card glass-panel" id="qa-card-dashboard-${q.id}">
                <div class="q-meta">
                    <span>Asked by <strong>${q.senderName || 'Anonymous'}</strong> ${editButton} • Answered ${getRelativeTime(q.answeredAt)}</span>
                </div>
                
                ${q.text ? `<div class="q-text" style="margin-bottom: 8px;">Q: ${q.text}</div>` : ''}
                
                ${quoteHtml}
                
                <div style="font-size: 1.05rem; padding-left: 12px; border-left: 3px solid var(--accent-color); color: var(--text-primary); margin-bottom: 16px;">
                    ${q.answer}
                </div>
                
                <div class="q-actions">
                    <button class="btn-secondary btn-sm btn-danger btn-delete-qa" data-id="${q.id}">Delete Answer</button>
                </div>
            </div>
        `;
    }).join('');
    
    container.querySelectorAll('.btn-delete-qa').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            db.deleteQuestion(id);
            showToast("Q&A deleted", "info");
            renderDashboard();
        });
    });

    container.querySelectorAll('.btn-edit-sender-name').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const q = qas.find(item => item.id === id);
            if (q) {
                const newName = prompt("Edit display name for this anonymous sender:", q.senderName || "Anonymous");
                if (newName !== null) {
                    db.updateQuestionSenderName(id, newName);
                    showToast("Sender name updated successfully! 🎀", "success");
                    renderDashboard();
                }
            }
        });
    });
    
    applyIosEmojis(container);
}

// --- PUBLIC PROFILE VIEW ---
function renderPublicProfile(user) {
    document.getElementById('pub-profile-avatar').src = user.avatar;
    document.getElementById('pub-profile-name').textContent = user.displayName;
    document.getElementById('pub-profile-handle').textContent = `@${user.handle}`;
    document.getElementById('pub-profile-sidebar-bio').innerText = user.sidebarBio || '';
    
    // Website link setup with dynamic icon based on host
    const websiteEl = document.getElementById('pub-profile-website');
    const websiteRow = document.getElementById('pub-profile-link-row');
    if (user.website) {
        websiteEl.textContent = getWebsiteLabel(user.website);
        websiteEl.href = user.website.startsWith('http') ? user.website : `https://${user.website}`;
        websiteRow.style.display = 'flex';
        
        let iconHtml = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
        `; // Default globe icon
        
        const lowered = user.website.toLowerCase();
        if (lowered.includes('twitter.com') || lowered.includes('x.com')) {
            iconHtml = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
            `;
        } else if (lowered.includes('tiktok.com')) {
            iconHtml = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.01 1.62 4.19.97 1.15 2.37 1.9 3.86 2.07v3.91c-1.24-.07-2.43-.53-3.41-1.3-.98-.77-1.68-1.87-1.99-3.08-.04 2.82-.01 5.64-.03 8.46-.02 1.4-.41 2.79-1.14 3.96-.86 1.4-2.22 2.45-3.8 2.92-1.89.59-3.99.37-5.72-.61-1.74-.97-2.98-2.69-3.37-4.68-.45-2.26.17-4.66 1.67-6.38 1.48-1.72 3.73-2.69 5.99-2.58v4.03c-1.12-.13-2.29.27-3.07 1.09-.79.82-1.1 2.05-.82 3.16.27 1.07 1.15 1.94 2.23 2.19 1.14.27 2.39-.06 3.22-.89.84-.82 1.13-2.09 1.08-3.23-.02-4.04-.01-8.08-.02-12.12z"/>
                </svg>
            `;
        } else if (lowered.includes('discord.gg') || lowered.includes('discord.com')) {
            iconHtml = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                </svg>
            `;
        } else if (lowered.includes('archiveofourown.org') || lowered.includes('archiveofourown.com')) {
            iconHtml = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19 2H6c-1.206 0-3 .799-3 3v14c0 2.201 1.794 3 3 3h13c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2zm-1 2v16H6c-.512 0-1-.189-1-.5V5c0-.311.488-.5 1-.5h12z"/>
                    <path d="M8 6h8v2H8zm0 4h8v2H8zm0 4h5v2H8z"/>
                </svg>
            `;
        }
        
        const existingIcon = websiteRow.querySelector('svg');
        if (existingIcon) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = iconHtml.trim();
            websiteRow.replaceChild(tempDiv.firstChild, existingIcon);
        }
    } else {
        websiteRow.style.display = 'none';
    }

    // Socials/Contact Box rendering
    const socialsCard = document.getElementById('pub-socials-card');
    const socialsContainer = document.getElementById('pub-socials-container');
    if (socialsCard && socialsContainer) {
        let socialsHtml = '';
        const minWidth = '110px';
        
        // 1. Twitter 1
        if (user.twitter) {
            const twitterUrl = user.twitter.startsWith('http') ? user.twitter : `https://x.com/${user.twitter.replace(/^@/, '')}`;
            const twitterHandle = user.twitter.startsWith('http') ? user.twitter.split('/').pop() : user.twitter.replace(/^@/, '');
            socialsHtml += `
                <div class="sidebar-link-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-primary);">
                    <span style="color: var(--accent-color); display: flex; align-items: center;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </span>
                    <span style="font-weight: 700; min-width: ${minWidth}; color: var(--text-secondary);">twitter:</span>
                    <a href="${twitterUrl}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">@${twitterHandle}</a>
                </div>
            `;
        }
        
        // 2. Twitter 2
        if (user.twitter2) {
            const twitterUrl = user.twitter2.startsWith('http') ? user.twitter2 : `https://x.com/${user.twitter2.replace(/^@/, '')}`;
            const twitterHandle = user.twitter2.startsWith('http') ? user.twitter2.split('/').pop() : user.twitter2.replace(/^@/, '');
            socialsHtml += `
                <div class="sidebar-link-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-primary);">
                    <span style="color: var(--accent-color); display: flex; align-items: center;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </span>
                    <span style="font-weight: 700; min-width: ${minWidth}; color: var(--text-secondary);">twitter 2:</span>
                    <a href="${twitterUrl}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">@${twitterHandle}</a>
                </div>
            `;
        }
        
        // 3. TikTok 1
        if (user.tiktok) {
            const tiktokUrl = user.tiktok.startsWith('http') ? user.tiktok : `https://www.tiktok.com/@${user.tiktok.replace(/^@/, '')}`;
            const tiktokHandle = user.tiktok.startsWith('http') ? user.tiktok.split('@').pop() : user.tiktok.replace(/^@/, '');
            socialsHtml += `
                <div class="sidebar-link-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-primary);">
                    <span style="color: var(--accent-color); display: flex; align-items: center;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.01 1.62 4.19.97 1.15 2.37 1.9 3.86 2.07v3.91c-1.24-.07-2.43-.53-3.41-1.3-.98-.77-1.68-1.87-1.99-3.08-.04 2.82-.01 5.64-.03 8.46-.02 1.4-.41 2.79-1.14 3.96-.86 1.4-2.22 2.45-3.8 2.92-1.89.59-3.99.37-5.72-.61-1.74-.97-2.98-2.69-3.37-4.68-.45-2.26.17-4.66 1.67-6.38 1.48-1.72 3.73-2.69 5.99-2.58v4.03c-1.12-.13-2.29.27-3.07 1.09-.79.82-1.1 2.05-.82 3.16.27 1.07 1.15 1.94 2.23 2.19 1.14.27 2.39-.06 3.22-.89.84-.82 1.13-2.09 1.08-3.23-.02-4.04-.01-8.08-.02-12.12z"/>
                        </svg>
                    </span>
                    <span style="font-weight: 700; min-width: ${minWidth}; color: var(--text-secondary);">tiktok:</span>
                    <a href="${tiktokUrl}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">@${tiktokHandle}</a>
                </div>
            `;
        }
        
        // 4. TikTok 2
        if (user.tiktok2) {
            const tiktokUrl = user.tiktok2.startsWith('http') ? user.tiktok2 : `https://www.tiktok.com/@${user.tiktok2.replace(/^@/, '')}`;
            const tiktokHandle = user.tiktok2.startsWith('http') ? user.tiktok2.split('@').pop() : user.tiktok2.replace(/^@/, '');
            socialsHtml += `
                <div class="sidebar-link-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-primary);">
                    <span style="color: var(--accent-color); display: flex; align-items: center;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.01 1.62 4.19.97 1.15 2.37 1.9 3.86 2.07v3.91c-1.24-.07-2.43-.53-3.41-1.3-.98-.77-1.68-1.87-1.99-3.08-.04 2.82-.01 5.64-.03 8.46-.02 1.4-.41 2.79-1.14 3.96-.86 1.4-2.22 2.45-3.8 2.92-1.89.59-3.99.37-5.72-.61-1.74-.97-2.98-2.69-3.37-4.68-.45-2.26.17-4.66 1.67-6.38 1.48-1.72 3.73-2.69 5.99-2.58v4.03c-1.12-.13-2.29.27-3.07 1.09-.79.82-1.1 2.05-.82 3.16.27 1.07 1.15 1.94 2.23 2.19 1.14.27 2.39-.06 3.22-.89.84-.82 1.13-2.09 1.08-3.23-.02-4.04-.01-8.08-.02-12.12z"/>
                        </svg>
                    </span>
                    <span style="font-weight: 700; min-width: ${minWidth}; color: var(--text-secondary);">tiktok 2:</span>
                    <a href="${tiktokUrl}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">@${tiktokHandle}</a>
                </div>
            `;
        }
        
        // 5. Discord 1
        if (user.discord) {
            const discordUrl = user.discord.startsWith('http') ? user.discord : `https://discord.com/users/${user.discord}`;
            const discordLabel = user.discord.startsWith('http') ? (user.discord.includes('invite') || user.discord.includes('discord.gg') ? 'Invite Link' : user.discord.split('/').pop()) : user.discord;
            socialsHtml += `
                <div class="sidebar-link-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-primary);">
                    <span style="color: var(--accent-color); display: flex; align-items: center;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                        </svg>
                    </span>
                    <span style="font-weight: 700; min-width: ${minWidth}; color: var(--text-secondary);">discord:</span>
                    <a href="${discordUrl}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${discordLabel}</a>
                </div>
            `;
        }
        
        // 6. Discord 2
        if (user.discord2) {
            const discordUrl = user.discord2.startsWith('http') ? user.discord2 : `https://discord.com/users/${user.discord2}`;
            const discordLabel = user.discord2.startsWith('http') ? (user.discord2.includes('invite') || user.discord2.includes('discord.gg') ? 'Invite Link' : user.discord2.split('/').pop()) : user.discord2;
            socialsHtml += `
                <div class="sidebar-link-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-primary);">
                    <span style="color: var(--accent-color); display: flex; align-items: center;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                        </svg>
                    </span>
                    <span style="font-weight: 700; min-width: ${minWidth}; color: var(--text-secondary);">discord 2:</span>
                    <a href="${discordUrl}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${discordLabel}</a>
                </div>
            `;
        }
        
        // 7. Discord Server
        if (user.discordServer) {
            const serverUrl = user.discordServer.startsWith('http') ? user.discordServer : `https://${user.discordServer}`;
            const serverLabel = user.discordServer.includes('invite') || user.discordServer.includes('discord.gg') ? 'Join Server' : (user.discordServer.startsWith('http') ? user.discordServer.split('/').pop() : user.discordServer);
            socialsHtml += `
                <div class="sidebar-link-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-primary);">
                    <span style="color: var(--accent-color); display: flex; align-items: center;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                        </svg>
                    </span>
                    <span style="font-weight: 700; min-width: ${minWidth}; color: var(--text-secondary);">discord server:</span>
                    <a href="${serverUrl}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${serverLabel}</a>
                </div>
            `;
        }
        
        // 8. AO3
        if (user.ao3) {
            const ao3Url = user.ao3.startsWith('http') ? user.ao3 : `https://archiveofourown.org/users/${user.ao3.replace(/^@/, '')}`;
            const ao3Handle = user.ao3.startsWith('http') ? user.ao3.split('/').pop() : user.ao3;
            socialsHtml += `
                <div class="sidebar-link-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-primary);">
                    <span style="color: var(--accent-color); display: flex; align-items: center;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M19 2H6c-1.206 0-3 .799-3 3v14c0 2.201 1.794 3 3 3h13c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2zm-1 2v16H6c-.512 0-1-.189-1-.5V5c0-.311.488-.5 1-.5h12z"/>
                            <path d="M8 6h8v2H8zm0 4h8v2H8zm0 4h5v2H8z"/>
                        </svg>
                    </span>
                    <span style="font-weight: 700; min-width: ${minWidth}; color: var(--text-secondary);">ao3:</span>
                    <a href="${ao3Url}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${ao3Handle}</a>
                </div>
            `;
        }
        
        if (socialsHtml) {
            socialsContainer.innerHTML = socialsHtml;
            socialsCard.style.display = 'block';
        } else {
            socialsCard.style.display = 'none';
        }
    }
    
    // Slogan box setup
    const sloganBox = document.getElementById('pub-profile-slogan');
    if (user.bio) {
        sloganBox.innerText = user.bio;
        sloganBox.style.display = 'block';
    } else {
        sloganBox.style.display = 'none';
    }
    
    // Action buttons display (Show share profile button always, show edit profile only if owner is logged in)
    const btnEdit = document.getElementById('btn-sidebar-edit');
    const btnShare = document.getElementById('btn-share-profile');
    if (auth.currentUser) {
        btnEdit.style.display = 'flex';
        btnShare.style.display = 'flex';
    } else {
        btnEdit.style.display = 'none';
        btnShare.style.display = 'flex';
    }
    
    applyHeaderBanner(document.getElementById('pub-profile-banner'), user.header);
    
    // Set custom theme profile view
    document.documentElement.setAttribute('data-theme', user.theme || 'sakura');
    
    // Set up tab badges (Answers vs. Posts)
    const allQA = db.getPublicQA();
    const answersCount = allQA.filter(q => !q.isPost && q.text).length;
    const postsCount = allQA.filter(q => q.isPost || !q.text).length;
    
    document.getElementById('tab-badge-answers').textContent = answersCount;
    document.getElementById('tab-badge-posts').textContent = postsCount;

    // Apply active/inactive styles to public tabs bar
    const tabAnswers = document.getElementById('tab-answers');
    const tabPosts = document.getElementById('tab-posts');
    const badgeAnswers = document.getElementById('tab-badge-answers');
    const badgePosts = document.getElementById('tab-badge-posts');

    if (activePublicTab === 'answers') {
        tabAnswers.style.background = 'var(--accent-color)';
        tabAnswers.style.color = '#fff';
        tabAnswers.style.fontWeight = '700';
        badgeAnswers.style.background = 'rgba(255,255,255,0.25)';
        badgeAnswers.style.color = '#fff';

        tabPosts.style.background = 'transparent';
        tabPosts.style.color = 'var(--text-secondary)';
        tabPosts.style.fontWeight = '600';
        badgePosts.style.background = 'var(--accent-soft)';
        badgePosts.style.color = 'var(--text-primary)';
    } else {
        tabPosts.style.background = 'var(--accent-color)';
        tabPosts.style.color = '#fff';
        tabPosts.style.fontWeight = '700';
        badgePosts.style.background = 'rgba(255,255,255,0.25)';
        badgePosts.style.color = '#fff';

        tabAnswers.style.background = 'transparent';
        tabAnswers.style.color = 'var(--text-secondary)';
        tabAnswers.style.fontWeight = '600';
        badgeAnswers.style.background = 'var(--accent-soft)';
        badgeAnswers.style.color = 'var(--text-primary)';
    }
    
    // Check if target user allows anonymous questions, and set up ask modes
    const askBoxModes = document.getElementById('ask-box-modes');
    const btnSubmit = document.getElementById('btn-submit-question');
    const labelAnon = document.getElementById('label-ask-anon');
    const checkAnon = document.getElementById('checkbox-ask-anon');
    const nameWrapper = document.getElementById('pub-ask-name-wrapper');
    const textarea = document.getElementById('pub-ask-textarea');

    // Update Ask Box Title dynamically
    const pubAskTitle = document.getElementById('pub-ask-title');
    if (pubAskTitle) {
        if (auth.currentUser && activeAskMode === 'write-post') {
            pubAskTitle.textContent = "Write a Post 📝";
        } else {
            pubAskTitle.textContent = user.askPrompt || "Ask me anything! 🎀";
        }
    }

    if (auth.currentUser) {
        askBoxModes.style.display = 'flex';
        
        const modePostBtn = document.getElementById('mode-write-post');
        const modeQuestionBtn = document.getElementById('mode-ask-question');
        
        if (activeAskMode === 'write-post') {
            modePostBtn.style.color = 'var(--accent-color)';
            modePostBtn.style.fontWeight = '700';
            
            modeQuestionBtn.style.color = 'var(--text-secondary)';
            modeQuestionBtn.style.fontWeight = '600';
            
            labelAnon.style.display = 'none';
            nameWrapper.style.display = 'none';
            
            textarea.placeholder = "Share an update with your followers...";
            btnSubmit.textContent = "Post";
        } else {
            modeQuestionBtn.style.color = 'var(--accent-color)';
            modeQuestionBtn.style.fontWeight = '700';
            
            modePostBtn.style.color = 'var(--text-secondary)';
            modePostBtn.style.fontWeight = '600';
            
            if (!user.allowAnonymous) {
                labelAnon.style.display = 'none';
                checkAnon.checked = false;
                nameWrapper.style.display = 'block';
                textarea.placeholder = user.askPlaceholder || "Anonymous questions are disabled. You must ask publicly!";
            } else {
                labelAnon.style.display = 'flex';
                if (checkAnon.checked) {
                    nameWrapper.style.display = 'none';
                } else {
                    nameWrapper.style.display = 'block';
                }
                textarea.placeholder = user.askPlaceholder || "Type your question here...";
            }
            btnSubmit.textContent = "Ask";
        }
    } else {
        askBoxModes.style.display = 'none';
        activeAskMode = 'ask-question';
        
        if (!user.allowAnonymous) {
            labelAnon.style.display = 'none';
            checkAnon.checked = false;
            nameWrapper.style.display = 'block';
            textarea.placeholder = user.askPlaceholder || "Anonymous questions are disabled. You must ask publicly!";
        } else {
            labelAnon.style.display = 'flex';
            if (checkAnon.checked) {
                nameWrapper.style.display = 'none';
            } else {
                nameWrapper.style.display = 'block';
            }
            textarea.placeholder = user.askPlaceholder || "Type your question here...";
        }
        btnSubmit.textContent = "Ask";
    }

    // Render quote preview banner
    const quoteContainer = document.getElementById('quote-preview-container');
    if (activeQuoteItem) {
        quoteContainer.style.display = 'block';
        quoteContainer.innerHTML = `
            <div class="glass-panel" style="background: var(--accent-soft); border-left: 4px solid var(--accent-color); padding: 10px 14px; border-radius: 10px; font-size: 0.88rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="min-width: 0; text-align: left;">
                    <span style="font-weight: 700; color: var(--text-primary); display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Quoting:</span>
                    <span style="color: var(--text-secondary); text-overflow: ellipsis; white-space: nowrap; overflow: hidden; display: block;">
                        "${activeQuoteItem.answer || activeQuoteItem.text}"
                    </span>
                </div>
                <button id="btn-clear-quote" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-secondary); font-weight: 700; padding: 0 4px; line-height: 1;">&times;</button>
            </div>
        `;
        document.getElementById('btn-clear-quote').onclick = () => {
            activeQuoteItem = null;
            renderPublicProfile(db.getOwner());
        };
    } else {
        quoteContainer.style.display = 'none';
        quoteContainer.innerHTML = '';
    }
    
    applyIosEmojis('pub-profile-name');
    applyIosEmojis('pub-profile-sidebar-bio');
    applyIosEmojis('pub-profile-slogan');
    applyIosEmojis('pub-ask-title');
    applyIosEmojis('quote-preview-container');
    
    // Load public feed
    renderPublicQAFeed();
}

function renderPublicQAFeed() {
    const container = document.getElementById('pub-answered-container');
    const allQA = db.getPublicQA();
    const owner = db.getOwner();
    
    // Filter feed based on active public tab
    let qas = [];
    if (activePublicTab === 'answers') {
        qas = allQA.filter(q => !q.isPost && q.text);
    } else {
        qas = allQA.filter(q => q.isPost || !q.text);
    }
    
    if (qas.length === 0) {
        if (activePublicTab === 'answers') {
            container.innerHTML = `
                <div class="empty-state glass-panel">
                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    <p>No answered questions on this profile yet. Be the first to ask! 🎀</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state glass-panel">
                    <svg viewBox="0 0 24 24" width="64" height="64"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="var(--text-secondary)" opacity="0.5"/></svg>
                    <p>No posts published by the owner yet. Stay tuned! 🌸</p>
                </div>
            `;
        }
        return;
    }
    
    const visitorSessionId = getVisitorSessionId();
    
    container.innerHTML = qas.map(q => {
        const hasLiked = (q.likes || []).includes(visitorSessionId);
        const likesCount = q.likes ? q.likes.length : 0;
        const isPost = q.isPost || !q.text;
        
        // Find parent quoted Q&A/post if it exists
        let quoteHtml = '';
        if (q.parentQuestionId) {
            const parentQ = db.getQuestions().find(item => item.id === q.parentQuestionId);
            if (parentQ) {
                const parentIsPost = parentQ.isPost || !parentQ.text;
                const quoteText = parentIsPost ? parentQ.answer : `Q: ${parentQ.text} — A: ${parentQ.answer}`;
                quoteHtml = `
                    <div class="quoted-card" style="background: rgba(0, 0, 0, 0.05); border-left: 4px solid var(--accent-color); padding: 10px 12px; border-radius: 8px; margin: 8px 0; font-size: 0.85rem; text-align: left; cursor: pointer; border: 1px solid var(--glass-border); border-left-width: 4px;" onclick="jumpToPublicItem('${parentQ.id}')">
                        <div style="font-weight: 700; color: var(--text-secondary); font-size: 0.72rem; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            <span>Quoting @${owner.handle}</span>
                        </div>
                        <div style="color: var(--text-primary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight: 500;">
                            ${quoteText}
                        </div>
                    </div>
                `;
            }
        }
        
        // Comments HTML Drawer
        const commentsHtml = `
            <div class="comments-section" id="comments-section-${q.id}" style="display: none; border-top: 1px solid var(--glass-border); padding-top: 12px; margin-top: 10px; animation: slideDown 0.25s ease;">
                <div class="comments-list" id="comments-list-${q.id}" style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; margin-bottom: 12px; padding-right: 4px;">
                    ${(q.comments || []).map(c => `
                        <div class="comment-item" style="background: rgba(255, 255, 255, 0.12); border: 1px solid var(--glass-border); border-radius: 8px; padding: 6px 10px; font-size: 0.85rem; text-align: left;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 2px; font-weight: 700;">
                                <span>${c.senderName}</span>
                                <span>${getRelativeTime(c.createdAt)}</span>
                            </div>
                            <div style="color: var(--text-primary); line-height: 1.3; word-break: break-word;">${c.text}</div>
                        </div>
                    `).join('') || `<div style="font-size: 0.82rem; color: var(--text-secondary); font-style: italic; text-align: center; padding: 8px 0;">No comments yet. Be the first to comment! 🌸</div>`}
                </div>
                
                <div class="comment-form-wrap" style="display: flex; flex-direction: column; gap: 6px;">
                    <input type="text" id="comment-sender-${q.id}" class="input-field" placeholder="Your Name (Optional)" style="margin-bottom: 0; padding: 6px 10px; font-size: 0.82rem; height: 32px; border-radius: 8px;">
                    <div style="display: flex; gap: 6px; align-items: flex-end;">
                        <textarea id="comment-text-${q.id}" class="input-field" placeholder="Add a comment..." style="margin-bottom: 0; padding: 6px 10px; font-size: 0.85rem; height: 38px; min-height: 38px; border-radius: 8px; resize: none; flex-grow: 1;"></textarea>
                        <button class="btn-pill btn-post-comment" data-id="${q.id}" style="background: var(--accent-color); color: #fff; border: none; padding: 0 16px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.82rem; height: 38px; display: flex; align-items: center; justify-content: center;">Send</button>
                    </div>
                </div>
            </div>
        `;
        
        if (isPost) {
            // Render standalone post (no question block)
            return `
                <div class="a-card glass-panel" id="qa-card-public-${q.id}">
                    <div class="a-card-header" style="border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; margin-bottom: 8px;">
                        <div class="a-card-sender" style="display: flex; align-items: center; gap: 8px;">
                            <img src="${owner.avatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--accent-border);">
                            <span style="font-weight: 700; color: var(--text-primary);">${owner.displayName}</span>
                            <span style="color: var(--text-secondary); font-size: 0.8rem;">@${owner.handle} · ${getRelativeTime(q.createdAt)}</span>
                        </div>
                    </div>
                    
                    ${quoteHtml}
                    
                    <div class="a-card-answer" style="font-size: 1.1rem; line-height: 1.5; color: var(--text-primary); font-weight: 500; word-break: break-word; padding: 4px 0;">
                        ${q.answer}
                    </div>
                    
                    <div class="a-card-actions">
                        <button class="footer-btn btn-like ${hasLiked ? 'liked' : ''}" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: ${hasLiked ? 'var(--accent-color)' : 'var(--text-secondary)'}; font-size: 0.85rem; font-weight: 600;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="${hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span>${likesCount}</span>
                        </button>
                        
                        <button class="footer-btn btn-comment-toggle" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            </svg>
                            <span>${(q.comments || []).length}</span>
                        </button>
                        
                        <button class="footer-btn btn-share-qa" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                        </button>
                        
                        <button class="footer-btn btn-quote-ask" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;" title="Ask another question referencing this post">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                            </svg>
                            <span>Ask another</span>
                        </button>
                        
                        ${auth.currentUser ? `
                        <button class="footer-btn btn-delete-qa-public" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: #ff4d4f; font-size: 0.85rem; font-weight: 600; margin-left: auto;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="color: #ff4d4f;">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            <span>Delete</span>
                        </button>
                        ` : `
                        <div style="color: var(--text-secondary); margin-left: auto; cursor: pointer;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="19" cy="12" r="1"></circle>
                                <circle cx="5" cy="12" r="1"></circle>
                            </svg>
                        </div>
                        `}
                    </div>
                    
                    ${commentsHtml}
                </div>
            `;
        } else {
            // Render standard Q&A card
            return `
                <div class="a-card glass-panel" id="qa-card-public-${q.id}">
                    <div class="a-card-header">
                        <div class="a-card-sender">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>${q.senderName ? q.senderName : 'Anonymous'} · ${getRelativeTime(q.createdAt)}</span>
                        </div>
                    </div>
                    
                    <div class="a-card-question">${q.text}</div>
                    
                    ${quoteHtml}
                    
                    <div class="a-card-answer-wrapper">
                        <div class="a-card-answer">${q.answer}</div>
                        
                        <div class="a-card-responder">
                            <img src="${owner.avatar}" alt="Avatar">
                            <span>${owner.handle} · ${getRelativeTime(q.answeredAt)}</span>
                        </div>
                    </div>
                    
                    <div class="a-card-actions">
                        <button class="footer-btn btn-like ${hasLiked ? 'liked' : ''}" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: ${hasLiked ? 'var(--accent-color)' : 'var(--text-secondary)'}; font-size: 0.85rem; font-weight: 600;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="${hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span>${likesCount}</span>
                        </button>
                        
                        <button class="footer-btn btn-comment-toggle" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            </svg>
                            <span>${(q.comments || []).length}</span>
                        </button>
                        
                        <button class="footer-btn btn-share-qa" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                        </button>
                        
                        <button class="footer-btn btn-quote-ask" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;" title="Ask another question referencing this Q&A">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                            </svg>
                            <span>Ask another</span>
                        </button>
                        
                        ${auth.currentUser ? `
                        <button class="footer-btn btn-delete-qa-public" data-id="${q.id}" style="background: transparent; border: none; display: flex; align-items: center; gap: 6px; cursor: pointer; color: #ff4d4f; font-size: 0.85rem; font-weight: 600; margin-left: auto;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="color: #ff4d4f;">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            <span>Delete</span>
                        </button>
                        ` : `
                        <div style="color: var(--text-secondary); margin-left: auto; cursor: pointer;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="19" cy="12" r="1"></circle>
                                <circle cx="5" cy="12" r="1"></circle>
                            </svg>
                        </div>
                        `}
                    </div>
                    
                    ${commentsHtml}
                </div>
            `;
        }
    }).join('');
    
    // Bind Likes
    container.querySelectorAll('.btn-like').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const updated = db.likeAnswer(id, visitorSessionId);
            if (updated) {
                renderPublicQAFeed();
            }
        });
    });
    
    // Bind Share
    container.querySelectorAll('.btn-share-qa').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const qId = e.currentTarget.dataset.id;
            const q = qas.find(item => item.id === qId);
            if (q) {
                openShareModal('qa', q);
            }
        });
    });

    // Bind Delete (public feed)
    container.querySelectorAll('.btn-delete-qa-public').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const qId = e.currentTarget.dataset.id;
            if (confirm("Are you sure you want to delete this post/Q&A?")) {
                db.deleteQuestion(qId);
                showToast("Item deleted successfully!", "success");
                renderPublicProfile(db.getOwner());
            }
        });
    });

    // Bind Comment Toggles
    container.querySelectorAll('.btn-comment-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const section = document.getElementById(`comments-section-${id}`);
            if (section) {
                const isHidden = section.style.display === 'none';
                section.style.display = isHidden ? 'block' : 'none';
            }
        });
    });

    // Bind Comment Post
    container.querySelectorAll('.btn-post-comment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const textEl = document.getElementById(`comment-text-${id}`);
            const senderEl = document.getElementById(`comment-sender-${id}`);
            const text = textEl ? textEl.value.trim() : "";
            const sender = senderEl ? senderEl.value.trim() : "";

            if (!text) {
                showToast("Please write a comment first!", "error");
                return;
            }

            db.addComment(id, text, sender || "Anonymous");
            showToast("Comment posted successfully! 🌸", "success");

            // Re-render
            renderPublicProfile(db.getOwner());

            // Re-open comment drawer instantly for flow feedback
            setTimeout(() => {
                const section = document.getElementById(`comments-section-${id}`);
                if (section) {
                    section.style.display = 'block';
                    const list = document.getElementById(`comments-list-${id}`);
                    if (list) list.scrollTop = list.scrollHeight;
                }
            }, 60);
        });
    });

    // Bind Quote-Ask (Ask another)
    container.querySelectorAll('.btn-quote-ask').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const q = allQA.find(item => item.id === id);
            if (q) {
                activeQuoteItem = q;
                // If owner is logged in, force 'ask-question' mode so they can ask a follow-up
                if (auth.currentUser) {
                    activeAskMode = 'ask-question';
                }
                
                // Rerender profile to show Quote Banner in Ask Box
                renderPublicProfile(db.getOwner());

                // Scroll Ask Box into view
                const askBox = document.getElementById('pub-ask-box-container');
                if (askBox) {
                    askBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Focus Ask Box textarea
                    setTimeout(() => {
                        const textarea = document.getElementById('pub-ask-textarea');
                        if (textarea) {
                            textarea.focus();
                            textarea.placeholder = "Ask a question about this post...";
                        }
                    }, 400);
                }
            }
        });
    });
    
    applyIosEmojis(container);
}

// --- APP EVENT LISTENERS ---
function setupEventListeners() {
    // Close share modal triggers
    document.getElementById('btn-close-share-modal').addEventListener('click', () => {
        document.getElementById('share-modal').classList.remove('active');
    });
    document.getElementById('share-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('share-modal')) {
            document.getElementById('share-modal').classList.remove('active');
        }
    });
    
    // Owner footer login trigger
    const footerLogin = document.getElementById('owner-footer-login');
    if (footerLogin) {
        footerLogin.addEventListener('click', (e) => {
            e.preventDefault();
            auth.loginWithOwnerGoogle("rue@google.com");
        });
    }

    // Owner landing login trigger
    const landingLogin = document.getElementById('btn-landing-login');
    if (landingLogin) {
        landingLogin.addEventListener('click', () => {
            auth.loginWithOwnerGoogle("rue@google.com");
        });
    }
    
    // Share Profile button trigger
    const shareProfileBtn = document.getElementById('btn-share-profile');
    if (shareProfileBtn) {
        shareProfileBtn.addEventListener('click', () => {
            openShareModal('profile');
        });
    }
    
    // Anonymous checkbox handler to toggle name field
    const checkboxAnon = document.getElementById('checkbox-ask-anon');
    const nameWrapper = document.getElementById('pub-ask-name-wrapper');
    if (checkboxAnon && nameWrapper) {
        checkboxAnon.addEventListener('change', (e) => {
            if (e.target.checked) {
                nameWrapper.style.display = 'none';
            } else {
                nameWrapper.style.display = 'block';
            }
        });
    }
    
    // Dashboard navigation tabs
    document.getElementById('btn-dash-inbox').addEventListener('click', () => {
        activeTab = 'inbox';
        renderDashboard();
    });
    document.getElementById('btn-dash-answers').addEventListener('click', () => {
        activeTab = 'answers';
        renderDashboard();
    });
    document.getElementById('btn-dash-settings').addEventListener('click', () => {
        activeTab = 'settings';
        renderDashboard();
    });
    
    // File Upload Handlers (Avatar & Banner)
    document.getElementById('settings-avatar-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) { // limit 500KB to stay within localStorage constraints
            showToast("Avatar image is too large (max 500KB)", "error");
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            tempAvatarBase64 = event.target.result;
            document.getElementById('preview-avatar-img').src = tempAvatarBase64;
            showToast("Avatar image loaded!", "success");
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('settings-header-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1000 * 1024) { // limit 1MB
            showToast("Header image is too large (max 1MB)", "error");
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            tempHeaderBase64 = event.target.result;
            applyHeaderBanner(document.getElementById('preview-header-img'), tempHeaderBase64);
            showToast("Header banner loaded!", "success");
        };
        reader.readAsDataURL(file);
    });

    // Save Profile Settings
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const displayName = document.getElementById('settings-display-name').value.trim();
        const handle = document.getElementById('settings-handle').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const bio = document.getElementById('settings-bio').value.trim();
        const sidebarBio = document.getElementById('settings-sidebar-bio').value.trim();
        const website = document.getElementById('settings-website').value.trim();
        const twitter = document.getElementById('settings-twitter').value.trim();
        const twitter2 = document.getElementById('settings-twitter2').value.trim();
        const tiktok = document.getElementById('settings-tiktok').value.trim();
        const tiktok2 = document.getElementById('settings-tiktok2').value.trim();
        const discord = document.getElementById('settings-discord').value.trim();
        const discord2 = document.getElementById('settings-discord2').value.trim();
        const discordServer = document.getElementById('settings-discord-server').value.trim();
        const ao3 = document.getElementById('settings-ao3').value.trim();
        const allowAnon = document.getElementById('settings-allow-anon').checked;
        const activeThemeCard = document.querySelector('.theme-card.active');
        const theme = activeThemeCard ? activeThemeCard.dataset.themeId : 'sakura';
        
        if (!displayName || !handle) {
            showToast("Display Name and Handle are required", "error");
            return;
        }
        
        const avatar = tempAvatarBase64 || auth.currentUser.avatar;
        const header = tempHeaderBase64 || auth.currentUser.header || "linear-gradient(45deg, #ff9a9e 0%, #fecfef 100%)";
        const askPrompt = document.getElementById('settings-ask-prompt').value.trim();
        const askPlaceholder = document.getElementById('settings-ask-placeholder').value.trim();
        
        auth.updateOwnerProfile({
            displayName,
            handle,
            bio,
            sidebarBio,
            website,
            twitter,
            twitter2,
            tiktok,
            tiktok2,
            discord,
            discord2,
            discordServer,
            ao3,
            allowAnonymous: allowAnon,
            theme,
            avatar,
            header,
            askPrompt,
            askPlaceholder
        });
        
        showToast("Profile settings saved", "success");
        renderDashboard();
    });
    
    // Settings Theme Card Toggles
    document.querySelectorAll('.theme-card').forEach(card => {
        card.addEventListener('click', (e) => {
            document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
            const cardEl = e.currentTarget;
            cardEl.classList.add('active');
            
            // Preview theme changes instantly
            const theme = cardEl.dataset.themeId;
            document.documentElement.setAttribute('data-theme', theme);
        });
    });
    
    // Submit question or post on public page
    document.getElementById('btn-submit-question').addEventListener('click', () => {
        const textarea = document.getElementById('pub-ask-textarea');
        const text = textarea.value.trim();
        
        if (!text) {
            if (auth.currentUser && activeAskMode === 'write-post') {
                showToast("Please enter some text for your post", "error");
            } else {
                showToast("Please enter a question", "error");
            }
            return;
        }
        
        if (auth.currentUser && activeAskMode === 'write-post') {
            db.createPost(text);
            showToast("Post published successfully! ✨", "success");
            textarea.value = '';
            
            // Switch active public tab to posts so they see their new post
            activePublicTab = 'posts';
            renderPublicProfile(db.getOwner());
        } else {
            const isAnon = document.getElementById('checkbox-ask-anon').checked;
            const nameInput = document.getElementById('pub-ask-name');
            const senderName = isAnon ? "Anonymous" : (nameInput ? nameInput.value.trim() : "");
            
            if (!isAnon && !senderName) {
                showToast("Please enter your name or check Ask Anonymously", "error");
                return;
            }
            
            db.askQuestion(text, senderName, isAnon, activeQuoteItem ? activeQuoteItem.id : null);
            showToast(`Question submitted successfully! 🎀`, "success");
            textarea.value = '';
            if (nameInput) nameInput.value = '';
            activeQuoteItem = null;
            
            // Reload public profile view
            renderPublicProfile(db.getOwner());
        }
    });

    // Public Profile Tab Toggles
    const tabAnswers = document.getElementById('tab-answers');
    if (tabAnswers) {
        tabAnswers.addEventListener('click', () => {
            activePublicTab = 'answers';
            renderPublicProfile(db.getOwner());
        });
    }

    const tabPosts = document.getElementById('tab-posts');
    if (tabPosts) {
        tabPosts.addEventListener('click', () => {
            activePublicTab = 'posts';
            renderPublicProfile(db.getOwner());
        });
    }

    // Owner Ask Mode Toggles
    const modeWritePost = document.getElementById('mode-write-post');
    if (modeWritePost) {
        modeWritePost.addEventListener('click', () => {
            activeAskMode = 'write-post';
            renderPublicProfile(db.getOwner());
        });
    }

    const modeAskQuestion = document.getElementById('mode-ask-question');
    if (modeAskQuestion) {
        modeAskQuestion.addEventListener('click', () => {
            activeAskMode = 'ask-question';
            renderPublicProfile(db.getOwner());
        });
    }
}
