var socket;
var room = null;
var roomHash = null;
var userData = null;
var userDataHash = null;
var username = "default";

function gotMessage(evt) {
  if (evt.origin === document.location.protocol + '//localhost:3000' || evt.origin === document.location.protocol + '//tjournal.ru') {
    var data = $.parseJSON(evt.data);

    userData = data.user;
    userDataHash = data.userHash;
    room = data.room;
    roomHash = data.roomHash;
    username = data.username;

    socket.open();
  }
}

$(function() {
  // Templates
  var template = $("#message-template").html();
  var messageTemplate = Handlebars.compile(template);

  var template = $("#online-user-template").html();
  var onlineUserTemplate = Handlebars.compile(template);

  var template = $("#message-typing-template").html();
  var messageTypingTemplate = Handlebars.compile(template);

  var autolinker = new Autolinker({
    twitter: false
  });

  var connected = false;
  var typing = false;
  var lastTypingTime;

  $(window).resize(function(){
    definePanelHeight();
  });
  definePanelHeight();

  /* Get notifications permissions */
  var Notification = window.Notification || window.mozNotification || window.webkitNotification;
  var notificationPermission;

  Notification.requestPermission(function (permission) {
    notificationPermission = permission;
  });

  function sendNotification(title, body, icon) {
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

  function languanize(number, vars) {
    var cases = [2, 0, 1, 1, 1, 2];
    return vars[ (number%100>4 && number%100<20)? 2 : cases[(number%10<5)?number%10:5] ];
  }

  function changeStatus(status) {
    if (status === -1) {
      $('.lineIndicator').addClass('offline').removeClass('connecting');
    } else if (status === 0) {
      $('.lineIndicator').removeClass('offline').addClass('connecting');
    } else if (status === 1) {
      $('.lineIndicator').removeClass('offline').removeClass('connecting');
    }
  }

  function definePanelHeight() {
    var h = $('.baseHeight').height();
    var hh = $('.baseHeight .panel-heading').outerHeight();
    var fh = $('.baseHeight .panel-footer').outerHeight();

    $('#chatWindow').css('height', h - hh - fh);
    $('#onlineList').css('height', h - hh);
  }

  function updateOnlineList(data, action) {
    if (data.numUsers != undefined) {
      var dnum = parseInt(data.numUsers);

      $('.onlineCount').text(dnum + languanize(dnum, [' человек',' человека',' человек']) + ' онлайн');
    }

    if (data.user != undefined) {
      if (action === 'remove') {
        $('#onlineList .userOnline' + data.user.id + ' .media-object').animate({opacity: 0.1}, 500).animate({opacity: 1}, 500).animate({opacity: 0.1}, 500).animate({opacity: 1}, 500, 'swing', function(){
          $('.userOnline' + data.user.id).remove();
        });
      } else if ($('#onlineList .userOnline' + data.user.id).length === 0) {
        var userLi = onlineUserTemplate(data.user);
        $('#onlineList').append(userLi);

        $('#onlineList .userOnline' + data.user.id + ' .media-object').animate({opacity: 0.1}, 500).animate({opacity: 1}, 500).animate({opacity: 0.1}, 500).animate({opacity: 1}, 500);
      }
    }

    if (data.users != undefined) {
      var list = '';

      $.each(data.users, function(i, v) {
        list += onlineUserTemplate(v);
      });

      $('#onlineList').html(list);
    }

    $('#onlineList .userOnline' + userData.id).addClass('me');
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
    //removeChatTyping(data);
    if ($('.message' + data.id).length == 0) {
      data.message = parseMentions(data.message);
      data.message = autolinker.link(data.message);
      addMessageElement(messageTemplate(data));

      var messageDate = new Date(data.timestamp*1000);
      $(".message"+data.id+" .timestamp").text(messageDate.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1"));
    }
  }

  function parseMentions(text) {
    var regex = /\[id(\d+)\|([^\]]+)\]/g;
    return text.replace(regex, '<a href="http://tjournal.ru/users/$1" target="_blank">$2</a>');
  }

  function addCommandResponse(data) {
    var el = $('<li>').addClass('command-response');

    // /help doesn't contains unsec text
    if (data.command === 'help') {
      el = el.html(data.response);
    } else {
      el = el.text(data.response);
    }
    addMessageElement(el);
  }

  function log(message) {
    var el = $('<li>').addClass('log').text(message);
    addMessageElement(el);
  }

  function addMessageElement(el) {
    var scrolledToNewest = ($('#chatWindow').scrollTop() + $('#chatWindow').innerHeight() >= $('#chatWindow')[0].scrollHeight);

    $('#chatWindow').append(el);

    if (scrolledToNewest) {
      $('#chatWindow')[0].scrollTop = $('#chatWindow')[0].scrollHeight;
    }
  }

  function addChatTyping(data) {
    addMessageElement(messageTypingTemplate(data));
  }

  function removeChatTyping(data) {
    $('.typing'+data.user.id).remove();
  }

  function updateTyping() {
    return false;
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
      //socket.emit('stop typing');
      typing = false;
    }
  });

  $('#messageSubmitButton').click(function (event) {
    sendMessage();
    //socket.emit('stop typing');
    typing = false;
  });

  /*$('#messageInput').on('input', function() {
    updateTyping();
  });*/

  // Mentions
  $('body').on('click', '.user-mention-here', function() {
    var mentionName = $(this).text();
    var mentionId = $(this).attr('data-id');
    var inputText = $('#messageInput').val();

    if (inputText && inputText.slice(-1) !== ' ') {
      inputText += ' ';
    }

    $('#messageInput').val(inputText + '[id' + mentionId + '|' + mentionName + '] ');
    $('#messageInput').focus();

    return false;
  });

  // --------------------------------------------------------------

  socket = io('//' + document.location.host, {
    reconnection: true,
    autoConnect: false
  });

  // Socket events
  socket.on('connect', function() {
    $('#chatWindow .waiting').remove();
    changeStatus(0);

    socket.emit('authentication', {
      user: userData,
      hash: userDataHash,
      username: username
    });
  });

  socket.on('reconnect', function() {
    socket.emit('add user', {
      room: room,
      roomHash: roomHash,
      socket: socket.io.engine.id
    });
  });

  socket.on('connect_error', function() {
    changeStatus(-1);
  });

  socket.on('disconnect', function() {
    connected = false;
    changeStatus(-1);

    socket.removeAllListeners('authenticated');
    socket.removeAllListeners('connect_error');

    log('Соединение с чатом прервано');
  });

  socket.on('authenticated', function() {
    socket.emit('add user', {
      room: room,
      roomHash: roomHash,
      socket: socket.io.engine.id
    });

    // login
    socket.on('login', function (data) {
      connected = true;
      changeStatus(1);

      log('Вы вошли в чат!');
      updateOnlineList(data);
    });

    // message
    socket.on('new message', function (data) {
      console.log(data);
      /*if (!data.history && !document.hasFocus() && data.message.indexOf('@' + userData.name) >= 0) {
        sendNotification('Вас упомянули в TJ Chat', data.user.name + ': ' + data.message, 'https://static39.cmtt.ru/paper-preview-fox/m/us/musk-longread-1/1bce7f668558-normal.jpg');
      }*/
      addChatMessage(data);
    });

    // user join & left
    socket.on('user joined', function (data) {
      updateOnlineList(data, 'add');
    });

    socket.on('user left', function (data) {
      updateOnlineList(data, 'remove');
      //removeChatTyping(data);
    });

    // typing
    /*socket.on('typing', function (data) {
      addChatTyping(data);
    });

    socket.on('stop typing', function (data) {
      removeChatTyping(data);
    });*/

    // ban
    socket.on('banned', function(data) {
      log(data.user.username + ' заблокирован на ' + data.period + ' ' + languanize(data.period, ['минуту', 'минуты', 'минут']));
    });

    // slash command response
    socket.on('command response', function (data) {
      addCommandResponse(data);
    });

    socket.on('reconnecting', function() {
      changeStatus(0);
    });

    socket.on('reconnect_failed', function() {
      changeStatus(-1);
    });

    socket.on('reconnect_error', function() {
      changeStatus(-1);
    });
  });

  socket.on('auth failed', function (data) {
    changeStatus(-1);
    alert('Access denied');
  });
});

