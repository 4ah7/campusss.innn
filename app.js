import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  doc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBNj63exOWvuoD1gNwpYTCZNdJarQJxu5U",
  authDomain: "campusconnect-d5fc1.firebaseapp.com",
  projectId: "campusconnect-d5fc1",
  storageBucket: "campusconnect-d5fc1.firebasestorage.app",
  messagingSenderId: "571562855908",
  appId: "1:571562855908:web:44e5d10e4b062412c38bf1",
  measurementId: "G-R15Q0X75XR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let allPosts = [];
let currentView = "feed";
let currentFilter = "All";
let searchTerm = "";
let currentVisitUid = null;

const els = {
  authArea: document.getElementById("authArea"),
  profileBtn: document.getElementById("profile-btn"),
  editor: document.getElementById("editor"),
  posts: document.getElementById("posts"),
  vPosts: document.getElementById("v-posts"),
  pImg: document.getElementById("p-img"),
  pName: document.getElementById("p-name"),
  uBio: document.getElementById("u-bio"),
  uDept: document.getElementById("u-dept"),
  vImg: document.getElementById("v-img"),
  vName: document.getElementById("v-name"),
  vBio: document.getElementById("v-bio"),
  vDept: document.getElementById("v-dept"),
  searchBar: document.getElementById("searchBar"),
  filterButtons: document.querySelectorAll("[data-filter]")
};

window.showView = (viewName) => {
  currentView = viewName;

  document.querySelectorAll(".view").forEach((v) => (v.style.display = "none"));
  document.getElementById(`${viewName}-view`).style.display = "block";

  document.getElementById("nav-home").classList.toggle("active", viewName === "feed");
  document.getElementById("nav-about").classList.toggle("active", viewName === "about");
  document.getElementById("profile-btn").classList.toggle("active", viewName === "profile");

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (viewName === "feed") renderFeed();
  if (viewName === "visit") renderVisit();
};

window.login = () => signInWithPopup(auth, provider);

window.logout = async () => {
  await signOut(auth);
  currentUser = null;
  currentVisitUid = null;
  window.showView("feed");
};

window.saveProfile = async () => {
  if (!currentUser) return;

  await setDoc(
    doc(db, "users", currentUser.uid),
    {
      name: currentUser.displayName || "",
      img: currentUser.photoURL || "",
      bio: els.uBio.value.trim(),
      dept: els.uDept.value.trim()
    },
    { merge: true }
  );

  alert("Profile saved!");
};

window.visitProfile = async (uid) => {
  currentVisitUid = uid;

  const uDoc = await getDoc(doc(db, "users", uid));
  if (!uDoc.exists()) return;

  const data = uDoc.data();
  els.vImg.src = data.img || "";
  els.vName.textContent = data.name || "User";
  els.vBio.textContent = data.bio || "No bio yet.";
  els.vDept.textContent = data.dept || "Campus Member";

  window.showView("visit");
  renderVisit();
};

window.like = async (id) => {
  if (!currentUser) {
    alert("Login to like posts!");
    return;
  }
  await updateDoc(doc(db, "posts", id), { likes: increment(1) });
};

window.deletePost = async (id, ownerUid) => {
  if (!currentUser) return;
  if (currentUser.uid !== ownerUid) return alert("You can only delete your own post.");

  if (confirm("Delete this post?")) {
    await deleteDoc(doc(db, "posts", id));
  }
};

window.sendReply = async (id) => {
  if (!currentUser) {
    alert("Login to reply!");
    return;
  }

  const input = document.getElementById(`re-${id}`);
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  input.value = "";
  input.disabled = true;

  try {
    await updateDoc(doc(db, "posts", id), {
      replies: arrayUnion({
        user: currentUser.displayName || "User",
        text,
        time: Date.now()
      })
    });
  } catch (err) {
    console.error("Reply error:", err);
    alert("Could not send reply.");
  } finally {
    input.disabled = false;
  }
};

window.addPost = async () => {
  if (!currentUser) return alert("Login first!");

  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const type = document.getElementById("postType").value;
  const file = document.getElementById("postFile").files[0];
  const btn = document.getElementById("uploadBtn");

  if (!title || !content) return alert("Please fill title and content.");

  if (file && file.size > 3 * 1024 * 1024) {
    alert("Please choose an image smaller than 3MB.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Posting...";

  let imageUrl = "";

  try {
    if (file) {
      const sRef = ref(storage, `posts/${Date.now()}_${file.name}`);
      await uploadBytes(sRef, file);
      imageUrl = await getDownloadURL(sRef);
    }

    await addDoc(collection(db, "posts"), {
      title,
      content,
      type,
      imageUrl,
      uid: currentUser.uid,
      userName: currentUser.displayName || "User",
      userImg: currentUser.photoURL || "",
      time: Date.now(),
      likes: 0,
      replies: []
    });

    document.getElementById("postTitle").value = "";
    document.getElementById("postContent").value = "";
    document.getElementById("postFile").value = "";
  } catch (err) {
    console.error("Post error:", err);
    alert("Could not publish post.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Post Update";
  }
};

window.toggleFilter = (type) => {
  currentFilter = type;
  els.filterButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === type);
  });
  renderFeed();
};

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function badgeClass(type) {
  const t = (type || "General").toLowerCase();
  if (t === "news") return "badge-news";
  if (t === "notice") return "badge-notice";
  if (t === "alert") return "badge-alert";
  return "badge-general";
}

