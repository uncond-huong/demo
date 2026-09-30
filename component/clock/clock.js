// =================
// ĐỒNG HỒ & MÚI GIỜ
// =================

function buildClockTicks(clockFaceId) {
    const clockFace = document.getElementById(clockFaceId);
    if (!clockFace) return;
    
    const oldTicks = clockFace.querySelectorAll('.clock-tick-mark');
    oldTicks.forEach(tick => tick.remove());

    for (let i = 0; i < 12; i++) {
        const tick = document.createElement('div');
        tick.className = 'clock-tick-mark';
        if (i % 3 === 0) tick.classList.add("main-tick");
        const angle = i * 30;
        tick.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-52px)`;
        clockFace.appendChild(tick);
    }
}

function getTimeData(timeZone) {
    const now = new Date();
    
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone,
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
    });
    
    let hour = 0, minute = 0, second = 0;
    formatter.formatToParts(now).forEach(p => {
        if (p.type === 'hour') hour = parseInt(p.value);
        if (p.type === 'minute') minute = parseInt(p.value);
        if (p.type === 'second') second = parseInt(p.value);
    });

    const dateStr = now.toLocaleDateString('vi-VN', {
        timeZone: timeZone,
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    return { hour, minute, second, dateStr };
}

function updateClockWidget(prefix, timeZone) {
    const { hour, minute, second, dateStr } = getTimeData(timeZone);

    const secDeg = (second / 60) * 360;
    const minDeg = ((minute + second / 60) / 60) * 360;
    const hourDeg = (((hour % 12) + minute / 60) / 12) * 360;

    const hHand = document.getElementById(`${prefix}-hour`);
    const mHand = document.getElementById(`${prefix}-minute`);
    const sHand = document.getElementById(`${prefix}-second`);
    
    if (hHand) hHand.style.transform = `rotate(${hourDeg}deg)`;
    if (mHand) mHand.style.transform = `rotate(${minDeg}deg)`;
    if (sHand) sHand.style.transform = `rotate(${secDeg}deg)`;

    const digiElem = document.getElementById(`${prefix}-digital`);
    if (digiElem) {
        const h = String(hour).padStart(2, '0');
        const m = String(minute).padStart(2, '0');
        const s = String(second).padStart(2, '0');
        digiElem.innerText = `${h}:${m}:${s}`;
    }

    const dateElem = document.getElementById(`${prefix}-date`);
    if (dateElem) dateElem.innerText = dateStr;
}

export { buildClockTicks, getTimeData, updateClockWidget };