const getUserDetailsFromToken = require("../helpers/getUserDetailsFromToken");
const UserModel = require("../models/UserModel");

const updateUserDetails = async (req, res) => {
    try {
        const token = req.cookies.token || '';
        const user = await getUserDetailsFromToken(token);
        const {name , profile_pic} = req.body;

        const updatedUser = await UserModel.updateOne({ _id: user.id }, {
             name,
              profile_pic
        });

        const userInformation = await UserModel.findById(user.id);
        return res.status(200).json({
            message: 'User details updated successfully',
            success: true,
            data: userInformation
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true
        });
    }
};

module.exports = updateUserDetails; 