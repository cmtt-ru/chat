var importedFunctions = {};

var administration = {
  1: true
};

function importFunction(name, fnc) {
  importedFunctions[name] = fnc;
}

function isCommand(message) {
  return (message[0] === '/') ? true : false;
}

function responseCommand(command, response, socket) {
  socket.emit('command response', {
    command: command,
    response: response
  });
}

function processCommand(data, socket) {
  // remove '/' char
  var fullCommand = data.slice(1).split(' ');

  var commandName = fullCommand[0];
  var commandArgs = fullCommand.slice(1);

  switch (commandName) {
    case 'echo':
      var response = String(commandArgs).replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      responseCommand('echo', response, socket);
      break;

    case 'durov':
      responseCommand('durov', 'Дуров позвонит', socket);
      break;

    case 'ban':
      if (administration[socket.user.id] === true) {
        var userId = parseInt(commandArgs[0]);
        var minutes = parseInt(commandArgs[1]);

        if (userId > 0 && minutes > 0) {
          responseCommand('ban', 'OK. Пользователь №' + userId + ' заблокирован', socket);
          if (importedFunctions['userBan'] !== undefined) {
            importedFunctions['userBan'](userId, minutes, socket);
          }
        }
      } else {
        responseCommand('ban', 'Не-а', socket);
      }
      break;

    case 'help':
    default:
      var response = '> /help<br>' +
          'Доступные команды:<br>' +
          '/echo — эхо<br>' +
          '/help — справка по командам<br>' +
          '/ban — блокировка аккаунта';
      responseCommand('help', response, socket);
  }
}

module.exports.isCommand = isCommand;
module.exports.responseCommand = responseCommand;
module.exports.processCommand = processCommand;
module.exports.importFunction = importFunction;