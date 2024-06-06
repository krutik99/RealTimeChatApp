const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

connectDB();

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('New user connected');

    socket.on('joinRoom', async ({ username, room, isPrivate, otherUser }) => {
        let roomId = room;

        let user = await User.findOne({ username });
        if (!user) {
            user = new User({ username });
            await user.save();
        }

        if (isPrivate && otherUser) {
            const otherUserData = await User.findOne({ username: otherUser });
            if (otherUserData) {
                roomId = [username, otherUser].sort().join('-');
                let roomData = await Room.findOne({ name: roomId });
                if (!roomData) {
                    roomData = new Room({
                        name: roomId,
                        private: true,
                        users: [user._id, otherUserData._id],
                    });
                    await roomData.save();
                }
            }
        } else {
            let roomData = await Room.findOne({ name: room });
            if (!roomData) {
                roomData = new Room({
                    name: room,
                    private: false,
                    users: [user._id],
                });
                await roomData.save();
            }
        }

        socket.join(roomId);
        socket.broadcast.to(roomId).emit('message', `${username} has joined the chat`);
    });

    socket.on('chatMessage', async (msg) => {
        const { room, message, username } = msg;

        const user = await User.findOne({ username });
        const roomData = await Room.findOne({ name: room });

        if (user && roomData) {
            const newMessage = new Message({
                room: roomData._id,
                user: user._id,
                text: message,
            });

            await newMessage.save();

            io.to(room).emit('message', message);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
