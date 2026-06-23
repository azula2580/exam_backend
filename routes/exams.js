const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const ec = require('../controller/examController')
const qc = require('../controller/questionController')
const upload = require('../config/multer')
const { generateFromPDF, generateQuestionsOnly, checkOllamaConnection } = require('../controller/pdfController')

router.use(protect)

// Эдгээр route-ууд :examId параметрээс өмнө байх ёстой
router.get('/stats', authorize('admin'), ec.getExamStats)
router.get('/ollama/status', checkOllamaConnection)

// PDF-ээс асуулт үүсгэх (шалгалт хадгалахгүй - CreateExam хуудаст)
router.post(
  '/generate-from-pdf',
  authorize('teacher', 'admin'),
  upload.single('pdf'),
  generateQuestionsOnly
)

router.get('/', ec.getExams)
router.post('/', authorize('teacher','admin'),  ec.createExam)
router.get('/:id', ec.getExamById)
router.put('/:id', authorize('teacher','admin'),  ec.updateExam)
router.delete('/:id', authorize('teacher','admin'),  ec.deleteExam)
router.patch('/:id/status', authorize('teacher','admin'),  ec.updateExamStatus)

router.get('/:examId/questions', qc.getQuestions)
router.post('/:examId/questions', authorize('teacher','admin'), qc.addQuestion)
router.post('/:examId/questions/bulk', authorize('teacher','admin'), qc.addQuestionsBulk)
router.put('/:examId/questions/:qId', authorize('teacher','admin'), qc.updateQuestion)
router.delete('/:examId/questions/:qId', authorize('teacher','admin'), qc.deleteQuestion)

router.post(
  '/:examId/generate-from-pdf',
  authorize('teacher', 'admin'),
  upload.single('pdf'),         
  generateFromPDF
)

module.exports = router
