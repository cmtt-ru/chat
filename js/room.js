/**
 * Представляет комнату чата
 *
 * @constructor
 *
 * @param  string name
 */
function Room(name) {
  this.name = name;
  this.users = {};
  this.history = [];
  this.numUsers = 0;
}

/**
 * Возвращает пользователей комнаты
 * @return object
 */
Room.prototype.getUsers = function() {
  return this.users;
}

/**
 * Вовзвращает количество пользователей в комнате
 * @return number
 */
Room.prototype.getUsersCount = function() {
  return this.numUsers;
}

/**
 * Добавляет сообщения в историю
 * @param  object user
 */
Room.prototype.addToHistory = function(message) {
  this.history.push(message);

  if (this.history.length > 30) {
    this.history.shift();
  }
}

/**
 * Отправляет историю комнаты в сокет
 * @param  socket
 */
Room.prototype.sendHistory = function(socket) {
  if (this.history.length > 0) {
    this.history.forEach(function(data) {
      socket.emit('new message', data);
    });
  }
}

/**
 * Добавляем пользователя в комнату
 * @param  array data
 * @param  object socket
 */
Room.prototype.addUser = function(data, socket) {
  if (!this.users[data[0].id]) {
    this.users[data[0].id] = {};
    this.users[data[0].id].user = data[0];
    this.users[data[0].id].sockets = [];
    ++this.numUsers;
  }
  this.users[data[0].id].sockets.push(data[1]);

  socket.broadcast.to(this.name).emit('user joined', {
    user: socket.user,
    numUsers: this.getUsersCount()
  });
}

/**
 * Удаляем данные пользователя из комнаты
 * @param  integer userId
 * @param  object socket
 */
Room.prototype.removeUser = function(userId, socket) {
  this.users[userId].sockets.shift();
  if (!this.users[userId].sockets.length) {
    delete this.users[userId];
    --this.numUsers;
  }

  socket.broadcast.to(this.name).emit('user left', {
    user: socket.user,
    numUsers: this.getUsersCount()
  });
}

module.exports = Room;