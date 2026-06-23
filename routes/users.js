const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const uc = require('../controller/userController')

router.use(protect)

router.get('/', authorize('teacher', 'admin'), uc.getAllUsers)
router.get('/stats',authorize('teacher', 'admin'), uc.getUserStats)
router.post('/', authorize('admin'), uc.createUser)
router.get('/:id', authorize('teacher', 'admin'), uc.getUserById)
router.put('/:id',  authorize('admin'), uc.updateUser)
router.delete('/:id', authorize('admin'), uc.deactivateUser)

module.exports = router