function typeClass(type) {
  const t = (type || "General").toLowerCase();
  if (t === "news") return "type-news";
  if (t === "notice") return "type-notice";
  if (t === "alert") return "type-alert";
  return "type-general";
}

function filteredPosts() {
  let posts = [...allPosts];

  if (currentFilter !== "All") {
    posts = posts.filter((p) => (p.type || "General") === currentFilter);
  }

  if (searchTerm) {
    posts = posts.filter((p) => {
      const hay = [
        p.title || "",
        p.content || "",
        p.userName || "",
        p.type || ""
      ].join(" ").toLowerCase();
      return hay.includes(searchTerm);
    });
  }

  return posts;
}

function createReplyItem(reply) {
  const item = document.createElement("div");
  item.className = "reply-item";

  const user = document.createElement("b");
  user.textContent = `${reply.user || "User"}:`;

  const text = document.createElement("span");
  text.textContent = ` ${reply.text || ""}`;

  item.append(user, text);
  return item;
}

function createPostCard(post) {
  const d = post;
  const id = post.id;
  const card = document.createElement("article");
  card.className = `post ${typeClass(d.type)}`;

  const badge = document.createElement("span");
  badge.className = `badge ${badgeClass(d.type)}`;
  badge.textContent = (d.type || "General").toUpperCase();
  card.appendChild(badge);

  const top = document.createElement("div");
  top.className = "post-top";

  const userWrap = document.createElement("div");
  userWrap.className = "user-wrap";

  const avatar = document.createElement("img");
  avatar.className = "user-avatar";
  avatar.src = d.userImg || "https://via.placeholder.com/80";
  avatar.alt = d.userName || "User";
  avatar.onclick = () => visitProfile(d.uid);

  const userTextWrap = document.createElement("div");

  const userBtn = document.createElement("button");
  userBtn.className = "user-link";
  userBtn.textContent = d.userName || "Campus Member";
  userBtn.onclick = () => visitProfile(d.uid);

  const meta = document.createElement("div");
  meta.className = "post-meta";
  meta.textContent = `${timeAgo(d.time || Date.now())}`;

  userTextWrap.append(userBtn, meta);
  userWrap.append(avatar, userTextWrap);

  const rightMeta = document.createElement("div");
  rightMeta.className = "post-meta";
  rightMeta.textContent = new Date(d.time || Date.now()).toLocaleDateString();

  top.append(userWrap, rightMeta);
  card.appendChild(top);

  const title = document.createElement("h3");
  title.textContent = d.title || "";
  card.appendChild(title);

  const content = document.createElement("p");
  content.className = "post-content";
  content.textContent = d.content || "";
  card.appendChild(content);

  if (d.imageUrl) {
    const img = document.createElement("img");
    img.className = "post-img";
    img.src = d.imageUrl;
    img.alt = "Post image";
    card.appendChild(img);
  }

  const footer = document.createElement("div");
  footer.className = "post-footer";

  const leftActions = document.createElement("div");
  leftActions.className = "post-action";
  leftActions.textContent = `❤️ ${d.likes || 0}`;
  leftActions.onclick = () => like(id);

  const comments = document.createElement("div");
  comments.className = "post-action muted";
  comments.textContent = `💬 ${(d.replies || []).length}`;

  footer.append(leftActions, comments);
  card.appendChild(footer);

  const repliesWrap = document.createElement("div");
  repliesWrap.className = "replies-container";

  (d.replies || []).forEach((reply) => {
    repliesWrap.appendChild(createReplyItem(reply));
  });

  if (currentUser) {
    const replyForm = document.createElement("div");
    replyForm.className = "reply-form";

    const input = document.createElement("input");
    input.className = "input-box reply-input";
    input.id = `re-${id}`;
    input.placeholder = "Add a comment...";

    const btn = document.createElement("button");
    btn.className = "btn-primary reply-btn";
    btn.textContent = "Reply";
    btn.onclick = () => sendReply(id);

    replyForm.append(input, btn);
    repliesWrap.appendChild(replyForm);
  } else {
    const prompt = document.createElement("div");
    prompt.className = "reply-item";
    prompt.style.opacity = "0.8";
    prompt.textContent = "Login to reply to this post.";
    repliesWrap.appendChild(prompt);
  }

  card.appendChild(repliesWrap);

  if (currentUser && currentUser.uid === d.uid) {
    const del = document.createElement("button");
    del.className = "logout-btn";
    del.style.marginTop = "14px";
    del.style.color = "#f87171";
    del.textContent = "Delete post";
    del.onclick = () => deletePost(id, d.uid);
    card.appendChild(del);
  }

  return card;
}

