
// Setup basic express server
var express = require('express');
var app = express();
var crypto = require('crypto');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var config = require('./config');
var Room = require('./js/room');
var helper = require('./js/helper');
var command = require('./js/command');

// Check for config availability

if (!config) {
  throw new Error("No configuration available. See config.example.js for example.");
}

// Auth module
require('socketio-auth')(io, {
  authenticate: authenticate,
  postAuthenticate: postAuthenticate,
  timeout: 1000
});

/**
 * Процедура аутентификации пользователя
 *
 */
function authenticate(data, callback) {
  var userData = data.user;
  var md5 = crypto.createHash('md5');
  var salt = config.salt;
  var result = false;

  if (md5.update(JSON.stringify(userData)).update(salt).digest('hex') === data.hash) {
    result = true;
  }

  return callback(null, result);
}

/**
 * Обработка авторизационных данных после успешной аутентификации
 *
 */
function postAuthenticate(socket, data) {
  var userData = data.user;

  socket.user = userData;
  socket.username = userData.name;
}

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatrooms
var rooms = {};

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // if message starts with '/' — we're not sending it to everyone, we're processing it in unique way
    if (command.isCommand(data)) {
      command.processCommand(data, socket);
    } else {
      rooms[socket.room].addToHistory(socket.user, data);

      socket.broadcast.to(socket.room).emit('new message', {
        user: socket.user,
        message: data,
        room: socket.room
      });
    }
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (data) {
    // normilize room name
    var room = helper.roomNameNormilize(data.room);

    // check access
    if (room.length === 0 || !helper.checkRoomAuthorization(room, config.salt, data.roomHash)) {
        socket.emit('auth failed').disconnect('wrong room');
        return false;
    }

    socket.room = room;

    // If not authorized
    if (socket.user == undefined) {
        socket.emit('auth failed').disconnect('wrong user data');
        return false;
    }

    // Init room
    if (rooms[room] == undefined) {
        rooms[room] = new Room(room);

    }

    rooms[room].users[socket.user.id] = socket.user;
    ++rooms[room].numUsers;

    addedUser = true;

    socket.join(room);

    socket.emit('login', {
      numUsers: rooms[room].getUsersCount(),
      users: rooms[room].getUsers()
    });

    // echo to room that a person has connected
    socket.broadcast.to(socket.room).emit('user joined', {
      user: socket.user,
      numUsers: rooms[room].getUsersCount(),
      users: rooms[room].getUsers()
    });

    // History of last messages in chat
    rooms[socket.room].sendHistory(socket);
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.to(socket.room).emit('typing', {
      user: socket.user
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.to(socket.room).emit('stop typing', {
      user: socket.user
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      delete rooms[socket.room].users[socket.user.id];
      --rooms[socket.room].numUsers;

      // echo to the room that this client has left
      socket.broadcast.to(socket.room).emit('user left', {
        user: socket.user,
      numUsers: rooms[socket.room].getUsersCount(),
      users: rooms[socket.room].getUsers()
      });
    }
  });
});
