const express = require('express')
const router  = express.Router()
const { protect } = require('../middleware/auth')
const db = require('../config/db')

router.get('/', protect, (req, res) => {
  const { examId } = req.query
  if (!examId) return res.status(400).json({ success: false, message: 'examId шаардлагатай.' })
  const q = req.user.role === 'student'
    ? db.getQuestionsForStudent(examId)
    : db.getQuestionsByExam(examId)
  return res.status(200).json({ success: true, count: q.length, data: q })
})

module.exports = router
