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

// Нэг асуулт үүсгэх — JSON богино тул таслагдахгүй
async function generateOneQuestion(text, index, total) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)

  const prompt = `Read this text and create 1 multiple choice question.

  TEXT: ${text.slice(0, 2000)}

  You must respond with ONLY this exact JSON format:
  {"text":"Write the full question here?","options":["First answer choice","Second answer choice","Third answer choice","Fourth answer choice"],"correctIndex":1,"topic":"Topic name"}

  Important rules:
  - "text" must be a proper question ending with "?"
  - "options" must have exactly 4 DIFFERENT answer choices (not "option A", "option B")
  - "correctIndex" is 0, 1, 2, or 3 (which option is correct)
  - "topic" is the subject area
  - Write everything in MONGOLIAN language
  - This is question number ${index} of ${total}, make it different from other questions
  - NO markdown, NO explanation, ONLY the JSON object`
  try {
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        system: 'Respond with valid JSON only. No explanation, no markdown.',
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 300, num_ctx: 2048 }
      })
    })
    if (!response.ok) throw new Error(`Ollama алдаа: ${response.status}`)
    const data = await response.json()
    const raw = data.response?.trim() || ''

    // JSON задлах
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('JSON олдсонгүй')
    const q = JSON.parse(raw.slice(start, end + 1))
    if (!q.text || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error('хариулт буруу форматтай байна')
    }
    return q
  } finally {
    clearTimeout(timeout)
  }
}

exports.generateFromPDF = async (req, res) => {
  try {
    const { examId, questionCount = 5 } = req.body
    const exam = await Exam.findById(examId)
    if (!exam) return res.status(404).json({ success: false, message: 'Шалгалт олдсонгүй.' })
    if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Эрхгүй.' })
    if (!req.file) return res.status(400).json({ success: false, message: 'PDF файл оруулна уу.' })

    console.log('[PDF] File received:', req.file.originalname, req.file.size, 'bytes')
    let text
    try { text = await extractTextFromPDF(req.file.buffer) }
    catch (e) { return res.status(400).json({ success: false, message: 'PDF файлыг унших боломжгүй.' }) }
    console.log('[PDF] Extracted text length:', text?.length || 0)
    if (!text || text.length < 50)
      return res.status(400).json({ success: false, message: 'PDF-ийн агуулга хэтэрхий богино байна.' })

    const count = Math.min(parseInt(questionCount) || 5, 10)
    const questions = []
    for (let i = 1; i <= count; i++) {
      console.log(`[PDF] Асуулт ${i}/${count} үүсгэж байна...`)
      try {
        const q = await generateOneQuestion(text, i, count)
        questions.push(q)
      } catch (e) {
        console.warn(`[PDF] Асуулт ${i} алдаа:`, e.message)
      }
    }

    if (!questions.length)
      return res.status(500).json({ success: false, message: 'Асуулт үүсгэхэд алдаа гарлаа.' })

    const existing = await Question.countDocuments({ exam: examId })
    const saved = await Question.insertMany(questions.map((q, i) => ({
      exam: examId, text: q.text, options: q.options,
      correctIndex: Number(q.correctIndex), topic: q.topic || '', order: existing + i + 1,
    })))

    res.status(201).json({
      success: true,
      message: `${saved.length} асуулт амжилттай үүсгэгдлээ.`,
      count: saved.length, data: saved,
    })
  } catch (err) {
    console.error('[PDF] Generate error:', err)
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.generateQuestionsOnly = async (req, res) => {
  try {
    const questionCount = Math.min(parseInt(req.body.questionCount) || 5, 10)
    if (!req.file) return res.status(400).json({ success: false, message: 'PDF файл оруулна уу.' })

    console.log('[PDF] File received:', req.file.originalname, req.file.size, 'bytes')
    let text
    try { text = await extractTextFromPDF(req.file.buffer) }
    catch (e) { return res.status(400).json({ success: false, message: 'PDF файлыг унших боломжгүй.' }) }
    console.log('[PDF] Extracted text length:', text?.length || 0)
    if (!text || text.length < 50)
      return res.status(400).json({ success: false, message: 'PDF-ийн агуулга хэтэрхий богино байна.' })

    const questions = []
    for (let i = 1; i <= questionCount; i++) {
      console.log(`[PDF] Асуулт ${i}/${questionCount} үүсгэж байна...`)
      try {
        const q = await generateOneQuestion(text, i, questionCount)
        questions.push(q)
      } catch (e) {
        console.warn(`[PDF] Асуулт ${i} алдаа:`, e.message)
      }
    }

    if (!questions.length)
      return res.status(500).json({ success: false, message: 'Асуулт үүсгэхэд алдаа гарлаа.' })

    res.status(200).json({
      success: true,
      message: `${questions.length} асуулт амжилттай үүсгэгдлээ.`,
      questions,
    })
  } catch (err) {
    console.error('[PDF] Generate error:', err)
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.checkOllamaConnection = async (req, res) => {
  try {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) throw new Error('Ollama холбогдоогүй')
    const data = await response.json()
    const models = data.models?.map(m => m.name) || []
    res.json({ success: true, connected: true, message: 'Ollama холбогдсон', models, model: process.env.OLLAMA_MODEL || 'llama3.2' })
  } catch (err) {
    res.status(500).json({ success: false, connected: false, message: 'Ollama сервер ажиллахгүй байна.', error: err.message })
  }
}