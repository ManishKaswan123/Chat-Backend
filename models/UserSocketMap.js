const mongoose = require('mongoose');

const userSocketMapSchema = new mongoose.Schema({
    socketId: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
});

const UserSocketMap = mongoose.model('UserSocketMap', userSocketMapSchema);

module.exports = UserSocketMap;
