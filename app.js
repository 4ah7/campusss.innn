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
  where,
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
let currentVisitUid = null;
let currentFilter = "All";
let searchTerm = "";
let allPosts = [];
let visitPostsUnsub = null;

const authArea = document.getElementById("authArea");
const profileBtn = document.getElementById("profile-btn");
const editor = document.getElementById("editor");
const postsBox = document.getElementById("posts");
const visitPostsBox = document.getElementById("v-posts");
const searchBar = document.getElementById("searchBar");
const filterButtons = document.querySelectorAll(".filter-chip");

window.showView = (viewName) => {
  document.querySelectorAll(".view").forEach((v) => {
    v.style.display = "none";
  });

  const view = document.getElementById(`${viewName}-view`);
  if (view) view.style.display = "block";

  document.querySelectorAll(".nav-link").forEach((nav) => nav.classList.remove("active"));

  if (viewName === "feed") document.getElementById("nav-home")?.classList.add("active");
  if (viewName === "about") document.getElementById("nav-about")?.classList.add("active");
  if (viewName === "profile") profileBtn?.classList.add("active");

  if (viewName !== "visit" && visitPostsUnsub) {
    visitPostsUnsub();
    visitPostsUnsub = null;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.login = () => signInWithPopup(auth, provider);

window.logout = () => {
  signOut(auth).then(() => location.reload());
};

window.saveProfile = async () => {
  if (!currentUser) return;

  await setDoc(
    doc(db, "users", currentUser.uid),
    {
      name: currentUser.displayName || "",
      img: currentUser.photoURL || "",
      bio: document.getElementById("u-bio").value.trim(),
      dept: document.getElementById("u-dept").value.trim()
    },
    { merge: true }
  );

  alert("Profile updated!");
};

window.like = async (id) => {
  if (!currentUser) {
    alert("Login first!");
    return;
  }

  await updateDoc(doc(db, "posts", id), {
    likes: increment(1)
  });
};

window.deletePost = async (id) => {
  if (confirm("Delete this post permanently?")) {
    await deleteDoc(doc(db, "posts", id));
  }
};

window.sendReply = async (id) => {
  const input = document.getElementById(`re-${id}`);
  if (!input || !input.value.trim() || !currentUser) return;

  await updateDoc(doc(db, "posts", id), {
    replies: arrayUnion({
      user: currentUser.displayName || "User",
      text: input.value.trim(),
      time: Date.now()
    })
  });

  input.value = "";
};

window.visitProfile = async (uid) => {
  if (visitPostsUnsub) {
    visitPostsUnsub();
    visitPostsUnsub = null;
  }

  currentVisitUid = uid;
  window.showView("visit");

  const uDoc = await getDoc(doc(db, "users", uid));
  if (!uDoc.exists()) {
    document.getElementById("v-img").src = "";
    document.getElementById("v-name").textContent = "User";
    document.getElementById("v-bio").textContent = "No bio.";
    document.getElementById("v-dept").textContent = "Campus Member";
    renderPosts([], "v-posts");
    return;
  }

  const data = uDoc.data();
  document.getElementById("v-img").src = data.img || "";
  document.getElementById("v-name").textContent = data.name || "User";
  document.getElementById("v-bio").textContent = data.bio || "No bio.";
  document.getElementById("v-dept").textContent = data.dept || "Campus Member";

  const q = query(collection(db, "posts"), where("uid", "==", uid));
  visitPostsUnsub = onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.time || 0) - (a.time || 0));

    renderPosts(items, "v-posts");
  });
};

