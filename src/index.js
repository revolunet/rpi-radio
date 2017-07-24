const Raspi = require("raspi-io")
const five = require("johnny-five")
const Mopidy = require("mopidy")
const fadeSteps = require("fade-steps")

const DEFAULT_VOLUME = 40
const DEFAULT_LED_INTENSITY = 60

const board = new five.Board({
  io: new Raspi({
    enableSoftPwm: true
  })
})

const delay = (duration = 500) => new Promise((resolve, reject) => setTimeout(resolve, duration))

// generate led color transition sequence
const fade = (led, fromColor, toColor, duration = 5000) => {
  const WAIT_TIME = 300; // ms
  const stepCount = Math.floor(duration / WAIT_TIME)
  const colors = fadeSteps(fromColor.replace(/#/, ""), toColor.replace(/#/, ""), stepCount).map(c => `#${c}`)
  return Array.from({ length: stepCount })
    .reduce((a, c, i) => {
      led.color(colors[i])
      return a.then(() => delay(WAIT_TIME))
    }, Promise.resolve())
    .catch(console.error)
}

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
  const led = new five.Led.RGB([0, 2, 3])
  led.intensity(DEFAULT_LED_INTENSITY)

  let currentPlaylistIndex = -1
  let playlists = []

  const rainbow = ["#FF7F00", "#8F00FF", "#FF0000", "#FFFF00", "#00FF00", "#0000FF"]
  let rainbowIndex = 0

  led.color(rainbow[rainbowIndex])

  const cycleColor = () => {
    const curColor = rainbow[rainbowIndex]
    rainbowIndex = (rainbowIndex + 1) % rainbow.length
    led.color(rainbow[rainbowIndex])
    //return fade(led, curColor, rainbow[rainbowIndex]).catch(console.error)
  }

  const rotaryButtonsPins = [4, 5, 6]

  const rotaryClick = async () => {
    console.log("rotaryClick")
    if (mopidy.playback) {
      mopidy.playback.stop()
    }
    cycleColor()
    // .then(() => {
        if (mopidy.playback) {
          const stopBlink = startLedBlink(led)
          return playNext().then(stopBlink).catch(stopBlink)
        }
     // })
     // .catch(console.error)
  }

  const shuffleArray = arr => arr.sort(() => Math.random() - 0.5)

  const playEurope1 = async () => {
    const curColor = rainbow[rainbowIndex]
    fade(led, curColor, "#006FC8").catch(console.error)
    return mopidy.library.lookup("http://e1-live-mp3-128.scdn.arkena.com/europe1.mp3").then(function(tracks) {
      mopidy.tracklist.clear()
      mopidy.tracklist.add(tracks)
      console.log(`play EUROPE 1`)
      return mopidy.playback.play()
    }).catch(console.error)
  }

  const playNext = async () => {
    console.log("playNext")
    // if (!playlists.length) {
    //   led.color(rainbow[rainbowIndex])
    // }

    if (rainbowIndex % 5 === 0) {
      return playEurope1()
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
    mopidy.mixer.setVolume(DEFAULT_VOLUME)
    mopidy.playlists
      .getPlaylists()
      .then(mopidyPlaylists => (playlists = shuffleArray(mopidyPlaylists)))
      .then(playEurope1)
  })

  this.repl.inject({
    mopidy,
    led
  })
})
