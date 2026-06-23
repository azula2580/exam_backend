const mongoose = require('mongoose')
const questionSchema = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Шалгалтын ID оруулна уу.'],
    },
    text: {
      type: String,
      required: [true, 'Асуултын текст оруулна уу.'],
      trim: true,
    },
    options: {
      type: [String],
      validate: {
        validator: v => Array.isArray(v) && v.length >= 2,
        message: 'Хамгийн багадаа 2 сонголт оруулна уу.',
      },
    },
    correctIndex: {
      type: Number,
      required: [true, 'Зөв хариултын индексийг оруулна уу.'],
      min: 0,
    },
    topic:  { type: String, default: '' }, 
    order:  { type: Number, default: 0 },    
  },
  {
    timestamps: true,
    toJSON: { transform(_, ret) { delete ret.__v; return ret } },
  }
)

questionSchema.pre('save', function (next) {
  if (this.correctIndex >= this.options.length) {
    return next(new Error('correctIndex нь options-н хэмжээнээс хэтэрч байна.'))
  }
  next()
})
questionSchema.index({ exam: 1, order: 1 })
module.exports = mongoose.model('Question', questionSchema)