if (window.addEventListener) {
  window.addEventListener("message", gotMessage, false);
}
else {
  window.attachEvent("onmessage", gotMessage);
}

// Scrolling on iOS
(function registerScrolling($) {
    var prevTouchPosition = {},
        scrollYClass = 'scroll-y',
        scrollXClass = 'scroll-x',
        searchTerms = '.' + scrollYClass + ', .' + scrollXClass;

    $('body').on('touchstart', function (e) {
        var $scroll = $(e.target).closest(searchTerms),
            targetTouch = e.originalEvent.targetTouches[0];

        // Store previous touch position if within a scroll element
        prevTouchPosition = $scroll.length ? { x: targetTouch.pageX, y: targetTouch.pageY } : {};
    });

$('body').on('touchmove', function (e) {
    var $scroll = $(e.target).closest(searchTerms),
        targetTouch = e.originalEvent.targetTouches[0];

    if (prevTouchPosition && $scroll.length) {
        // Set move helper and update previous touch position
        var move = {
            x: targetTouch.pageX - prevTouchPosition.x,
            y: targetTouch.pageY - prevTouchPosition.y
        };
        prevTouchPosition = { x: targetTouch.pageX, y: targetTouch.pageY };

        // Check for scroll-y or scroll-x classes
        if ($scroll.hasClass(scrollYClass)) {
            var scrollHeight = $scroll[0].scrollHeight,
                outerHeight = $scroll.outerHeight(),

                atUpperLimit = ($scroll.scrollTop() === 0),
                atLowerLimit = (scrollHeight - $scroll.scrollTop() === outerHeight);

            if (scrollHeight > outerHeight) {
                // If at either limit move 1px away to allow normal scroll behavior on future moves,
                // but stop propagation on this move to remove limit behavior bubbling up to body
                if (move.y > 0 && atUpperLimit) {
                    $scroll.scrollTop(1);
                    e.stopPropagation();
                } else if (move.y < 0 && atLowerLimit) {
                    $scroll.scrollTop($scroll.scrollTop() - 1);
                    e.stopPropagation();
                }

                // If only moving right or left, prevent bad scroll.
                if(Math.abs(move.x) > 0 && Math.abs(move.y) < 3){
                  e.preventDefault()
                }

                // Normal scrolling behavior passes through
            } else {
                // No scrolling / adjustment when there is nothing to scroll
                e.preventDefault();
            }
        } else if ($scroll.hasClass(scrollXClass)) {
            var scrollWidth = $scroll[0].scrollWidth,
                outerWidth = $scroll.outerWidth(),

                atLeftLimit = $scroll.scrollLeft() === 0,
                atRightLimit = scrollWidth - $scroll.scrollLeft() === outerWidth;

            if (scrollWidth > outerWidth) {
                if (move.x > 0 && atLeftLimit) {
                    $scroll.scrollLeft(1);
                    e.stopPropagation();
                } else if (move.x < 0 && atRightLimit) {
                    $scroll.scrollLeft($scroll.scrollLeft() - 1);
                    e.stopPropagation();
                }
                // If only moving up or down, prevent bad scroll.
                if(Math.abs(move.y) > 0 && Math.abs(move.x) < 3){
                  e.preventDefault();
                }

                // Normal scrolling behavior passes through
            } else {
                // No scrolling / adjustment when there is nothing to scroll
                e.preventDefault();
            }
        }
    } else {
        // Prevent scrolling on non-scrolling elements
        e.preventDefault();
    }
});
})(jQuery);
