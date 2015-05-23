
// Setup basic express server
var express = require('express');
var app = express();
var crypto = require('crypto');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

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

    socket.client.user = userData;
    socket.username = userData.name;
}

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

// usernames which are currently connected to the chat

var users = {};
var rooms = {};

// Some test rooms
rooms['room1'] = { name:'room1', users:{} };
rooms['room2'] = { name:'room2', users:{} };
rooms['room3'] = { name:'room3', users:{} };

// Generate room list
function getRoomList() {
  var roomList = {};
  for (var room in rooms) {
    var r = rooms[room];
    roomList[r.name] = r.name;
  }
  return roomList;
}

// Get users in the room
function getRoomsUsers(room) {
  return rooms[room].users;
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

var usernames = {};
var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // Send room list to every new socket
  socket.emit('room list', getRoomList());

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.to(socket.room).emit('new message', {
      username: socket.username,
      message: data,
      room: socket.room
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (data) {
    // normilize room name
    data.room = roomNameNormilize(data.room);

    // check access
    if (data.room.length === 0 || !checkRoomAuthorization(data.room, data.roomHash)) {
        socket.emit('auth failed').disconnect('wrong room');
    }


    // we store the username in the socket session for this client
    socket.username = data.username || socket.username;
    socket.room = data.room;
    // add the client's username to the global list
    usernames[socket.username] = socket.username;
    ++numUsers;
    // add the client's username to the rooom list
    rooms[data.room].users[data.username] = data.username;
    addedUser = true;
    socket.join(data.room);
    socket.emit('login', {
      numUsers: numUsers,
      users: getRoomsUsers(socket.room)
    });
    // echo to room that a person has connected
    socket.broadcast.to(socket.room).emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
      users: getRoomsUsers(socket.room)
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.to(socket.room).emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.to(socket.room).emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      delete rooms[socket.room].users[socket.username];
      --numUsers;

      // echo to the room that this client has left
      socket.broadcast.to(socket.room).emit('user left', {
        username: socket.username,
        numUsers: numUsers,
		users: getRoomsUsers(socket.room)
      });
    }
  });
});
