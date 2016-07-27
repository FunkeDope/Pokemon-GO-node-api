/*jslint devel: true, node: true, passfail: false, white: true, eqeq: true*/
require('console-stamp')(console, 'HH:MM:ss.l'); //timestamp all console logs
var cluster = require('cluster');
//config = require('./config');

const numWorkers = 1;
var proc;

var events = require('events'),
    EventEmitter = require("events").EventEmitter,
    ee = new EventEmitter(),
    request = require("request"),
    util = require('util'),
    hangoutsBot = require('hangouts-bot'),
    creds = require('./creds.js');


if(typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    localStorage = new LocalStorage('./scratch');
}


//hangouts bot
var bot = new hangoutsBot(creds.hangouts.user, creds.hangouts.pass);
worker = [];



//start this b
initManager();

function initManager() {
    /* Manager only code */
    if(cluster.isMaster) {

        var worker = [];
        var notify = [];
        var ignoreList = ['doduo', 'weedle', 'caterpie', 'pidgey', 'pinsir', 'dodrio', 'rattata', 'zubat'];
        cluster.on('online', function(worker) {
            console.log('Worker ' + worker.process.pid + ' is online');
        });

        cluster.on('exit', function(worker, code, signal) {
            console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
            console.log('Starting a new worker');
            //sendEmail('info', 'Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
            worker = cluster.fork();
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
        bot.on('message', function(from, msg) {
            msg = msg.trim().toLowerCase();
            console.log('GOT MESSAGE: ' + msg);
            if(msg === 'add') {
                addUser(from);
            }
            else if(msg.indexOf('maps?q=') > -1) {
                //location = msg.substr(msg.indexOf('?q=') + 3, msg.length);
                localStorage.setItem('location', msg.substr(msg.indexOf('?q=') + 3, msg.length));
                //kill all existing works
                //TODO: add a way to just spin up multiple workers with different accounts etc
                /*if(cluster && cluster.workers && cluster.workers.length > 0) {
                    console.log('killing workers');
                    for(var id in cluster.workers) {
                        cluster.workers[id].kill();
                    }
                }*/
                if(worker && worker.kill) {
                    worker.kill();
                }
                else {
                    startWorkers();
                }
                addUser(from);
                bot.sendMessage(from, 'Updated watch location...');
            }
            else if(msg === 'clear') {
                notify = [];
                addUser(from);
            }
            else if(msg === 'stop') {
                for(var i = 0; i < notify.length; i++) {
                    if(notify[i] === from) {
                        delete notify[i];
                        worker.send({
                            type: 'notify',
                            notify: notify
                        });
                        bot.sendMessage(from, 'You\'ve been removed from the list');
                    }
                }
            }
            else if(msg.indexOf('ignore')) {
                //TO DO: ability to add or remove from the ignore list
            }
            else {
                console.log(from + ' >> ' + msg);
            }

        });

        bot.on('online', function() {
            console.log('--Chat bot up and running--');
        });

        function startWorkers() {
            //set up the workers
            console.log('Master cluster setting up ' + numWorkers + ' workers...');

            for(var i = 0; i < numWorkers; i++) {
                worker = cluster.fork();
            }

            worker.send({
                type: 'notify',
                notify: notify
            });
            worker.send({
                type: 'ignore',
                ignore: ignoreList
            });

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
                worker.send({
                    type: 'notify',
                    notify: notify
                });
                console.log('Adding someone to the watch list: ' + from, notify);
                bot.sendMessage(from, 'Added you to the watch list. Currently watching: http://maps.google.com?q=' + localStorage.getItem('location') + '\nIgnoring: ' + ignoreList.join(', '));
            }
            else {
                console.log('Youre already on the notification list')
            }
        }


    }
    /* Worker Only code */
    else {
        var Worker = require('./worker'),
            worker,
            ignoreList = [],
            notify = [];

        worker = new Worker(ee, localStorage.getItem('location'));


        process.on('message', function(data) {
            if(data.type === 'notify') {
                notify = data.notify;
            }
            else if(data.type === 'ignore') {
                ignoreList = data.ignore;
            }
        });

        //event listeners
        ee.on('WORKER.DONE', function(e) {
            console.log('Worker Complete!');
        });
        ee.on('WORKER.ERROR', function(e) {
            console.log('Worker error: ', e);
        });

        ee.on('WORKER.SENDMESSAGE', function(poke) {
            var ignore = false;
            for(var i = 0; i < ignoreList.length; i++) {
                if(poke.name.toLowerCase() === ignoreList[i]) {
                    ignore = true;
                }
            }
            if(!ignore) {
                console.log('Sending alert for ' + poke.name);
                var msg = 'A wild ' + poke.name + ' appeared!\n' + poke.timeRemaining + ' remaining. (' + poke.experationTimeLocal + ')\nNear: ' + poke.address + '\n' + poke.map + '\n(' + (parseFloat(poke.distance) * 5280).toFixed(0) + 'ft / ' + parseFloat(poke.distance).toFixed(3) + 'mi away)';
                for(var i = 0; i < notify.length; i++) {
                    bot.sendMessage(notify[i], msg);
                }
            }
            else {
                console.log(poke.name + ' is on the ignore list, not sending notification!');
            }

        });
    }
}
