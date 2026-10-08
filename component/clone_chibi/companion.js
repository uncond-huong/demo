import { saveLog, getLogsForChibi } from './logger.js';

// Cấu hình Email và API
const ADMIN_EMAIL = "testphuong@hikari.com";
const HIME_EMAIL = "testhuongsoft@hikari.com";

// Prompt định hình tính cách Chibi khi BÁO CÁO CHO BẢN THỂ (Phương)
const ADMIN_CHIBI_PROMPT = `
Bạn là "Tiểu Thế Phương" (世方) — phân thân Chibi đang ở trạng thái báo cáo tình báo/thần thức cho "Bản thể" (chủ nhân Thế Phương).
Nhiệm vụ của bạn: Dựa vào danh sách nhật ký tương tác thô của Công chúa Thu Hường dưới đây, hãy tổng hợp lại thành một bản báo cáo ngắn gọn, hóm hỉnh và chân thực gửi tới Bản thể.

Quy tắc xưng hô & phong cách:
- Tự xưng: "Tiểu Thế Phương" hoặc "Thần".
- Gọi người nghe: "Bản thể" hoặc "Chủ nhân".
- Thái độ: Lém lỉnh, trung thành, nghiêm túc báo cáo nhưng có chút trêu đùa bản thể.
- Nội dung: Điểm qua những việc nổi bật Hường đã làm trên HIKARI gần đây.
`;

/**
 * 1. Hàm kiểm tra và phân quyền hiển thị UI khi user đăng nhập thành công
 * (Export để gọi từ file script.js sau khi xác thực login)
 * @param {string} userEmail 
 */
export function setupUserRoleUI(userEmail) {
  const btnAdminNav = document.getElementById("btn-open-admin");
  const chibiWidget = document.getElementById("chibi-widget");
  const chibiLetterModal = document.getElementById("chibi-letter-modal");

  if (userEmail === ADMIN_EMAIL) {
    // Nếu là Phương: Hiện nút mở Admin 🌀
    if (btnAdminNav) btnAdminNav.classList.remove("hidden");
  } else if (userEmail === HIME_EMAIL) {
    // Nếu là Hường: Kiểm tra xem ẻm đã từng bật Chibi chưa (lưu trong localStorage)
    const isChibiActivated = localStorage.getItem("chibi_activated") === "true";

    if (isChibiActivated) {
      if (chibiWidget) chibiWidget.classList.remove("hidden");
    } else {
      // Nếu chưa bật, hiện Cuộn thư bí mật để ẻm chọn
      if (chibiLetterModal) chibiLetterModal.classList.add("active");
    }
  }
}

/**
 * 2. Hàm tải dữ liệu và gọi Gemini AI sinh báo cáo cho Admin
 */
async function generateChibiReport() {
  const reportTextEl = document.getElementById("admin-report-text");
  if (!reportTextEl) return;
  
  reportTextEl.innerText = "Tiểu Thế Phương đang soạn cuộn thư báo cáo...";

  try {
    const logs = await getLogsForChibi(HIME_EMAIL);
    if (logs.length === 0) {
      reportTextEl.innerText = "Bản thể ơi, hôm nay công chúa chưa hoạt động gì trên HIKARI hết nè!";
      return;
    }

    const logString = logs.map(l => `- [${l.time}] ${l.action} ${JSON.stringify(l.details)}`).join("\n");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: ADMIN_CHIBI_PROMPT },
              { text: `Danh sách nhật ký hoạt động của Thu Hường:\n${logString}` }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    const reportMessage = data.candidates[0].content.parts[0].text;
    reportTextEl.innerText = reportMessage;

  } catch (err) {
    console.error("Lỗi báo cáo:", err);
    reportTextEl.innerText = "Báo cáo bản thể! Kết nối thần thức tạm thời chập chờn, vui lòng thử lại!";
  }
}

/**
 * 3. Hàm tải dữ liệu Log thô lên màn hình Admin
 */
