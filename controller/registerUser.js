const UserModel = require("../models/UserModel");
const bcryptjs = require('bcryptjs');

const registerUser = async (req, res) => {
    try {
        const { name, email, password, profile_pic } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ 
                message: 'Please fill in all fields' 
            });
        }
        const user = await UserModel.findOne({ email });
        if (user) {
            return res.status(400).json({ 
                message: 'User already exists' ,
                error: true
            });
        }

        // Password into hash password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        const payload = {
            name,
            email,
            password: hashedPassword,
            profile_pic
        };

        const newUser = new UserModel(payload);
        const userSave = await newUser.save();

        res.status(201).json({ 
            message: 'User created successfully' ,
            data: userSave,
            success: true
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            message: error.message || error
        });
    }
}

module.exports = registerUser;