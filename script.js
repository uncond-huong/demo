// ==========================================
// 0. IMPORT FIREBASE
// ==========================================
import { 
    db, 
    auth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    addDoc, 
    doc, 
    setDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove,
    onSnapshot, 
    serverTimestamp, 
    query, 
    orderBy,
    collection
} from "./firebase.js";

// ĐỒNG HỒ & MÚI GIỜ
import { buildClockTicks, updateClockWidget } from './components/clock/clock.js';

// Biến toàn cục
let currentUserName = "Thành viên";
let currentAvatarUrl = "";
let activeCommentPostId = null;
let commentUnsubscribe = null;
let selectedPostFiles = []; // Mảng lưu nhiều file ảnh/video chọn đăng
let usersCache = {}; // Bộ nhớ tạm chứa Tên & Avatar mới nhất của từng User UID

// ==========================================
// THÔNG TIN CLOUDINARY
// ==========================================
const CLOUD_NAME = "zwyvvrqi"; 
const UPLOAD_PRESET = "hikari-preset";

async function uploadToCloudinary(file) {
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    if (data.secure_url) {
        return data.secure_url;
    } else {
        throw new Error(data.error?.message || "Lỗi tải media lên Cloudinary!");
    }
}

// ==========================================
// ĐỊNH NGHĨA DANH SÁCH TÀI KHOẢN ĐƯỢC PHÉP TRUY CẬP
// ==========================================
const ALLOWED_EMAILS = [
    "phuong@hikari.com",
    "huongsoft@hikari.com",
    "guestthao@hikari.com",
    "guestchinh@hikari.com",
    "guesttuong@hikari.com",
];

// ==========================================
// HÀM HIỂN THỊ TOAST THÔNG BÁO (KIỂU FACEBOOK)
// ==========================================
function showToast(message, icon = "✨") {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    if (!toast || !toastMsg) return;

    toastMsg.innerText = message;
    if (toastIcon) toastIcon.innerText = icon;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

function getCustomToastInfo() {
    const user = auth.currentUser;
    if (!user) return { msg: "Thao tác thành công! ✨", icon: "✨" };

    const email = (user.email || "").toLowerCase();

    if (email.includes("soft")) {
        return { msg: "Ui, cảm ơn công chúa đã chia sẻ nhen... 💖", icon: "🌸" };
    }
    if (email.includes("phuong")) {
        return { msg: "Đã góp phần làm nàng ấy vui! ✨", icon: "🪷" };
    }
    return { msg: "Cảm ơn bạn đã kết nối với chúng tôi! 🌿", icon: "💌" };
}

function getAuthorName() {
    const user = auth.currentUser;
    if (!user) return "Thành viên";
    return currentUserName || (user.email ? user.email.split('@')[0] : "Thành viên");
}

// Hàm đổi Timestamp Firestore sang khoảng thời gian thực tương đối
function formatRelativeTime(timestamp) {
    if (!timestamp) return "Vừa xong";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 30) return "Vừa xong";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;

    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ==========================================
// XÁC THỰC NGƯỜI DÙNG & LẮNG NGHE TOÀN BỘ USERS
// ==========================================

function listenToAllUsersRealtime() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        snapshot.forEach(docSnap => {
            usersCache[docSnap.id] = docSnap.data();
        });
        listenToPostsRealtime();
    });
}

