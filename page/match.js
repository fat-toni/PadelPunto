// Score screen: tap a team's card to give it the point. The watch buttons are locked here.
// Seen from the player's side of the net: the own team (0) at the bottom, the opponents (1) on top.
import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { px } from '@zos/utils'
import {
  setWakeUpRelaunch,
  setPageBrightTime,
  pauseDropWristScreenOff,
  resetDropWristScreenOff,
  pausePalmScreenOff,
  resetPalmScreenOff,
} from '@zos/display'
import { onKey, offKey, onGesture, offGesture } from '@zos/interaction'
import { HeartRate } from '@zos/sensor'
import {
  addPoint,
  replay,
  pointLabels,
  pointSteps,
  deuceInfo,
  durationText,
  currentServer,
  serveSide,
  hasStarted,
  spokenWords,
} from '../utils/score'
import { isTraining, pointsToWin, matchBalls, americanoInfo, trainingProgress } from '../utils/training'
import { loadCfg } from '../utils/config'
import { loadGame, saveMatch, archiveMatch, clearMatch } from '../utils/store'
import {
  C,
  text,
  fitText,
  rect,
  tappable,
  button,
  restyle,
  buzz,
  buzzSwitch,
  buzzSet,
  buzzMatch,
  buzzPauseEnd,
  clock,
  fullScreen,
  teamColor,
  lazy,
  confirmTwice,
} from '../utils/theme'
import { tr, teamNames, hintText } from '../utils/i18n'
import { createVoice, VOICE_LANG } from '../utils/voice'
import { safePage, safe } from '../utils/errors'
import { toast } from '../utils/toast'

// Card top per team: own team below, opponents above. The hint badge sits in the gap between
// the cards (HINT_Y), so it never covers a part of a card that should count a tap.
const CARD_Y = [238, 54]
const CARD_H = 152
const HINT_Y = 208
const SWITCH_MS = 5000
// How long the games tile of the team that won a game lights up in ball color.
const FLASH_MS = 700
const MAX_BRIGHT_MS = 2147483000
// The banner after a won set covers the cards for this long, or until tapped.
const BANNER_MS = 3000
// A tap that closes the banner must not also count as a point on the card below it.
const BANNER_TAP_MS = 400
// FIP rules 2.5 and 2.6: up to 90 s at a change of ends, up to 120 s at the end of a set.
const PAUSE_MS = 90000
const SET_PAUSE_MS = 120000
// Training: the ball on the serving team's card, between the points and the tile (img/ball.png),
// and the progress bar along the bottom of the card.
const BALL = 48
const BALL_X = 214
const BALL_DY = 66
const BAR_W = 232

function pillProps(x, w, label, onClick, active) {
  return {
    x: px(x),
    y: px(396),
    w: px(w),
    h: px(44),
    radius: px(22),
    text: label,
    text_size: px(22),
    color: active ? 0x000000 : C.muted,
    normal_color: active ? C.ball : C.pill,
    press_color: active ? C.ballPress : C.tile,
    click_func: onClick,
  }
}

// As in the padel rules: a break after each set, and at a change of ends after a game, but not
// after the first game of a set and not in a tiebreak (those change ends without a rest);
// none once the match is over.
function breakDue(state, events) {
  if (events.includes('match') || !events.includes('game')) return false
  if (events.includes('set')) return true
  return events.includes('switch') && state.games[0] + state.games[1] !== 1
}

