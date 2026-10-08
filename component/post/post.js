import { 
    db, auth, addDoc, doc, setDoc, updateDoc, arrayUnion, arrayRemove, 
    onSnapshot, serverTimestamp, query, orderBy, collection 
} from "../../firebase.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { showToast, getCustomToastInfo, formatRelativeTime } from "../utils/helpers.js";
import { currentUserName, currentAvatarUrl } from "../auth/auth.js";

let selectedPostFiles = [];
let activeCommentPostId = null;
let commentUnsubscribe = null;
let usersCache = {};

// 1. LẮNG NGHE TOÀN BỘ USERS & POSTS
export function listenToAllUsersRealtime() {
    onSnapshot(collection(db, "users_demo"), (snapshot) => {
        snapshot.forEach(docSnap => {
            usersCache[docSnap.id] = docSnap.data();
        });
        listenToPostsRealtime();
    }, err => console.warn("Lỗi tải users:", err));
}

export function listenToPostsRealtime() {
    const postsQuery = query(collection(db, "posts_demo"), orderBy("createdAt", "desc"));

    onSnapshot(postsQuery, (snapshot) => {
        const feedContainer = document.getElementById('feed-posts');
        if (!feedContainer) return;

        feedContainer.innerHTML = '';
        const currentUser = auth.currentUser;

        snapshot.forEach(docSnap => {
            const postId = docSnap.id;
            const data = docSnap.data();
            const postCard = document.createElement('div');
            postCard.className = 'post-card';

            const defaultAvatar = "avatar.png"; 
            const avatarUrl = (data.authorUid && usersCache[data.authorUid]?.avatarUrl) || data.authorAvatarUrl || defaultAvatar;
            const authorName = (data.authorUid && usersCache[data.authorUid]?.displayName) || data.author || 'Thành viên';

            const timeAgo = formatRelativeTime(data.createdAt);
            const locationStr = data.location ? `${data.location} • ` : '';

            const likesArray = data.likes || [];
            const likeCount = likesArray.length;
            const isLikedByMe = currentUser && likesArray.includes(currentUser.uid);

            let mediaHTML = '';
            const urls = data.mediaUrls || (data.mediaUrl ? [data.mediaUrl] : []);

            if (urls.length > 0) {
                if (data.isVideo) {
                    mediaHTML = `<video src="${urls[0]}" controls style="width:100%; max-height:250px; border-radius:12px; margin-top:8px;"></video>`;
                } else if (urls.length === 1) {
                    mediaHTML = `<img src="${urls[0]}" alt="Ảnh bài viết" style="width:100%; max-height:250px; object-fit:cover; border-radius:12px; margin-top:8px;">`;
                } else {
                    mediaHTML = `
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 8px;">
                            ${urls.map(url => `<img src="${url}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">`).join('')}
                        </div>
                    `;
                }
            }

            postCard.innerHTML = `
                <div class="post-user">
                    <img src="${avatarUrl}" class="post-avatar-img" alt="Avatar">
                    <div class="user-meta">
                        <span class="user-name">${authorName}</span>
                        <span class="post-time">${locationStr}${timeAgo}</span>
                    </div>
                </div>
                <div class="post-body">
                    <p class="post-text">${data.content || ''}</p>
                    ${mediaHTML}
                </div>
                <div class="post-footer">
                    <button class="btn-like ${isLikedByMe ? 'liked' : ''}" data-id="${postId}">
                        ${isLikedByMe ? '❤️' : '🤍'} <span class="like-count">${likeCount}</span>
                    </button>
                    <button class="btn-comment" data-id="${postId}">
                        💬 <span class="comment-count">Bình luận</span>
                    </button>
                </div>
            `;

            const btnLike = postCard.querySelector('.btn-like');
            const btnComment = postCard.querySelector('.btn-comment');

            if (btnLike) btnLike.addEventListener('click', () => toggleLikePost(postId, likesArray));
            if (btnComment) btnComment.addEventListener('click', () => openCommentModal(postId));

            feedContainer.appendChild(postCard);
        });
    });
}

