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

// --- RENDER ENGINE ---
function renderPosts(snap, targetId) {
    const box = document.getElementById(targetId);
    box.innerHTML = ""; 

    snap.forEach(pDoc => {
        const d = pDoc.data();
        const id = pDoc.id;
        
        const post = document.createElement('div');
        post.className = 'post';

        // Delete (Owner Only)
        if(currentUser && d.uid === currentUser.uid) {
            const del = document.createElement('button');
            del.className = 'delete-btn';
            del.innerHTML = '<i class="fas fa-trash"></i>';
            del.onclick = () => window.deletePost(id);
            post.append(del);
        }

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:12px;';
        header.innerHTML = `
            <img src="${d.userImg}" style="width:32px; height:32px; border-radius:50%; cursor:pointer;" onclick="window.visitProfile('${d.uid}')">
            <span style="font-weight:700; cursor:pointer; font-size:0.9rem;" onclick="window.visitProfile('${d.uid}')">${d.userName}</span>
        `;
        post.append(header);

        // Body
        post.innerHTML += `<h3>${d.title}</h3><p style="font-size:0.95rem; color:var(--text-dim); line-height:1.5;">${d.content}</p>`;

        if(d.imageUrl) {
            const img = document.createElement('img');
            img.src = d.imageUrl;
            img.className = 'post-img';
            post.append(img);
        }

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = 'margin-top:20px; border-top:1px solid rgba(128,128,128,0.1); padding-top:12px; display:flex; justify-content:space-between; align-items:center;';
        footer.innerHTML = `
            <span style="cursor:pointer;" onclick="window.like('${id}')">❤️ ${d.likes || 0}</span>
            <span style="font-size:0.7rem; opacity:0.5;">${new Date(d.time).toLocaleDateString()}</span>
        `;
        post.append(footer);

        // Replies
        const replyBox = document.createElement('div');
        (d.replies || []).forEach(r => {
            const rDiv = document.createElement('div');
            rDiv.className = 'reply-item';
            rDiv.innerHTML = `<b>${r.user}:</b> ${r.text}`;
            replyBox.append(rDiv);
        });
        post.append(replyBox);

        if(currentUser) {
            const rForm = document.createElement('div');
            rForm.style.cssText = 'display:flex; gap:8px; margin-top:15px;';
            rForm.innerHTML = `
                <input id="re-${id}" class="input-box" style="margin:0; font-size:0.8rem;" placeholder="Reply...">
                <button onclick="window.sendReply('${id}')" class="btn-primary" style="width:auto; padding:0 15px;">Send</button>
            `;
            post.append(rForm);
        }

        box.append(post);
    });
}

// --- ATTACH TO WINDOW FOR HTML ONCLICKS ---
window.showView = (v) => {
    ['feed-view', 'profile-view', 'visit-view'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById(`${v}-view`).style.display = 'block';
};

window.login = () => signInWithPopup(auth, provider);
window.logout = () => signOut(auth).then(() => location.reload());

window.visitProfile = async (uid) => {
    document.getElementById('v-posts').innerHTML = "Loading posts...";
    const uDoc = await getDoc(doc(db, "users", uid));
    if(uDoc.exists()) {
        const data = uDoc.data();
        document.getElementById('v-img').src = data.img;
        document.getElementById('v-name').textContent = data.name;
        document.getElementById('v-bio').textContent = data.bio || "No bio yet.";
        document.getElementById('v-dept').textContent = data.dept || "Campus Member";
        window.showView('visit');
        
        const q = query(collection(db, "posts"), where("uid", "==", uid), orderBy("time", "desc"));
        onSnapshot(q, (snap) => renderPosts(snap, 'v-posts'));
    }
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

window.saveProfile = async () => {
    await updateDoc(doc(db, "users", currentUser.uid), {
        bio: document.getElementById('u-bio').value,
        dept: document.getElementById('u-dept').value
    });
    alert("Profile Updated!");
};

window.deletePost = async (id) => {
    if(confirm("Delete this post?")) await deleteDoc(doc(db, "posts", id));
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

// --- AUTH & INITIAL LOAD ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('authArea').innerHTML = `<img src="${user.photoURL}" style="width:32px; border-radius:50%; border:2px solid var(--accent); cursor:pointer;" onclick="window.showView('profile')">`;
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
        document.getElementById('authArea').innerHTML = `<button onclick="window.login()" class="btn-primary" style="width:auto; padding:8px 16px;">Login</button>`;
        document.getElementById('profile-btn').style.display = 'none';
        document.getElementById('editor').style.display = 'none';
    }
});

onSnapshot(query(collection(db, "posts"), orderBy("time", "desc")), (snap) => renderPosts(snap, 'posts'));
