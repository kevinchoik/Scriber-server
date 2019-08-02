const express = require('express');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const translate = require('./translate');
// const multer = require('multer');
// const multerS3 = require('multer-s3');
// const aws = new require('aws-sdk');
// const s3 = new aws.S3();
const fileupload = require('express-fileupload');
const path = require('path');

app.use(morgan('tiny'));
app.use(fileupload());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'img')));

const BACKEND = 'https://obscure-basin-81956.herokuapp.com/';

app.post('/image', (req, res) => {
	console.log(req.files);
	const dest = 'image' + Date.now().toString() + '.jpg';
	console.log(dest);
	console.log(path.join('img/', dest));
	req.files.image.mv(path.join('img/', dest), err => {
		if (err) {
			console.log(err);
		} else {
			console.log('pass until here');
			const imageUri = BACKEND + dest;
			const currId = req.body.id;
			const currSocket = io.sockets.connected[currId];
			console.log(currSocket);
			const rooms = Object.keys(currSocket.rooms);
			const currRoom = rooms[0] === socket.id ? rooms[1] : rooms[0];
			res.json({ message: 'Success' });
			io.to(currRoom).emit('newMsg', { uri: imageUri });
		}
	});
	// console.log('a');
	// const currId = req.body.id;
	// console.log(currId);
	// const imageUri = req.file.location;
	// console.log(imageUri);
	// const currSocket = io.sockets.connected[currId];
	// console.log(currSocket);
	// const rooms = Object.keys(currSocket.rooms);
	// const currRoom = rooms[0] === socket.id ? rooms[1] : rooms[0];
});

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
		const clients = io.sockets.adapter.rooms[currRoom].sockets;
		const origMsg = msg;
		for (let clientId in clients) {
			msg = origMsg;
			if (guestLangs.hasOwnProperty(clientId)) {
				msg = (await translate(msg, guestLangs[clientId]))[0];
				console.log('hi');
			}
			io.sockets.connected[clientId].emit('newMsg', msg);
		}
	});

	socket.on('removeMyRooms', () => {
		const rooms = socket.rooms;
		for (room in rooms) {
			if (room !== socket.id) {
				socket.leave(room);
			}
		}
	});

	socket.on('translate', async ({ messages, language }) => {
		if (language !== 'en') {
			guestLangs[socket.id] = language;
		} else {
			if (guestLangs.hasOwnProperty(socket.id)) {
				delete guestLangs[socket.id];
			}
		}
		let returnArr = [];
		for (let i = 0; i < messages.length; i++) {
			returnArr.push((await translate(messages[i], language))[0]);
		}
		socket.emit('translate', returnArr);
	});

	socket.on('editMsg', async ({ message, index }) => {
		const rooms = Object.keys(socket.rooms);
		const currRoom = rooms[0] === socket.id ? rooms[1] : rooms[0];
		const clients = io.sockets.adapter.rooms[currRoom].sockets;
		const origMsg = message;
		for (let clientId in clients) {
			message = origMsg;
			if (guestLangs.hasOwnProperty(clientId)) {
				message = (await translate(message, guestLangs[clientId]))[0];
			}
			io.sockets.connected[clientId].emit('editMsg', { message, index });
		}
	});
});

const port = process.env.PORT || 3000;
server.listen(port, function() {
	console.log('Listening on %s', port);
});
