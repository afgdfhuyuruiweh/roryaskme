// Vercel Serverless Function to serve dynamic crawler metadata for individual Q&As and posts
module.exports = async function handler(req, res) {
    const { id, avatar, header } = req.query;
    
    // 1. Handle dynamic image requests directly from Firestore (base64 or remote URL)
    if (avatar || header) {
        try {
            const ownerUrl = `https://firestore.googleapis.com/v1/projects/roryaskme/databases/(default)/documents/owners/owner_rue`;
            const ownerRes = await fetch(ownerUrl);
            if (ownerRes.ok) {
                const ownerDoc = await ownerRes.json();
                const fields = ownerDoc.fields;
                
                if (avatar) {
                    const avatarVal = fields?.avatar?.stringValue || "";
                    if (avatarVal.startsWith('data:image/')) {
                        const matches = avatarVal.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            const contentType = matches[1];
                            const base64Data = matches[2];
                            const imgBuffer = Buffer.from(base64Data, 'base64');
                            res.setHeader("Content-Type", contentType);
                            res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour to prevent excessive database hits
                            return res.status(200).send(imgBuffer);
                        }
                    } else if (avatarVal.startsWith('http')) {
                        return res.redirect(302, avatarVal);
                    }
                    // Fallback to static avatar.jpg
                    return res.redirect(302, "https://roryaskme.vercel.app/avatar.jpg");
                }
                
                if (header) {
                    const headerVal = fields?.header?.stringValue || "";
                    if (headerVal.startsWith('data:image/')) {
                        const matches = headerVal.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            const contentType = matches[1];
                            const base64Data = matches[2];
                            const imgBuffer = Buffer.from(base64Data, 'base64');
                            res.setHeader("Content-Type", contentType);
                            res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
                            return res.status(200).send(imgBuffer);
                        }
                    } else if (headerVal.startsWith('http')) {
                        return res.redirect(302, headerVal);
                    }
                    
                    // Fallback banner gradient SVG
                    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">
                        <defs>
                            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#ff9a9e;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#fecfef;stop-opacity:1" />
                            </linearGradient>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grad)" />
                    </svg>`;
                    res.setHeader("Content-Type", "image/svg+xml");
                    res.setHeader("Cache-Control", "public, max-age=3600");
                    return res.status(200).send(defaultSvg);
                }
            }
        } catch (err) {
            console.error("Error serving dynamic resource from Firestore:", err);
        }
        
        // Final fallback if anything fails
        if (avatar) {
            return res.redirect(302, "https://roryaskme.vercel.app/avatar.jpg");
        } else {
            res.setHeader("Content-Type", "image/svg+xml");
            return res.status(200).send('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="100%" height="100%" fill="#ff9a9e" /></svg>');
        }
    }

    // Default metadata values
    let userHandle = "wlwruweh";
    let userDisplayName = "rue";
    
    // We fetch the dynamic avatar and header endpoints so they remain synced with Firestore.
    // Adding a timestamp/version helps bypass caching of old profile pictures.
    const cacheBuster = Date.now();
    const avatarUrl = `https://roryaskme.vercel.app/api/share?avatar=1&v=${cacheBuster}`;
    
    // 2. Fetch owner details from Firestore to show correct displayName and handle in previews
    try {
        const ownerUrl = `https://firestore.googleapis.com/v1/projects/roryaskme/databases/(default)/documents/owners/owner_rue`;
        const ownerRes = await fetch(ownerUrl);
        if (ownerRes.ok) {
            const ownerDoc = await ownerRes.json();
            const fields = ownerDoc.fields;
            if (fields) {
                userDisplayName = fields.displayName?.stringValue || "rue";
                userHandle = fields.handle?.stringValue || "wlwruweh";
            }
        }
    } catch (err) {
        console.error("Error fetching owner profile in share script:", err);
    }
    
    // Helper to truncate text with ellipsis if it exceeds limit
    const truncate = (text, maxLength) => {
        if (!text) return "";
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + "...";
    };

    let title = "RORYASKME! Q&A";
    let desc = "Ask me questions anonymously or publicly! 🌸";
    
    // 3. If a Q&A or Post ID is specified, fetch the details to customize metadata tags
    if (id) {
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/roryaskme/databases/(default)/documents/questions/${id}`;
            const response = await fetch(firestoreUrl);
            
            if (response.ok) {
                const doc = await response.json();
                const fields = doc.fields;
                
                if (fields) {
                    const isPost = fields.isPost?.booleanValue || false;
                    
                    if (isPost) {
                        const answerText = fields.answer?.stringValue || "";
                        title = `${userDisplayName} posted an update`;
                        desc = truncate(answerText, 200) || "View update on RORYASKME!";
                    } else {
                        const questionText = fields.text?.stringValue || "";
                        const answerText = fields.answer?.stringValue || "";
                        const truncatedQ = truncate(questionText, 80);
                        title = `${userDisplayName} answered: "${truncatedQ}"`;
                        desc = truncate(answerText, 200) || "Ask me questions anonymously or publicly! 🌸";
                    }
                }
            }
        } catch (err) {
            console.error("Error fetching question metadata from Firestore:", err);
        }
    }
    
    // Escape quotes to prevent breaking meta tags
    const escapeHtml = (text) => {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const escapedTitle = escapeHtml(title);
    const escapedDesc = escapeHtml(desc);
    const escapedId = id ? encodeURIComponent(id) : "";
    const redirectUrl = id ? `/?q=${escapedId}#u/${userHandle}` : `/#u/${userHandle}`;
    
    // Serve HTML with custom meta tags and instant redirect
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedTitle}</title>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapedTitle}">
    <meta property="og:description" content="${escapedDesc}">
    <meta property="og:image" content="${avatarUrl}">
    <meta property="og:url" content="https://roryaskme.vercel.app/q/${escapedId}">
    
    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapedTitle}">
    <meta name="twitter:description" content="${escapedDesc}">
    <meta name="twitter:image" content="${avatarUrl}">
    
    <!-- Fallback Meta Refresh Redirect -->
    <noscript>
        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
    </noscript>
    
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #ffeef2;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #ff69b4;
        }
        .redirect-box {
            text-align: center;
            padding: 30px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(255, 105, 180, 0.15);
            border: 1px solid rgba(255, 105, 180, 0.2);
            max-width: 400px;
            width: 90%;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 105, 180, 0.1);
            border-top: 4px solid #ff69b4;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        h2 {
            font-size: 1.25rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        p {
            font-size: 0.9rem;
            color: #666;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="redirect-box">
        <div class="spinner"></div>
        <h2>Redirecting you to RORYASKME...</h2>
        <p>If you are not redirected automatically, <a href="${redirectUrl}" style="color: #ff69b4; font-weight: 700; text-decoration: none;">click here</a>.</p>
    </div>
    
    <script>
        // Redirect browser to client-side app route
        window.location.href = "${redirectUrl}";
    </script>
</body>
</html>`);
};
