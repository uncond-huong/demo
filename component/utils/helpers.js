import { auth } from "../../firebase.js";

export function showToast(message, icon = "✨") {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    if (!toast || !toastMsg) return;

    toastMsg.innerText = message;
    if (toastIcon) toastIcon.innerText = icon;

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

export function getCustomToastInfo() {
    const user = auth.currentUser;
    if (!user) return { msg: "Thao tác thành công! ✨", icon: "✨" };
    const email = (user.email || "").toLowerCase();

    if (email.includes("soft")) return { msg: "Ui, cảm ơn công chúa đã chia sẻ nhen... 💖", icon: "🌸" };
    if (email.includes("phuong")) return { msg: "Đã góp phần làm nàng ấy vui! ✨", icon: "🪷" };
    return { msg: "Cảm ơn bạn đã kết nối với chúng tôi! 🌿", icon: "💌" };
}

export function formatRelativeTime(timestamp) {
    if (!timestamp) return "Vừa xong";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 30) return "Vừa xong";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;

    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function updateProgressBar() {
    const startDate = new Date(2026, 8, 9).getTime(); 
    const endDate = new Date(2026, 11, 31).getTime(); 
    const now = new Date().getTime();
    let percentage = ((now - startDate) / (endDate - startDate)) * 100;
    
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    const formattedPercent = percentage.toFixed(2) + '%';
    const progressBarFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (progressBarFill) progressBarFill.style.width = formattedPercent;
    if (progressText) progressText.innerText = formattedPercent;
}