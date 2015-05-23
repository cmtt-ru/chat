
// Setup basic express server
var express = require('express');
var app = express();
var crypto = require('crypto');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

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
  var salt = 'euc3Karc4uN9yEk9vA';
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

// Chatroom

// usernames which are currently connected to the chat

var rooms = {};

// Get users in the room
function getRoomsUsers(room) {
  return rooms[room].users;
}

function getRoomsUsersCount(room) {
  return rooms[room].numUsers;
}

function roomInitialize(room) {
  rooms[room] = {
    users: {},
    history: [],
    numUsers: 0
  };
}

function roomAddToHistory(room, user, data) {
  rooms[room].history.push({message: data, user: user});
  if (rooms[room].history.length > 30) {
      history.shift();
  }
}

/**
 * Чистим название комнаты от посторонних символов
 *
 * @param  string name
 *
 * @return string
 */
function roomNameNormilize(name) {
  return name.replace(/[^a-z0-9-]/ig, '');
}

/**
 * Проверяем доступ пользователя к комнате
 *
 * @param  string name
 * @param  string hash
 *
 * @return boolean
 */
function checkRoomAuthorization(name, hash) {
  var md5 = crypto.createHash('md5');
  var salt = 'euc3Karc4uN9yEk9vA';

  if (md5.update(name).update(salt).digest('hex') === hash) {
    return true;
  }

  return false;
}

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    roomAddToHistory(socket.room, socket.user, data);

    socket.broadcast.to(socket.room).emit('new message', {
      user: socket.user,
      message: data,
      room: socket.room
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (data) {
    // normilize room name
    var room = roomNameNormilize(data.room);

    // check access
    if (room.length === 0 || !checkRoomAuthorization(room, data.roomHash)) {
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
        roomInitialize(room);
    }

    rooms[room].users[socket.user.id] = socket.user;
    ++rooms[room].numUsers;

    addedUser = true;

    socket.join(room);

    socket.emit('login', {
      numUsers: getRoomsUsersCount(room),
      users: getRoomsUsers(room)
    });

    // echo to room that a person has connected
    socket.broadcast.to(socket.room).emit('user joined', {
      user: socket.user,
      numUsers: getRoomsUsersCount(room),
      users: getRoomsUsers(room)
    });

    // History of last messages in chat
    if (rooms[room].history.length > 0) {
      rooms[room].history.forEach(function(data) {
        socket.emit('new message', {
          user: data.user,
          message: data.message,
          room: room
        });
      });
    }
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
        numUsers: getRoomsUsersCount(socket.room),
        users: getRoomsUsers(socket.room)
      });
    }
  });
});
