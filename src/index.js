const Raspi = require("raspi-io")
var five = require("johnny-five")
var Mopidy = require("mopidy")

var board = new five.Board({
  io: new Raspi({
    enableSoftPwm: true
  })
})

const startLedBlink = (led, duration = 500) => {
  let blinking = true
  const blink = () => {
    if (blinking) {
      led.toggle()
      setTimeout(blink, duration)
    } else {
      // finished
      led.on()
    }
  }
  setTimeout(blink, duration)
  return () => (blinking = false)
}

board.on("ready", function() {
  var led = new five.Led.RGB([0, 2, 3])

  led.intensity(100)

  let currentPlaylistIndex = -1
  let playlists = []

  const rainbow = ["FF0000", "FF7F00", "FFFF00", "00FF00", "0000FF", "4B0082", "8F00FF"]
  let rainboxIndex = 0
  led.color(rainbow[rainboxIndex])

  const cycleColor = () => {
    rainboxIndex = (rainboxIndex + 1) % rainbow.length
    led.color(rainbow[rainboxIndex])
  }

  const rotaryButtonsPins = [4, 5, 6]

  const rotaryClick = async () => {
    cycleColor()
    if (mopidy.playback) {
      const stopBlink = startLedBlink(led)
      playNextPlaylist().then(stopBlink).catch(stopBlink)
    }
  }

  const shuffleArray = arr => arr.sort(() => Math.random() - 0.5)

  const playNextPlaylist = async () => {
    if (!playlists.length) {
      return
    }
    // pick next spotify playlist
    currentPlaylistIndex = (currentPlaylistIndex + 1) % playlists.length
    const playlist = playlists[currentPlaylistIndex]
    console.log(`playlist: ${playlist.name}`)
    // clear tracks
    mopidy.tracklist.clear()
    let tracks = await mopidy.tracklist.add(playlist.tracks)
    // random
    mopidy.tracklist.shuffle()
    // start
    mopidy.playback.next()
    await mopidy.playback.play()
    setTimeout(async () => {
      const track = await mopidy.playback.getCurrentTrack()
      //console.log("track", track)
      console.log(`track: ${track && track.name}`)
      console.log(`artist: ${track && track.artists && track.artists.length && track.artists[0].name}`)
    }, 1000)
  }

  rotaryButtonsPins.forEach(pin => {
    var button = new five.Button({
      pin,
      isPullup: true
    })
    button.on("press", rotaryClick)
  })

  var mopidy = new Mopidy({
    webSocketUrl: "ws://127.0.0.1:6680/mopidy/ws/"
  })

  //  mopidy.on(console.log.bind(console));

  mopidy.on("state:online", function() {
    console.log("mopidy:online")
    mopidy.mixer.setVolume(80)
    mopidy.playlists
      .getPlaylists()
      .then(mopidyPlaylists => (playlists = shuffleArray(mopidyPlaylists)))
      //.then(playlists => playNextPlaylist())
  })

  this.repl.inject({
    mopidy,
    led
  })
})
