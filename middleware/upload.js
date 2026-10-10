const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dribkqzom',
    api_key: process.env.CLOUDINARY_API_KEY || '938458753219558',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'Ex1didyDbLa_jSGhKSwnxkqLzOM'
});

// Alternative: Parse CLOUDINARY_URL if provided
if (process.env.CLOUDINARY_URL) {
    // CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name
    const url = process.env.CLOUDINARY_URL;
    const match = url.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
    if (match) {
        cloudinary.config({
            cloud_name: match[3],
            api_key: match[1],
            api_secret: match[2]
        });
    }
}

// Check file type
function checkFileType(file) {
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|wmv|flv|webm/;
    // Check extension
    const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());
    // Check mime type
    const mimetype = /^(image|video)\//.test(file.mimetype);

    return mimetype && extname;
}

// Storage for images (product photos, gallery)
const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'nanshhuf/products/images',
        resource_type: 'auto',
        quality: 'auto'
    }
});

// Storage for videos
const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'nanshhuf/products/videos',
        resource_type: 'video',
        quality: 'auto'
    }
});

// Combined storage that determines folder based on file type
const combinedStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        const isVideo = /video/.test(file.mimetype);
        return {
            folder: isVideo ? 'nanshhuf/products/videos' : 'nanshhuf/products/images',
            resource_type: isVideo ? 'video' : 'auto',
            quality: 'auto'
        };
    }
});

// Init uploads with different storage configurations
const uploadImages = multer({
    storage: imageStorage,
    limits: {
        fileSize: 50000000 // 50MB limit
    },
    fileFilter: function (req, file, cb) {
        if (checkFileType(file)) {
            cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed!'));
        }
    }
});

const uploadCombined = multer({
    storage: combinedStorage,
    limits: {
        fileSize: 50000000 // 50MB limit
    },
    fileFilter: function (req, file, cb) {
        if (checkFileType(file)) {
            cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed!'));
        }
    }
});

// Export different upload configurations
module.exports = {
    // Single file uploads
    single: (fieldName) => uploadCombined.single(fieldName),

    // Multiple files of same type
    array: (fieldName, maxCount) => uploadCombined.array(fieldName, maxCount),

    // Multiple files of different types (for product form)
    fields: uploadCombined.any(),

    // Direct multer instance for custom configurations
    upload: uploadCombined,

    // Cloudinary instance for direct operations if needed
    cloudinary: cloudinary
};