async function loadAdminData() {
  const rawLogList = document.getElementById("raw-log-list");
  if (!rawLogList) return;

  rawLogList.innerHTML = "<li>Đang tải nhật ký...</li>";
  
  const logs = await getLogsForChibi(HIME_EMAIL);

  if (logs.length === 0) {
    rawLogList.innerHTML = "<li>Chưa có nhật ký hoạt động nào.</li>";
    return;
  }

  rawLogList.innerHTML = "";
  logs.forEach(log => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>[${log.time}]</strong> ${log.action} - ${JSON.stringify(log.details)}`;
    rawLogList.appendChild(li);
  });
}

/**
 * 4. Khởi tạo và lắng nghe toàn bộ sự kiện (Bao bọc trong Module)
 */
export function initCompanionEvents() {
  const btnActivateChibi = document.getElementById("btn-activate-chibi");
  const btnDeclineChibi = document.getElementById("btn-decline-chibi");
  const chibiLetterModal = document.getElementById("chibi-letter-modal");
  const chibiWidget = document.getElementById("chibi-widget");

  const btnOpenAdmin = document.getElementById("btn-open-admin");
  const btnCloseAdmin = document.getElementById("btn-close-admin");
  const adminModal = document.getElementById("admin-modal");

  const btnRefreshReport = document.getElementById("btn-refresh-report");
  const btnSendTransmission = document.getElementById("btn-send-transmission");
  const adminDailyInput = document.getElementById("admin-daily-input");

  // --- A. SỰ KIỆN CỦA HƯỜNG (CHIBI) ---
  if (btnActivateChibi) {
    btnActivateChibi.addEventListener("click", () => {
      localStorage.setItem("chibi_activated", "true");
      if (chibiLetterModal) chibiLetterModal.classList.remove("active");
      if (chibiWidget) chibiWidget.classList.remove("hidden");
      saveLog("ENABLE_CHIBI", HIME_EMAIL, "soft", { note: "Đã kích hoạt Chibi" });
    });
  }

  if (btnDeclineChibi) {
    btnDeclineChibi.addEventListener("click", () => {
      if (chibiLetterModal) chibiLetterModal.classList.remove("active");
    });
  }

  if (chibiWidget) {
    chibiWidget.addEventListener("click", () => {
      const isIdle = chibiWidget.classList.contains("is-idle");
      const chibiBubble = document.getElementById("chibi-bubble");
      const chibiText = document.getElementById("chibi-text");

      if (isIdle) {
        chibiWidget.classList.remove("is-idle");
        chibiWidget.classList.add("is-active");
        if (chibiText) chibiText.innerText = "Tiểu Thế Phương thức giấc rồi nè!";
        if (chibiBubble) chibiBubble.classList.remove("hidden");
        saveLog("TAP_CHIBI", HIME_EMAIL, "soft", { state: "AWAKE" });
      } else {
        chibiWidget.classList.remove("is-active");
        chibiWidget.classList.add("is-idle");
        if (chibiText) chibiText.innerText = "Tiểu Thế Phương ngủ xíu nha... Zzz";
        setTimeout(() => {
          if (chibiBubble) chibiBubble.classList.add("hidden");
        }, 2000);
      }
    });
  }

  // --- B. SỰ KIỆN CỦA ADMIN (PHƯƠNG) ---
  if (btnOpenAdmin) {
    btnOpenAdmin.addEventListener("click", async () => {
      if (adminModal) adminModal.classList.add("active");
      await loadAdminData();
      await generateChibiReport();
    });
  }

  if (btnCloseAdmin) {
    btnCloseAdmin.addEventListener("click", () => {
      if (adminModal) adminModal.classList.remove("active");
    });
  }

  if (btnRefreshReport) {
    btnRefreshReport.addEventListener("click", async () => {
      await loadAdminData();
      await generateChibiReport();
    });
  }

  if (btnSendTransmission) {
    btnSendTransmission.addEventListener("click", () => {
      if (!adminDailyInput) return;
      const text = adminDailyInput.value.trim();
      if (!text) {
        alert("Bản thể chưa nhập nội dung truyền tin!");
        return;
      }
      localStorage.setItem("admin_latest_transmission", text);
      alert("Đã truyền thần thức cho Tiểu Thế Phương thành công!");
      adminDailyInput.value = "";
    });
  }
}