
// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

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
rooms['room1'] = 'room1';
rooms['room2'] = 'room2';
rooms['room3'] = 'room3';


var usernames = {};
var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // Send room list to every new socket
  socket.emit('room list', rooms);

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
    // we store the username in the socket session for this client
    socket.username = data.username;
    socket.room = data.room;
    // add the client's username to the global list
    usernames[data.username] = data.username;
    ++numUsers;
    addedUser = true;
    socket.join(data.room);
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.to(socket.room).emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
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
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.to(socket.room).emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
