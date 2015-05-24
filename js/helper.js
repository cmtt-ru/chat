var crypto = require('crypto');

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
 * @param  string salt
 * @param  string hash
 *
 * @return boolean
 */
function checkRoomAuthorization(name, salt, hash) {
  var md5 = crypto.createHash('md5');

  if (md5.update(name).update(salt).digest('hex') === hash) {
    return true;
  }

  return false;
}

module.exports.roomNameNormilize = roomNameNormilize;
module.exports.checkRoomAuthorization = checkRoomAuthorization;