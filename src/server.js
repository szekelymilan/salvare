/**
 * Copyright © 2018.
 * Salvare is the work of Milan Szekely <szekelymilan1125@gmail.com>
*/

const package = require('../package.json');
console.log("Salvare - server");
console.log("v" + package.version);
console.log("Written by " + package.author + "\n");

// Packages
const express = require('express');
const fs = require('fs');

// Express (web server)
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const EditorSocketIOServer = require('./editor-socketio-server.js');
app.use('/node_modules', express.static('../node_modules'));
app.use('/assets', express.static('site/assets'));

app.get('/', function(req, res) {
  if ('newSession' in req.query) {
    let sessID = randomString(8);
    do sessID = randomString(8)
    while (sessID in sessions);
    
    return res.redirect('/' +sessID);
  }
  res.sendFile(__dirname + '/site/index.htm');
});

app.get('/:id', function(req, res) {
  const sessID = req.params.id;
  const file = fs.readFileSync(__dirname + '/site/editor.htm', 'utf8').replace("[[[[replaceWithID]]]]", sessID);
  res.send(file);
});

app.use(function(req, res) { // Error 404: Not found
  res.status(404).sendFile(__dirname + '/site/errors/404.htm');
});

app.use(function(error, req, res, next) { // Error 500: Internal Server Error
  res.status(500).sendFile(__dirname + '/site/errors/500.htm');
});

server.listen(80);

// socket.io server
let sessions = {};
const defText = "";

function createNewSession(id) {
  sessions[id] = new EditorSocketIOServer(defText, [], id);
  return sessions[id];
}

io.on('connection', function(socket) {
  const handshakeData = socket.request;
  const sessID = handshakeData._query['sessID'];
  const session = (sessID in sessions ? sessions[sessID] : createNewSession(sessID));
  session.addClient(socket);

  socket.on('testelek', function(data) {
    console.dir(sessID);
    console.dir(data);
  });
});

// randomstring
function randomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
