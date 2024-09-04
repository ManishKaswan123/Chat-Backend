const UserModel = require("../models/userModel");
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

const checkPassword = async (req, res) => {
    try {
        const {password , userId} = req.body;
        const user = await UserModel.findById(userId);

        const verifyPassword = await bcryptjs.compare(password, user.password);

        const tokenData = {
            id: user._id,
            email: user.email,
            name: user.name
        };
        const token = await jwt.sign(tokenData, process.env.JWT_SECRET, { expiresIn: '1d' });

        const cookieOptions = {
            http: true,
            sceure: true,
        };

        if(!verifyPassword) {
            return res.status(400).json({
                message: 'Please enter correct password!',
                error: true
            });
        }

        return res.cookie('token', token , cookieOptions).status(200).json({
            message: 'Login Successful!',
            token: token,
            success: true
        });
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true
        });
    }
};

module.exports = checkPassword;