const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const getUserDetailsFromToken = require('../helpers/getUserDetailsFromToken');
const UserModel = require('../models/userModel');
const { ConversationModel, MessageModel } = require('../models/ConversationModel');
const getConversation = require('../helpers/getConversation');
const ACTIONS = require('../Action');
const UserSocketMap = require('../models/UserSocketMap');

const app = express();

// Socket connection
const server = http.createServer(app);
const io = new Server(server,{
    cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true,
    }
});

// Online user
const onlineUser = new Set();

// save last code change
const lastCodeChange = {};

// save last language change
const lastLanguageChange = {};

// Get All connected clients
const getAllConnectedClients = (roomId) => {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => socketId);
}

io.on('connection', async (socket) => {
    const token = socket?.handshake?.auth?.token;

    // Current user details
    const user = await getUserDetailsFromToken(token);
    // Create a room for the user
    socket.join(user?._id?.toString());
    onlineUser.add(user?._id?.toString());

    io.emit('onlineUser', Array.from(onlineUser));

    socket.on('message-page', async (userId) => {
        const userDetails = await UserModel.findById(userId).select('-password');
        const payload = {
            _id : userDetails?._id,
            name : userDetails?.name,
            email : userDetails?.email,
            online : onlineUser.has(userId),
            profile_pic : userDetails?.profile_pic
        };

        socket.emit('message-user', payload);

        // Get Previous message
        const getConversationMessage = await ConversationModel.findOne({
            '$or' : [
                { sender : user?._id, receiver : userId },
                { sender : userId, receiver : user?._id }
            ]
        }).populate('messages').sort({updatedAt: -1});

        let messagesToSend = [];
        
        if (getConversationMessage) {
            // Find the entry in clearAll for the current user
            const userClearEntry = getConversationMessage?.clearAll?.find(
                (entry) => entry?.user?.toString() === user?._id?.toString()
            );
        
            if (userClearEntry) {
                // Filter messages that were created after the `date` in the clearAll entry
                messagesToSend = getConversationMessage?.messages?.filter(
                    (message) => new Date(message?.createdAt) > new Date(userClearEntry?.date)
                );
            } else {
                // If the userClearEntry does not exist, send all messages
                messagesToSend = getConversationMessage?.messages;
            }
        }

        let newMessages = {
            messages : messagesToSend,
            viewMessageBy : user?._id,
            viewMessageOf : userId
        }

        socket.emit('message', newMessages); 
    });


    // New message
    socket.on('new-message', async (data) => {
        // Check conversation exists or not
        let conversation = await ConversationModel.findOne({
            '$or' : [
                { sender : data?.sender, receiver : data?.receiver },
                { sender : data?.receiver, receiver : data?.sender }
            ]
        });

        // If conversation not exists
        if(!conversation){
            const newConversation = new ConversationModel({
                sender : data?.sender,
                receiver : data?.receiver,
            });
            conversation = await newConversation.save();
        }
        const message = new MessageModel({
            text : data?.text,
            imageUrl : data?.imageUrl,
            videoUrl : data?.videoUrl,
            msgByUserId : data?.msgByUserId
        })

        const saveMessage = await message.save();
        const updateConversation = await ConversationModel.updateOne({_id: conversation?._id}, {
            "$push" : {
                messages: saveMessage?._id
            }
        })

        const getConversationMessage = await ConversationModel.findOne({
            '$or' : [
                { sender : data?.sender, receiver : data?.receiver },
                { sender : data?.receiver, receiver : data?.sender }
            ]
        }).populate('messages').sort({updatedAt: -1});
        
        let messagesToSend = [];
        
        if (getConversationMessage) {
            // Find the entry in clearAll for the current user
            const userClearEntry = getConversationMessage?.clearAll?.find(
                (entry) => entry?.user?.toString() === data?.sender?.toString()
            );
        
            if (userClearEntry) {
                // Filter messages that were created after the `date` in the clearAll entry
                messagesToSend = getConversationMessage?.messages?.filter(
                    (message) => new Date(message?.createdAt) > new Date(userClearEntry?.date)
                );
            } else {
                // If the userClearEntry does not exist, send all messages
                messagesToSend = getConversationMessage?.messages;
            }
        }

        let messagesToSend2 = [];
        
        if (getConversationMessage) {
            // Find the entry in clearAll for the current user
            const userClearEntry = getConversationMessage?.clearAll?.find(
                (entry) => entry?.user?.toString() === data?.receiver?.toString()
            );
        
            if (userClearEntry) {
                // Filter messages that were created after the `date` in the clearAll entry
                messagesToSend2 = getConversationMessage?.messages?.filter(
                    (message) => new Date(message?.createdAt) > new Date(userClearEntry?.date)
                );
            } else {
                // If the userClearEntry does not exist, send all messages
                messagesToSend2 = getConversationMessage?.messages;
            }
        }

        let newMessages1 = {
            messages : messagesToSend,
            viewMessageBy : data?.sender,
            viewMessageOf : data?.receiver
        }

        let newMessages2 = {
            messages : messagesToSend2,
            viewMessageBy : data?.receiver,
            viewMessageOf : data?.sender
        }

        io.to(data?.sender).emit('message', newMessages1);
        io.to(data?.receiver).emit('message', newMessages2);

        // Send conversation to sidebar
        const conversationSender = await getConversation(data?.sender);
        io.to(data?.sender).emit('conversation', conversationSender);

        const conversationReceiver = await getConversation(data?.receiver);
        io.to(data?.receiver).emit('conversation', conversationReceiver);
    });



    // Sidebar
    socket.on('sidebar', async (currentUserId) => {
        const conversation = await getConversation(currentUserId);
         socket.emit('conversation', conversation);
    });

    // Message seen
    socket.on('seen' , async(msgByUserId) => {
        const conversation = await ConversationModel.findOne({
            '$or' : [
                { sender : user?._id, receiver : msgByUserId },
                { sender : msgByUserId, receiver : user?._id }
            ]
        });

        const connectionMessageId = conversation?.messages || [];
        const updateMessage = await MessageModel.updateMany({
            _id : { '$in' : connectionMessageId },
            msgByUserId : msgByUserId
        }, {
            '$set' : { seen : true }
        });

         // Send conversation to sidebar
         const conversationSender = await getConversation(user?._id?.toString());
         io.to(user?._id?.toString()).emit('conversation', conversationSender);
 
         const conversationReceiver = await getConversation(msgByUserId);
         io.to(msgByUserId).emit('conversation', conversationReceiver);
    })

    // Clear all message
    socket.on('clear-chats', async (receiver) => {
        const conversation = await ConversationModel.findOne({
            '$or': [
                { sender: user?._id, receiver },
                { sender: receiver, receiver: user?._id }
            ]
        });

        if (conversation) {
            const userInClearAll = conversation?.clearAll?.find(
                (entry) => entry?.user?.toString() === user?._id?.toString()
            );
        
            if (userInClearAll) {
                // Update the date for the existing user in the clearAll array
                await ConversationModel.updateOne(
                    { _id: conversation?._id, 'clearAll.user': user?._id },
                    {
                        $set: {
                            'clearAll.$.date': new Date(),
                            updatedAt: new Date()
                        }
                    }
                );
            } else {
                // Add a new entry for the user in the clearAll array
                await ConversationModel.updateOne(
                    { _id: conversation?._id },
                    {
                        $addToSet: {
                            clearAll: { user: user?._id, date: new Date() }
                        },
                        $set: {
                            updatedAt: new Date()
                        }
                    }
                );
            }

        }

        const getConversationMessage = await ConversationModel.findOne({
            '$or': [
                { sender: user?._id, receiver: receiver },
                { sender: receiver, receiver: user?._id }
            ]
        }).populate('messages').sort({ updatedAt: -1 });
        
        let messagesToSend = [];
        
        if (getConversationMessage) {
            // Find the entry in clearAll for the current user
            const userClearEntry = getConversationMessage?.clearAll?.find(
                (entry) => entry?.user?.toString() === user?._id?.toString()
            );
        
            if (userClearEntry) {
                // Filter messages that were created after the `date` in the clearAll entry
                messagesToSend = getConversationMessage?.messages?.filter(
                    (message) => new Date(message.createdAt) > new Date(userClearEntry.date)
                );
            } else {
                // If the userClearEntry does not exist, send all messages
                messagesToSend = getConversationMessage?.messages;
            }
        }
        
        let newMessages2 = {
            messages : messagesToSend,
            viewMessageBy : user?._id,
            viewMessageOf : receiver
        }

        // Emit the appropriate messages to the sender
        io.to(user?._id).emit('message', newMessages2);
        
    });
    
    // Remove user from friend list
    socket.on('remove', async (userId) => {
        const conversation = await ConversationModel.findOne({
            '$or' : [
                { sender: user?._id, receiver: userId },
                { sender: userId, receiver: user?._id }
            ]
        });
    
        if (conversation) {
            // Delete all messages associated with the conversation
            await MessageModel.deleteMany({ _id: { $in: conversation.messages } });
    
            // Delete the conversation itself
            await ConversationModel.deleteOne({ _id: conversation._id });
        }
    
        // Send updated conversation list to the sender
        const conversationSender = await getConversation(user?._id?.toString());
        io.to(user?._id?.toString()).emit('conversation', conversationSender);
    
        // Send updated conversation list to the receiver
        const conversationReceiver = await getConversation(userId);
        io.to(userId).emit('conversation', conversationReceiver);
    });
    

    // Join Room
    socket.on(ACTIONS.JOIN, async(data) => {
        const {roomId , userId} = data;
        const userSocketMap = await UserSocketMap.findOneAndUpdate(
            { userId }, // Find by userId
            { socketId: socket?.id }, // Update the socketId
            { new: true, upsert: true } // Create a new one if it doesn't exist
        );
        
        // console.log('UserSocketMap result:', userSocketMap);
        

        await userSocketMap.save();

        socket.join(roomId);

        const clients = getAllConnectedClients(roomId);
        const populatedClients = await UserSocketMap.find({ socketId: { $in: clients } }).populate('userId');
        const addeduser = await UserModel.findById(userId).select('-password');

        populatedClients.forEach((client) => {
            io.to(client?.socketId).emit(ACTIONS.JOINED, {
                populatedClients,
                user: addeduser,
                socketId: socket?.id
            });
        });

        let prevCode = lastCodeChange[roomId];
        let prevLanguage = lastLanguageChange[roomId];
        io.to(roomId).emit(ACTIONS.SYNC_CODE, prevCode);
        io.to(roomId).emit('language-update', prevLanguage);
    });
    
    // Change Code
    socket.on(ACTIONS.CODE_CHANGE, async(data) => {
        const {roomId, code} = data;
        lastCodeChange[roomId] = code;
        io.to(roomId).emit(ACTIONS.SYNC_CODE, code);

        // const clients = getAllConnectedClients(roomId);
        // clients.forEach((client) => {
        //     io.to(client).emit(ACTIONS.CODE_CHANGED, code);
        // });
    });

    // language change
    socket.on('language-change', async(data) => {
        const {roomId, language} = data;
        lastLanguageChange[roomId] = language;
        io.to(roomId).emit('language-update', language);
    });

    // Leave Room
    socket.on(ACTIONS.LEAVE, async (data) => {
        const { roomId, userId } = data;
        // Find and remove the user from the UserSocketMap
        const userSocketMap = await UserSocketMap.findOneAndDelete({ userId });
        // Leave the socket room
        socket.leave(roomId);
        // Notify others in the room that the user has left
        const clients = getAllConnectedClients(roomId);
        const populatedClients = await UserSocketMap.find({ socketId: { $in: clients } }).populate('userId');
        const removedUser = await UserModel.findById(userId).select('-password');
        populatedClients.forEach((client) => {
            io.to(client?.socketId).emit(ACTIONS.LEFT, {
                populatedClients,
                user: removedUser,
                socketId: socket?.id,
            });
        });
        // If the user was the last one in the room, you can optionally clean up any resources here
        // Optionally, remove previous code/language changes for this user
        if (!clients.length) {
            delete lastCodeChange[roomId];
            delete lastLanguageChange[roomId];
        }
    });

    // Disconnect 
    socket.on('disconnect', () => {
        onlineUser.delete(user?._id?.toString());
    });
});

module.exports = { 
    app,
    server
};