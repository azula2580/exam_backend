const multer = require('multer')

const storage = multer.memoryStorage() // файлыг RAM-д хадгална

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    // PDF болон application/octet-stream хүлээн авна
    const allowedTypes = ['application/pdf', 'application/octet-stream']
    if (allowedTypes.includes(file.mimetype) || file.originalname?.toLowerCase().endsWith('.pdf')) {
      cb(null, true)
    } else {
      cb(new Error('Зөвхөн PDF файл зөвшөөрнө.'), false)
    }
  },
})

module.exports = upload