// Vercel Serverless Function to serve dynamic crawler metadata for individual Q&As and posts
module.exports = async function handler(req, res) {
    const { id } = req.query;
    
    // Default metadata values
    const userHandle = "wlwruweh";
    const userDisplayName = "rue";
    const avatarUrl = "https://roryaskme.vercel.app/avatar.jpg";
    
    // Helper to truncate text with ellipsis if it exceeds limit
    const truncate = (text, maxLength) => {
        if (!text) return "";
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + "...";
    };

    let title = "ask rue! Q&A";
    let desc = "Ask me questions anonymously or publicly! 🌸";
    
    if (id) {
        try {
            // Fetch the question document from Firestore via the public REST API
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
                        desc = truncate(answerText, 200) || "View update on ask rue!";
                    } else {
                        const questionText = fields.text?.stringValue || "";
                        const answerText = fields.answer?.stringValue || "";
                        
                        // Truncate the question text for a cleaner title
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
}
