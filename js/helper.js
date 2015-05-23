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

module.exports.roomNameNormilize = roomNameNormilize;