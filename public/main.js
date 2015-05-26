var room = null;
var roomHash = null;
var userData = null;
var userDataHash = null;

$(function() {
  // Templates
  var template = $("#message-template").html();
  var messageTemplate = Handlebars.compile(template);

  var template = $("#online-user-template").html();
  var onlineUserTemplate = Handlebars.compile(template);

  var template = $("#message-typing-template").html();
  var messageTypingTemplate = Handlebars.compile(template);

  var colorHash = new ColorHash();
  var connected = false;
  var typing = false;
  var lastTypingTime;

  var id = Math.floor(Math.random() * 9999 + 1);
  userData = {
    id: id,
    name: 'User #' + id,
    image: 'https://static39.cmtt.ru/paper-preview-fox/m/us/musk-longread-1/1bce7f668558-normal.jpg'
  };
  userDataHash = md5(JSON.stringify(userData) + 'euc3Karc4uN9yEk9vA');

  room = 'room1';
  roomHash = 'd3bdb69348a7fde810da2915cc52645a';

  // --------------------------------------------------------------

  function cleanInput(input) {
    return $('<div/>').text(input).text();
  }

  function updateOnlineList(data) {
    if (data.numUsers != undefined) {
      $('.onlineCount').text(parseInt(data.numUsers));
    }

    if (data.users != undefined) {
      var list = '';

      $.each(data.users, function(i, v) {
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

      socket.emit('new message', { text: message });
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
      console.log(colorHash.hex(username.text()));
      username.css('color', colorHash.hex(username.text()));
    }

    $('#chatWindow').append(el);
    $('#chatWindow')[0].scrollTop = $('#chatWindow')[0].scrollHeight;
  }

  function addChatTyping(data) {
    addMessageElement(messageTypingTemplate(data));
  }

  function removeChatTyping(data) {
    $('.typing'+data.user.id).fadeOut(function() {
      $(this).remove();
    });
  }

  function updateTyping() {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }

      lastTypingTime = (new Date()).getTime();

      setTimeout(function() {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= 500 && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, 500);
    }
  }

  // --------------------------------------------------------------

  // Keyboard events
  $(window).keydown(function(event) {
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $('#messageInput').focus();
    }

    if (event.which === 13) {
      sendMessage();
      socket.emit('stop typing');
      typing = false;
    }
  });

  $('#messageInput').on('input', function() {
    updateTyping();
  });

  // --------------------------------------------------------------

  var socket = io();

  // Socket events
  socket.on('connect', function() {
    socket.emit('authentication', {
      user: userData,
      hash: userDataHash
    });
  });

  socket.on('reconnect', function() {
    socket.emit('add user', {
      room: room,
      roomHash: roomHash
    });
  });

  socket.on('disconnect', function() {
    socket.removeAllListeners('authenticated');
    socket.removeAllListeners('login');
  });

  socket.on('authenticated', function(data) {
    socket.emit('add user', {
      room: room,
      roomHash: roomHash
    });

    // login
    socket.on('login', function (data) {
      connected = true;

      log("Вы вошли в чат!");
      updateOnlineList(data);
    });

    // message
    socket.on('new message', function (data) {
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

    socket.on('command response', function (data) {
      addCommandResponse(data);
    });
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('auth failed', function (data) {
    alert('Access denied');
  });
});

String.prototype.getHashCode = function() {
    var hash = 0;
    if (this.length == 0) return hash;
    for (var i = 0; i < this.length; i++) {
        hash = this.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};
Number.prototype.intToHSL = function() {
    var shortened = this % 360;
    return "hsl(" + shortened + ",100%,30%)";
};