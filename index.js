
// Setup basic express server
var express = require('express');
var app = express();
var crypto = require('crypto');
var _redis = require('redis'), redis = _redis.createClient();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var config = require('./config');
var Room = require('./js/room');
var helper = require('./js/helper');

// Check for config availability

if (!config) {
  throw new Error("No configuration available. See config.example.js for example.");
}

redis.on('error', function (err) {
  console.log("Error " + err);
});

var redisReady = false;
redis.on('ready', function (err) {
  redisReady = true;
});

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

/**
 * Бан пользователя
 *
 */
var userBan = function(userId, minutes, socket) {
  var timestamp = Math.floor(Date.now() / 1000);
  var seconds = minutes * 60;

  if (redisReady) {
    redis.setex('chat:ban' + userId, seconds, true);
  }

  ban[userId] = timestamp + seconds;

  io.to(socket.room).emit('banned', { user: userId, period: minutes });
}

var userBannedInit = function(userId) {
  if (redisReady) {
    redis.exists('chat:ban' + userId, function(err, result) {
      if (!err) {
        if (result === 0) {
          ban[userId] = false;
        } else if (result === 1) {
          var timestamp = Math.floor(Date.now() / 1000);
          redis.ttl('chat:ban' + userId, function(err, ttl){
            if (!err && ttl > 0) {
              ban[userId] = timestamp + ttl;
            } else {
              ban[userId] = false;
            }
          });
        }
      }
    });
  }
}

var isUserBanned = function(userId) {
  if (ban[userId] === false) {
    return false;
  }

  return true;
}

var command = require('./js/command');
command.importFunction('userBan', userBan);

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatrooms
var rooms = {};
var flood = {};
var ban = {};

io.on('connection', function (socket) {
  var isAuthenticated = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    if (!isAuthenticated) {
      return false;
    }

    // if message starts with '/' — we're not sending it to everyone, we're processing it in unique way
    if (command.isCommand(data.text)) {
      command.processCommand(data.text, socket);
      return true;
    }

    if (isUserBanned(socket.user.id)) {
      return false;
    }

    if (flood[socket.user.id] >= 15) {
      userBan(socket.user.id, 10, socket);

      return false;
    }

    var timestamp = Math.floor(Date.now() / 1000);
    var timestampms = new Date().getTime();
    var messageId = crypto.createHash('md5');
    messageId = messageId.update(JSON.stringify({ userId: socket.user.id, time: timestampms })).digest('hex');

    var message = {
      id: messageId,
      user: socket.user,
      message: data.text,
      timestamp: timestamp
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

    userBannedInit(socket.user.id);

    socket.emit('login', {
      numUsers: rooms[room].getUsersCount(),
      users: rooms[room].getUsers()
    });

    // History of last messages in chat
    rooms[socket.room].sendHistory(socket);
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    if (!isAuthenticated || isUserBanned(socket.user.id)) {
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
  var timestamp = Math.floor(Date.now() / 1000);

  for(var userId in ban) {
    if (ban[userId] !== false && ban[userId] <= timestamp) {
      ban[userId] = false;
      io.emit('unbanned', { user: userId });
    }
  }
}, 30000);