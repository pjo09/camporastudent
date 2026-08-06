const multer = require("multer");
const path = require("path");
const fs = require("fs");

let storage;

const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                               process.env.CLOUDINARY_API_KEY && 
                               process.env.CLOUDINARY_API_SECRET && 
                               process.env.CLOUDINARY_CLOUD_NAME !== "your_cloudinary_cloud_name";

if (isCloudinaryConfigured) {
    try {
        const cloudinary = require("../config/cloudinary");
        const { CloudinaryStorage } = require("multer-storage-cloudinary");
        storage = new CloudinaryStorage({
            cloudinary,
            params: {
                folder: "campora-uploads",
                allowed_formats: ["jpg", "jpeg", "png", "webp"]
            }
        });
    } catch (e) {
        console.warn("Cloudinary storage init failed, falling back to disk storage:", e.message);
    }
}

if (!storage) {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, file.fieldname + "-" + uniqueSuffix + ext);
        }
    });
}

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, and WEBP images are allowed."), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

module.exports = upload;