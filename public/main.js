var room = null;
var roomHash = null;
var userData = null;
var userDataHash = null;

$(function () {
  // Templates
  var template = $("#message-template").html();
  var messageTemplate = Handlebars.compile(template);

  var template = $("#online-user-template").html();
  var onlineUserTemplate = Handlebars.compile(template);

  var template = $("#message-typing-template").html();
  var messageTypingTemplate = Handlebars.compile(template);

  var connected = false;
  var typing = false;
  var lastTypingTime;

  $(window).resize(function () {
    definePanelHeight();
  });
  definePanelHeight();

  var id = Math.floor(Math.random() * 9999 + 1);
  userData = {
    id: id,
    name: 'User #' + id,
    image: 'https://static39.cmtt.ru/paper-preview-fox/m/us/musk-longread-1/1bce7f668558-normal.jpg'
  };
  userDataHash = md5(JSON.stringify(userData) + 'euc3Karc4uN9yEk9vA');

  room = 'room1';
  roomHash = 'd3bdb69348a7fde810da2915cc52645a';

  /* Get notifications permissions */
  var Notification = window.Notification || window.mozNotification || window.webkitNotification;
  var notificationPermission;

  Notification.requestPermission(function (permission) {
    notificationPermission = permission;
  });

  function showNotification(title, body, icon) {
    if (notificationPermission === 'granted') {
      var instance = new Notification(title, {
        body: body,
        icon: icon
      });

      instance.onclick = function () {
        $('#messageInput').focus();
      };
      instance.onerror = function () {
        // Something to do
      };
      instance.onshow = function () {
        // Something to do
      };
      instance.onclose = function () {
        // Something to do
      };  

      return false;
    } else {
      return false;
    }
  }

  // --------------------------------------------------------------

  function cleanInput(input) {
    return $('<div/>').text(input).text();
  }

  function definePanelHeight() {
    var h = $('.baseHeight').height();
    var hh = $('.baseHeight .panel-heading').outerHeight();
    var fh = $('.baseHeight .panel-footer').outerHeight();

    $('#chatWindow').css('height', h - hh - fh);
    $('#onlineList').css('height', h - hh);
  }

  function updateOnlineList(data) {
    if (data.numUsers != undefined) {
      $('.onlineCount').text(parseInt(data.numUsers));
    }

    if (data.users != undefined) {
      var list = '';

      $.each(data.users, function (i, v) {
        list += onlineUserTemplate(v);
      });

      $('#onlineList').html(list);
      $('#onlineList .userOnline' + userData.id).addClass('me');
    }
  }

  function sendMessage() {
    var message = $('#messageInput').val();
    message = cleanInput(message);

    if (message && connected) {
      $('#messageInput').val('');

      socket.emit('new message', {
        text: message
      });
    }
  }

  function addChatMessage(data) {
    addMessageElement(messageTemplate(data));
  }

  function addCommandResponse(data) {
    var el = $('<li>').addClass('command-response').text(data.response);
    addMessageElement(el);
  }

  function log(message) {
    var el = $('<li>').addClass('log').text(message);
    addMessageElement(el);
  }

  function addMessageElement(el) {
    var el = $(el);
    var username = el.find('.media-user-name');
    if (username.length > 0) {
      username.css('color', userColor(username.text()));
    }

    $('#chatWindow').append(el);
    $('#chatWindow')[0].scrollTop = $('#chatWindow')[0].scrollHeight;
  }

  function addChatTyping(data) {
    addMessageElement(messageTypingTemplate(data));
  }

  function removeChatTyping(data) {
    $('.typing' + data.user.id).remove();
  }

  function updateTyping() {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }

      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= 500 && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, 500);
    }
  }

  /**
   * The function generates a color based on the string.
   * @param   {String}  string       Base string.
   * @param   {Integer} chromaticity The less - the darker. 0 - 765.
   * @returns {String}  Return rgb color for css.
   */
  function userColor(string, chromaticity) {
    chromaticity = chromaticity || 600;
    var hash = md5(string);
    var chunks = hash.match(/.{1,2}/g);
    var sum = function (n) {
      var count = 0;
      var i = n.length;
      while (i--) {
        count += n[i];
      }
      return count;
    }
    for (var i = 0; i < chunks.length - 4; i++) {
      var color = chunks.splice(i, 3).map(function (n) {
        return parseInt(n, 16);
      });
      if (sum(color) <= chromaticity) {
        return 'rgb(' + color.join(', ') + ')';
      }
    }
    return 'rgb(0, 0, 0)';
  }

  // --------------------------------------------------------------

  // Keyboard events
  $(window).keydown(function (event) {
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $('#messageInput').focus();
    }

    if (event.which === 13) {
      sendMessage();
      socket.emit('stop typing');
      typing = false;
    }
  });

  $('#messageInput').on('input', function () {
    updateTyping();
  });

  // --------------------------------------------------------------

  var socket = io('//' + document.location.host, {
    reconnection: true
  });

  // Socket events
  socket.on('connect', function () {
    socket.emit('authentication', {
      user: userData,
      hash: userDataHash
    });
  });

  socket.on('reconnect', function () {
    socket.emit('add user', {
      room: room,
      roomHash: roomHash
    });
  });

  socket.on('disconnect', function () {
    connected = false;

    socket.removeAllListeners('authenticated');

    log('Соединение с чатом прервано');
  });

  socket.on('authenticated', function () {
    socket.emit('add user', {
      room: room,
      roomHash: roomHash
    });

    // login
    socket.on('login', function (data) {
      connected = true;

      log('Вы вошли в чат!');
      updateOnlineList(data);
    });

    // message
    socket.on('new message', function (data) {
      if (!data.history && !document.hasFocus()) {
        showNotification('TJ Chat', '@' + data.user.name + ': ' + data.message, 'https://static39.cmtt.ru/paper-preview-fox/m/us/musk-longread-1/1bce7f668558-normal.jpg');
      }
      addChatMessage(data);
    });

    // user join & left
    socket.on('user joined', function (data) {
      log(data.user.name + ' присоединился');
      updateOnlineList(data);
    });

    socket.on('user left', function (data) {
      log(data.user.name + ' покинул чат');
      updateOnlineList(data);
      removeChatTyping(data);
    });

    // typing
    socket.on('typing', function (data) {
      addChatTyping(data);
    });

    socket.on('stop typing', function (data) {
      removeChatTyping(data);
    });

    // ban
    socket.on('banned', function (data) {
      log(data.user + ' заблокирован на ' + data.period + ' минут');
    });

    socket.on('unbanned', function (data) {
      log(data.user + ' разблокирован');
    });

    // slash command response
    socket.on('command response', function (data) {
      addCommandResponse(data);
    });
  });

  socket.on('auth failed', function (data) {
    alert('Access denied');
  });
});