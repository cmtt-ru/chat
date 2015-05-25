$(function () {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  //var $roomInput = $('input:radio[name=room]'); // Input for room
  var $messages = $('.messages'); // Messages area
  var $participants = $('.participants');
  var $participantsCount = $('.participants-count');
  var $participantsList = $('.participants-list');
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The d page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var room;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io.connect('http://127.0.0.1:3000/', {
    'reconnect': true,
    'reconnection delay': 500,
    'max reconnection attempts': 10
  });

  var id = Math.floor(Math.random() * (9999 - 1 + 1)) + 1;
  var userData = {
    id: id,
    name: 'User #' + id,
    image: 'https://static39.cmtt.ru/paper-preview-fox/m/us/musk-longread-1/1bce7f668558-normal.jpg'
  };

  function addParticipantsMessage(data) {
    var message = '';

    if (data.numUsers === 1) {
      message += 'There\'s 1 participant';
    } else {
      message += 'There are ' + data.numUsers + ' participants';
    }

    $participantsCount.html(message);
    generateParticipantsList(data.users);
  }

  // Sets the client's username
  function setUsername() {
    username = cleanInput($usernameInput.val().trim());
    room = 'room1';

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', {
        room: room,
        roomHash: 'd3bdb69348a7fde810da2915cc52645a'
      });
    }
  }

  // Sends a chat message
  function sendMessage() {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');

      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', { text: message });
    }
  }

  // Log a message
  function log(message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage(data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.user.name)
      .css('color', getUsernameColor(data.user.name));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.user.name)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping(data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping(data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement(el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // generate participants list
  function generateParticipantsList(users) {
    $participantsList.html('');
    $.each(users, function (id, element) {
      var $el = $('<li>').addClass('participant').html('<img src="' + element.image + '" width=20 height=20>').append(' ' + element.name);

      if (element.id == userData.id) {
        var $itsYouMsg = $('<span>', {
          html: ' (it\'s you)'
        });

        $el.addClass('currentUser').append($itsYouMsg);
      }

      $participantsList.append($el);
    });
  }

  // Prevents input from having injected markup
  function cleanInput(input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
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
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages(data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.user.name;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor(username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Adds the command response
  function addCommandResponse(data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $messageBodyDiv = $('<span class="commandBody">')
      .html(data.response);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .addClass(typingClass)
      .append($messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function () {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events
  socket.on('connect', function () {
    socket.emit('authentication', {
      user: userData,
      hash: md5(JSON.stringify(userData) + 'euc3Karc4uN9yEk9vA')
    });
    console.log('U r connected!');
  }); 
  
  socket.on('reconnect', function () {
    socket.emit('add user', {
      room: 'room1',
      roomHash: 'd3bdb69348a7fde810da2915cc52645a'
    });
    console.log('U r reconnected!');
  });
  
  socket.on('disconnect', function () {
    socket.removeAllListeners('authenticated');
    socket.removeAllListeners('login');
    console.log('U r disonnected!');
  });
  
  socket.on('authenticated', function (data) {
    // Whenever the server emits 'login', log the login message
    socket.on('login', function (data) {
      connected = true;
      // Display the welcome message
      var message = "Добро пожаловать в чат TJournal!";
      log(message, {
        prepend: true
      });
      console.log('u r logged in');
      addParticipantsMessage(data);
    });

    // Whenever the server emits 'new message', update the chat body
    socket.on('new message', function (data) {
      addChatMessage(data);
      console.log('new message');
    });

    // Whenever the server emits 'user joined', log it in the chat body
    socket.on('user joined', function (data) {
      log(data.user.name + ' joined');
      console.log('new user');
      addParticipantsMessage(data);
    });

    // Whenever the server emits 'user left', log it in the chat body
    socket.on('user left', function (data) {
      log(data.user.name + ' left');
      console.log('user left');
      addParticipantsMessage(data);
      removeChatTyping(data);
    });

    // Whenever the server emits 'typing', show the typing message
    socket.on('typing', function (data) {
      addChatTyping(data);
    });

    // Whenever the server emits 'stop typing', kill the typing message
    socket.on('stop typing', function (data) {
      removeChatTyping(data);
    });

    socket.on('banned', function (data) {
      log('Пользователь ' + data.user + ' заблокирован на ' + data.period + ' минут');
    });

    socket.on('unbanned', function (data) {
      log('Пользователь ' + data.user + ' разблокирован');
    });

    socket.on('command response', function (data) {
      console.log('command response');
      addCommandResponse(data);
    });
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('auth failed', function (data) {
    alert('Access denied');
  });
});
