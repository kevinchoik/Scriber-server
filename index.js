const express = require('express');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const translate = require('./translate');
const fileupload = require('express-fileupload');
const path = require('path');

// Middlewares
app.use(morgan('tiny'));
app.use(fileupload());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'img')));

// const BACKEND = 'https://obscure-basin-81956.herokuapp.com/';
const BACKEND = 'http://192.168.1.88:3000/';

// Upload the image and emit to room
app.post('/image', (req, res) => {
	// Using current timestamp ensures unique filename
	const dest = 'image' + Date.now().toString() + '.jpg';
	// Move the image to img directory on server
	req.files.image.mv(path.join(__dirname, 'img/', dest), err => {
		if (err) {
			// Failed to upload image
			console.log(err);
		} else {
			const imageUri = BACKEND + dest;
			// Retreive current room
			const currId = req.body.id;
			const currSocket = io.sockets.connected[currId];
			const rooms = Object.keys(currSocket.rooms);
			const currRoom = rooms[0] === currId ? rooms[1] : rooms[0];
			// Emit to current room and respond success
			io.to(currRoom).emit('newMsg', { uri: imageUri });
			res.json({ message: 'Success' });
		}
	});
});

// Language preference object for each connected user
// Default is english ('en')
let guestLangs = {};

io.on('connection', socket => {
	socket.on('disconnect', () => {
		// Remove user's language preference data
		if (guestLangs.hasOwnProperty(socket.id)) {
			delete guestLangs[socket.id];
		}
	});

	// Host creating a room
	socket.on('makeRoom', roomId => {
		const room = io.sockets.adapter.rooms[roomId];
		if (room && room.length) {
			// Room already populated
			socket.emit('dupRoom');
		} else {
			// Successfully create room
			socket.join(roomId);
			socket.emit('joinRoomHost');
		}
	});

	// Guest joining a room
	socket.on('joinRoom', roomId => {
		const room = io.sockets.adapter.rooms[roomId];
		if (room && room.length) {
			// Successfully join room
			socket.join(roomId);
			socket.emit('joinRoomGuest');
		} else {
			// Room is not populated; does not exist
			socket.emit('noRoom');
		}
	});

	// Emit received message to all clinets in room, translating as necessary
	socket.on('newMsg', async msg => {
		// Retreive current room
		const rooms = Object.keys(socket.rooms);
		const currRoom = rooms[0] === socket.id ? rooms[1] : rooms[0];
		// Retreive all clients
		const clients = io.sockets.adapter.rooms[currRoom].sockets;
		const origMsg = msg;
		for (let clientId in clients) {
			msg = origMsg;
			if (guestLangs.hasOwnProperty(clientId)) {
				// Translate message if necessary
				msg = (await translate(msg, guestLangs[clientId]))[0];
			}
			// Emit message to client
			io.sockets.connected[clientId].emit('newMsg', msg);
		}
	});

	// Leave all rooms except for default room (id of socket)
	socket.on('removeMyRooms', () => {
		const rooms = socket.rooms;
		for (room in rooms) {
			if (room !== socket.id) {
				socket.leave(room);
			}
		}
	});

	// Translate all messages
	socket.on('translate', async ({ messages, language }) => {
		// Update langauge preference object
		if (language !== 'en') {
			guestLangs[socket.id] = language;
		} else {
			if (guestLangs.hasOwnProperty(socket.id)) {
				delete guestLangs[socket.id];
			}
		}
		let returnArr = [];
		for (let i = 0; i < messages.length; i++) {
			if (typeof messages[i] === 'string') {
				// Translate if the message contains text
				returnArr.push((await translate(messages[i], language))[0]);
			} else {
				// Simply push if the message contains an image
				returnArr.push(messages[i]);
			}
		}
		// Emit back to client
		socket.emit('translate', returnArr);
	});

	// Edit certain message and emit to all clients in room, translating as necessary
	socket.on('editMsg', async ({ message, index }) => {
		// Retreive clients
		const rooms = Object.keys(socket.rooms);
		const currRoom = rooms[0] === socket.id ? rooms[1] : rooms[0];
		const clients = io.sockets.adapter.rooms[currRoom].sockets;
		const origMsg = message;
		for (let clientId in clients) {
			message = origMsg;
			if (guestLangs.hasOwnProperty(clientId)) {
				// Translate message if necessary
				message = (await translate(message, guestLangs[clientId]))[0];
			}
			// Emit message to client along with index of message
			io.sockets.connected[clientId].emit('editMsg', { message, index });
		}
	});
});

// Listen to provided port or default to 3000
const port = process.env.PORT || 3000;
server.listen(port, function() {
	console.log('Listening on %s', port);
});
