import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import passport from 'passport';
import cors from 'cors';
import mongoose from 'mongoose';
import './passport.js';

import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import attendanceRouter from './routes/attendance.js';

const app = express();
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(path.resolve(), 'public')));
app.use(cors());
dotenv.config();
console.log(process.env.REACT_APP_GOOGLE_CLIENT_ID);

mongoose.connect(process.env.REACT_APP_MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(passport.initialize());

app.use('/', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/attendance', attendanceRouter);

export default app;
