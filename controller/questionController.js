const Question = require('../models/Question')
const Exam     = require('../models/Exam')

const assertOwner = async (examId, userId, role) => {
  const exam = await Exam.findById(examId)
  if (!exam) throw { status: 404, message: 'Шалгалт олдсонгүй.' }
  if (role !== 'admin' && exam.createdBy.toString() !== userId.toString())
    throw { status: 403, message: 'Зөвхөн шалгалтыг үүсгэсэн багш асуулт удирдах боломжтой.' }
  return exam
}

exports.getQuestions = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId)
    if (!exam) return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })

    if (req.user.role === 'student' && exam.status !== 'active')
      return res.status(403).json({ success: false, message: 'Энэ шалгалтад хандах эрхгүй байна.' })

    let questions = await Question.find({ exam: req.params.examId }).sort({ order: 1 })

    if (req.user.role === 'student') {
      questions = questions.map(q => {
        const obj = q.toJSON()
        delete obj.correctIndex
        return obj
      })
    }

    res.json({ success: true, count: questions.length, data: questions })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.addQuestion = async (req, res) => {
  try {
    await assertOwner(req.params.examId, req.user._id, req.user.role)

    const { text, options, correctIndex, topic } = req.body
    if (!text || !options || options.length < 2 || correctIndex === undefined)
      return res.status(400).json({ success: false,
        message: 'Асуулт, хариултын сонголтууд (2+), зөв хариулт оруулна уу.' })

    const count = await Question.countDocuments({ exam: req.params.examId })
    const q = await Question.create({
      exam: req.params.examId, text, options,
      correctIndex: Number(correctIndex), topic: topic || '',
      order: count + 1,
    })
    res.status(201).json({ success: true, message: 'Асуулт амжилттай нэмэгдлээ.', data: q })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message })
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ')
      return res.status(400).json({ success: false, message: msg })
    }
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.addQuestionsBulk = async (req, res) => {
  try {
    console.log('BULK BODY:', JSON.stringify(req.body))
    await assertOwner(req.params.examId, req.user._id, req.user.role)
    const { questions } = req.body
    if (!Array.isArray(questions) || !questions.length)
      return res.status(400).json({ success: false, message: 'questions массив оруулна уу.' })

    const count   = await Question.countDocuments({ exam: req.params.examId })
    const toInsert = questions.map((q, i) => ({
      ...q, exam: req.params.examId, order: count + i + 1,
    }))

    const inserted = await Question.insertMany(toInsert)
    res.status(201).json({ success: true,
      message: `${inserted.length} асуулт амжилттай нэмэгдлээ.`, data: inserted })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message })
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.updateQuestion = async (req, res) => {
  try {
    await assertOwner(req.params.examId, req.user._id, req.user.role)

    const q = await Question.findOneAndUpdate(
      { _id: req.params.qId, exam: req.params.examId },
      req.body,
      { new: true, runValidators: true }
    )
    if (!q) return res.status(404).json({ success: false, message: 'Асуулт олдсонгүй.' })
    res.json({ success: true, message: 'Асуулт амжилттай засагдлаа.', data: q })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message })
    res.status(400).json({ success: false, message: err.message })
  }
}

exports.deleteQuestion = async (req, res) => {
  try {
    await assertOwner(req.params.examId, req.user._id, req.user.role)

    const q = await Question.findOneAndDelete({ _id: req.params.qId, exam: req.params.examId })
    if (!q) return res.status(404).json({ success: false, message: 'Асуулт олдсонгүй.' })

    const remaining = await Question.find({ exam: req.params.examId }).sort({ order: 1 })
    await Promise.all(remaining.map((r, i) => Question.findByIdAndUpdate(r._id, { order: i + 1 })))

    res.json({ success: true, message: 'Асуулт устгагдлаа.' })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message })
    res.status(500).json({ success: false, message: err.message })
  }
}
