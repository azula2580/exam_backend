const mongoose = require('mongoose')
const examSchema = new mongoose.Schema(
  {
    title: {
      type: String, required: [true, 'Шалгалтын нэр оруулна уу.'], trim: true,
    },
    subject: {
      type: String, default: '', trim: true,
    },
    description: { type: String, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    duration:   { type: Number, required: [true, 'Хугацааг минутаар оруулна уу.'], min: 1 },
    totalScore: { type: Number, default: 100 },
    passScore:  { type: Number, default: 60 },   

    status: {
      type: String,
      enum: { values: ['draft', 'active', 'closed'], message: 'Буруу статус.' },
      default: 'draft',
    },

    startAt: { type: Date, default: null },
    endAt:   { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_, ret) { delete ret.__v; return ret } },
    toObject: { virtuals: true },
  }
)

examSchema.virtual('questionCount', {
  ref:          'Question',
  localField:   '_id',
  foreignField: 'exam',
  count:        true,
})

examSchema.virtual('participantCount', {
  ref:          'ExamSession',
  localField:   '_id',
  foreignField: 'exam',
  count:        true,
})

examSchema.index({ status: 1 })
examSchema.index({ createdBy: 1 })
examSchema.index({ subject: 1 })
module.exports = mongoose.model('Exam', examSchema)