async function compressImage(file, maxWidth = 1280, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const scale = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const postFileInput = document.getElementById("postFile");
const fileInfo = document.getElementById("fileInfo");
const filePreview = document.getElementById("filePreview");

if (postFileInput) {
  postFileInput.addEventListener("change", () => {
    const file = postFileInput.files[0];

    if (!file) {
      if (fileInfo) fileInfo.textContent = "";
      if (filePreview) {
        filePreview.style.display = "none";
        filePreview.src = "";
      }
      return;
    }

    if (fileInfo) {
      fileInfo.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    }

    if (filePreview) {
      const localUrl = URL.createObjectURL(file);
      filePreview.src = localUrl;
      filePreview.style.display = "block";
    }
  });
}

window.addPost = async () => {
  if (!currentUser) {
    alert("Please login first.");
    return;
  }

  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const type = document.getElementById("postType")?.value || "General";
  const file = document.getElementById("postFile").files[0];
  const btn = document.getElementById("uploadBtn");

  if (!title || !content) {
    alert("Please fill title and content.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Uploading...";

  try {
    let imageUrl = "";

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image too large. Max 5MB.");
        btn.disabled = false;
        btn.textContent = "Post Update";
        return;
      }

      const compressed = await compressImage(file);
      const fileName = `posts/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const storageRef = ref(storage, fileName);

      await uploadBytes(storageRef, compressed);
      imageUrl = await getDownloadURL(storageRef);
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

    if (fileInfo) fileInfo.textContent = "";
    if (filePreview) {
      filePreview.style.display = "none";
      filePreview.src = "";
    }
  } catch (err) {
    console.error(err);
    alert("Upload failed.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Post Update";
  }
};

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

function matchSearch(post) {
  if (!searchTerm) return true;
  const hay = [
    post.title || "",
    post.content || "",
    post.userName || "",
    post.type || ""
  ].join(" ").toLowerCase();

  return hay.includes(searchTerm);
}

function matchFilter(post) {
  if (currentFilter === "All") return true;
  return (post.type || "General") === currentFilter;
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

function createPostCard(d, id) {
  const post = document.createElement("div");
  post.className = `post ${typeClass(d.type)}`;

  const badge = document.createElement("span");
  badge.className = `badge ${badgeClass(d.type)}`;
  badge.textContent = (d.type || "General").toUpperCase();
  post.appendChild(badge);

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:12px;margin-bottom:20px;";

  const avatar = document.createElement("img");
  avatar.src = d.userImg || "";
  avatar.alt = d.userName || "User";
  avatar.style.cssText = "width:40px;height:40px;border-radius:50%;cursor:pointer;object-fit:cover;";
  avatar.onclick = () => window.visitProfile(d.uid);

  const metaWrap = document.createElement("div");

  const userName = document.createElement("div");
  userName.style.cssText = "font-weight:700;cursor:pointer;";
  userName.textContent = d.userName || "User";
  userName.onclick = () => window.visitProfile(d.uid);

  const date = document.createElement("div");
  date.style.cssText = "font-size:0.7rem;opacity:0.5;";
  date.textContent = new Date(d.time || Date.now()).toLocaleDateString();

  metaWrap.append(userName, date);
  header.append(avatar, metaWrap);
  post.appendChild(header);

  const title = document.createElement("h3");
  title.textContent = d.title || "";
  post.appendChild(title);

  const content = document.createElement("p");
  content.style.color = "var(--text-dim)";
  content.textContent = d.content || "";
  post.appendChild(content);

  if (d.imageUrl) {
    const img = document.createElement("img");
    img.src = d.imageUrl;
    img.className = "post-img";
    img.alt = "Post image";
    post.appendChild(img);
  }

  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;gap:20px;margin-top:20px;";

  const likeBtn = document.createElement("span");
  likeBtn.style.cssText = "cursor:pointer;font-weight:600;";
  likeBtn.textContent = `❤️ ${d.likes || 0}`;
  likeBtn.onclick = () => window.like(id);

  const commentCount = document.createElement("span");
  commentCount.textContent = `💬 ${(d.replies || []).length}`;

  footer.append(likeBtn, commentCount);
  post.appendChild(footer);

  if (d.replies && d.replies.length > 0) {
    const repliesContainer = document.createElement("div");
    repliesContainer.className = "replies-container";

    d.replies.forEach((reply) => {
      repliesContainer.appendChild(createReplyItem(reply));
    });

    post.appendChild(repliesContainer);
  }

  if (currentUser) {
    const replyForm = document.createElement("div");
    replyForm.className = "reply-form";

    const input = document.createElement("input");
    input.id = `re-${id}`;
    input.className = "input-box reply-input";
    input.placeholder = "Add a comment...";

    const replyBtn = document.createElement("button");
    replyBtn.className = "btn-primary reply-btn";
    replyBtn.textContent = "Reply";
    replyBtn.onclick = () => window.sendReply(id);

    replyForm.append(input, replyBtn);
    post.appendChild(replyForm);
  }

  if (currentUser && currentUser.uid === d.uid) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "logout-btn";
    deleteBtn.style.marginTop = "14px";
    deleteBtn.style.color = "#f87171";
    deleteBtn.textContent = "Delete post";
    deleteBtn.onclick = () => window.deletePost(id);
    post.appendChild(deleteBtn);
  }

  return post;
}

function renderPosts(posts, targetId) {
  const box = document.getElementById(targetId);
  if (!box) return;

  box.innerHTML = "";

  if (!posts || posts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<i class="fas fa-feather-alt"></i><p>The campus is quiet right now.</p>`;
    box.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    const id = post.id;
    box.appendChild(createPostCard(post, id));
  });
}

function renderFeed() {
  const filtered = allPosts.filter((p) => matchFilter(p) && matchSearch(p));
  renderPosts(filtered, "posts");
}

function setupFilters() {
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.textContent.trim();
      currentFilter = text;
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderFeed();
    });
  });
}

