const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
pdfjsLib.GlobalWorkerOptions.workerSrc = false

const Question = require('../models/Question')
const Exam = require('../models/Exam')

async function extractTextFromPDF(buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text.trim()
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY тохируулаагүй байна.')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq алдаа: ${response.status} - ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

function buildPrompt(text, questionCount) {
  return `Дараах текстийг уншаад яг ${questionCount} олон сонголттой тест асуулт үүсгэ.

ТЕКСТ:
${text.slice(0, 6000)}

ЗААВАЛ дагах дүрэм:
- Яг ${questionCount} асуулт үүсгэнэ
- Бүх асуулт, хариулт МОНГОЛ хэлээр байна
- Хариулт 4 сонголттой
- Зөвхөн текстэд суурилна
- Зөвхөн JSON буцаа

JSON формат:
{
  "questions": [
    {
      "text": "Асуултын текст",
      "options": ["А сонголт", "Б сонголт", "В сонголт", "Г сонголт"],
      "correctIndex": 0,
      "topic": "Сэдэв"
    }
  ]
}

Зөвхөн JSON буцаа, өөр юм бичихгүй:`
}

function parseResponse(raw) {
  let cleaned = raw.trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*"questions"[\s\S]*\}/)
  if (jsonMatch) cleaned = jsonMatch[0]
  cleaned = cleaned.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned)
}

exports.generateFromPDF = async (req, res) => {
  try {
    const { examId, questionCount = 10 } = req.body
    const exam = await Exam.findById(examId)
    if (!exam) return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })
    if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Эрхгүй.' })
    if (!req.file) return res.status(400).json({ success: false, message: 'PDF файл оруулна уу.' })

    let text
    try {
      text = await extractTextFromPDF(req.file.buffer)
    } catch (err) {
      return res.status(400).json({ success: false, message: 'PDF унших боломжгүй.' })
    }

    if (!text || text.length < 50)
      return res.status(400).json({ success: false, message: 'PDF агуулга хэтэрхий богино байна.' })

    const raw = await callGroq(buildPrompt(text, questionCount))
    let parsed
    try { parsed = parseResponse(raw) }
    catch { return res.status(500).json({ success: false, message: 'AI хариултыг задлахад алдаа гарлаа.' }) }

    if (!parsed.questions?.length)
      return res.status(500).json({ success: false, message: 'Асуулт үүсгэхэд алдаа гарлаа.' })

    const existing = await Question.countDocuments({ exam: examId })
    const toInsert = parsed.questions.map((q, i) => ({
      exam: examId, text: q.text, options: q.options,
      correctIndex: Number(q.correctIndex), topic: q.topic || '',
      order: existing + i + 1,
    }))
    const saved = await Question.insertMany(toInsert)
    res.status(201).json({ success: true, message: `${saved.length} асуулт үүсгэгдлээ.`, count: saved.length, data: saved })

  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.generateQuestionsOnly = async (req, res) => {
  try {
    const questionCount = parseInt(req.body.questionCount) || 10
    if (!req.file) return res.status(400).json({ success: false, message: 'PDF файл оруулна уу.' })

    let text
    try {
      text = await extractTextFromPDF(req.file.buffer)
    } catch (err) {
      return res.status(400).json({ success: false, message: 'PDF унших боломжгүй.' })
    }

    if (!text || text.length < 50)
      return res.status(400).json({ success: false, message: 'PDF агуулга хэтэрхий богино байна.' })

    const raw = await callGroq(buildPrompt(text, questionCount))
    let parsed
    try { parsed = parseResponse(raw) }
    catch { return res.status(500).json({ success: false, message: 'AI хариултыг задлахад алдаа гарлаа.' }) }

    if (!parsed.questions?.length)
      return res.status(500).json({ success: false, message: 'Асуулт үүсгэхэд алдаа гарлаа.' })

    res.status(200).json({
      success: true,
      message: `${parsed.questions.length} асуулт үүсгэгдлээ.`,
      questions: parsed.questions,
    })

  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
exports.checkOllamaConnection = async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY тохируулаагүй.')

    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    if (!response.ok) throw new Error('Groq холбогдоогүй')
    const data = await response.json()
    res.json({
      success: true, connected: true,
      message: 'Groq AI холбогдсон',
      model: 'llama-3.1-8b-instant',
      models: data.data?.map(m => m.id) || []
    })
  } catch (err) {
    res.status(500).json({ success: false, connected: false, message: err.message })
  }
}
