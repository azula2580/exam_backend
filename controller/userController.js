const User = require('../models/User')

exports.getAllUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query
    const filter = {}
    if (role)   filter.role   = role
    if (status) filter.status = status
    if (search) filter.$or = [
      { lastname:  new RegExp(search, 'i') },
      { firstname: new RegExp(search, 'i') },
      { email:     new RegExp(search, 'i') },
    ]

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await User.countDocuments(filter)
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    res.json({
      success: true,
      count: users.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: users,
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getUserStats = async (req, res) => {
  try {
    const [total, students, teachers, admins, active, inactive] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'inactive' }),
    ])
    res.json({ success: true, data: { total, students, teachers, admins, active, inactive } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй.' })
    res.json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.createUser = async (req, res) => {
  try {
    const { lastname, firstname, email, password, role, grade } = req.body
    if (!lastname || !firstname || !email || !password || !role)
      return res.status(400).json({ success: false, message: 'Бүх заавал талбарыг бөглөнө үү.' })

    const user = await User.create({ lastname, firstname, email, password, role, grade })
    res.status(201).json({ success: true, message: 'Хэрэглэгч амжилттай нэмэгдлээ.', data: user })
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'Энэ и-мэйл аль хэдийн бүртгэгдсэн байна.' })
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ')
      return res.status(400).json({ success: false, message: msg })
    }
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.updateUser = async (req, res) => {
  try {
    delete req.body.password
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!user) return res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй.' })
    res.json({ success: true, message: 'Хэрэглэгч амжилттай засагдлаа.', data: user })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
}

exports.deactivateUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Өөрийгөө идэвхгүй болгох боломжгүй.' })

    const user = await User.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true })
    if (!user) return res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй.' })
    res.json({ success: true, message: 'Хэрэглэгч идэвхгүй болгогдлоо.' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
