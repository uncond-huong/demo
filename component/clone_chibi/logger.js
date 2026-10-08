import { db, addDoc, collection, serverTimestamp, query, where, orderBy, limit, getDocs } from '../firebase.js';
/*Ghi nhận hành động của main user vào Firestore
* @param {string} action - Hành động của main user
* @param {string} userId - ID của main user
* @param {string} targetId - ID của đối tượng bị tác động (nếu có)
* @param {object} details - Thông tin bổ sung (vd: { key: 'Đ', song: 'Làm sao để em tựa vào' })
*/
export async function saveLog(action, userId, targetId = "soft", details = {}) {
    try {
        const logData = {
            action: action,
            userId: userId,
            targetId: targetId,
            details: details,
            timestamp: serverTimestamp()
        };
        await addDoc(collection(db, 'logs'), logData);
        console.log('Log saved successfully:', logData);
    } catch (error) {
        console.error('Error saving log:', error);
    }
}

/* Lấy 15 log gần nhất của main user từ Firestore
* @param {string} userId - ID của main user
* @returns {Promise<Array>} - Mảng các log gần nhất
*/
export async function getLogsForChibi(userId) {
    try {
        const logsRef = collection(db, 'logs');
        const logsQuery = query(
            logsRef,
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(15)
        );
        const querySnapshot = await getDocs(logsQuery);
        const logs = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const timeString = data.timestamp ? data.timestamp.toDate().toLocaleString('vi-VN', { timeZone: 'Asia/Tokyo' }) : 'Mới xong';
            logs.push({
                time: timeString,
                action: data.action,
                targetId: data.targetId,
                details: data.details
            });
        });
        return logs;
    } catch (error) {
        console.error('Error getting logs:', error);
        return [];
    }
}