
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
}

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatrooms
var rooms = {};
var flood = {};

io.on('connection', function (socket) {
  var isAuthenticated = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    if (!isAuthenticated) {
      return false;
    }

    // if message starts with '/' — we're not sending it to everyone, we're processing it in unique way
    if (command.isCommand(data)) {
      command.processCommand(data, socket);
      return true;
    }

    if (flood[socket.user.id] >= 30) {
      // ban


      return false;
    }

    var messageId = crypto.createHash('md5');
    messageId = messageId.update(data).digest('hex');

    var message = {
      id: messageId,
      user: socket.user,
      message: data
    };

    io.to(socket.room).emit('new message', message);

    rooms[socket.room].addToHistory(message);

    if (flood[socket.user.id] == undefined) {
      flood[socket.user.id] = 1;
    } else {
      flood[socket.user.id]++;
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

    // Prevent reading from multiple rooms
    if (socket.room) {
      socket.leave(socket.room);
      rooms[socket.room].removeUser(socket.user.id, socket);
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

    socket.join(room);
    isAuthenticated = true;

    rooms[room].addUser(socket.user, socket);

    socket.emit('login', {
      numUsers: rooms[room].getUsersCount(),
      users: rooms[room].getUsers()
    });

    // History of last messages in chat
    rooms[socket.room].sendHistory(socket);
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    if (!isAuthenticated) {
      return false;
    }

    socket.broadcast.to(socket.room).emit('typing', {
      user: socket.user
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    if (!isAuthenticated) {
      return false;
    }

    socket.broadcast.to(socket.room).emit('stop typing', {
      user: socket.user
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (!isAuthenticated) {
      return false;
    }

    rooms[socket.room].removeUser(socket.user.id, socket);
  });
});

var antiflood = setInterval(function(){
  flood = {};
}, 60000);