// 2. TẠO BÀI VIẾT MỚI
export function setupCreatePostEvents() {
    const fabBtn = document.getElementById('fab-post-btn');
    const navPostBtn = document.getElementById('btn-open-post');
    const btnBackPost = document.getElementById('btn-back-post');
    const btnSubmitScreenPost = document.getElementById('btn-submit-screen-post');
    const imageFileInput = document.getElementById('post-file-image');
    const videoFileInput = document.getElementById('post-file-video');

    const openScreen = () => document.getElementById('create-post-screen')?.classList.add('active');
    const closeScreen = () => {
        document.getElementById('create-post-screen')?.classList.remove('active');
        if (document.getElementById('post-screen-text')) document.getElementById('post-screen-text').value = '';
        if (document.getElementById('post-screen-preview')) document.getElementById('post-screen-preview').innerHTML = '';
        selectedPostFiles = [];
    };

    if (fabBtn) fabBtn.addEventListener('click', openScreen);
    if (navPostBtn) navPostBtn.addEventListener('click', openScreen);
    if (btnBackPost) btnBackPost.addEventListener('click', closeScreen);

    const handleFiles = (files) => {
        if (!files) return;
        Array.from(files).forEach(f => selectedPostFiles.push(f));
        renderPreview();
    };

    if (imageFileInput) imageFileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    if (videoFileInput) videoFileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    if (btnSubmitScreenPost) {
        btnSubmitScreenPost.addEventListener('click', async () => {
            const content = document.getElementById('post-screen-text')?.value.trim();
            const user = auth.currentUser;

            if (!content && selectedPostFiles.length === 0) {
                showToast("Hãy gõ nội dung hoặc chọn ảnh/video nhé!", "📝");
                return;
            }

            btnSubmitScreenPost.innerText = "Đang đăng...";
            btnSubmitScreenPost.disabled = true;

            try {
                let mediaUrls = [];
                let isVideo = false;

                if (selectedPostFiles.length > 0) {
                    isVideo = selectedPostFiles[0].type.startsWith('video/');
                    mediaUrls = await Promise.all(selectedPostFiles.map(file => uploadToCloudinary(file)));
                }

                await addDoc(collection(db, "posts_demo"), {
                    authorUid: user ? user.uid : "",
                    author: currentUserName,
                    authorAvatarUrl: currentAvatarUrl,
                    location: "Việt Nam 🇻🇳",
                    content: content,
                    mediaUrls: mediaUrls,
                    isVideo: isVideo,
                    likes: [],
                    createdAt: serverTimestamp()
                });

                const toastInfo = getCustomToastInfo();
                showToast(toastInfo.msg, toastInfo.icon);
                closeScreen();
            } catch (error) {
                showToast("Đăng bài thất bại: " + error.message, "❌");
            } finally {
                btnSubmitScreenPost.innerText = "Đăng";
                btnSubmitScreenPost.disabled = false;
            }
        });
    }
}

