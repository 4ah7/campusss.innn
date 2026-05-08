import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, setDoc, doc, getDoc, updateDoc, increment, arrayUnion, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// --- RENDERER (FORTIFIED) ---
function renderPosts(snap, targetId) {
    const box = document.getElementById(targetId);
    box.textContent = ""; 

    snap.forEach(pDoc => {
        const d = pDoc.data();
        const id = pDoc.id;
        
        const post = document.createElement('div');
        post.className = 'post';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:12px;';
        
        const userImg = document.createElement('img');
        userImg.src = d.userImg;
        userImg.style.cssText = 'width:32px; height:32px; border-radius:50%; cursor:pointer;';
        userImg.onclick = () => window.visitProfile(d.uid);

        const userName = document.createElement('span');
        userName.style.cssText = 'font-weight:700; cursor:pointer; font-size:0.9rem;';
        userName.textContent = d.userName;
        userName.onclick = () => window.visitProfile(d.uid);

        header.append(userImg, userName);

        const title = document.createElement('h3');
        title.style.margin = '0 0 8px 0';
        title.textContent = d.title;

        const content = document.createElement('p');
        content.style.cssText = 'font-size:0.95rem; color:var(--text-dim); line-height:1.5;';
        content.textContent = d.content;

        post.append(header, title, content);

        if(d.imageUrl) {
            const img = document.createElement('img');
            img.src = d.imageUrl;
            img.className = 'post-img';
            post.append(img);
        }

        const footer = document.createElement('div');
        footer.style.cssText = 'margin-top:20px; border-top:1px solid rgba(128,128,128,0.1); padding-top:12px; display:flex; justify-content:space-between; align-items:center;';
        
        const likeBtn = document.createElement('span');
        likeBtn.style.cursor = 'pointer';
        likeBtn.textContent = `❤️ ${d.likes || 0}`;
        likeBtn.onclick = () => window.like(id);

        const timeLabel = document.createElement('span');
        timeLabel.style.cssText = 'font-size:0.7rem; opacity:0.5;';
        timeLabel.textContent = new Date(d.time).toLocaleDateString();

        footer.append(likeBtn, timeLabel);
        post.append(footer);

        const replyContainer = document.createElement('div');
        replyContainer.style.marginTop = '15px';
        (d.replies || []).forEach(r => {
            const rDiv = document.createElement('div');
            rDiv.className = 'reply-item';
            const rUser = document.createElement('b');
            rUser.textContent = `${r.user}: `;
            const rText = document.createElement('span');
            rText.textContent = r.text;
            rDiv.append(rUser, rText);
            replyContainer.append(rDiv);
        });
        post.append(replyContainer);

        if(currentUser) {
            const rForm = document.createElement('div');
            rForm.style.cssText = 'display:flex; gap:8px; margin-top:15px;';
            const rInput = document.createElement('input');
            rInput.className = 'input-box';
            rInput.style.cssText = 'margin:0; font-size:0.8rem;';
            rInput.placeholder = 'Reply...';
            rInput.id = `re-${id}`;
            const rBtn = document.createElement('button');
            rBtn.className = 'btn-primary';
            rBtn.style.cssText = 'width:auto; padding:0 15px;';
            rBtn.textContent = 'Send';
            rBtn.onclick = () => window.sendReply(id);
            rForm.append(rInput, rBtn);
            post.append(rForm);
        }

        box.append(post);
    });
}

// --- GLOBAL ATTACHMENTS ---
window.showView = (v) => {
    ['feed-view', 'profile-view', 'visit-view'].forEach(view => document.getElementById(view).style.display = 'none');
    document.getElementById(`${v}-view`).style.display = 'block';
};

window.login = () => signInWithPopup(auth, provider);
window.logout = () => signOut(auth).then(() => location.reload());

window.saveProfile = async () => {
    await updateDoc(doc(db, "users", currentUser.uid), {
        bio: document.getElementById('u-bio').value,
        dept: document.getElementById('u-dept').value
    });
    alert("Profile Updated!");
};

window.visitProfile = async (uid) => {
    const uDoc = await getDoc(doc(db, "users", uid));
    if(!uDoc.exists()) return;
    const data = uDoc.data();
    document.getElementById('v-img').src = data.img;
    document.getElementById('v-name').textContent = data.name;
    document.getElementById('v-bio').textContent = data.bio || "No bio yet.";
    document.getElementById('v-dept').textContent = data.dept || "Student";
    window.showView('visit');
    const q = query(collection(db, "posts"), where("uid", "==", uid), orderBy("time", "desc"));
    onSnapshot(q, (snap) => renderPosts(snap, 'v-posts'));
};

window.addPost = async () => {
    const t = document.getElementById('postTitle').value;
    const c = document.getElementById('postContent').value;
    const file = document.getElementById('postFile').files[0];
    if(!t || !c || !currentUser) return;

    const btn = document.getElementById('uploadBtn');
    btn.textContent = "Uploading...";
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
    document.getElementById('postFile').value = "";
    btn.textContent = "Post to Campus";
    btn.disabled = false;
};

window.like = (id) => updateDoc(doc(db, "posts", id), { likes: increment(1) });
window.sendReply = async (id) => {
    const input = document.getElementById(`re-${id}`);
    if(!input.value) return;
    await updateDoc(doc(db, "posts", id), {
        replies: arrayUnion({ user: currentUser.displayName, text: input.value })
    });
    input.value = "";
};

// --- AUTH OBSERVER ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('authArea').innerHTML = `<img src="${user.photoURL}" style="width:32px; border-radius:50%; border:2px solid var(--accent); cursor:pointer;" onclick="showView('profile')">`;
        document.getElementById('profile-btn').style.display = 'inline';
        document.getElementById('editor').style.display = 'block';
        document.getElementById('p-img').src = user.photoURL;
        document.getElementById('p-name').textContent = user.displayName;
        
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if(uDoc.exists()) {
            document.getElementById('u-bio').value = uDoc.data().bio || "";
            document.getElementById('u-dept').value = uDoc.data().dept || "";
        } else {
            await setDoc(doc(db, "users", user.uid), { name: user.displayName, img: user.photoURL, bio: "", dept: "" });
        }
    } else {
        currentUser = null;
        document.getElementById('authArea').innerHTML = `<button onclick="login()" class="btn-primary" style="width:auto; padding:8px 16px;">Login</button>`;
        document.getElementById('profile-btn').style.display = 'none';
        document.getElementById('editor').style.display = 'none';
    }
});

// --- FEED SUBSCRIPTION ---
onSnapshot(query(collection(db, "posts"), orderBy("time", "desc")), (snap) => renderPosts(snap, 'posts'));
