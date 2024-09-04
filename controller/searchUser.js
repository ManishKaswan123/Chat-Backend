const UserModel = require("../models/userModel");

const searchUser = async (req, res) => {
    try {
        const { search } = req.body;
        const query = new RegExp(search, 'i' , 'g');

        const user = await UserModel.find({
            "$or": [
                { name: query },
                { email: query }
            ]
        }).select('-password');

        res.status(200).json({
            data: user,
            success: true,
            message: 'All users'
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || error,
            error: true
        });
    }
}

module.exports = searchUser;