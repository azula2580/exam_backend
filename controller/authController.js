const User = require('../models/User')
const { generateToken } = require('../middleware/auth')

const REDIRECT = { admin: '/dashboard', teacher: '/dashboard', student: '/' }
// Оюутан өөрөө бүртгүүлэх боломжгүй - зөвхөн login хийнэ
exports.register = async (req, res) => {
  return res.status(403).json({ 
    success: false, 
    message: 'Оюутан өөрөө бүртгүүлэх боломжгүй. Админ эсвэл багш таныг бүртгэнэ.' 
  })
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'И-мэйл болон нууц үгийг оруулна уу.' })

    const user = await User.findOne({ email }).select('+password')
    if (!user)
      return res.status(401).json({ success: false, message: 'И-мэйл эсвэл нууц үг буруу байна.' })
    if (user.status !== 'active')
      return res.status(403).json({ success: false, message: 'Таны бүртгэл идэвхгүй байна.' })

    const isMatch = await user.comparePassword(password)
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'И-мэйл эсвэл нууц үг буруу байна.' })

    const token = generateToken(user._id)
    res.json({ success: true, message: 'Амжилттай нэвтэрлээ.',
      data: { user: user.toJSON(), token, redirect: REDIRECT[user.role] } })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Серверийн алдаа.' })
  }
}

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
  res.json({ success: true, data: { user } })
}

exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['lastname', 'firstname', 'phone', 'studentId']
    const updates = {}
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true })
    res.json({ success: true, message: 'Мэдээлэл амжилттай шинэчлэгдлээ.', data: { user } })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
}

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Одоогийн болон шинэ нууц үгийг оруулна уу.' })
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.' })

    const user = await User.findById(req.user._id).select('+password')
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Одоогийн нууц үг буруу байна.' })

    user.password = newPassword
    await user.save()
    res.json({ success: true, message: 'Нууц үг амжилттай солигдлоо.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Серверийн алдаа.' })
  }
}
