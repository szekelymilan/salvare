/**
 * Code forked from ot.js
 * Edited version (for Salvare)
*/
'use strict';

const EventEmitter     = require('events').EventEmitter;
const TextOperation    = require('../node_modules/ot/lib/text-operation');
const WrappedOperation = require('../node_modules/ot/lib/wrapped-operation');
const Server           = require('../node_modules/ot/lib/server');
const Selection        = require('../node_modules/ot/lib/selection');
const util             = require('util');
const fs               = require('fs');

function EditorSocketIOServer (document, operations, docId, mayWrite) {
  EventEmitter.call(this);
  Server.call(this, document, operations);
  this.users = {};
  this.docId = docId;
  this.mayWrite = mayWrite || function (_, cb) { cb(true); };
  this.options = {mode: 'text/javascript', tabSize: 2, theme: 'monokai'};
}

util.inherits(EditorSocketIOServer, Server);
extend(EditorSocketIOServer.prototype, EventEmitter.prototype);

function extend (target, source) {
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key];
    }
  }
}

function addLog (main, id, ip) {
  if (!fs.existsSync('../logs'))
    fs.mkdirSync('../logs');

  fs.appendFileSync('../logs/connections.txt', '['+getDate()+'] '+main+': '+id+' <- '+ip+'\n');
}

EditorSocketIOServer.prototype.addClient = function (socket) {
  const self = this;
  console.log("\x1b[32mNew connect for session:\x1b[0m " + self.docId + "  [address " + socket.handshake.address.substr(7) + "]");
  addLog('CONNECTION', self.docId, socket.handshake.address.substr(7));
  socket
    .join(this.docId)
    .emit('doc', {
      str: this.document,
      revision: this.operations.length,
      clients: this.users,
      options: this.options
    })
    .on('changeOption', function (option, value) {
      if (!(option in self.options))
        return;
      self.options[option] = value;
      socket.broadcast['in'](self.docId).emit('updateOption', option, value);
    })
    .on('operation', function (revision, operation, selection) {
      self.mayWrite(socket, function (mayWrite) {
        if (!mayWrite)
          return;
        self.onOperation(socket, revision, operation, selection);
      });
    })
    .on('selection', function (obj) {
      self.mayWrite(socket, function (mayWrite) {
        if (!mayWrite)
          return;
        self.updateSelection(socket, obj && Selection.fromJSON(obj));
      });
    })
    .on('disconnect', function () {
      console.log("\x1b[31mDisconnect from session:\x1b[0m " + self.docId + "  [address " + socket.handshake.address.substr(7) + "]");
      addLog('DISCONNECT', self.docId, socket.handshake.address.substr(7));
      socket.leave(self.docId);
      self.onDisconnect(socket);
      /*if (socket.manager.sockets.clients(self.docId).length === 0) {
        self.emit('empty-room');
      }*/
    });
};

EditorSocketIOServer.prototype.onOperation = function (socket, revision, operation, selection) {
  var wrapped;
  try {
    wrapped = new WrappedOperation(
      TextOperation.fromJSON(operation),
      selection && Selection.fromJSON(selection)
    );
  } catch (exc) {
    return console.error("Invalid operation received: " + exc);
  }

  try {
    const clientId = socket.id;
    const wrappedPrime = this.receiveOperation(revision, wrapped);
    //console.log("new operation: " + wrapped);
    this.getClient(clientId).selection = wrappedPrime.meta;
    socket.emit('ack');
    socket.broadcast['in'](this.docId).emit(
      'operation', clientId,
      wrappedPrime.wrapped.toJSON(), wrappedPrime.meta
    );
  } catch (exc) {
    return console.error(exc);
  }
};

EditorSocketIOServer.prototype.updateSelection = function (socket, selection) {
  const clientId = socket.id;
  if (selection) {
    this.getClient(clientId).selection = selection;
  } else {
    delete this.getClient(clientId).selection;
  }
  socket.broadcast['in'](this.docId).emit('selection', clientId, selection);
};

EditorSocketIOServer.prototype.setName = function (socket, name) {
  const clientId = socket.id;
  this.getClient(clientId).name = name;
  socket.broadcast['in'](this.docId).emit('set_name', clientId, name);
};

EditorSocketIOServer.prototype.getClient = function (clientId) {
  return this.users[clientId] || (this.users[clientId] = {});
};

EditorSocketIOServer.prototype.onDisconnect = function (socket) {
  const clientId = socket.id;
  delete this.users[clientId];
  socket.broadcast['in'](this.docId).emit('client_left', clientId);
};

function getDate() {
  const d = new Date();

  var hour = d.getHours();
  hour = (hour < 10 ? "0" : "") + hour;

  var min = d.getMinutes();
  min = (min < 10 ? "0" : "") + min;

  var sec = d.getSeconds();
  sec = (sec < 10 ? "0" : "") + sec;

  var year = d.getFullYear();

  var month = d.getMonth() + 1;
  month = (month < 10 ? "0" : "") + month;

  var day = d.getDate();
  day = (day < 10 ? "0" : "") + day;

  return year + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;
}

module.exports = EditorSocketIOServer;