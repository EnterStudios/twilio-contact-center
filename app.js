var express       = require('express')
var bodyParser    = require('body-parser')
var sessions      = require("express-session")
var compression   = require('compression')
var http = require('http');
var https = require('https');
var fs = require('fs');



/* check if the application runs on heroku */
var util

if(process.env.DYNO){
  util = require("./util-pg.js")
} else {
  util = require("./util-file.js")
}

var app = express()

var port = normalizePort(process.env.PORT || '5000');

app.set('port', port);
app.set('secport', port + 443);

// Secure traffic only
//app.all('*', function(req, res, next){
//  console.log('req start: ',req.secure, req.hostname, req.url, app.get('port'));
//  if (req.secure) {
//    return next();
//  }
//  res.redirect('https://'+req.hostname+':'+app.get('secport')+req.url);
//});

app.use(compression())
app.use(sessions({resave: true, saveUninitialized: false, secret: 'keyboard cat', name: 'session',  cookie: {expires: util.generateSessionExirationDate() }}))
app.use(bodyParser.json({}))
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(function (req, res, next) {
    util.getConfiguration(function(error, configuration){
  	if(error){
  		res.status(500).json({stack: error.stack, message: error.message })
  	} else {
  		req.configuration = configuration
  		next()
  	}
  })
})

var router = express.Router()

var setup = require('./controllers/setup.js')

router.route('/setup').get(setup.get)
router.route('/setup').post(setup.update)
router.route('/setup/validate').get(setup.validate)
router.route('/setup/workspace').get(setup.getWorkspace)
router.route('/setup/activities').get(setup.getActivities)

var tasks = require('./controllers/tasks.js')

router.route('/tasks/callback').post(tasks.createCallback)
router.route('/tasks/chat').post(tasks.createChat)

/* routes for agent interface and phone */
var agents = require('./controllers/agents.js')

router.route('/agents/login').post(agents.login)
router.route('/agents/logout').post(agents.logout)
router.route('/agents/session').get(agents.getSession)
router.route('/agents/call').get(agents.call)

/* routes for IVR */
var ivr = require('./controllers/ivr.js')

router.route('/ivr/welcome').get(ivr.welcome)
router.route('/ivr/select-team').get(ivr.selectTeam)
router.route('/ivr/create-task').get(ivr.createTask)

/* routes called by the Twilio Taskrouter */
var taskrouter = require('./controllers/taskrouter.js')

router.route('/taskrouter/assignment').post(taskrouter.assignment)

var workers = require('./controllers/workers.js')

router.route('/workers').get(workers.list) // agents
router.route('/workers').post(workers.create)
router.route('/workers/:id').delete(workers.delete)

var dashboard = require('./controllers/dashboard.js')

router.route('/dashboard/event-receiver').post(dashboard.pushEvent)

app.use('/api', router)
app.use('/', express.static(__dirname + '/public'))


var options = {
    key: fs.readFileSync(__dirname + '/private.key'),
    cert: fs.readFileSync(__dirname + '/certificate.pem')
};

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

//server.listen(port, function() {
//    console.log('Server listening on port ',port);
//});
server.on('error', onError);
server.on('listening', onListening);

var secureServer = https.createServer(options, app);

//secureServer.listen(app.get('secport'), function() {
//    console.log('magic happens on port', app.get('secport'))
//});

secureServer.on('error', onError);
secureServer.on('listening', onListening);

app.listen(app.get('port'), function() {
  console.log('magic happens on port', app.get('port'))
})

function normalizePort(val) {
    var port = parseInt(val, 10);
    if (isNaN(port)) {
        // named pipe
        return val;
    }
    if (port >= 0) {
        // port number
        return port;
    }
    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;

        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;

        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;

}
