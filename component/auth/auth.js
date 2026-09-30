import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, setDoc, onSnapshot, serverTimestamp, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "../../firebase.js";
import { showToast } from "../utils/helpers.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const ALLOWED_EMAILS = [
    "phuong@hikari.com",
    "huongsoft@hikari.com",
    "guestthao@hikari.com",
    "guestchinh@hikari.com",
    "guesttuong@hikari.com",
];

export let currentUserName = "Thành viên";
export let currentAvatarUrl = "";

export function initAuth(onAuthSuccess) {
    setupLoginEvent();
    
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

            onSnapshot(doc(db, "users", user.uid), (docSnap) => {
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
        } else {
            if (loginOverlay) loginOverlay.style.display = 'flex';
            document.body.classList.add('login-locked');
        }    
    });
}

function setupLoginEvent() {
    const btnLogin = document.getElementById('btn-login-submit');
    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        const email = document.getElementById('login-email')?.value.trim();
        const pass = document.getElementById('login-pass')?.value.trim();
        const errorMsg = document.getElementById('login-error-msg');

        if (!email || !pass) {
            if (errorMsg) errorMsg.innerText = "Vui lòng nhập đầy đủ Email và Mật khẩu!";
            return;
        }

        if (btnLogin) { btnLogin.innerText = "Đang kiểm tra..."; btnLogin.disabled = true; }
        if (errorMsg) errorMsg.innerText = "";

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            if (errorMsg) errorMsg.innerText = "Tài khoản hoặc mật khẩu không chính xác!";
        } finally {
            if (btnLogin) { btnLogin.innerText = "Đăng nhập"; btnLogin.disabled = false; }
        }
    };

    if (btnLogin) btnLogin.addEventListener('click', handleLogin);
    window.login = handleLogin; // Bảo hiểm nếu HTML xài onclick
}

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
                    await setDoc(doc(db, "users", currentUser.uid), { displayName: newName, email: currentUser.email, updatedAt: serverTimestamp() }, { merge: true });
                }
                if (newStatus) {
                    await setDoc(doc(db, "user_status", currentUser.uid), { status: newStatus, updatedAt: serverTimestamp() });
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