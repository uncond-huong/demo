// components/auth/auth.js
import { 
    auth, 
    db, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    doc, 
    setDoc, 
    onSnapshot, 
    serverTimestamp 
} from "../../firebase.js";

import { showToast } from "../utils/helpers.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const ALLOWED_EMAILS = [
    "testphuong@hikari.com",
    "testhuongsoft@hikari.com",
    "testguess@hikari.com"
];

export let currentUserName = "Thành viên";
export let currentAvatarUrl = "";

// 1. Tự động gắn sự kiện Đăng nhập (Global Event Delegation)
document.addEventListener('click', async (e) => {
    const btnLogin = e.target.closest('#btn-login-submit');
    if (!btnLogin) return;

    e.preventDefault();

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
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.style.display = 'none';
        document.body.classList.remove('login-locked');
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        if (errorMsg) errorMsg.innerText = "Tài khoản hoặc mật khẩu không chính xác!";
    } finally {
        btnLogin.innerText = "Đăng nhập";
        btnLogin.disabled = false;
    }
});

// 2. Lắng nghe trạng thái đăng nhập
export function initAuth(onAuthSuccess) {
    onAuthStateChanged(auth, async (user) => {
        const loginOverlay = document.getElementById('login-overlay');
        const errorMsg = document.getElementById('login-error-msg');
        
        if (user) {
            const userEmail = (user.email || "").toLowerCase();
            if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(userEmail)) {
                await signOut(auth);
                if (loginOverlay) loginOverlay.style.display = 'flex';
                document.body.classList.add('login-locked');
                if (errorMsg) errorMsg.innerText = "Tài khoản này không tồn tại";
                return;
            }

            if (loginOverlay) loginOverlay.style.display = 'none';
            document.body.classList.remove('login-locked');

            onSnapshot(doc(db, "users_demo", user.uid), (docSnap) => {
                const userNameElem = document.getElementById('user-name');
                const myAvatarImg = document.getElementById('my-avatar-img');
                const inputDisplayName = document.getElementById('input-display-name');

                currentUserName = (docSnap.exists() && docSnap.data().displayName) 
                    ? docSnap.data().displayName 
                    : (user.email ? user.email.split('@')[0] : "Thành viên");

                if (userNameElem) userNameElem.innerText = currentUserName;
                if (inputDisplayName && !inputDisplayName.value) inputDisplayName.value = currentUserName;

                if (docSnap.exists() && docSnap.data().avatarUrl) {
                    currentAvatarUrl = docSnap.data().avatarUrl;
                    if (myAvatarImg) myAvatarImg.src = currentAvatarUrl;
                }
            });

            if (onAuthSuccess) onAuthSuccess(user);
        onSnapshot(doc(db, "user_status_demo", user.uid), (docSnap) => {
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
}

// 3. Sự kiện đổi tên, trạng thái & avatar
export function setupProfileEvents() {
    const btnSaveStatus = document.getElementById('btn-save-status');
    const btnChangeAvatar = document.getElementById('btn-trigger-change-avatar');
    const avatarFileInput = document.getElementById('avatar-file-input');

    if (btnSaveStatus) {
        btnSaveStatus.addEventListener('click', async () => {
            const newStatus = document.getElementById('input-user-status')?.value.trim();
            const newName = document.getElementById('input-display-name')?.value.trim();
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            try {
                if (newName) {
                    await setDoc(doc(db, "users_demo", currentUser.uid), { displayName: newName, email: currentUser.email, updatedAt: serverTimestamp() }, { merge: true });
                }
                if (newStatus) {
                    await setDoc(doc(db, "user_status_demo", currentUser.uid), { status: newStatus, updatedAt: serverTimestamp() });
                }
                showToast("Đã cập nhật thông tin thành công!", "✨");
                document.getElementById('status-modal')?.classList.remove('active');
            } catch (error) {
                showToast("Không thể cập nhật: " + error.message, "❌");
            }
        });
    }

    if (btnChangeAvatar && avatarFileInput) {
        btnChangeAvatar.addEventListener('click', () => avatarFileInput.click());
        avatarFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !auth.currentUser) return;
            try {
                btnChangeAvatar.innerText = "Đang tải ảnh lên...";
                const avatarUrl = await uploadToCloudinary(file);
                await setDoc(doc(db, "users", auth.currentUser.uid), { avatarUrl, email: auth.currentUser.email, updatedAt: serverTimestamp() }, { merge: true });
                showToast("Đã cập nhật ảnh đại diện mới! ✨", "📷");
                document.getElementById('status-modal')?.classList.remove('active');
            } catch (err) {
                showToast("Lỗi đổi avatar: " + err.message, "❌");
            } finally {
                btnChangeAvatar.innerText = "📷 Chọn ảnh đại diện mới";
            }
        });
    }
}
