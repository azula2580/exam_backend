const mongoose = require('mongoose')
const answerSchema = new mongoose.Schema(
  {
    question:     { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedIndex: { type: Number, required: true },   
    isCorrect:    { type: Boolean, required: true },
  },
  { _id: false }
)

const examSessionSchema = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    answers:    { type: [answerSchema], default: [] },
    score:      { type: Number, default: null },    
    passed:     { type: Boolean, default: null },
    timeTaken:  { type: Number, default: null },    

    startedAt:   { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_, ret) { delete ret.__v; return ret } },
    toObject: { virtuals: true },
  }
)

examSessionSchema.index({ exam: 1, student: 1 }, { unique: true })
examSessionSchema.index({ student: 1 })
examSessionSchema.index({ exam: 1 })

examSessionSchema.methods.calculateScore = function () {
  if (!this.answers.length) return 0
  const correct = this.answers.filter(a => a.isCorrect).length
  return Math.round((correct / this.answers.length) * 100)
}
module.exports = mongoose.model('ExamSession', examSessionSchema)
