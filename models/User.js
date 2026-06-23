const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    lastname:  { type: String, required: [true, 'Овог оруулна уу.'],  trim: true },
    firstname: { type: String, required: [true, 'Нэр оруулна уу.'],   trim: true },
    email: {
      type: String, required: [true, 'И-мэйл оруулна уу.'],
      unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, 'И-мэйл хаяг буруу байна.'],
    },
    password: {
      type: String, required: [true, 'Нууц үг оруулна уу.'],
      minlength: [6, 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.'],
      select: false,  
    },
    role: {
      type: String,
      enum: { values: ['admin', 'teacher', 'student'], message: 'Буруу дүр.' },
      default: 'student',
    },
    studentID:  { type: String, default: null }, 
    phone:  { type: String, default: null },
    status: {
      type: String, enum: ['active', 'inactive'], default: 'active',
    },
  },
  {
    timestamps: true,      
    toJSON: {
      transform(_, ret) {
        delete ret.password
        delete ret.__v
        return ret
      },
    },
  }
)

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 10)
})

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password)
}

userSchema.methods.getFullName = function () {
  return `${this.lastname} ${this.firstname}`
}

userSchema.statics.findByRole = function (role) {
  return this.find({ role, status: 'active' })
}
module.exports = mongoose.model('User', userSchema)