function renderList(list, target) {
  const box = document.getElementById(target);
  if (!box) return;

  box.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<i class="fas fa-feather-alt"></i><p>The campus is quiet right now.</p>`;
    box.appendChild(empty);
    return;
  }

  list.forEach((post) => box.appendChild(createPostCard(post)));
}

function renderFeed() {
  renderList(filteredPosts(), "posts");
}

function renderVisit() {
  if (!currentVisitUid) return;
  const list = allPosts.filter((p) => p.uid === currentVisitUid);
  renderList(list, "v-posts");
}

window.showView = (viewName) => {
  currentView = viewName;

  document.querySelectorAll(".view").forEach((v) => (v.style.display = "none"));
  const view = document.getElementById(`${viewName}-view`);
  if (view) view.style.display = "block";

  document.getElementById("nav-home").classList.toggle("active", viewName === "feed");
  document.getElementById("nav-about").classList.toggle("active", viewName === "about");

  if (viewName === "profile") {
    document.getElementById("profile-btn").classList.add("active");
  } else {
    document.getElementById("profile-btn").classList.remove("active");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (viewName === "feed") renderFeed();
  if (viewName === "visit") renderVisit();
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    els.authArea.innerHTML = `
      <img src="${user.photoURL || ""}" alt="Me"
           style="width:34px; height:34px; border-radius:50%; object-fit:cover; cursor:pointer; border:2px solid var(--accent);"
           onclick="showView('profile')">
    `;

    els.profileBtn.style.display = "inline";
    els.editor.style.display = "block";

    els.pImg.src = user.photoURL || "";
    els.pName.textContent = user.displayName || "My Profile";

    const uDoc = await getDoc(doc(db, "users", user.uid));
    if (!uDoc.exists()) {
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName || "User",
        img: user.photoURL || "",
        bio: "",
        dept: ""
      });
      els.uBio.value = "";
      els.uDept.value = "";
    } else {
      const data = uDoc.data();
      els.uBio.value = data.bio || "";
      els.uDept.value = data.dept || "";
    }

    renderFeed();
  } else {
    currentUser = null;
    els.authArea.innerHTML = `<button onclick="login()" class="btn-primary" style="width:auto; padding:8px 14px;">Login</button>`;
    els.profileBtn.style.display = "none";
    els.editor.style.display = "none";
    currentVisitUid = null;
    if (currentView === "profile" || currentView === "visit") showView("feed");
    renderFeed();
  }
});

window.addPost = async () => {
  if (!currentUser) return alert("Login first!");

  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const type = document.getElementById("postType").value;
  const file = document.getElementById("postFile").files[0];
  const btn = document.getElementById("uploadBtn");

  if (!title || !content) return alert("Please fill title and content.");

  if (file && file.size > 3 * 1024 * 1024) {
    alert("Please choose an image smaller than 3MB.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Posting...";

  try {
    let imageUrl = "";

    if (file) {
      const sRef = ref(storage, `posts/${Date.now()}_${file.name}`);
      await uploadBytes(sRef, file);
      imageUrl = await getDownloadURL(sRef);
    }

    await addDoc(collection(db, "posts"), {
      title,
      content,
      type,
      imageUrl,
      uid: currentUser.uid,
      userName: currentUser.displayName || "User",
      userImg: currentUser.photoURL || "",
      time: Date.now(),
      likes: 0,
      replies: []
    });

    document.getElementById("postTitle").value = "";
    document.getElementById("postContent").value = "";
    document.getElementById("postFile").value = "";
  } catch (err) {
    console.error(err);
    alert("Could not upload post.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Post Update";
  }
};

window.searchPosts = () => {
  searchTerm = (els.searchBar.value || "").trim().toLowerCase();
  renderFeed();
};

window.setFilter = (type) => {
  currentFilter = type;
  els.filterButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === type);
  });
  renderFeed();
};

els.searchBar.addEventListener("input", window.searchPosts);

els.filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => window.setFilter(btn.dataset.filter));
});

onSnapshot(query(collection(db, "posts"), orderBy("time", "desc")), (snap) => {
  allPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (currentView === "visit") {
    renderVisit();
  } else {
    renderFeed();
  }
});
