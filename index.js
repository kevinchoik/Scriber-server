const express = require('express');
const app = express();
const morgan = require('morgan');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const translate = require('./translate');

app.use(morgan('tiny'));

let guestLangs = {};

io.on('connection', socket => {
    socket.on('disconnect', () => {
        if (guestLangs.hasOwnProperty(socket.id)) {
            delete guestLangs[socket.id];
        }
    });

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

	socket.on('newMsg', async msg => {
		const rooms = Object.keys(socket.rooms);
        const currRoom = rooms[0] === socket.id ? rooms[1] : rooms[0];
        // if (guestLangs.hasOwnProperty(socket.id)) {
        //     msg = await translate(msg, guestLangs[socket.id]);
        // }
        // msg = await translate(msg, 'ru')[0];
        // console.log(msg)
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
    
    // socket.on('translate', msgArr => {

    // })
});

const port = process.env.PORT || 3000;
server.listen(port, function() {
	console.log('Listening on %s', port);
});
