import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import baseRouter from './routes/baseRouter';

const app = express();
const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true }));

app.use(express.json({limit: '5mb'}));
app.use(express.urlencoded({ extended: true }));

app.use('/api', baseRouter);

app.listen(PORT, () => {
    console.log(`Server is running on http://${HOST}:${PORT}/api`);
});