const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs')
const cookieParser = require('cookie-parser')
const morgan = require('morgan')
const connectDB = require('./config/db')
dotenv.config({ path:'./config/config.env'})
connectDB();

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials:true}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(morgan('dev'))

app.use('/api/auth', require('./routes/auth'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/sessions', require('./routes/sessions'))
app.use('/api/users',    require('./routes/users'))

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});
app.get('/', (req, res) => res.json({ message: 'API ажиллаж байна!' }))
// app.get('/api', (_req, res) => {
//   res.json({
//     name: 'Цахим шалгалт ба үнэлгээний систем API v2.0',
//     database: 'MongoDB / Mongoose',
//     roles: {
//       admin:   'Бүх хэрэглэгч, шалгалт, үр дүнг удирдана',
//       teacher: 'Шалгалт үүсгэх, засах, асуулт нэмэх, үр дүн харах',
//       student: 'Идэвхтэй шалгалт харах, шалгалт өгөх, өөрийн дүн харах',
//     },
//     endpoints: {
//       'POST /api/auth/register':              'Бүртгүүлэх',
//       'POST /api/auth/login':                 'Нэвтрэх → role-д тохирсон redirect буцаана',
//       'GET  /api/auth/me':                    'Өөрийн мэдээлэл [нэвтрэлт шаардлагатай]',
//       'GET  /api/exams':                      'Шалгалтын жагсаалт [дүрийн дагуу шүүгдэнэ]',
//       'POST /api/exams':                      'Шалгалт үүсгэх [teacher, admin]',
//       'GET  /api/exams/:id':                  'Шалгалт дэлгэрэнгүй',
//       'GET  /api/exams/:id/questions':        'Асуулт харах [student: correctIndex нуугдана]',
//       'POST /api/exams/:id/questions':        'Асуулт нэмэх [teacher, admin]',
//       'POST /api/sessions/start':             'Шалгалт эхлүүлэх [student]',
//       'POST /api/sessions/:id/submit':        'Шалгалт илгээх [student]',
//       'GET  /api/sessions/my':                'Өөрийн дүн [student]',
//       'GET  /api/sessions/exam/:id':          'Тухайн шалгалтын бүх дүн [teacher, admin]',
//       'GET  /api/users':                      'Хэрэглэгчийн жагсаалт [admin]',
//     },
//     testAccounts: {
//       admin:   { email: 'admin@exam.mn',   password: 'admin123'   },
//       teacher: { email: 'teacher@exam.mn', password: 'teacher123' },
//       student: { email: 'student1@exam.mn',password: 'student123' },
//     },
//   })
// })

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