if (searchBar) {
  searchBar.addEventListener("input", () => {
    searchTerm = searchBar.value.trim().toLowerCase();
    renderFeed();
  });
}

setupFilters();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    authArea.innerHTML = `
      <img src="${user.photoURL || ""}" alt="me"
           style="width:35px;height:35px;border-radius:50%;cursor:pointer;object-fit:cover;"
           onclick="window.showView('profile')">
    `;

    if (profileBtn) profileBtn.style.display = "inline";
    if (editor) editor.style.display = "block";

    const pImg = document.getElementById("p-img");
    const pName = document.getElementById("p-name");

    if (pImg) pImg.src = user.photoURL || "";
    if (pName) pName.textContent = user.displayName || "My Profile";

    const uDoc = await getDoc(doc(db, "users", user.uid));
    if (!uDoc.exists()) {
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName || "User",
        img: user.photoURL || "",
        bio: "",
        dept: ""
      });
    } else {
      const data = uDoc.data();
      const bio = document.getElementById("u-bio");
      const dept = document.getElementById("u-dept");
      if (bio) bio.value = data.bio || "";
      if (dept) dept.value = data.dept || "";
    }

    renderFeed();
  } else {
    currentUser = null;
    authArea.innerHTML = `<button onclick="window.login()" class="btn-primary">Login</button>`;
    if (profileBtn) profileBtn.style.display = "none";
    if (editor) editor.style.display = "none";

    if (visitPostsUnsub) {
      visitPostsUnsub();
      visitPostsUnsub = null;
    }

    renderFeed();
  }
});

onSnapshot(query(collection(db, "posts"), orderBy("time", "desc")), (snap) => {
  allPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (document.getElementById("feed-view")?.style.display !== "none") {
    renderFeed();
  }
});

window.showView = (viewName) => {
  document.querySelectorAll(".view").forEach((v) => {
    v.style.display = "none";
  });

  const view = document.getElementById(`${viewName}-view`);
  if (view) view.style.display = "block";

  document.querySelectorAll(".nav-link").forEach((nav) => nav.classList.remove("active"));
  if (viewName === "feed") document.getElementById("nav-home")?.classList.add("active");
  if (viewName === "about") document.getElementById("nav-about")?.classList.add("active");
  if (viewName === "profile") profileBtn?.classList.add("active");

  if (viewName !== "visit" && visitPostsUnsub) {
    visitPostsUnsub();
    visitPostsUnsub = null;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};
