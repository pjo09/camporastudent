// ======================================================
// CAMPORA IMAGE UPLOAD ROUTE
// ======================================================

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// ======================================================
// CLOUDINARY CONFIG
// ======================================================

cloudinary.config({

    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,

    api_key: process.env.CLOUDINARY_API_KEY,

    api_secret: process.env.CLOUDINARY_API_SECRET

});

// ======================================================
// MULTER CONFIG
// ======================================================

const storage = multer.memoryStorage();

const upload = multer({

    storage,

    limits: {

        fileSize: 10 * 1024 * 1024 // 10 MB

    },

    fileFilter: (req, file, cb) => {

        const allowedTypes = [

            "image/jpeg",

            "image/jpg",

            "image/png",

            "image/webp"

        ];

        if (allowedTypes.includes(file.mimetype)) {

            cb(null, true);

        }

        else {

            cb(

                new Error(

                    "Only JPG, JPEG, PNG and WEBP images are allowed."

                )

            );

        }

    }

});

// ======================================================
// UPLOAD IMAGES
// POST /api/upload
// ======================================================

router.post(

    "/",

    auth,

    upload.array("images", 10),

    async (req, res) => {

        try {

            if (!req.files || req.files.length === 0) {

                return res.status(400).json({

                    success: false,

                    message: "Please select at least one image."

                });

            }

            const uploadedImages = [];

            for (const file of req.files) {

                const result = await new Promise((resolve, reject) => {

                    const stream = cloudinary.uploader.upload_stream(

                        {

                            folder: "campora/properties",

                            public_id:

                                `property_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,

                            resource_type: "image",

                            quality: "auto",

                            fetch_format: "auto"

                        },

                        (error, result) => {

                            if (error) {

                                reject(error);

                            }

                            else {

                                resolve(result);

                            }

                        }

                    );

                    stream.end(file.buffer);

                });

                uploadedImages.push({

                    url: result.secure_url,

                    public_id: result.public_id

                });

            }

            res.status(200).json({

                success: true,

                total: uploadedImages.length,

                images: uploadedImages

            });

        }

        catch (err) {

            console.log(err);

            res.status(500).json({

                success: false,

                message: err.message || "Image upload failed."

            });

        }

    }

);

// ======================================================
// DELETE IMAGE
// DELETE /api/upload/:publicId
// ======================================================

router.delete("/:publicId", auth, async (req, res) => {

    try {

        if (req.user.role !== "admin") {

            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });

        }

        const result = await cloudinary.uploader.destroy(

            req.params.publicId

        );

        res.json({

            success: true,

            result

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// ======================================================
// EXPORT
// ======================================================

module.exports = router;