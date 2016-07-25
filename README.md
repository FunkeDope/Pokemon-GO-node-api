# PokeHang
A Google Hangouts bot that lets you know when there are Pokemon in your area!<br>
Based off the [PokemonGo Node API](https://github.com/Armax/Pokemon-GO-node-api)

## Installation & Usage:
```
sudo npm install
```

## Demo:


## Documentation:

### Config

See [PokemonGo Node API](https://github.com/Armax/Pokemon-GO-node-api) for base configuration.

You will also need a Google account to notify you. Why not use the same account that you are using with the API!?

Create a `creds.js` file and add the following to it:
```javascript
module.exports = {
    ptc: { //pokemon trainer club login
        user: 'Username',
        pass: 'Password',
        type: 'ptc'
    },
    google: { //google login. note you only need one or the other unless you want to run multiple instances
        user: 'username@gmail.com',
        pass: 'password',
        type: 'google'
    },
    hangouts: {
        user: 'username@gmail.com',
        pass: 'password'
    }
}
```

### Example

Once you have that ready, starting the app is simple
`node manager.js`

The chat bot will now be listening. You can now drop it a pin in Hangouts and it will start tracking all nearby Pokemon for you and send you a message when new ones pop up. Noe that you will need to change your chat settings to either allow everyone to contact me, or friend the bot first with your main google account.

### Commands (WIP)

Currently you can send the bot the following commands:

## [Dropped Pin] or Google Maps link

This is how you control the bot mainly. Dropping a pin (which actually sends a nicely formatted google maps link) will start the bot and/or update the watch location. It will also add you to the watch list.

## Add

'Add' will add another user to the watch list. They will be notified when a Pokemon is nearby as well. Dropping a pin also adds you to the watch list.

## Stop

'Stop' will remove you from the watch notification list.

## Clear

'Clear' will remove everyone from the watch list except you.
