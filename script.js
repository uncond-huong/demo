// ==========================================
// FILE CHÍNH KHỞI CHẠY HIKARI SPACE
// ==========================================

// script.js
import { buildClockTicks, updateClockWidget } from './component/clock/clock.js';
import { updateProgressBar } from './component/utils/helpers.js';
import { initAuth, setupProfileEvents } from './component/auth/auth.js';
import { 
    setupCreatePostEvents, 
    setupCommentEvents, 
    listenToAllUsersRealtime, 
    listenToMomentsRealtime, 
    setupMomentUploadListener,
    listenToPostsRealtime
} from './component/post/post.js';
import { setupStatusModalEvents, setupAvatarEvents, setupChangePasswordEvents } from './component/profile.js';

// 1. Đồng hồ
function initClocks() {
    buildClockTicks('clock-face-vn');
    buildClockTicks('clock-face-jp');
    const tick = () => {
        updateClockWidget('vn', 'Asia/Ho_Chi_Minh');
        updateClockWidget('jp', 'Asia/Tokyo');
    };
    tick();
    setInterval(tick, 1000);
}

// 2. Chuyển Tab Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            if (this.id === 'btn-open-post') return;
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// 3. Khởi chạy toàn bộ ứng dụng
document.addEventListener("DOMContentLoaded", () => {
    // Chạy UI cơ bản
    initClocks();
    updateProgressBar(); // <-- Thanh tiến trình Hime đã hoạt động trở lại!
    setupNavigation();
    setupProfileEvents();

    // Sự kiện Đăng bài & Bình luận
    setupCreatePostEvents();
    setupCommentEvents();
    setupMomentUploadListener();

    // Kích hoạt Xác thực hệ thống
    initAuth((user) => {
        console.log("Đã xác thực thành công:", user.email);
        
        // Sau khi đăng nhập thành công mới bắt đầu tải dữ liệu bài viết & moments
        listenToAllUsersRealtime();
        listenToMomentsRealtime();
    });

    // Tự động cập nhật lại thời gian bài viết mỗi 60s
    setInterval(() => {
        listenToPostsRealtime();
    }, 60000);

    // Sự kiện đổi trạng thái, avatar & mật khẩu
    document.addEventListener("DOMContentLoaded", () => {
    setupStatusModalEvents();     
    setupAvatarEvents();         
    setupChangePasswordEvents();    
});

    // PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log("HIKARI PWA sẵn sàng!"))
            .catch(err => console.warn("Lỗi PWA:", err));
    }
});