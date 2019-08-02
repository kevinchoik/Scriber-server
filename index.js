const express = require('express');
const app = express();
const morgan = require('morgan');
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(morgan('tiny'));

io.on('connection', socket => {
	socket.on('makeRoom', roomId => {
		const room = io.sockets.adapter.rooms[roomId];
		if (room && room.length) {
			socket.emit('dupRoom');
		} else {
			socket.join(roomId);
			socket.emit('joinRoomHost');
		}
	});

	socket.on('joinRoom', roomId => {
		const room = io.sockets.adapter.rooms[roomId];
		if (room && room.length) {
			socket.join(roomId);
			socket.emit('joinRoomGuest');
		} else {
			socket.emit('noRoom');
		}
	});

	socket.on('newMsg', msg => {
		const rooms = Object.keys(socket.rooms);
		const currRoom = rooms[0] === socket.id ? rooms[1] : rooms[0];
		io.to(currRoom).emit('newMsg', msg);
	});

	socket.on('removeMyRooms', () => {
		const rooms = socket.rooms;
		for (room in rooms) {
			if (room !== socket.id) {
				socket.leave(room);
			}
		}
	});
});

const port = process.env.PORT || 3000;
server.listen(port, function() {
	console.log('Listening on %s', port);
});
