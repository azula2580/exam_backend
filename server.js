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

app.use(cors({ origin:[
    'http://localhost:5173',
    'http://localhost:3000',
    'https://azula2580.github.io',
  ], credentials:true}));
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
