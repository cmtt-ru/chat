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

  if (md5.update(name, 'utf8').update(salt, 'utf8').digest('hex') === hash) {
    return true;
  }

  return false;
}

function parseMentions(text) {
  var regex = /\[(\d*)\|([\wа-я]*)\]/g;
  var matches;
  var mentions = [];
  while ((matches = regex.exec(text)) !== null) {
    mentions.push({id:matches[1],name:matches[2]});
   // mentions[matches[1]] = matches[2];
  }
  return mentions;
}

var rAmp = /&/g,
  rLt = /</g,
  rGt = />/g,
  rApos =/\'/g,
  rQuot = /\"/g,
  hChars =/[&<>\"\']/;

function coerceToString(val) {
  return String((val === null || val === undefined) ? '' : val);
}

function escapeHTML(str) {
  str = coerceToString(str);

  return hChars.test(str)
    ? str
      .replace(rAmp,'&amp;')
      .replace(rLt,'&lt;')
      .replace(rGt,'&gt;')
      .replace(rApos,'&#39;')
      .replace(rQuot, '&quot;')
    : str;
};

module.exports.roomNameNormilize = roomNameNormilize;
module.exports.checkRoomAuthorization = checkRoomAuthorization;
module.exports.escapeHTML = escapeHTML;
module.exports.parseMentions = parseMentions;