/**
 * Copyright © 2018.
 * Salvare is the work of Milan Szekely <szekelymilan1125@gmail.com>
*/

const package = require('../package.json');
console.log('Salvare - server');
console.log(`v${package.version}`);
console.log(`Written by ${package.author}\n`);

// Packages
const express = require('express');
const fs = require('fs');
const path = require('path');

// Express (web server)
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, { pingTimeout: 4000, pingInterval: 2000 });
const EditorSocketIOServer = require('./editor-socketio-server.js');
const domain = 'salva.re';

app.set('trust proxy', true);
app.use(function(req, res, next) { // Redirect www to non-www
  if (req.headers.host.slice(0, 4) === 'www.')
    return res.redirect(301, req.protocol + '://' + req.headers.host.slice(4) + req.originalUrl);

  if (req.headers.host.indexOf(domain) === -1)
    return res.sendFile('/site/ip_access.htm', { root: __dirname });

  return next();
});

app.use('/node_modules', express.static('./node_modules'));
app.use('/assets', express.static('./src/site/assets'));

app.get('/', function(req, res) { // Homepage
  if ('newSession' in req.query) { // Start new session
    let sessID = randomString(8);
    do sessID = randomString(8)
    while (sessID in sessions);
    
    return res.redirect('/' +sessID);
  }
  res.sendFile('/site/index.htm', { root: __dirname });
});

app.get('/:id', function(req, res) { // Session editor
  const sessID = req.params.id;
  if (req.originalUrl.slice(-1) === '/')
    return res.redirect('/' +sessID);
  
  const file = fs.readFileSync(path.join(__dirname, '/site/editor.htm'), 'utf8').replace('[[[[replaceWithID]]]]', sessID);
  res.send(file);
});

app.use(function(req, res) { // Error 404: Not found
  res.status(404).sendFile('/site/errors/404.htm', { root: __dirname });
});

app.use(function(error, req, res, next) { // Error 500: Internal Server Error
  res.status(500).sendFile('/site/errors/500.htm', { root: __dirname });
});

server.listen(8080);

// socket.io server
let sessions = {};
const defText = '';

function createNewSession(id) {
  sessions[id] = new EditorSocketIOServer(defText, [], id);
  return sessions[id];
}

function newConnection(socket) {
  const handshakeData = socket.request;
  const sessID = handshakeData._query['sessID'];
  const session = (sessID in sessions ? sessions[sessID] : createNewSession(sessID));
  session.addClient(socket);
}
io.on('connection', newConnection);

// randomstring
function randomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
