/*jslint devel: true, node: true, passfail: false, white: true, eqeq: true*/
require('console-stamp')(console, 'HH:MM:ss.l'); //timestamp all console logs
var cluster = require('cluster');
//config = require('./config');

const numWorkers = 1;


var events = require('events'),
    EventEmitter = require("events").EventEmitter,
    ee = new EventEmitter(),
    request = require("request"),
    //cheerio = require("cheerio"),
    //http = require('http'),
    util = require('util'),
    hangoutsBot = require('hangouts-bot'),
    creds = require('./creds.js');
//mysql = require('mysql'),
//sanitize = require("sanitize-filename"),


if(typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    localStorage = new LocalStorage('./scratch');
}

//hangouts bot
var notify = ['3hvvsimj9o2702ju1nxslmi12s@public.talk.google.com/lcsw_hangouts_5C7DBA35'];
var bot = new hangoutsBot(creds.hangouts.user, creds.hangouts.pass);

bot.on('message', function(from, msg) {
    msg = msg.toLowerCase();
    if(msg === 'add') {
        addUser(from);
    }
    else if(msg.indexOf('maps?q=') > -1) {
        //location = msg.substr(msg.indexOf('?q=') + 3, msg.length);
        localStorage.setItem('location', msg.substr(msg.indexOf('?q=') + 3, msg.length));
        //kill all existing works
        //TODO: add a way to just spin up multiple workers with different accounts etc
        if(cluster.workers.length > 0) {
            for(var id in cluster.workers) {
                cluster.workers[id].kill();
            }
        }
        else {
            startWorkers();
        }
        addUser(from);
    }
    else {
        console.log(from + ' >> ' + msg);
    }

});

function startWorkers() {
    //set up the workers
    console.log('Master cluster setting up ' + numWorkers + ' workers...');

    for(var i = 0; i < numWorkers; i++) {
        cluster.fork();
    }
}

function addUser(from) {
    var exists = false;
    for(var i = 0; i < notify.length; i++) {
        if(notify[i] === from) {
            exists = true;
            break;
        }
    }
    if(!exists) {
        notify.push(from);
        console.log('Adding someone to the watch list: ' + from);
    }
    else {
        console.log('Youre already on the notification list')
    }
}

//start this b
initManager();


function initManager() {
    /* Manager only code */
    if(cluster.isMaster) {


        cluster.on('online', function(worker) {
            console.log('Worker ' + worker.process.pid + ' is online');
        });

        cluster.on('exit', function(worker, code, signal) {
            console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
            console.log('Starting a new worker');
            //sendEmail('info', 'Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
            cluster.fork();
        });


        //routes and rest triggers
        var express = require("express");
        var bodyParser = require("body-parser");
        var app = express();
        //Here we are configuring express to use body-parser as middle-ware.
        app.use(bodyParser.urlencoded({
            extended: false
        }));
        app.use(bodyParser.json());
        //start the express server
        var server = app.listen(3000, function() {});
        app.get('/', function(req, res) {
            res.send('Placeholder, this will be the status page?');
        });

        //hangouts bot
        bot.on('online', function() {
            console.log('--Chat bot up and running--');
            //bot.sendMessage('3hvvsimj9o2702ju1nxslmi12s@public.talk.google.com/lcsw_hangouts_5C7DBA35', "Hey yo I'm a bot!")
        });

    }
    /* Worker Only code */
    else {
        var Worker = require('./worker'),
            worker;
        //console.log('WORKER SENDING ' + localStorage.getItem('location'))
        worker = new Worker(ee, localStorage.getItem('location'));

        ee.on('WORKER.DONE', function(e) {
            console.log('Worker Complete!');
        });
        ee.on('WORKER.ERROR', function(e) {
            console.log('Worker error: ', e);
            //sendEmail('error', 'There was an error converting the following file:<br><pre><code>' + JSON.stringify(e, null, 4) + '<code></pre>');
            isBusy = false;
        });

        ee.on('WORKER.SENDMESSAGE', function(poke) {
            console.log('Sending alert!', poke);
            for(var i = 0; i < notify.length; i++) {
                bot.sendMessage(notify[i], 'A wild ' + poke.name + ' appeared!\nYou have ~' + poke.timeRemaining + ' to get it!\n' + poke.map);
            }
        });
    }
}