// Remaining time as "1:25" (rounded up, so it reads 1:30 right at the start and 0:01 at the end).
function clockText(ms) {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function pillButton(x, w, label, onClick) {
  return button(pillProps(x, w, label, onClick, false))
}

Page(
  safePage('match', {
    onInit() {
      const { state, moves } = loadGame()
      this.state = state
      this.moves = moves
      this.switchUntil = 0
      if (!this.state) replace({ url: 'page/start' })
    },

    build() {
      if (!this.state) return
      fullScreen()
      setWakeUpRelaunch({ relaunch: true })
      const cfg = loadCfg()
      // Names and colors changed in the options after "Verlassen" count at once; the rules stay
      // as the match started (see the hint on the options page).
      this.state = { ...this.state, cfg: { ...this.state.cfg, names: cfg.names, colors: cfg.colors } }
      this.keepScreenOn = cfg.screen === 'on'
      this.switchBuzz = cfg.switchBuzz === 'on'
      // The timed break (option "Pausen", off by default).
      this.pauseOn = cfg.pause === 'on'
      this.pauseUntil = 0
      this.showHr = cfg.hr !== 'off'
      // Training: points only, a ball for the server, no announcement (not yet) and no change of ends.
      this.training = isTraining(this.state.cfg)
      // Score announcement (option "Ansage"); also sets the watch volume until the page closes.
      this.voice = cfg.voice === 'on' && !this.training ? createVoice(VOICE_LANG, cfg.volume) : null
      if (this.keepScreenOn) {
        // Screen stays lit for this page; lowering the wrist or covering it with a hand
        // no longer turns it off. The page bright time resets with the page itself.
        try {
          setPageBrightTime({ brightTime: MAX_BRIGHT_MS })
          pauseDropWristScreenOff({ duration: 0 })
          pausePalmScreenOff({ duration: 0 })
        } catch (e) {}
      }

      // Top bar, kept away from the rounded corners: heart rate (unless switched off), time, match duration.
      if (this.showHr) {
        hmUI.createWidget(hmUI.widget.CIRCLE, { center_x: px(70), center_y: px(29), radius: px(5), color: C.heart })
        this.hrW = lazy(text({ x: px(80), y: px(10), w: px(60), h: px(38), text_size: px(22) }))
      }
      // One wake-up a minute for both the time and the match duration (the duration is also
      // refreshed with every point).
      this.stopClock = clock(
        {
          x: px(140),
          y: px(10),
          w: px(110),
          h: px(38),
          text_size: px(28),
          align_h: hmUI.align.CENTER_H,
        },
        () => this.renderStatus(),
      )
      this.timeW = lazy(
        text({
          x: px(250),
          y: px(10),
          w: px(72),
          h: px(38),
          text_size: px(22),
          color: C.muted,
          align_h: hmUI.align.RIGHT,
        }),
      )

      this.colors = [0, 1].map((t) => teamColor(this.state.cfg, t))
      this.teams = [0, 1].map((t) => this.buildTeam(t, px(CARD_Y[t])))
      if (this.training) this.ball = null

      // Badge between the cards for deuce, tiebreak and side change.
      this.hintBg = lazy(rect({ x: px(85), y: px(HINT_Y), w: px(220), h: px(28), radius: px(14), color: C.ball }))
      this.hintW = lazy(
        text({
          x: px(85),
          y: px(HINT_Y),
          w: px(220),
          h: px(28),
          text_size: px(20),
          color: 0x000000,
          align_h: hmUI.align.CENTER_H,
        }),
      )

      this.leftBtn = pillButton(12, 179, tr('undo'), () => this.tapLeft())
      // A match with points played needs a second tap to end; it then goes to the log,
      // marked as abandoned unless someone has won. While "Beenden?" waits, the undo button
      // offers "Verlassen" instead: back to the start page, the match stays saved for "Weiter".
      this.endConfirm = confirmTwice(
        (on) => this.paintEnd(on),
        () => this.finish(),
        () => this.state.winner === null && hasStarted(this.state),
      )
      this.endBtn = pillButton(199, 179, tr('end'), () => this.tapEnd())

      // Won set: a banner in the winner's color over both cards ("SATZ · WIR · 6:4"), so the set
      // stands out without relying on the vibration. The buttons below stay free. Built last, so
      // it lies on top.
      const bannerBg = rect({ x: px(12), y: px(54), w: px(366), h: px(336), radius: px(28), color: C.card })
      const bannerText = (y, h, size) =>
        text({
          x: px(24),
          y: px(y),
          w: px(342),
          h: px(h),
          text_size: px(size),
          color: 0x000000,
          align_h: hmUI.align.CENTER_H,
        })
      this.banner = [bannerBg, bannerText(88, 50, 40), bannerText(150, 70, 56), bannerText(228, 120, 104)].map(lazy)
      this.bannerOn = false
      this.bannerClosedAt = 0
      bannerBg.addEventListener(
        hmUI.event.CLICK_UP,
        safe('banner', () => this.hideBanner(true)),
      )
      this.banner.forEach((w) => w.set(hmUI.prop.VISIBLE, false))

      // Lock the watch buttons and swipes: a bent wrist or a sweeping finger must not leave the
      // match or open a menu. The match is left only via "Ende" → "Beenden?" or "Verlassen".
      onKey({ callback: () => true })
      onGesture({ callback: () => true })

      if (this.showHr) {
        try {
          this.hr = new HeartRate()
          this.onHr = safe('hr', () => this.renderHr())
          this.hr.onCurrentChange(this.onHr)
        } catch (e) {
          this.hr = null
        }
      }

      this.render()
    },

    // A team card: name, big point label with the games of finished sets beside it, four point
    // bars, and a games tile for the running set. Names and colors come from the match's config,
    // so changing them in the options affects the next match.
    // A ball-colored bar on the serving team's card edge shows the side the server serves from,
    // big enough to see in sunlight on a smudged screen; both bars show when the receivers choose
    // the side. Sides are drawn as the player sees them: the opponents face the player, so their
    // right side is on the player's left.
    buildTeam(t, y) {
      const team = this.colors[t]
      const card = rect({ x: px(12), y, w: px(366), h: px(CARD_H), radius: px(28), color: team.card })
      // Top row: name on the left, up to the games tile. The name gets smaller until it fits,
      // but not below 16 px; a name too wide even then ends in "…".
      const label = fitText(teamNames(this.state.cfg)[t], px(232), [24, 22, 20, 18, 16].map(px))
      const name = text({
        x: px(30),
        y: y + px(16),
        w: px(232),
        h: px(28),
        text: label.text,
        text_size: label.size,
        color: team.text,
      })
      // Clear of the rounded corners, between the card edge and the content.
      const edges = [0, 1].map((i) =>
        rect({ x: px(14 + i * 352), y: y + px(28), w: px(10), h: px(96), radius: px(5), color: C.ball }),
      )
      // Middle row: big point label, the games of finished sets to its right.
      const sets = [0, 1, 2].map((i) =>
        text({
          x: px(172 + i * 30),
          y: y + px(76),
          w: px(30),
          h: px(28),
          text_size: px(24),
          align_h: hmUI.align.CENTER_H,
        }),
      )
      const points = text({ x: px(30), y: y + px(44), w: px(142), h: px(92), text_size: px(100) })
      // The winner's word (SIEG/WIN/GANA) gets its own widget, sized to fit beside the sets.
      const winLabel = fitText(tr('win'), px(142), [100, 88, 76, 64, 56].map(px))
      const win = text({
        x: px(30),
        y: y + px(44),
        w: px(142),
        h: px(92),
        text: winLabel.text,
        text_size: winLabel.size,
        color: C.ball,
      })
      // Four point bars; in a training one progress bar instead, a track and its fill.
      const bars = this.training
        ? [C.off, team.text].map((color) =>
            rect({ x: px(30), y: y + px(138), w: px(BAR_W), h: px(6), radius: px(3), color }),
          )
        : [0, 1, 2, 3].map((i) =>
            rect({ x: px(30 + i * 56), y: y + px(138), w: px(48), h: px(6), radius: px(3), color: C.off }),
          )
      const tile = rect({ x: px(270), y: y + px(16), w: px(92), h: px(124), radius: px(22), color: team.tile })
      const games = text({
        x: px(270),
        y: y + px(28),
        w: px(92),
        h: px(76),
        text_size: px(64),
        align_h: hmUI.align.CENTER_H,
      })
      const caption = text({
        x: px(270),
        y: y + px(104),
        w: px(92),
        h: px(24),
        text: tr('games'),
        text_size: px(16),
        color: C.muted,
        align_h: hmUI.align.CENTER_H,
      })
      tappable(card, [name, points, win, tile, games, caption, ...edges], team.card, team.press, () => this.point(t))
      return {
        tile: lazy(tile),
        caption: lazy(caption),
        name: lazy(name),
        edges: edges.map(lazy),
        sets: sets.map(lazy),
        points: lazy(points),
        win: lazy(win),
        bars: bars.map(lazy),
        games: lazy(games),
        y,
        rightEdge: t === 0 ? 1 : 0,
      }
    },

    // One light tick per point; a side change ticks twice unless switched off in the options;
    // a won set vibrates once long (and shows the banner), the won match three times long.
    // The games tile of the team that won a game lights up for a moment.
    point(t) {
      if (this.bannerOn) return this.hideBanner(true)
      if (Date.now() - this.bannerClosedAt < BANNER_TAP_MS) return
      if (this.state.winner !== null) return
      const { state, events } = addPoint(this.state, t)
      if (events.includes('match')) buzzMatch()
      else if (events.includes('set')) buzzSet()
      else if (this.switchBuzz && events.includes('switch')) buzzSwitch()
      else buzz()
      this.moves.push(t)
      this.state = state
      if (events.includes('match')) this.state.endedAt = Date.now()
      if (events.includes('game')) this.flash(t)
      // An Americano is won by whoever is ahead, not by the last point (-1: level).
      if (events.includes('set')) this.showBanner(state.winner !== null ? state.winner : t, events.includes('match'))
      // A point played ends any break that is still running.
      this.stopPause()
      if (events.includes('switch')) {
        this.switchUntil = Date.now() + SWITCH_MS
        clearTimeout(this.switchTimer)
        this.switchTimer = setTimeout(
          safe('switch', () => this.renderStatus()),
          SWITCH_MS + 100,
        )
      }
      if (this.pauseOn && breakDue(state, events)) {
        this.startPause(events.includes('set') ? SET_PAUSE_MS : PAUSE_MS)
      }
      this.save()
      this.render()
      this.announce(events.includes('game') ? t : null)
    },

    // The score after a point or undo; a won game is called with the winner's color instead
    // ("Grün – gewonnen").
    announce(gameWinner = null) {
      if (!this.voice) return
      if (gameWinner !== null) this.voice.say([`c_${this.colors[gameWinner].key}`, 'won'])
      else this.voice.say(spokenWords(this.state))
    },

    // The banner for a won set: title, winner's name and the set's score from the winner's side
    // (the points of a match tiebreak), on the winner's team color. An Americano that ends level
    // (t = -1) shows "UNENTSCHIEDEN" and the score on ball color.
    showBanner(t, match) {
      const P = hmUI.prop
      const set = this.state.sets[this.state.sets.length - 1]
      const g = set.mtb ? set.tb : set.g
      const draw = t === -1
      const name = fitText(draw ? '' : teamNames(this.state.cfg)[t], px(342), [56, 48, 40, 32].map(px))
      const head = fitText(
        draw ? tr('draw').toUpperCase() : match ? tr('win') : tr('setWon'),
        px(342),
        [40, 32, 28].map(px),
      )
      const [bg, title, nameW, score] = this.banner
      bg.set(P.COLOR, draw ? C.ball : this.colors[t].text)
      title.set(P.TEXT_SIZE, head.size)
      title.set(P.TEXT, head.text)
      nameW.set(P.TEXT_SIZE, name.size)
      nameW.set(P.TEXT, name.text)
      score.set(P.TEXT, draw ? `${g[0]}:${g[1]}` : `${g[t]}:${g[1 - t]}`)
      this.banner.forEach((w) => w.set(P.VISIBLE, true))
      this.bannerOn = true
      clearTimeout(this.bannerTimer)
      this.bannerTimer = setTimeout(
        safe('banner', () => this.hideBanner()),
        BANNER_MS,
      )
    },

    // byTap: closed by a tap, which then must not count as a point too (BANNER_TAP_MS).
    hideBanner(byTap) {
      clearTimeout(this.bannerTimer)
      if (!this.bannerOn) return
      this.bannerOn = false
      if (byTap) this.bannerClosedAt = Date.now()
      this.banner.forEach((w) => w.set(hmUI.prop.VISIBLE, false))
    },

    // Saves the match; if that fails (storage full), the match goes on in memory and a toast
    // says so once per visit of the page.
    save() {
      if (saveMatch(this.state, this.moves) || this.saveWarned) return
      this.saveWarned = true
      this.toastSaveFailed()
    },

    toastSaveFailed() {
      toast(tr('saveFailed'))
    },

    // Left pill: "Rückgängig", or "Verlassen" while the end confirmation waits.
    tapLeft() {
      buzz()
      if (!this.confirming) return this.undo()
      this.endConfirm.stop()
      replace({ url: 'page/start' })
    },

    tapEnd() {
      buzz()
      this.endConfirm.tap()
    },

    // If the log can't be written, the match stays saved and can be continued with "Weiter".
    finish() {
      if (!hasStarted(this.state)) clearMatch()
      else if (!archiveMatch(this.state)) this.toastSaveFailed()
      replace({ url: 'page/start' })
    },

    // MORE replaces the button's props, so it gets all of them.
    paintEnd(confirm) {
      this.confirming = confirm
      const label = confirm ? tr('endConfirm') : tr('end')
      restyle(
        this.endBtn,
        pillProps(199, 179, label, () => this.tapEnd(), confirm),
      )
      restyle(
        this.leftBtn,
        pillProps(12, 179, confirm ? tr('leave') : tr('undo'), () => this.tapLeft(), false),
      )
    },

    // The break: after the side change hint, the badge counts down "Pause 1:25" once a second;
    // at the end the watch buzzes twice and the badge goes away.
    startPause(ms) {
      this.pauseUntil = Date.now() + ms
      const tick = safe('pause', () => {
        const left = this.pauseUntil - Date.now()
        if (left <= 0) {
          this.pauseUntil = 0
          buzzPauseEnd()
          this.renderStatus()
          return
        }
        this.renderStatus()
        this.pauseTimer = setTimeout(tick, left % 1000 || 1000)
      })
      this.pauseTimer = setTimeout(tick, 1000)
    },

    stopPause() {
      clearTimeout(this.pauseTimer)
      this.pauseUntil = 0
    },

    // Lights up team t's games tile for FLASH_MS (ball color, dark digits).
    flash(t) {
      clearTimeout(this.flashTimer)
      this.flashTeam = t
      this.renderFlash()
      this.flashTimer = setTimeout(
        safe('flash', () => {
          this.flashTeam = null
          this.renderFlash()
        }),
        FLASH_MS,
      )
    },

    renderFlash() {
      const P = hmUI.prop
      this.teams.forEach((w, t) => {
        const on = this.flashTeam === t
        w.tile.set(P.COLOR, on ? C.ball : this.colors[t].tile)
        w.games.set(P.COLOR, on ? 0x000000 : 0xffffff)
        w.caption.set(P.COLOR, on ? 0x000000 : C.muted)
      })
    },

    undo() {
      this.hideBanner()
      if (!this.moves.length) return
      this.moves.pop()
      this.state = replay(this.state.cfg, this.state.startedAt, this.moves)
      this.switchUntil = 0
      this.stopPause()
      clearTimeout(this.flashTimer)
      this.flashTeam = null
      this.renderFlash()
      this.save()
      this.render()
      this.announce()
    },

    render() {
      const s = this.state
      const labels = pointLabels(s)
      const steps = pointSteps(s)
      const server = currentServer(s)
      const side = serveSide(s)
      const P = hmUI.prop
      this.teams.forEach((w, t) => {
        const lost = s.winner !== null && s.winner !== t
        const color = this.colors[t].text
        w.games.set(P.TEXT, String(s.games[t]))
        w.name.set(P.COLOR, lost ? C.muted : color)
        w.points.set(P.TEXT, s.winner === null ? labels[t] : '')
        w.win.set(P.VISIBLE, s.winner === t)
        // Games per finished set (points for a match tiebreak); the set winner's number is white.
        w.sets.forEach((cell, i) => {
          const set = s.sets[i]
          cell.set(P.VISIBLE, !!set)
          if (!set) return
          const mine = set.mtb ? set.tb[t] : set.g[t]
          const theirs = set.mtb ? set.tb[1 - t] : set.g[1 - t]
          cell.set(P.TEXT, String(mine))
          cell.set(P.COLOR, mine > theirs ? 0xffffff : C.muted)
        })
        const serving = side !== null && server === t
        w.edges.forEach((edge, i) => {
          const lit = side === 'choice' || (side === 'right') === (i === w.rightEdge)
          edge.set(P.VISIBLE, serving && lit && !this.training)
        })
        if (this.training) return
        w.bars.forEach((b, i) => {
          b.set(P.VISIBLE, steps !== null && s.winner === null)
          if (steps) b.set(P.COLOR, i < steps[t] ? color : C.off)
        })
      })
      if (this.training) this.renderTraining()
      this.renderStatus()
      this.renderHr()
    },

    // Training: the tile shows the points still needed ("NOCH", in ball color at a match point)
    // or, in an Americano, the server's serves left in this turn and the other team's in the next
    // (dimmed); the progress bar fills towards the target; the ball sits on the server's card.
    // All of it goes once the training is over.
    renderTraining() {
      const s = this.state
      const P = hmUI.prop
      const over = s.winner !== null
      const balls = matchBalls(s)
      const info = s.cfg.total ? americanoInfo(s) : null
      const server = currentServer(s)
      this.teams.forEach((w, t) => {
        for (const k of ['tile', 'games', 'caption']) w[k].set(P.VISIBLE, !over)
        const [track, fill] = w.bars
        track.set(P.VISIBLE, !over)
        const share = trainingProgress(s, t)
        fill.set(P.VISIBLE, !over && share > 0)
        const bar = { x: px(30), y: w.y + px(138), h: px(6), radius: px(3), color: this.colors[t].text }
        if (share > 0) fill.set(P.MORE, { ...bar, w: Math.max(px(6), Math.round(px(BAR_W) * share)) })
        if (over) return
        const hot = balls.includes(t)
        const dim = info && t !== server
        const n = info ? (t === server ? info.serves : info.next) : pointsToWin(s, t)
        const caption = info ? (t === server ? tr('serves') : tr('servesNext')) : tr('toGo')
        const fit = fitText(caption, px(88), [16, 14, 12].map(px))
        w.tile.set(P.COLOR, hot ? C.ball : this.colors[t].tile)
        w.games.set(P.TEXT, info && n === 0 ? '–' : String(n))
        w.games.set(P.COLOR, hot ? 0x000000 : dim ? C.dim : 0xffffff)
        w.caption.set(P.TEXT_SIZE, fit.size)
        w.caption.set(P.TEXT, fit.text)
        w.caption.set(P.COLOR, hot ? 0x000000 : dim ? C.dim : C.muted)
      })
      this.renderBall(over ? null : server)
    },

    // The image is created only when first needed: the watch ignores visible: false on a new image.
    renderBall(t) {
      const P = hmUI.prop
      if (t === null) {
        if (this.ball) this.ball.set(P.VISIBLE, false)
        return
      }
      const props = {
        x: px(BALL_X),
        y: this.teams[t].y + px(BALL_DY),
        w: px(BALL),
        h: px(BALL),
        src: 'img/ball.png',
      }
      if (!this.ball) this.ball = lazy(hmUI.createWidget(hmUI.widget.IMG, props))
      else if (this.ballY !== props.y) this.ball.set(P.MORE, props)
      this.ballY = props.y
      this.ball.set(P.VISIBLE, true)
    },

    // The badge between the cards; in a training the target ("Bis 21") or a match point, in an
    // Americano the points still to play.
    trainingHint(s) {
      if (s.cfg.total) {
        const { left } = americanoInfo(s)
        return left === 1 ? tr('lastPoint') : tr('pointsLeft', { n: left })
      }
      const balls = matchBalls(s)
      if (balls.length === 2) return tr('decidingPoint')
      if (balls.length === 1) return tr('matchBall', { name: teamNames(s.cfg)[balls[0]] })
      return tr('trainTo', { n: s.cfg.target })
    },

    renderStatus() {
      const s = this.state
      this.timeW.set(hmUI.prop.TEXT, durationText(s, Date.now()))
      let hint = hintText(deuceInfo(s))
      if (s.tb) hint = this.training ? this.trainingHint(s) : s.mtb ? tr('matchTiebreak') : tr('tiebreak')
      if (s.winner !== null) hint = tr('matchOver')
      const left = this.pauseUntil - Date.now()
      if (left > 0) hint = tr('pauseLeft', { t: clockText(left) })
      if (Date.now() < this.switchUntil) hint = tr('switchSides')
      this.hintBg.set(hmUI.prop.VISIBLE, !!hint)
      this.hintW.set(hmUI.prop.VISIBLE, !!hint)
      // Smaller if needed, e.g. "Bola de partido NARANJA"; measured only when the text changes.
      if (hint === this.hint) return
      this.hint = hint
      const fit = hint ? fitText(hint, px(210), [20, 18, 16].map(px)) : { text: '', size: px(20) }
      this.hintW.set(hmUI.prop.TEXT_SIZE, fit.size)
      this.hintW.set(hmUI.prop.TEXT, fit.text)
    },

    renderHr() {
      if (!this.hrW) return
      const bpm = this.hr ? this.hr.getCurrent() : 0
      this.hrW.set(hmUI.prop.TEXT, bpm > 0 ? String(bpm) : '--')
    },

    onDestroy() {
      // After the match, waking the watch shows the watch face again instead of the app.
      setWakeUpRelaunch({ relaunch: false })
      if (this.keepScreenOn) {
        try {
          resetDropWristScreenOff()
          resetPalmScreenOff()
        } catch (e) {}
      }
      offKey()
      offGesture()
      if (this.stopClock) this.stopClock()
      clearTimeout(this.switchTimer)
      clearTimeout(this.flashTimer)
      clearTimeout(this.bannerTimer)
      this.stopPause()
      if (this.endConfirm) this.endConfirm.stop()
      if (this.hr && this.onHr) this.hr.offCurrentChange(this.onHr)
      if (this.voice) this.voice.release()
    },
  }),
)
