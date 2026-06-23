const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const sc = require('../controller/sessionController')
router.use(protect)
router.post('/start', authorize('student'), sc.startSession)
router.post('/:id/submit', authorize('student'), sc.submitSession)
router.get('/my', authorize('student', 'teacher', 'admin'), sc.getMySessions)
router.get('/exam/:examId', authorize('teacher','admin'), sc.getSessionsByExam)
router.get('/all', authorize('admin', 'teacher'), sc.getAllSessions)

module.exports = router