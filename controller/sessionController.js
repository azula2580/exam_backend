const ExamSession = require('../models/ExamSession')
const Exam = require('../models/Exam')
const Question = require('../models/Question')

exports.startSession = async (req, res) => {
  try {
    const { examId } = req.body
    if (!examId)
      return res.status(400).json({ success: false, message: 'examId оруулна уу.' })
    const exam = await Exam.findById(examId)
    if (!exam)
      return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })
    if (exam.status !== 'active')
      return res.status(400).json({ success: false, message: 'Энэ шалгалт одоогоор идэвхтэй биш байна.' })
    const done = await ExamSession.findOne({ exam: examId, student: req.user._id, submittedAt: { $ne: null } })
    if (done)
      return res.status(400).json({
        success: false,
        message: 'Та энэ шалгалтыг аль хэдийн өгсөн байна.',
        data: { sessionId: done._id, score: done.score, passed: done.passed },
      })
    const ongoing = await ExamSession.findOne({ exam: examId, student: req.user._id, submittedAt: null })
    if (ongoing)
      return res.json({
        success: true, message: 'Шалгалт үргэлжлүүлж байна.',
        data: { sessionId: ongoing._id, examDuration: exam.duration, startedAt: ongoing.startedAt },
      })
    const session = await ExamSession.create({ exam: examId, student: req.user._id })
    res.status(201).json({
      success: true, message: 'Шалгалт эхэллээ.',
      data: { sessionId: session._id, examDuration: exam.duration, startedAt: session.startedAt },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.submitSession = async (req, res) => {
  try {
    const { answers } = req.body
    if (!Array.isArray(answers))
      return res.status(400).json({ success: false, message: 'answers массив оруулна уу.' })
    const session = await ExamSession.findById(req.params.id)
    if (!session)
      return res.status(404).json({ success: false, message: 'Хуралдай олдсонгүй.' })
    if (session.student.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Эрхгүй.' })
    if (session.submittedAt)
      return res.status(400).json({ success: false, message: 'Шалгалт аль хэдийн илгээгдсэн байна.' })

    const exam = await Exam.findById(session.exam)
    const questions = await Question.find({ exam: session.exam }).sort({ order: 1 })

    const qMap = {}
    questions.forEach(q => { qMap[q._id.toString()] = q })

    const processedAnswers = answers.map(a => {
      const q = qMap[a.questionId]
      if (!q) return null
      const isCorrect = Number(a.selectedIndex) === q.correctIndex
      return { question: q._id, selectedIndex: Number(a.selectedIndex), isCorrect }
    }).filter(Boolean)

    const correct  = processedAnswers.filter(a => a.isCorrect).length
    const total    = questions.length
    const score    = total > 0 ? Math.round((correct / total) * 100) : 0
    const passed   = score >= (exam?.passScore || 60)
    const timeTaken = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000 / 60)

    session.answers = processedAnswers
    session.score = score
    session.passed = passed
    session.timeTaken = timeTaken
    session.submittedAt = new Date()
    await session.save()

    const review = questions.map(q => {
      const userAns = answers.find(a => a.questionId === q._id.toString())
      const selected = userAns ? Number(userAns.selectedIndex) : null
      return {
        questionId: q._id,
        text: q.text,
        options: q.options,
        correctIndex:  q.correctIndex,
        selectedIndex: selected,
        isCorrect:  selected !== null && selected === q.correctIndex,
        topic: q.topic,
      }
    })

    res.json({
      success: true,
      message: passed ? 'Баяр хүргэе! Та тэнцлээ.' : 'Та тэнцээгүй байна. Дараагийн удаа амжилт хүсье.',
      data: { sessionId: session._id, score, passed, timeTaken,
        correctCount: correct, totalCount: total, review },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getMySessions = async (req, res) => {
  try {
    const sessions = await ExamSession.find({
      student: req.user._id, submittedAt: { $ne: null },
    })
      .populate('exam', 'title subject duration passScore')
      .sort({ submittedAt: -1 })

    res.json({ success: true, count: sessions.length, data: sessions })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getSessionsByExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId)
    if (!exam) return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Эрхгүй.' })

    const sessions = await ExamSession.find({
      exam: req.params.examId, submittedAt: { $ne: null },
    })
      .populate('student', 'lastname firstname grade email')
      .sort({ score: -1 })

    const scores  = sessions.map(s => s.score)
    const stats = {
      count:     sessions.length,
      avgScore:  scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0,
      maxScore:  scores.length ? Math.max(...scores) : 0,
      minScore:  scores.length ? Math.min(...scores) : 0,
      passCount: sessions.filter(s => s.passed).length,
      failCount: sessions.filter(s => !s.passed).length,
    }

    res.json({ success: true, stats, data: sessions })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getAllSessions = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query
    const skip  = (Number(page)-1) * Number(limit)
    const total = await ExamSession.countDocuments({ submittedAt: { $ne: null } })

    const sessions = await ExamSession.find({ submittedAt: { $ne: null } })
      .populate('exam', 'title subject')
      .populate('student', 'lastname firstname grade')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    res.json({ success: true, count: sessions.length, total,
      page: Number(page), pages: Math.ceil(total/Number(limit)), data: sessions })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
