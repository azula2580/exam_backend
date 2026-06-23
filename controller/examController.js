const Exam  = require('../models/Exam')
const Question  = require('../models/Question')
const ExamSession = require('../models/ExamSession')

exports.getExams = async (req, res) => {
  try {
    const { status, subject, page = 1, limit = 20 } = req.query
    const { role, _id: userId } = req.user

    const filter = {}
    if (role === 'student')  filter.status    = 'active'
    if (role === 'teacher')  filter.createdBy = userId
    if (status) filter.status    = status
    if (subject) filter.subject   = new RegExp(subject, 'i')

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await Exam.countDocuments(filter)

    const exams = await Exam.find(filter)
      .populate('createdBy', 'lastname firstname')
      .populate('questionCount')
      .populate('participantCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const enriched = await Promise.all(
      exams.map(async exam => {
        const sessions = await ExamSession.find({ exam: exam._id, submittedAt: { $ne: null } }).select('score')
        const avg = sessions.length
          ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length)
          : 0
        return { ...exam.toJSON(), avgScore: avg }
      })
    )

    res.json({ success: true, count: enriched.length, total,
      page: Number(page), pages: Math.ceil(total / Number(limit)), data: enriched })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('createdBy', 'lastname firstname email')
      .populate('questionCount')
      .populate('participantCount')
    if (!exam) return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })

    if (req.user.role === 'student' && exam.status !== 'active')
      return res.status(403).json({ success: false, message: 'Энэ шалгалтыг харах эрхгүй байна.' })
    if (req.user.role === 'teacher' && exam.createdBy._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Зөвхөн өөрийн шалгалтыг харах боломжтой.' })

    const sessions = await ExamSession.find({ exam: exam._id, submittedAt: { $ne: null } }).select('score passed')
    const scores   = sessions.map(s => s.score)
    const stats = {
      participantCount: sessions.length,
      avgScore:  scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0,
      maxScore:  scores.length ? Math.max(...scores) : 0,
      minScore:  scores.length ? Math.min(...scores) : 0,
      passCount: sessions.filter(s => s.passed).length,
      failCount: sessions.filter(s => !s.passed).length,
    }

    res.json({ success: true, data: { ...exam.toJSON(), stats } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.createExam = async (req, res) => {
  try {
    const { title, subject, description, duration, totalScore, passScore, startAt, endAt } = req.body
    if (!title || !subject || !duration)
      return res.status(400).json({ success: false, message: 'Нэр, хичээл, хугацааг заавал оруулна уу.' })

    const exam = await Exam.create({
      title, subject, description, duration, totalScore, passScore,
      startAt: startAt || null, endAt: endAt || null,
      createdBy: req.user._id,
      status: 'draft',
    })
    res.status(201).json({ success: true, message: 'Шалгалт амжилттай үүсгэгдлээ.', data: exam })
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ')
      return res.status(400).json({ success: false, message: msg })
    }
    res.status(500).json({ success: false, message: err.message,  stack: err.stack })
  }
}

exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
    if (!exam) return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })

    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Зөвхөн өөрийн шалгалтыг засах боломжтой.' })
    if (exam.status === 'closed')
      return res.status(400).json({ success: false, message: 'Хаагдсан шалгалтыг засах боломжгүй.' })

    const forbidden = ['createdBy', 'createdAt']
    forbidden.forEach(f => delete req.body[f])

    const updated = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('createdBy', 'lastname firstname')
    res.json({ success: true, message: 'Шалгалт амжилттай засагдлаа.', data: updated })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
}

exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
    if (!exam) return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Зөвхөн өөрийн шалгалтыг устгах боломжтой.' })

    await Question.deleteMany({ exam: exam._id })
    await ExamSession.deleteMany({ exam: exam._id })
    await exam.deleteOne()

    res.json({ success: true, message: 'Шалгалт болон холбоотой бүх өгөгдөл устгагдлаа.' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.updateExamStatus = async (req, res) => {
  try {
    const { status } = req.body
    if (!['draft', 'active', 'closed'].includes(status))
      return res.status(400).json({ success: false, message: 'Буруу статус.' })

    const exam = await Exam.findById(req.params.id)
    if (!exam) return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })
    if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Эрхгүй.' })

    exam.status = status
    await exam.save()
    res.json({ success: true, message: `Шалгалтын статус "${status}" болж өөрчлөгдлөө.`, data: exam })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getExamStats = async (req, res) => {
  try {
    const [total, active, draft, closed, totalParticipants] = await Promise.all([
      Exam.countDocuments(),
      Exam.countDocuments({ status: 'active' }),
      Exam.countDocuments({ status: 'draft' }),
      Exam.countDocuments({ status: 'closed' }),
      ExamSession.countDocuments({ submittedAt: { $ne: null } }),
    ])
    res.json({ success: true, data: { total, active, draft, closed, totalParticipants } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
