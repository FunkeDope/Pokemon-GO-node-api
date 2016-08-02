module.exports = function Worker(ee, loc) {
    'use strict';
    var PokemonGO = require('./poke.io.js'),
        fs = require('fs'),
        moment = require('moment'),
        geocoder = require('geocoder'),
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

    var initialLoc;

    //temp. to help throttle maps calls. todo: pull from the main threads global list
    var ignoreList = ['doduo', 'weedle', 'caterpie', 'pidgey', 'pinsir', 'dodrio', 'rattata', 'zubat', 'poliwag', 'krabby', 'goldeen', 'spearow', 'magnemite', 'voltorb'];

    //log into pogo
    a.init(username, password, location, provider, function(err) {
        if(err) {
            throw err;
        }

        initialLoc = {
            lat: a.playerInfo.latitude,
            long: a.playerInfo.longitude
        };

        //step logic!
        //this is stupid and needs to be refactored
        var compassRose = [];
        compassRose.push(initialLoc);
        var dataset = [];
        dataset[0] = generateLocations(initialLoc.lat, initialLoc.long, .05);
        dataset[1] = generateLocations(initialLoc.lat, initialLoc.long, .1);
        dataset[2] = generateLocations(initialLoc.lat, initialLoc.long, .15);
        dataset[3] = generateLocations(initialLoc.lat, initialLoc.long, .2);
        dataset[4] = generateLocations(initialLoc.lat, initialLoc.long, .25);
        /*dataset[5] = generateLocations(initialLoc.lat, initialLoc.long, .175);
        dataset[6] = generateLocations(initialLoc.lat, initialLoc.long, .2);
        dataset[7] = generateLocations(initialLoc.lat, initialLoc.long, .22);
        dataset[8] = generateLocations(initialLoc.lat, initialLoc.long, .235);*/
        for(var i = 0; i < dataset.length; i++) {
            for(var x = 0; x < dataset[i].length; x++) {
                compassRose.push(dataset[i][x]);
            }
        }

        console.log(require('util').inspect(compassRose, true, 10));

        //main loop
        var c = 0;
        setInterval(function() {
            checkPokemon();
            checkForExpired();
            updateLocation(compassRose[c]);
            c++;
            if(c >= compassRose.length) {
                c = 0;
            }
        }, 1500);
    });

    function checkPokemon() {
        a.Heartbeat(function(err, hb) {
            if(err) {
                console.log(err);
            }

            //catchable pokemon around you right now
            for(var i = 0; i < hb.cells.length; i++) {
                if(hb.cells[i].MapPokemon.length > 0) {
                    for(var x = 0; x < hb.cells[i].MapPokemon.length; x++) {
                        //console.log( heartbeat.cells[i].MapPokemon[x]);

                        var poke = hb.cells[i].MapPokemon[x];
                        var skip = false;
                        if(!knownPoke[poke.EncounterId] && parseFloat(poke.ExpirationTimeMs.toString()) > 0) { //idk why, but some times they have -1 as an exMath.PIred time?
                            for(var t = 0; t < ignoreList.length; t++) {
                                if(a.pokemonlist[parseInt(poke.PokedexTypeId) - 1].name.toLowerCase() === ignoreList[t]) {
                                    skip = true;
                                    console.log('Skipping: ' + a.pokemonlist[parseInt(poke.PokedexTypeId) - 1].name);
                                    return;
                                }
                            }
                            if(!skip) {
                                var time = poke.ExpirationTimeMs - (new Date).getTime();
                                var min = (time / 1000 / 60) << 0;
                                var sec = (time / 1000) % 60;

                                var dateTime = moment(poke.ExpirationTimeMs.toString(), 'x').format('h:mm:ss a ddd');

                                var distanceFromHome = calculateDistance(initialLoc.lat, initialLoc.long, poke.Latitude, poke.Longitude);

                                var humanAddress = '';

                                geocoder.reverseGeocode(poke.Latitude, poke.Longitude, function(err, data) {
                                    if(err) {
                                        console.log('Error reverse geocoding: ' + err);
                                    }

                                    humanAddress = data.results[0].formatted_address;

                                    knownPoke[poke.EncounterId] = {
                                        name: a.pokemonlist[parseInt(poke.PokedexTypeId) - 1].name,
                                        location: {
                                            lat: poke.Latitude,
                                            long: poke.Longitude
                                        },
                                        experationTime: parseFloat(poke.ExpirationTimeMs.toString()),
                                        experationTimeLocal: dateTime,
                                        timeRemaining: min + 'm ' + sec.toFixed(0) + 's',
                                        distance: distanceFromHome,
                                        address: humanAddress,
                                        map: 'http://maps.google.com?q=' + poke.Latitude + ',' + poke.Longitude
                                    };
                                    console.log('--New Pokemon Found!--', knownPoke[poke.EncounterId].name, knownPoke[poke.EncounterId].map, knownPoke[poke.EncounterId].timeRemaining);
                                    //console.log(knownPoke[poke.EncounterId]);
                                    ee.emit('WORKER.SENDMESSAGE', knownPoke[poke.EncounterId]);
                                }, creds.maps);
                            }


                        }
                    }

                }
            }
        });
    }

    function generateLocations(lat, long, distance) {
        //check ~ .25km in all 4 directions
        var locs = [],
            neighbors = getNeighbors(lat, long, distance);


        locs.push({ //north
            lat: neighbors.northLat,
            long: long
        });
        locs.push({ //north east
            lat: neighbors.northLat,
            long: neighbors.eastLong
        });
        locs.push({ //east
            lat: lat,
            long: neighbors.eastLong
        });
        locs.push({ //south east
            lat: neighbors.southLat,
            long: neighbors.eastLong
        });
        locs.push({ //south
            lat: neighbors.southLat,
            long: long
        });
        locs.push({ //south west
            lat: neighbors.southLat,
            long: neighbors.westLong
        });
        locs.push({ //west
            lat: lat,
            long: neighbors.westLong
        });
        locs.push({ //north west
            lat: neighbors.northLat,
            long: neighbors.westLong
        });

        //do middles too
        if(distance > .05) {
            var points = [];
            points.push(generateLocations(neighbors.northLat, neighbors.eastLong, .05));
            points.push(generateLocations(neighbors.northLat, neighbors.westLong, .05));
            points.push(generateLocations(neighbors.southLat, neighbors.eastLong, .05));
            points.push(generateLocations(neighbors.southLat, neighbors.westLong, .05));

            for(var i = 0; i < points.length; i++) {
                for(var point in points[i]) {
                    locs.push({
                        lat: points[i][point].lat,
                        long: points[i][point].long
                    });
                }
            }
        }

        return locs;
    }

    function getNeighbors(lat, long, distance) {
        var neighbors = {
            northLat: lat + (distance / 6378) * (180 / Math.PI),
            southLat: lat - (distance / 6378) * (180 / Math.PI),
            eastLong: long + (distance / 6378) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180),
            westLong: long - (distance / 6378) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180)
        }

        return neighbors;

    }


    function calculateDistance(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2 - lat1); // deg2rad below
        var dLon = deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        d = d / 1.609344; //this is america, so make this in miles 
        return d;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180)
    }

    function updateLocation(data) {
        var callback = function(err, data) {
            if(err) {
                console.log(err);
            }
            //console.log('moving to location: ', data);
        }

        var newLoc = {
            type: 'coords',
            coords: {
                latitude: data.lat,
                longitude: data.long
            }
        };
        //console.log(newLoc);
        a.SetLocation(newLoc, callback);
    }

    function checkForExpired() {
        for(var poke in knownPoke) {
            if(knownPoke[poke].experationTime < (new Date).getTime()) {
                console.log('Pokemon Gone :( ' + knownPoke[poke].name);
                delete knownPoke[poke];
            }
        }
    }
}
