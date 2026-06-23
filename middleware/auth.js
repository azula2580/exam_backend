const jwt  = require('jsonwebtoken')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'exam_dev_secret'

const generateToken = (userId) =>
  jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Нэвтрэх шаардлагатай. Токен олдсонгүй.' })
    }

    const token   = header.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)

    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({ success: false, message: 'Хэрэглэгч олдсонгүй.' })
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Таны бүртгэл идэвхгүй байна.' })
    }

    req.user = user
    next()
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Токен хугацаа дууссан. Дахин нэвтэрнэ үү.'
      : 'Токен хүчингүй байна.'
    return res.status(401).json({ success: false, message: msg })
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Эрхгүй. Шаардлагатай дүр: [${roles.join(', ')}]. Таны дүр: ${req.user.role}`,
    })
  }
  next()
}
module.exports = { protect, authorize, generateToken }