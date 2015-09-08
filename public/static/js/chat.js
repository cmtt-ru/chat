var socket;
var room = null;
var roomHash = null;
var userData = null;
var userDataHash = null;
var username = "default";

var ls;
try {
  ls = 'localStorage' in window && window['localStorage'] !== null;
} catch (e) {
  ls = false;
}

var notificationsStatus = (ls && localStorage.getItem("notificationsStatus") == 'true') ? true : false;

function gotMessage(evt) {
  if (evt.origin === document.location.protocol + '//localhost:3000' || evt.origin === document.location.protocol + '//tj.local' || evt.origin === document.location.protocol + '//tjournal.ru') {
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
  var lastMentionName = '';
  var lastMentionId = 0;

  var $notificationsPanel = $('#notifications-panel');
  var $notificationsStatus = $('#notifications-status');

  $(window).resize(function() {
    definePanelHeight();
  });
  definePanelHeight();

  var Notification = window.Notification || window.mozNotification || window.webkitNotification;

  resetNotificationsStatus();

  if (ls) {
    if (localStorage.getItem('fontSizeLarger') == 'true') {
      $('body').addClass('larger');
    }
  }

  // --------------------------------------------------------------

  function cleanInput(input) {
    return $('<div/>').text(input).text();
  }

  function languanize(number, vars) {
    var cases = [2, 0, 1, 1, 1, 2];
    return vars[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
  }

  function changeFont() {
    $('body').toggleClass('larger');
    $('#chatWindow')[0].scrollTop = $('#chatWindow')[0].scrollHeight;

    if (ls) {
      localStorage.setItem('fontSizeLarger', $('body').hasClass('larger'));
    }
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
    var nh = $('#notifications-panel').outerHeight();

    $('#chatWindow').css('height', h - hh - fh);
    $('#onlineList').css('height', h - hh - nh);
  }

  function updateOnlineList(data, action) {
    if (data.numUsers != undefined) {
      var dnum = parseInt(data.numUsers);

      $('.onlineCount').text(dnum + languanize(dnum, [' человек', ' человека', ' человек']) + ' онлайн');
    }

    if (data.user != undefined) {
      if (action === 'remove') {
        $('#onlineList .userOnline' + data.user.id + ' .media-object').animate({
          opacity: 0.1
        }, 500).animate({
          opacity: 1
        }, 500).animate({
          opacity: 0.1
        }, 500).animate({
          opacity: 1
        }, 500, 'swing', function() {
          $('.userOnline' + data.user.id).remove();
        });
      } else {
        var userLi = onlineUserTemplate(data.user);

        if ($('#onlineList .userOnline' + data.user.id).length === 0) {
          $('#onlineList').append(userLi);

          $('#onlineList .userOnline' + data.user.id + ' .media-object').animate({opacity: 0.1}, 500).animate({opacity: 1}, 500).animate({opacity: 0.1}, 500).animate({opacity: 1}, 500);
        } else {
          $('#onlineList .userOnline' + data.user.id).replaceWith(userLi);
        }
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

      socket.emit('new message', {
        text: message,
        replyId: lastMentionId
      });

      lastMentionId = 0;
      lastMentionName = '';
    }
  }

  function addChatMessage(data) {
    //removeChatTyping(data);
    if ($('.message' + data.id).length == 0) {
      data.message = parseMentions(data);
      data.message = autolinker.link(data.message);
      addMessageElement(messageTemplate(data));

      var messageDate = new Date(data.timestamp * 1000);
      $(".message" + data.id + " .timestamp").text(messageDate.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1"));

      if (data.mentions.length > 0) {
        data.mentions.forEach(function(mention) {
          if (mention.id == userData.id) {
            $(".message" + data.id).addClass('reply');
            return;
          }
        });
      }
    }
  }

  function parseMentions(data, isNotification) {
    var text = data.message;
    var regex = /\[id(\d+)\|([^\]]+)\]/g;

    // Notifications can't show html
    if (isNotification) {
      return text.replace(regex, '$2');
    } else {
      if (data.mentions.length > 0) {
        data.mentions.forEach(function(mention) {
          if (mention.isReply === true && mention.name.length > 0 && text.indexOf(mention.name) >= 0) {
            var regexName = new RegExp('^([^|]*)(' + mention.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + ')([^\\]]*)$');
            text = text.replace(regexName, '$1<a href="http://tjournal.ru/users/'+mention.id+'" target="_blank">$2</a>$3');
          }
        });
      }

      return text.replace(regex, '<a href="http://tjournal.ru/users/$1" target="_blank">$2</a>');
    }
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
    $('.typing' + data.user.id).remove();
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

  function bell(status) {
    if (status === 'offline') {
      $('.bell').removeClass('bell-online').addClass('bell-offline');
    } else {
      $('.bell').addClass('bell-online').removeClass('bell-offline');
    }
  }

  function sendNotification(title, body, icon) {
    if (!("Notification" in window)) {
      $notificationsStatus.text('Браузер не поддерживает уведомления');
      return;
    }

    if (notificationsStatus && Notification.permission === 'granted') {
      var instance = new Notification(title, {
        body: body,
        icon: icon
      });

      instance.onclick = function() {
        $('#messageInput').focus();
      };
      instance.onerror = function() {
        // Something to do
      };
      instance.onshow = function() {
        // Something to do
      };
      instance.onclose = function() {
        // Something to do
      };

      // Close after 4 seconds
      setTimeout(instance.close.bind(instance), 4000);

      return false;
    } else if (notificationsStatus && Notification.permission !== 'granted') {
      $notificationsStatus.text('Одобрите показ уведомлений');
      bell('offline');
      requestNotificationsPermission();
    } else {
      return false;
    }
  }

  function requestNotificationsPermission(callback) {
    if (!("Notification" in window)) {
      $notificationsPanel.hide();
      return;
    }

    callback = callback || function() {};

    Notification.requestPermission(function(permission) {
      Notification.permission = permission;

      callback(Notification.permission);
    });
  }

  function resetNotificationsStatus() {
    if (!("Notification" in window)) {
      $notificationsStatus.text('Браузер не поддерживает уведомления');
      return;
    }

    if (notificationsStatus && Notification.permission === 'granted') {
      notificationsStatus = true;
      $notificationsStatus.text('Отключить уведомления');
      bell();
    } else {
      if (Notification.permission === 'denied') {
        $notificationsStatus.text('Одобрите показ уведомлений');
        requestNotificationsPermission();
        bell('offline');
      } else {
        notificationsStatus = false;
        $notificationsStatus.text('Включить уведомления');
        bell('offline');
      }
    }
  }

  function changeNotificationsStatus() {
    if (!("Notification" in window)) {
      $notificationsStatus.text('Браузер не поддерживает уведомления');
      return;
    }

    // turn off
    if (notificationsStatus && Notification.permission === 'granted') {
      notificationsStatus = false;
      $notificationsStatus.text('Включить уведомления');
      bell('offline');
    } else {
      if (Notification.permission !== 'granted') {
        notificationsStatus = false;
        $notificationsStatus.text('Одобрите показ уведомлений');
        bell('offline');
        requestNotificationsPermission(function () {
          if (Notification.permission !== 'granted') {
            notificationsStatus = false;
            $notificationsStatus.text('Одобрите показ уведомлений');
            bell('offline');
          } else {
            notificationsStatus = true;
            $notificationsStatus.text('Отключить уведомления');
            bell();
          }
        });
      } else {
        notificationsStatus = true;
        $notificationsStatus.text('Отключить уведомления');
        bell();
      }
    }
    if (ls) localStorage.setItem('notificationsStatus', notificationsStatus);
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

  $('body').on('click', '#messageSubmitButton', function(event) {
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
    var mentionId = parseInt($(this).attr('data-id'));
    var inputText = $('#messageInput').val();

    if (lastMentionName.length > 0) {
      inputText = inputText.replace(lastMentionName + ', ', '');
    }

    inputText = mentionName + ', ' + inputText;

    lastMentionName = mentionName;
    lastMentionId = mentionId;

    $('#messageInput').val(inputText);
    $('#messageInput').focus();

    return false;
  });

  $('body').on('change blur keydown', '#messageInput', function() {
    if (lastMentionName.length > 0 && $(this).val().indexOf(lastMentionName) === -1) {
      lastMentionName = '';
      lastMentionId = 0;
    }
  });

  $('body').on('click', '#notifications-panel', function() {
    changeNotificationsStatus();
  });

  $('body').on('click', '.changeFont', function() {
    changeFont();
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
    socket.on('login', function(data) {
      connected = true;
      changeStatus(1);

      if (data.user.id > 0) {
        $('.onLoginSetUserPic').attr('src', data.user.image);
        $('.login-button').remove();
      }

      log('Вы вошли в чат!');
      updateOnlineList(data);
    });

    // message
    socket.on('new message', function(data) {
      if (!data.history && !document.hasFocus()) {
        if (data.message.indexOf('[id' + userData.id) >= 0) {
          var parsedMessage = parseMentions(data, true);
          sendNotification('Вас упомянули в чате TJ', data.user.username + ': ' + parsedMessage, data.user.image);
        } else if (data.mentions.length > 0) {
          data.mentions.forEach(function(mention) {
            if (mention.id == userData.id) {
              sendNotification('Вас упомянули в чате TJ', data.user.username + ': ' + data.message, data.user.image);
              return;
            }
          });
        }
      }

      addChatMessage(data);
    });

    // user join & left
    socket.on('user joined', function(data) {
      updateOnlineList(data, 'add');
    });

    socket.on('user left', function(data) {
      updateOnlineList(data, 'remove');
      //removeChatTyping(data);
    });

    // typing
    /*socket.on('typing', function(data) {
      addChatTyping(data);
    });

    socket.on('stop typing', function(data) {
      removeChatTyping(data);
    });*/

    // ban
    socket.on('banned', function(data) {
      log(data.user.username + ' заблокирован на ' + data.period + ' ' + languanize(data.period, ['минуту', 'минуты', 'минут']));
    });

    // slash command response
    socket.on('command response', function(data) {
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

  socket.on('auth failed', function(data) {
    changeStatus(-1);
    alert('Access denied');
  });
});

if (window.addEventListener) {
  window.addEventListener("message", gotMessage, false);
} else {
  window.attachEvent("onmessage", gotMessage);
}

// Scrolling on iOS
(function registerScrolling($) {
  var prevTouchPosition = {},
    scrollYClass = 'scroll-y',
    scrollXClass = 'scroll-x',
    searchTerms = '.' + scrollYClass + ', .' + scrollXClass;

  $('body').on('touchstart', function(e) {
    var $scroll = $(e.target).closest(searchTerms),
      targetTouch = e.originalEvent.targetTouches[0];

    // Store previous touch position if within a scroll element
    prevTouchPosition = $scroll.length ? {
      x: targetTouch.pageX,
      y: targetTouch.pageY
    } : {};
  });

  $('body').on('touchmove', function(e) {
    var $scroll = $(e.target).closest(searchTerms),
      targetTouch = e.originalEvent.targetTouches[0];

    if (prevTouchPosition && $scroll.length) {
      // Set move helper and update previous touch position
      var move = {
        x: targetTouch.pageX - prevTouchPosition.x,
        y: targetTouch.pageY - prevTouchPosition.y
      };
      prevTouchPosition = {
        x: targetTouch.pageX,
        y: targetTouch.pageY
      };

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
          if (Math.abs(move.x) > 0 && Math.abs(move.y) < 3) {
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
          if (Math.abs(move.y) > 0 && Math.abs(move.x) < 3) {
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
