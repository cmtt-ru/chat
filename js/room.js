// Constructor
function Room(name) {
  this.name = name;
  this.users = {};
  this.history = [];
  this.numUsers = 0;
}

Room.prototype.getUsers = function() {
  return this.users;
}

Room.prototype.getUsersCount = function() {
  return this.numUsers;
}

Room.prototype.addToHistory = function(user, data) {
  this.history.push({message:data, user: user});
  if (this.history.length > 30) {
    this.history.shift();
  }
}

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