onAuthStateChanged(auth, async (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    const errorMsg = document.getElementById('login-error-msg');
    if (user) {
        const userEmail = (user.email || "").toLowerCase();

        if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(userEmail)) {
            console.warn("Tài khoản không thuộc trang web này:", userEmail);
            await signOut(auth);

            if (loginOverlay) loginOverlay.style.display = 'flex';
            document.body.classList.add('login-locked');

            if (errorMsg) errorMsg.innerText = "Tài khoản này không tồn tại";
            else showToast("Tài khoản không tồn tại");
            return;
        }

        if (loginOverlay) loginOverlay.style.display = 'none';
        document.body.classList.remove('login-locked');

        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            const userNameElem = document.getElementById('user-name');
            const myAvatarImg = document.getElementById('my-avatar-img');
            const inputDisplayName = document.getElementById('input-display-name');

            if (docSnap.exists() && docSnap.data().displayName) {
                currentUserName = docSnap.data().displayName;
            } else {
                currentUserName = user.email ? user.email.split('@')[0] : "Thành viên";
            }

            if (userNameElem) userNameElem.innerText = currentUserName;

            if (inputDisplayName && !inputDisplayName.value) {
                inputDisplayName.value = currentUserName;
            }

            if (docSnap.exists() && docSnap.data().avatarUrl) {
                currentAvatarUrl = docSnap.data().avatarUrl;
                if (myAvatarImg) myAvatarImg.src = currentAvatarUrl;
            }
        });

        onSnapshot(doc(db, "user_status", user.uid), (docSnap) => {
            const myStatusBubble = document.getElementById('my-status-bubble');
            if (docSnap.exists() && docSnap.data().status && myStatusBubble) {
                myStatusBubble.innerText = docSnap.data().status;
                myStatusBubble.style.display = 'block';
            }
        });

    } else {
        if (loginOverlay) loginOverlay.style.display = 'flex';
        document.body.classList.add('login-locked');
    }    
});

function setupLoginEvent() {
    const btnLogin = document.getElementById('btn-login-submit');
    if (btnLogin) {
        btnLogin.addEventListener('click', async (e) => {
            if (e) e.preventDefault();

            const emailInput = document.getElementById('login-email');
            const passInput = document.getElementById('login-pass');
            const errorMsg = document.getElementById('login-error-msg');

            const email = emailInput ? emailInput.value.trim() : '';
            const pass = passInput ? passInput.value.trim() : '';

            if (!email || !pass) {
                if (errorMsg) errorMsg.innerText = "Vui lòng nhập đầy đủ Email và Mật khẩu!";
                return;
            }

            btnLogin.innerText = "Đang kiểm tra...";
            btnLogin.disabled = true;
            if (errorMsg) errorMsg.innerText = "";

            try {
                await signInWithEmailAndPassword(auth, email, pass);
            } catch (error) {
                console.error("Lỗi đăng nhập:", error);
                if (errorMsg) errorMsg.innerText = "Tài khoản hoặc mật khẩu không chính xác!";
            } finally {
                btnLogin.innerText = "Đăng nhập";
                btnLogin.disabled = false;
            }
        });
    }
}

// ==========================================
// 2. THANH TIẾN ĐỘ (PROGRESS BAR)
// ==========================================

function updateProgressBar() {
    const startDate = new Date(2026, 8, 9).getTime(); 
    const endDate = new Date(2026, 11, 31).getTime(); 
    const now = new Date().getTime();

    const totalDuration = endDate - startDate;
    const elapsedDuration = now - startDate;

    let percentage = (elapsedDuration / totalDuration) * 100;
    
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    const formattedPercent = percentage.toFixed(2) + '%';
    
    const progressBarFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (progressBarFill) progressBarFill.style.width = formattedPercent;
    if (progressText) progressText.innerText = formattedPercent;
}

// ==========================================
// 3. MÀN HÌNH ĐĂNG BÀI NHIỀU ẢNH
// ==========================================

function openCreatePostScreen() {
    const createPostScreen = document.getElementById('create-post-screen');
    if (createPostScreen) createPostScreen.classList.add('active');
}

function closeCreatePostScreen() {
    const createPostScreen = document.getElementById('create-post-screen');
    const textInputScreen = document.getElementById('post-screen-text');
    const previewContainer = document.getElementById('post-screen-preview');
    const imageFileInput = document.getElementById('post-file-image');
    const videoFileInput = document.getElementById('post-file-video');

    if (createPostScreen) createPostScreen.classList.remove('active');
    if (textInputScreen) textInputScreen.value = '';
    if (previewContainer) previewContainer.innerHTML = '';
    if (imageFileInput) imageFileInput.value = '';
    if (videoFileInput) videoFileInput.value = '';
    selectedPostFiles = [];
}

