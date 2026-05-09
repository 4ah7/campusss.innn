import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, setDoc, doc, getDoc, updateDoc, increment, arrayUnion, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBNj63exOWvuoD1gNwpYTCZNdJarQJxu5U",
    authDomain: "campusconnect-d5fc1.firebaseapp.com",
    projectId: "campusconnect-d5fc1",
    storageBucket: "campusconnect-d5fc1.firebasestorage.app",
    messagingSenderId: "571562855908",
    appId: "1:571562855908:web:44e5d10e4b062412c38bf1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// --- SMARTER VIEW MANAGER ---
window.showView = (viewName) => {
    const allViews = document.querySelectorAll('.view');
    allViews.forEach(v => v.style.display = 'none');
    
    const target = document.getElementById(`${viewName}-view`);
    if(target) {
        target.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// --- RENDER ENGINE ---
function renderPosts(snap, targetId) {
    const box = document.getElementById(targetId);
    if(!box) return;
    
    if (snap.empty) {
        box.innerHTML = `<div style="text-align:center; padding: 60px; opacity: 0.3;">
            <i class="fas fa-feather-alt" style="font-size: 3rem; margin-bottom: 15px;"></i>
            <p>The campus is quiet. Be the first to start a conversation!</p>
        </div>`;
        return;
    }

    box.innerHTML = ""; 
    snap.forEach(pDoc => {
        const d = pDoc.data();
        const id = pDoc.id;
        const post = document.createElement('div');
        post.className = 'post';

        if(currentUser && d.uid === currentUser.uid) {
            post.innerHTML += `<button onclick="window.deletePost('${id}')" class="delete-btn"><i class="fas fa-trash"></i></button>`;
        }

        post.innerHTML += `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
                <img src="${d.userImg}" style="width:40px; height:40px; border-radius:50%; cursor:pointer;" onclick="window.visitProfile('${d.uid}')">
                <div>
                    <div style="font-weight:700; cursor:pointer;" onclick="window.visitProfile('${d.uid}')">${d.userName}</div>
                    <div style="font-size:0.7rem; opacity:0.5;">${new Date(d.time).toLocaleDateString()}</div>
                </div>
            </div>
            <h3>${d.title}</h3>
            <p style="color:var(--text-dim); margin-bottom:15px;">${d.content}</p>
        `;

        if(d.imageUrl) {
            post.innerHTML += `<img src="${d.imageUrl}" class="post-img" style="width:100%; border-radius:16px; margin: 10px 0;">`;
        }

        post.innerHTML += `
            <div style="display:flex; gap:20px; margin-top:20px; padding-top:15px; border-top:1px solid var(--border);">
                <span style="cursor:pointer; font-weight:600;" onclick="window.like('${id}')">❤️ ${d.likes || 0}</span>
                <span style="opacity:0.6;"><i class="far fa-comment"></i> ${d.replies?.length || 0}</span>
            </div>
        `;
        box.append(post);
    });
}

// --- CORE ACTIONS ---
window.login = () => signInWithPopup(auth, provider);
window.logout = () => signOut(auth).then(() => location.reload());

window.visitProfile = async (uid) => {
    window.showView('visit');
    const uDoc = await getDoc(doc(db, "users", uid));
    if(uDoc.exists()) {
        const data = uDoc.data();
        document.getElementById('v-img').src = data.img;
        document.getElementById('v-name').textContent = data.name;
        document.getElementById('v-bio').textContent = data.bio || "No biography provided.";
        document.getElementById('v-dept').textContent = data.dept || "Campus Member";
        onSnapshot(query(collection(db, "posts"), where("uid", "==", uid), orderBy("time", "desc")), (snap) => renderPosts(snap, 'v-posts'));
    }
};

window.addPost = async () => {
    const t = document.getElementById('postTitle').value;
    const c = document.getElementById('postContent').value;
    const file = document.getElementById('postFile').files[0];
    if(!t || !c || !currentUser) return;

    const btn = document.getElementById('uploadBtn');
    btn.textContent = "Processing...";
    btn.disabled = true;

    let url = "";
    if(file) {
        const sRef = ref(storage, `posts/${Date.now()}_${file.name}`);
        await uploadBytes(sRef, file);
        url = await getDownloadURL(sRef);
    }

    await addDoc(collection(db, "posts"), {
        title: t, content: c, imageUrl: url, uid: currentUser.uid, 
        userName: currentUser.displayName, userImg: currentUser.photoURL,
        time: Date.now(), likes: 0, replies: []
    });

    document.getElementById('postTitle').value = "";
    document.getElementById('postContent').value = "";
    btn.textContent = "Post Update";
    btn.disabled = false;
};

window.deletePost = async (id) => { if(confirm("Permanently delete post?")) await deleteDoc(doc(db, "posts", id)); };
window.like = (id) => updateDoc(doc(db, "posts", id), { likes: increment(1) });

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('authArea').innerHTML = `<img src="${user.photoURL}" class="nav-avatar" style="width:35px; border-radius:50%; border:2px solid var(--accent); cursor:pointer;" onclick="window.showView('profile')">`;
        document.getElementById('profile-btn').style.display = 'inline';
        document.getElementById('editor').style.display = 'block';
        document.getElementById('p-img').src = user.photoURL;
        document.getElementById('p-name').textContent = user.displayName;
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if(!uDoc.exists()) {
            await setDoc(doc(db, "users", user.uid), { name: user.displayName, img: user.photoURL, bio: "", dept: "" });
        } else {
            document.getElementById('u-bio').value = uDoc.data().bio || "";
            document.getElementById('u-dept').value = uDoc.data().dept || "";
        }
    } else {
        currentUser = null;
        document.getElementById('authArea').innerHTML = `<button onclick="window.login()" class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem;">Login</button>`;
        document.getElementById('profile-btn').style.display = 'none';
        document.getElementById('editor').style.display = 'none';
    }
});

onSnapshot(query(collection(db, "posts"), orderBy("time", "desc")), (snap) => renderPosts(snap, 'posts'));