function renderPreview() {
    const previewContainer = document.getElementById('post-screen-preview');
    if (!previewContainer) return;
    if (selectedPostFiles.length === 0) { previewContainer.innerHTML = ''; return; }

    let html = '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">';
    selectedPostFiles.forEach((file, index) => {
        const isVideo = file.type.startsWith('video/');
        const fileUrl = URL.createObjectURL(file);
        html += `
            <div style="position: relative; width: 75px; height: 75px;">
                ${isVideo ? `<video src="${fileUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;"></video>` : `<img src="${fileUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`}
                <button class="btn-remove-single" data-index="${index}" style="position:absolute; top:-6px; right:-6px; background:rgba(0,0,0,0.7); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:11px;">×</button>
            </div>
        `;
    });
    html += '</div>';
    previewContainer.innerHTML = html;

    previewContainer.querySelectorAll('.btn-remove-single').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            selectedPostFiles.splice(idx, 1);
            renderPreview();
        });
    });
}

// 3. THẢ TIM & BÌNH LUẬN
async function toggleLikePost(postId, likesArray = []) {
    const user = auth.currentUser;
    if (!user) return showToast("Vui lòng đăng nhập để thả tim!", "⚠️");
    const postRef = doc(db, "posts", postId);
    const isLiked = likesArray.includes(user.uid);
    try {
        await updateDoc(postRef, { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    } catch (err) {
        showToast("Lỗi thả tim: " + err.message, "❌");
    }
}

function openCommentModal(postId) {
    activeCommentPostId = postId;
    document.getElementById('comment-modal')?.classList.add('active');
    const commentList = document.getElementById('comment-list');
    if (commentList) commentList.innerHTML = '<p style="text-align:center; color:#888; font-size:12px;">Đang tải bình luận...</p>';

    if (commentUnsubscribe) commentUnsubscribe();

    const commentsRef = query(collection(db, "posts_demo", postId, "comments_demo"), orderBy("createdAt", "asc"));
    commentUnsubscribe = onSnapshot(commentsRef, (snapshot) => {
        if (!commentList) return;
        commentList.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#888; font-size:12px;">Chưa có bình luận nào.</p>' : '';

        snapshot.forEach(docSnap => {
            const cData = docSnap.data();
            const avatar = (cData.authorUid && usersCache[cData.authorUid]?.avatarUrl) || cData.authorAvatarUrl || "avatar.png";
            const authorName = (cData.authorUid && usersCache[cData.authorUid]?.displayName) || cData.author || "Thành viên";

            const item = document.createElement('div');
            item.className = 'comment-item-box';
            item.innerHTML = `
                <img src="${avatar}" class="comment-user-avatar" alt="Avatar">
                <div class="comment-content-box">
                    <span class="comment-author-name">${authorName}</span>
                    <span class="comment-text-body">${cData.text || ''}</span>
                </div>
            `;
            commentList.appendChild(item);
        });
    });
}

export function setupCommentEvents() {
    const btnClose = document.getElementById('btn-close-comment');
    const btnSend = document.getElementById('btn-send-comment');
    const inputComment = document.getElementById('input-comment-text');

    if (btnClose) btnClose.addEventListener('click', () => {
        document.getElementById('comment-modal')?.classList.remove('active');
        if (commentUnsubscribe) commentUnsubscribe();
    });

    if (btnSend && inputComment) {
        btnSend.addEventListener('click', async () => {
            const text = inputComment.value.trim();
            const user = auth.currentUser;
            if (!text || !activeCommentPostId || !user) return;
            try {
                await addDoc(collection(db, "posts_demo", activeCommentPostId, "comments_demo"), {
                    authorUid: user.uid,
                    author: currentUserName,
                    authorAvatarUrl: currentAvatarUrl || "avatar.png",
                    text: text,
                    createdAt: serverTimestamp()
                });
                inputComment.value = '';
            } catch (err) {
                showToast("Gửi thất bại: " + err.message, "❌");
            }
        });
    }
}

// 4. KHOẢNH KHẮC (MOMENTS)
export function listenToMomentsRealtime() {
    onSnapshot(query(collection(db, "moments_demo"), orderBy("createdAt", "desc")), (snapshot) => {
        const momentsList = document.getElementById('moments-list');
        if (!momentsList) return;
        momentsList.innerHTML = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.imageUrl) {
                const item = document.createElement('div');
                item.className = 'moment-item';
                item.innerHTML = `<img src="${data.imageUrl}" alt="Khoảnh khắc">`;
                momentsList.appendChild(item);
            }            
        });

        const addBtn = document.createElement('div');
        addBtn.className = 'moment-add-card';
        addBtn.onclick = () => document.getElementById('moment-file-input').click();
        addBtn.innerHTML = `<div class="plus-icon">+</div><span>Thêm ảnh</span>`;
        momentsList.appendChild(addBtn);
    });
}

export function setupMomentUploadListener() {
    const momentFileInput = document.getElementById('moment-file-input');
    if (momentFileInput && !momentFileInput.dataset.hasListener) {
        momentFileInput.dataset.hasListener = "true";
        momentFileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const imageUrl = await uploadToCloudinary(file);
                await addDoc(collection(db, "moments_demo"), { imageUrl, createdAt: serverTimestamp() });
                const toastInfo = getCustomToastInfo();
                showToast(toastInfo.msg, toastInfo.icon);
                e.target.value = '';
            } catch (error) {
                showToast("Không thêm được ảnh: " + error.message, "❌");
            }
        });
    }
}