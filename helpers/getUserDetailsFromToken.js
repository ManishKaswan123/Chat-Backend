const jwt = require('jsonwebtoken');
const { use } = require('../routes');
const UserModel = require('../models/UserModel');
const getUserDetailsFromToken = async (token) => {
    try {
        if(!token) {
            return {
                message: 'Unauthorized',
                logout: true
            };
        };
        const decoded = await jwt.verify(token, process.env.JWT_SECRET);
        const user = await UserModel.findById(decoded.id).select('-password');

        return user;
    } catch (error) {
        return error;
    }
};

module.exports = getUserDetailsFromToken;