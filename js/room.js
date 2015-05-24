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
 * @param  string user
 * @param  string data
 */
Room.prototype.addToHistory = function(user, data) {
  this.history.push({ message:data, user: user });
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
      socket.emit('new message', {
        user: data.user,
        message: data.message
      });
    });
  }
}

module.exports = Room;