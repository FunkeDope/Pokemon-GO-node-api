module.exports = function Worker(ee, loc) {
    'use strict';
    var PokemonGO = require('./poke.io.js'),
        fs = require('fs'),
        moment = require('moment'),
        creds = require('./creds.js');


    var a = new PokemonGO.Pokeio();

    //Set environment variables or replace placeholder text
    var location = {
        type: 'name',
        name: loc //'4775 league island blvd 19112'
    };

    /*var username = creds.ptc.user,
        password = creds.ptc.pass,
        provider = creds.ptc.type;*/
    var username = creds.google.user,
        password = creds.google.pass,
        provider = creds.google.type;

    var knownPoke = [];


    //log into pogo
    a.init(username, password, location, provider, function(err) {
        if(err) {
            throw err;
        }

        //main loop
        setInterval(function() {
            checkPokemon();
            checkForExpired();
        }, 5000);
    });

    function checkPokemon() {
        a.Heartbeat(function(err, hb) {
            if(err) {
                console.log(err);
            }

            for(var i = 0; i < hb.cells.length; i++) {
                if(hb.cells[i].MapPokemon.length > 0) {
                    for(var x = 0; x < hb.cells[i].MapPokemon.length; x++) {
                        //console.log( heartbeat.cells[i].MapPokemon[x]);
                        var poke = hb.cells[i].MapPokemon[x];

                        if(!knownPoke[poke.EncounterId] && parseFloat(poke.ExpirationTimeMs.toString()) > 0) { //idk why, but some times they have -1 as an expired time?
                            console.log('--New Pokemon Found!--');
                            var time = poke.ExpirationTimeMs - (new Date).getTime();
                            var min = (time / 1000 / 60) << 0;
                            var sec = (time / 1000) % 60;

                            var dateTime = moment(poke.ExpirationTimeMs.toString(), 'x').format('h:mm:ss a ddd');

                            knownPoke[poke.EncounterId] = {
                                name: a.pokemonlist[parseInt(poke.PokedexTypeId) - 1].name,
                                location: {
                                    lat: poke.Latitude,
                                    long: poke.Longitude
                                },
                                experationTime: parseFloat(poke.ExpirationTimeMs.toString()),
                                experationTimeLocal: dateTime,
                                timeRemaining: min + 'm ' + sec.toFixed(0) + 's',
                                map: 'http://maps.google.com?q=' + poke.Latitude + ',' + poke.Longitude
                            };
                            console.log(knownPoke[poke.EncounterId]);
                            ee.emit('WORKER.SENDMESSAGE', knownPoke[poke.EncounterId]);
                        }
                    }

                }
            }

        });
    }

    function checkForExpired() {
        for(var poke in knownPoke) {
            if(knownPoke[poke].experationTime < (new Date).getTime()) {
                console.log('Pokemon Gone :( ' + knownPoke[poke].name);
                delete knownPoke[poke];
            }
        }
    }
};
