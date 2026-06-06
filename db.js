// Pinkspring Personal Database Service (Single-User Owner)

const DEFAULT_OWNER = {
    id: "owner_rue",
    handle: "wlwruweh",
    displayName: "rue",
    avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23ffccd5'/><text x='50' y='60' font-size='40' text-anchor='middle'>🌸</text></svg>",
    header: "linear-gradient(45deg, #ff9a9e 0%, #fecfef 100%)",
    bio: "⊹₊˚‧︵‿₊୨ᰔ Roryaskme! ᰔ ୧₊‿︵‧˚₊⊹\n╰┈➤ Rue’s official digital fallout shelter.\n\n.ᐟ Welcome! I’m Rue—part-time AU enthusiast, full-time struggling uni student, and professional multi-shipper XD. 𐔌՞. .՞𐦯 I spend 90% of my time writing alternative universes and 10% fighting for my life sa uni para lang tumagos. My shipping tastes are \"yes,\" and my fandoms are \"all of them.\"\n\n⤹⤷ System Log: This page is my digital fallout shelter in case revospring pulls a cc and crashes permanently, since the internet loves deleting our favorite Q&A sites. Feed my inbox with prompts, questions, or your favorite ships before the servers realize I'm here! 𑣲⋆",
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

const DEFAULT_QUESTIONS = [
    {
        id: "q_danmei",
        targetUserId: "owner_rue",
        senderName: "anon ruelvs",
        text: "ate mahilig ka po sa danmei?",
        createdAt: new Date(Date.now() - 3600000 * 24 * 6).toISOString(),
        answeredAt: new Date(Date.now() - 3600000 * 24 * 6).toISOString(),
        answer: "hiii!!! ohmyghoodd yes na yes!!!",
        likes: ["visitor_1", "visitor_2"],
        isAnonymous: true
    },
    {
        id: "q_miss_writing",
        targetUserId: "owner_rue",
        senderName: "anon ruelvs",
        text: "miss u na po",
        createdAt: new Date(Date.now() - 3600000 * 24 * 26).toISOString(),
        answeredAt: new Date(Date.now() - 3600000 * 24 * 15).toISOString(),
        answer: "I miss writing too huhuhu",
        likes: [],
        isAnonymous: true
    },
    {
        id: "q_type_mo",
        targetUserId: "owner_rue",
        senderName: "anon ruelvs",
        text: "hi po ano po type mo",
        createdAt: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
        answeredAt: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
        answer: "secret no clue",
        likes: ["visitor_3"],
        isAnonymous: true
    },
    {
        id: "q_ships",
        targetUserId: "owner_rue",
        senderName: "anon ruelvs",
        text: "hello ano ano pa po ship mo? ang sarap lang baka ship mo rin ship ko",
        createdAt: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
        answeredAt: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
        answer: "secret, wait mo na lang baka ship mo pala bigla ko na lang mapost",
        likes: [],
        isAnonymous: true
    },
    {
        id: "q_shiguang",
        targetUserId: "owner_rue",
        senderName: "anon ruelvs",
        text: "shiguang mentioned",
        createdAt: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
        answeredAt: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
        answer: "yaayy shiguang 🥳",
        likes: [],
        isAnonymous: true
    }
];

class DBService {
    constructor() {
        this.init();
    }

    init() {
        if (!localStorage.getItem("pinkspring_owner")) {
            localStorage.setItem("pinkspring_owner", JSON.stringify(DEFAULT_OWNER));
        } else {
            // Add adminEmail field to localStorage owner config if missing
            const owner = JSON.parse(localStorage.getItem("pinkspring_owner"));
            let changed = false;
            if (owner.adminEmail === undefined) {
                owner.adminEmail = "";
                changed = true;
            }
            if (changed) {
                localStorage.setItem("pinkspring_owner", JSON.stringify(owner));
            }
        }
        if (!localStorage.getItem("pinkspring_questions")) {
            localStorage.setItem("pinkspring_questions", JSON.stringify(DEFAULT_QUESTIONS));
        } else {
            // Map legacy questions to add isAnonymous: true where appropriate
            const questions = JSON.parse(localStorage.getItem("pinkspring_questions"));
            let updated = false;
            questions.forEach(q => {
                if (q.isAnonymous === undefined) {
                    const isAnon = !q.senderName || q.senderName === "Anonymous" || q.senderName.toLowerCase().startsWith("anon");
                    q.isAnonymous = isAnon;
                    updated = true;
                }
            });
            if (updated) {
                localStorage.setItem("pinkspring_questions", JSON.stringify(questions));
            }
        }
    }

    getOwner() {
        return JSON.parse(localStorage.getItem("pinkspring_owner"));
    }

    saveOwner(ownerData) {
        const owner = { ...this.getOwner(), ...ownerData };
        localStorage.setItem("pinkspring_owner", JSON.stringify(owner));
        if (window.FIREBASE_ACTIVE && window.firebaseSaveOwner) {
            window.firebaseSaveOwner(owner);
        }
        return owner;
    }

    getQuestions() {
        return JSON.parse(localStorage.getItem("pinkspring_questions"));
    }

    getInboxQuestions() {
        const questions = this.getQuestions();
        return questions.filter(q => q.answer === null);
    }

    getPublicQA() {
        const questions = this.getQuestions();
        return questions.filter(q => q.answer !== null)
            .sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt));
    }

    askQuestion(text, senderName, isAnonymous, parentQuestionId = null) {
        if (window.FIREBASE_ACTIVE && window.firebaseAskQuestion) {
            window.firebaseAskQuestion(text, senderName, isAnonymous, parentQuestionId);
            return;
        }
        const questions = this.getQuestions();
        const newQ = {
            id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            targetUserId: "owner_rue",
            senderName: isAnonymous ? "Anonymous" : (senderName ? senderName.trim() : "Friend"),
            text: text,
            createdAt: new Date().toISOString(),
            answeredAt: null,
            answer: null,
            likes: [],
            comments: [],
            parentQuestionId: parentQuestionId,
            isAnonymous: !!isAnonymous
        };
        questions.push(newQ);
        localStorage.setItem("pinkspring_questions", JSON.stringify(questions));
        return newQ;
    }

    createPost(text) {
        if (window.FIREBASE_ACTIVE && window.firebaseCreatePost) {
            window.firebaseCreatePost(text);
            return;
        }
        const questions = this.getQuestions();
        const newPost = {
            id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            targetUserId: "owner_rue",
            senderName: null,
            text: "",
            isPost: true,
            createdAt: new Date().toISOString(),
            answeredAt: new Date().toISOString(),
            answer: text,
            likes: [],
            comments: []
        };
        questions.push(newPost);
        localStorage.setItem("pinkspring_questions", JSON.stringify(questions));
        return newPost;
    }

    addComment(itemId, text, senderName) {
        if (window.FIREBASE_ACTIVE && window.firebaseAddComment) {
            window.firebaseAddComment(itemId, text, senderName);
            return;
        }
        const questions = this.getQuestions();
        const index = questions.findIndex(q => q.id === itemId);
        if (index !== -1) {
            if (!questions[index].comments) {
                questions[index].comments = [];
            }
            const newComment = {
                id: "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                senderName: senderName ? senderName.trim() : "Anonymous",
                text: text,
                createdAt: new Date().toISOString()
            };
            questions[index].comments.push(newComment);
            localStorage.setItem("pinkspring_questions", JSON.stringify(questions));
            return newComment;
        }
        return null;
    }

    answerQuestion(questionId, answerText) {
        if (window.FIREBASE_ACTIVE && window.firebaseAnswerQuestion) {
            window.firebaseAnswerQuestion(questionId, answerText);
            return;
        }
        const questions = this.getQuestions();
        const index = questions.findIndex(q => q.id === questionId);
        if (index !== -1) {
            questions[index].answer = answerText;
            questions[index].answeredAt = new Date().toISOString();
            localStorage.setItem("pinkspring_questions", JSON.stringify(questions));
            return questions[index];
        }
        return null;
    }

    updateQuestionSenderName(questionId, newName) {
        if (window.FIREBASE_ACTIVE && window.firebaseUpdateSenderName) {
            window.firebaseUpdateSenderName(questionId, newName);
            return;
        }
        const questions = this.getQuestions();
        const index = questions.findIndex(q => q.id === questionId);
        if (index !== -1) {
            questions[index].senderName = newName ? newName.trim() : "Anonymous";
            localStorage.setItem("pinkspring_questions", JSON.stringify(questions));
            return questions[index];
        }
        return null;
    }

    deleteQuestion(questionId) {
        let questions = this.getQuestions();
        questions = questions.filter(q => q.id !== questionId);
        localStorage.setItem("pinkspring_questions", JSON.stringify(questions));

        if (window.FIREBASE_ACTIVE && window.firebaseDeleteQuestion) {
            window.firebaseDeleteQuestion(questionId);
        }
    }

    likeAnswer(questionId, visitorSessionId) {
        if (window.FIREBASE_ACTIVE && window.firebaseLikeAnswer) {
            window.firebaseLikeAnswer(questionId, visitorSessionId);
        }
        const questions = this.getQuestions();
        const index = questions.findIndex(q => q.id === questionId);
        if (index !== -1) {
            const likes = questions[index].likes || [];
            const userIndex = likes.indexOf(visitorSessionId);
            if (userIndex === -1) {
                likes.push(visitorSessionId);
            } else {
                likes.splice(userIndex, 1);
            }
            questions[index].likes = likes;
            localStorage.setItem("pinkspring_questions", JSON.stringify(questions));
            return questions[index];
        }
        return null;
    }
}

window.db = new DBService();