function renderPostPreview() {
    const previewContainer = document.getElementById('post-screen-preview');
    if (!previewContainer) return;

    if (selectedPostFiles.length === 0) {
        previewContainer.innerHTML = '';
        return;
    }

    let html = '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">';
    selectedPostFiles.forEach((file, index) => {
        const isVideo = file.type.startsWith('video/');
        const fileUrl = URL.createObjectURL(file);
        html += `
            <div style="position: relative; width: 75px; height: 75px;">
                ${isVideo 
                    ? `<video src="${fileUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;"></video>` 
                    : `<img src="${fileUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`
                }
                <button class="btn-remove-single" data-index="${index}" style="position:absolute; top:-6px; right:-6px; background:rgba(0,0,0,0.7); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center;">×</button>
            </div>
        `;
    });
    html += '</div>';

    previewContainer.innerHTML = html;

    previewContainer.querySelectorAll('.btn-remove-single').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            selectedPostFiles.splice(idx, 1);
            renderPostPreview();
        });
    });
}

function setupCreatePostEvents() {
    const fabBtn = document.getElementById('fab-post-btn');
    const navPostBtn = document.getElementById('btn-open-post');
    const btnBackPost = document.getElementById('btn-back-post');
    const btnSubmitScreenPost = document.getElementById('btn-submit-screen-post');
    const imageFileInput = document.getElementById('post-file-image');
    const videoFileInput = document.getElementById('post-file-video');

    if (fabBtn) fabBtn.addEventListener('click', openCreatePostScreen);
    if (navPostBtn) navPostBtn.addEventListener('click', openCreatePostScreen);
    if (btnBackPost) btnBackPost.addEventListener('click', closeCreatePostScreen);

    function handleFilesSelected(files) {
        if (!files || files.length === 0) return;
        Array.from(files).forEach(file => selectedPostFiles.push(file));
        renderPostPreview();
    }

    if (imageFileInput) imageFileInput.addEventListener('change', (e) => handleFilesSelected(e.target.files));
    if (videoFileInput) videoFileInput.addEventListener('change', (e) => handleFilesSelected(e.target.files));

    if (btnSubmitScreenPost) {
        btnSubmitScreenPost.addEventListener('click', async () => {
            const textInputScreen = document.getElementById('post-screen-text');
            const content = textInputScreen ? textInputScreen.value.trim() : '';
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
                    const uploadPromises = selectedPostFiles.map(file => uploadToCloudinary(file));
                    mediaUrls = await Promise.all(uploadPromises);
                }

                await addDoc(collection(db, "posts"), {
                    authorUid: user ? user.uid : "",
                    author: getAuthorName(),
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

                closeCreatePostScreen();
            } catch (error) {
                console.error("Lỗi khi đăng bài:", error);
                showToast("Đăng bài thất bại: " + error.message, "❌");
            } finally {
                btnSubmitScreenPost.innerText = "Đăng";
                btnSubmitScreenPost.disabled = false;
            }
        });
    }
}

// ==========================================
// 4. POPUP CẢM XÚC, TÊN HIỂN THỊ & ĐỔI MẬT KHẨU
// ==========================================

function setupStatusModalEvents() {
    const myAvatarWrapper = document.getElementById('my-avatar-wrapper');
    const statusModal = document.getElementById('status-modal');
    const btnCloseStatus = document.getElementById('btn-close-status');
    const btnSaveStatus = document.getElementById('btn-save-status');
    const inputUserStatus = document.getElementById('input-user-status');
    const emojiChips = document.querySelectorAll('.emoji-chip');

    if (myAvatarWrapper) {
        myAvatarWrapper.addEventListener('click', () => {
            if (statusModal) statusModal.classList.add('active');
        });
    }

    if (btnCloseStatus) {
        btnCloseStatus.addEventListener('click', () => {
            if (statusModal) statusModal.classList.remove('active');
        });
    }

    emojiChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (inputUserStatus) inputUserStatus.value = chip.innerText;
        });
    });

    if (btnSaveStatus) {
        btnSaveStatus.addEventListener('click', async () => {
            const newStatus = inputUserStatus ? inputUserStatus.value.trim() : '';
            const newNameInput = document.getElementById('input-display-name');
            const newName = newNameInput ? newNameInput.value.trim() : '';
            const currentUser = auth.currentUser;

            if (!currentUser) return;

            btnSaveStatus.innerText = "Lưu...";
            btnSaveStatus.disabled = true;

            try {
                if (newName) {
                    await setDoc(doc(db, "users", currentUser.uid), {
                        displayName: newName,
                        email: currentUser.email,
                        updatedAt: serverTimestamp()
                    }, { merge: true });
                    currentUserName = newName;
                }

                if (newStatus) {
                    await setDoc(doc(db, "user_status", currentUser.uid), {
                        status: newStatus,
                        updatedAt: serverTimestamp()
                    });
                }

                showToast("Đã cập nhật thông tin thành công!", "✨");
                if (statusModal) statusModal.classList.remove('active');

            } catch (error) {
                console.error("Lỗi cập nhật thông tin:", error);
                showToast("Không thể cập nhật: " + error.message, "❌");
            } finally {
                btnSaveStatus.innerText = "Cập nhật";
                btnSaveStatus.disabled = false;
            }
        });
    }
}

function setupAvatarEvents() {
    const btnChangeAvatar = document.getElementById('btn-trigger-change-avatar');
    const avatarFileInput = document.getElementById('avatar-file-input');

    if (btnChangeAvatar && avatarFileInput) {
        btnChangeAvatar.addEventListener('click', () => {
            avatarFileInput.click();
        });
    }

    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const currentUser = auth.currentUser;
            if (!currentUser) {
                showToast("Vui lòng đăng nhập trước khi đổi avatar!", "⚠️");
                return;
            }

            try {
                if (btnChangeAvatar) btnChangeAvatar.innerText = "Đang tải ảnh lên...";

                const avatarUrl = await uploadToCloudinary(file);

                await setDoc(doc(db, "users", currentUser.uid), {
                    avatarUrl: avatarUrl,
                    email: currentUser.email,
                    updatedAt: serverTimestamp()
                }, { merge: true });

                showToast("Đã cập nhật ảnh đại diện mới thành công! ✨", "📷");

                const statusModal = document.getElementById('status-modal');
                if (statusModal) statusModal.classList.remove('active');

            } catch (error) {
                console.error("Lỗi đổi avatar:", error);
                showToast("Không thể đổi avatar: " + error.message, "❌");
            } finally {
                if (btnChangeAvatar) btnChangeAvatar.innerText = "📷 Chọn ảnh đại diện mới";
                avatarFileInput.value = '';
            }
        });
    }
}

function setupChangePasswordEvents() {
    const modal = document.getElementById('change-pass-modal');
    const btnClose = document.getElementById('btn-close-pass-modal');
    const btnSave = document.getElementById('btn-save-new-pass');
    const msg = document.getElementById('change-pass-msg');

    window.openChangePasswordModal = function() {
        if (modal) modal.classList.add('active');
    };

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            if (modal) modal.classList.remove('active');
            clearInputs();
        });
    }

    function clearInputs() {
        if (document.getElementById('input-old-pass')) document.getElementById('input-old-pass').value = '';
        if (document.getElementById('input-new-pass')) document.getElementById('input-new-pass').value = '';
        if (document.getElementById('input-confirm-pass')) document.getElementById('input-confirm-pass').value = '';
        if (msg) msg.innerText = '';
    }

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const oldPass = document.getElementById('input-old-pass').value.trim();
            const newPass = document.getElementById('input-new-pass').value.trim();
            const confirmPass = document.getElementById('input-confirm-pass').value.trim();
            const user = auth.currentUser;

            if (!oldPass || !newPass || !confirmPass) {
                msg.style.color = '#FF5A5A';
                msg.innerText = 'Vui lòng nhập đầy đủ thông tin!';
                return;
            }

            if (newPass.length < 6) {
                msg.style.color = '#FF5A5A';
                msg.innerText = 'Mật khẩu mới phải có ít nhất 6 ký tự!';
                return;
            }

            if (newPass !== confirmPass) {
                msg.style.color = '#FF5A5A';
                msg.innerText = 'Mật khẩu xác nhận không khớp!';
                return;
            }

            btnSave.innerText = 'Đang đổi...';
            btnSave.disabled = true;

            try {
                const credential = EmailAuthProvider.credential(user.email, oldPass);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPass);

                msg.style.color = '#4CAF50';
                msg.innerText = 'Đổi mật khẩu thành công! 🎉';

                setTimeout(() => {
                    if (modal) modal.classList.remove('active');
                    clearInputs();
                }, 1500);

            } catch (error) {
                console.error("Lỗi đổi mật khẩu:", error);
                msg.style.color = '#FF5A5A';
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    msg.innerText = 'Mật khẩu hiện tại không đúng!';
                } else {
                    msg.innerText = 'Đổi thất bại: ' + error.message;
                }
            } finally {
                btnSave.innerText = 'Lưu mật khẩu';
                btnSave.disabled = false;
            }
        });
    }
}

// ==========================================
// 5. CHUYỂN TAB (NAVIGATION)
// ==========================================

function setupNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            if (this.id === 'btn-open-post') return;
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            const targetSectionId = this.getAttribute('data-target');
            console.log("Đã chuyển sang tab:", targetSectionId);
        });
    });
}

// ==========================================
// 6. NHẬT KÝ KHOẢNH KHẮC REALTIME
// ==========================================

function listenToMomentsRealtime() {
    const momentsQuery = query(collection(db, "moments"), orderBy("createdAt", "desc"));

    onSnapshot(momentsQuery, (snapshot) => {
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
        addBtn.innerHTML = `
            <div class="plus-icon">+</div>
            <span>Thêm ảnh</span>
        `;
        momentsList.appendChild(addBtn);
    });
}

function setupMomentUploadListener() {
    const momentFileInput = document.getElementById('moment-file-input');
    if (momentFileInput && !momentFileInput.dataset.hasListener) {
        momentFileInput.dataset.hasListener = "true";
        momentFileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const imageUrl = await uploadToCloudinary(file);
                
                await addDoc(collection(db, "moments"), {
                    imageUrl: imageUrl,
                    createdAt: serverTimestamp()
                });

                const toastInfo = getCustomToastInfo();
                showToast(toastInfo.msg, toastInfo.icon);

                e.target.value = '';
            } catch (error) {
                console.error("Lỗi thêm khoảnh khắc:", error);
                showToast("Không thêm được ảnh: " + error.message, "❌");
            }
        });
    }
}

// ==========================================
// 7. FEED BÀI VIẾT, THẢ TIM & BÌNH LUẬN
// ==========================================

async function toggleLikePost(postId, likesArray = []) {
    const user = auth.currentUser;
    if (!user) {
        showToast("Vui lòng đăng nhập để thả tim!", "⚠️");
        return;
    }

    const postRef = doc(db, "posts", postId);
    const isLiked = likesArray.includes(user.uid);

    try {
        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(user.uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(user.uid) });
        }
    } catch (error) {
        console.error("Lỗi thả tim:", error);
        showToast("Thao tác thất bại: " + error.message, "❌");
    }
}

function openCommentModal(postId) {
    activeCommentPostId = postId;
    const modal = document.getElementById('comment-modal');
    if (modal) modal.classList.add('active');

    const commentList = document.getElementById('comment-list');
    if (commentList) commentList.innerHTML = '<p style="text-align:center; color:#888; font-size:12px;">Đang tải bình luận...</p>';

    if (commentUnsubscribe) commentUnsubscribe();

    const commentsRef = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
    commentUnsubscribe = onSnapshot(commentsRef, (snapshot) => {
        if (!commentList) return;
        commentList.innerHTML = '';

        if (snapshot.empty) {
            commentList.innerHTML = '<p style="text-align:center; color:#888; font-size:12px;">Chưa có bình luận nào. Hãy là người đầu tiên!</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const cData = docSnap.data();
            const defaultAvatar = "avatar.png";
            const avatar = (cData.authorUid && usersCache[cData.authorUid]?.avatarUrl) || cData.authorAvatarUrl || defaultAvatar;
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

        commentList.scrollTop = commentList.scrollHeight;
    });
}

function setupCommentEvents() {
    const btnClose = document.getElementById('btn-close-comment');
    const btnSend = document.getElementById('btn-send-comment');
    const inputComment = document.getElementById('input-comment-text');
    const modal = document.getElementById('comment-modal');

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            if (modal) modal.classList.remove('active');
            if (commentUnsubscribe) commentUnsubscribe();
            activeCommentPostId = null;
        });
    }

    if (btnSend && inputComment) {
        btnSend.addEventListener('click', async () => {
            const text = inputComment.value.trim();
            const user = auth.currentUser;
            if (!text || !activeCommentPostId || !user) return;

            btnSend.disabled = true;
            try {
                await addDoc(collection(db, "posts", activeCommentPostId, "comments"), {
                    authorUid: user.uid,
                    author: getAuthorName(),
                    authorAvatarUrl: currentAvatarUrl || "avatar.png",
                    text: text,
                    createdAt: serverTimestamp()
                });
                inputComment.value = '';
            } catch (error) {
                console.error("Lỗi gửi bình luận:", error);
                showToast("Gửi thất bại: " + error.message, "❌");
            } finally {
                btnSend.disabled = false;
            }
        });
    }
}

function listenToPostsRealtime() {
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));

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

            // Tính mốc thời gian thực tương đối
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

            if (btnLike) {
                btnLike.addEventListener('click', () => toggleLikePost(postId, likesArray));
            }
            if (btnComment) {
                btnComment.addEventListener('click', () => openCommentModal(postId));
            }

            feedContainer.appendChild(postCard);
        });
    });
}

// ==========================================
// 8. KHỞI CHẠY TẤT CẢ KHI PAGE LOAD XONG
// ==========================================

document.addEventListener("DOMContentLoaded", function() {
    buildClockTicks('clock-face-vn');
    buildClockTicks('clock-face-jp');
    
    function tickAll() {
        updateClockWidget('vn', 'Asia/Ho_Chi_Minh');
        updateClockWidget('jp', 'Asia/Tokyo');
    }
    tickAll();
    setInterval(tickAll, 1000);

    updateProgressBar();

    setupLoginEvent();
    setupCreatePostEvents();
    setupStatusModalEvents();
    setupAvatarEvents();
    setupChangePasswordEvents();
    setupCommentEvents();
    setupNavigation();

    setupMomentUploadListener();
    listenToMomentsRealtime();
    listenToAllUsersRealtime();

    // Tự động cập nhật lại mốc thời gian bài viết mỗi 60 giây
    setInterval(() => {
        listenToPostsRealtime();
    }, 60000);

    // Đăng ký PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log("HIKARI PWA đã sẵn sàng!"))
            .catch(err => console.log("Lỗi đăng ký PWA:", err));
    }
});