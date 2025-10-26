import multer from "multer";
import path from "path";
import fs from "fs/promises";

// File filter configuration
const fileFilter = (req, file, cb) => {
  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Type de fichier non valide"), false);
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error("Extension de fichier invalide"), false);
  }

  // Additional security checks
  if (file.originalname.includes("%00") || file.originalname.includes("..")) {
    return cb(new Error("Image invalide endommagée"), false);
  }

  cb(null, true);
};

// Error handler middleware for file upload (reusable)
export const handleFileUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "La taille du fichier dépasse la limite autorisée",
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Nombre de fichiers dépasse la limite autorisée",
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Fichier inattendu dans la requête",
        });
      default:
        return res.status(400).json({ success: false, message: err.message });
    }
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

export const singleUpload = multer({
  dest: "tmp/",
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 1,
  },
});

// Multiple files upload configuration
export const multipleUpload = multer({
  dest: "tmp/",
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    fieldSize: 50 * 1024 * 1024, // 50MB total limit
  },
});
