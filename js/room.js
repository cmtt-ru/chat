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
  this.sockets = {};
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
    this.users[data[0].id] = data[0];
    this.sockets[data[0].id] = [];
    ++this.numUsers;
  }
  this.sockets[data[0].id].push(data[1]);

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
  this.sockets[userId].shift();
  if (!this.sockets[userId].length) {
    delete this.users[userId];
    delete this.sockets[userId];
    --this.numUsers;
    socket.broadcast.to(this.name).emit('user left', {
      user: socket.user,
      numUsers: this.getUsersCount()
    });
  }
}

module.exports = Room;