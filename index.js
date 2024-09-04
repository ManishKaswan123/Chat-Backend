const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/connectDB');
const router = require('./routes');
const cookieParser = require('cookie-parser');
const PORT = process.env.PORT || 4000;
const {app , server} = require('./socket/index');

// const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL ,
    credentials: true
}));


app.get('/', (req, res) => {
    res.json({ message: 'Hello from server!' });
});

// API endpoints
app.use('/api', router);

connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});