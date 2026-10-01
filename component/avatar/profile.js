import { 
    auth,
    db, 
    uploadToCloudinary,
    showToast,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
    doc, 
    setDoc, 
    serverTimestamp 
} from "../../firebase.js";

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

export { setupStatusModalEvents, setupAvatarEvents, setupChangePasswordEvents };