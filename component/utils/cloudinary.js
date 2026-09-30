const CLOUD_NAME = "zwyvvrqi"; 
const UPLOAD_PRESET = "hikari-preset";

export async function uploadToCloudinary(file) {
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