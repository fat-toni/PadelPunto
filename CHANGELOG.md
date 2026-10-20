# Changelog – Padel Punto

All changes to Padel Punto, newest version first.

## 1.7.0 – 2026-10-20

### New

- **Short sets:** The new option “Games per set” (Rules) offers short sets to 4 games next to 6
  (FIP alternative scoring): a set is won with 4 games and a lead of two, e.g. 4:2 or 5:3; at 4:4 a
  tiebreak to 7 decides it and the set counts 5:4. Handy when court time is short.
- **Court time:** With the new clock button left of the logo you set when your court booking ends
  (e.g. 14:00) and how many minutes before the watch should remind you (5, 10 or 15). At the
  reminder and at the end the watch vibrates firmly and shows “5 minutes left” or “Court time is
  up”, even when the app is closed. “OK” takes you back into the running match. The end time shows
  below the clock button; “Clear” removes it.

### Changed

- **Tidier options:** “Heart rate in match” now sits under “General”, which makes “In the match” shorter.
- **Call volume only with the score call:** While “Score call” is off, “Call volume” is greyed
  out and cannot be changed.
- **New voice for the score call:** much clearer and free of license restrictions. Each word
  was picked from several takes for how well it can be understood. The score call is now always
  in English, the padel standard, whatever the app language: “Score call (English)”.
- **Logo:** The racket now has a diamond-shaped head, so it looks more like a padel racket.
- **License:** The code is now under the GNU GPL v3 (before: MIT). You may still use, change and
  share it freely; changed versions you pass on must stay open source under the same license.

### Fixed

- Leaving a match just as the score call was loading its next word still played that word on the
  start screen.

## 1.6.0 – 2026-10-17

### New

- **Score call:** After every point the watch calls out the score on its speaker, the serving
  team first: “thirty – fifteen”, “fifteen all”, “deuce”, “advantage server” / “advantage
  receiver”, “golden point”, “star point”, and the numbers in a tiebreak. When a game is won,
  it calls the winner’s team color, e.g. “Green – wins”. After “Undo” it calls the
  new score too. Switch it on under Options → General → “Score call” (off by default); it speaks
  German, English or Spanish like the app. The voices come with the app, no internet needed.
- **Call volume:** Low or High. During a match the app sets the watch volume to it and
  puts it back afterwards.

### Improved

- **Roomier start screen:** More space between logo, name and buttons. With an open match the logo
  gets smaller, so “Continue” fits and the lower buttons stay out of the corners.

## 1.5.0 – 2026-10-14

### New

- **Random serve:** “Who serves first?” has a “Random” button. It brings up a padel racket and turns
  into “Spin”: the racket spins, slows down and stops with its head pointing at the team that serves.
- **Third set without tiebreak:** The option “3rd set” has the new choice “No tiebreak” (FIP rule
  1.4, advantage set): at 6:6 in the third set, play goes on until a team leads by two games, e.g.
  8:6 or 12:10. The first two sets keep their tiebreak.
- **Match tiebreak to 7:** Instead of the third set there can now also be a match tiebreak to 7
  (with a lead of two points), next to the one to 10.

### Improved

- **Serve visible in sunlight:** Instead of the small serve boxes next to the team name, a green bar
  now lights up on the left or right edge of the serving team’s card, on the side the serve comes
  from (both sides at Golden/Star Point). It stays easy to see in sunlight and on a smudged screen.
  The team name gets more room.
- **Simpler breaks:** The option “Breaks” is now just On or Off, Off by default. When on, the
  FIP times apply: 90 seconds at a change of ends, 2 minutes after a set. A line below the option
  names the times.
- **Names and colors apply at once:** If you pause a match with “Leave” and change team names or
  team colors in the options, “Continue” shows them right away in the running match. The rules of
  the running match stay as they were; a note in the options says they apply from the next match.
- **No more matching team colors:** Tapping through the colors skips the other team’s color.
- When the watch storage is full, “Who serves first?” now says so instead of silently going back to
  the start screen.

## 1.4.0 – 2026-10-10

### New

- **Change ends like in leisure play:** New option “Change ends” under Rules: after games 1, 3, 5 …
  (official rule, default), only after the set, or never. The previous option is now called “Change-ends
  signal” (vibrate twice or show only).
- **Break timer:** At a change of ends and after every set, the watch counts down the break
  (“Break 1:25”) and buzzes twice firmly when play resumes. As in the padel rules, there is no break after
  the first game of a set or in a tiebreak. The next point ends the break at once. Set the length in the
  options under “Breaks”: 30, 60, 90 (default) or 120 seconds, or off.
- **A won set, big on the screen:** After a won set, “SET”, the winner's name and the set score appear
  big in the winner's team color for 3 seconds (“WIN” for the match). A tap closes it without counting a
  point.
- **Feel a won set or match:** A won set gives one long buzz, the won match three. So you notice it
  without looking at the watch.
- **Diagnosis:** Tapping the logo on the Info page five times quickly opens a diagnosis page
  with the watch model, display, Zepp OS version, storage use and an error log.
- If something goes wrong in the app, it keeps running and remembers the error for the diagnosis page; a
  short notice appears.

### Changed

- **Team cards in team colors:** The cards in the match and on “Who serves first?” are tinted dark in their
  team's color, so you can tell the teams apart without reading.
- **A won game lights up:** The games tile of the team that wins a game briefly lights up in ball color.
- **“Leave” goes to the start page:** In a match, “Leave” now takes you to the start page instead of out
  of the app. The match stays saved and carries on with “Continue”.

## 1.3.0 – 2026-10-07

### New

- **Default names with a long press:** In the options, press and hold “Team 1 name” or “Team 2 name” to
  get the default name back (“Us” or “Them”, in the chosen language). A short tap opens the keyboard as
  before. A hint below the team colors reminds you of this.

### Changed

- The options are now sorted into groups: Rules, Teams, In the match and General, with easy-to-read
  headings.
  “Done” is a smaller button in the middle, like “Back” on the other pages.
- “Who serves?”: “Cancel” is now also a smaller button in the middle and no longer reaches into the
  rounded corners. In History, “Show older” and “Clear history” use the same text size.
- Info: the developer is now listed as “Toni & Claude”.
- Info, Options and History: the time and the page title now sit centered at the top instead of in the
  rounded corners of the display. “Back” is a smaller button in the middle.
- If the watch is set to a language the app doesn't know (e.g. French), the app now appears in English
  instead of German.
- **Team colors stay saved** like all other options, also after restarting the app.
- **New layout of the team cards in the match:** The small court for the serve now sits at the top right
  next to the games tile, and the sets are shown to the right of the big points. This gives the team name
  much more room. It is only made as small as needed; if it is still too wide, it ends in “…”.
- Long texts get a little smaller when needed instead of running over the edge: the question “Who serves
  first?” in Spanish, the line with date, mode and duration in History, and long values in the options.
- After a match, waking the watch shows the watch face again instead of the app.

### Faster and more efficient

- During a match the app now wakes the watch only once a minute instead of twice to update the time and
  the match duration.
- Each point writes only about half as much to the watch: the points and the rules are saved, and the
  score is worked out from them when the match is opened.

### Fixed

- When the watch's storage is full, an ended match is no longer lost. It stays saved and can be resumed
  with “Continue” until there is room again; a notice appears.
- Scrolling the history no longer deletes a match, even while its card is red (ready to delete).
  Scrolling also no longer marks a card red by accident.
- Damaged saved data no longer crashes the app. The score is rebuilt from the points played, and invalid
  settings are reset to their defaults.
- After winning a match tiebreak, the “GAMES” tile showed one game too many (1:0 instead of 0:0).

## 1.2.1 – 2026-10-04

### New

- **Leave a match without ending it:** After tapping “End”, “Undo” turns into “Leave” for 3 seconds. It
  takes you out of the app, e.g. to quickly check something else. The match stays saved and goes on with
  “Continue”.

### Changed

- **Swiping locked during a match:** Swiping across the screen while playing no longer drops you into the
  watch's app menu by accident. The only way out is “End”.
- Swiping across a card instead of tapping it no longer gives a point.

### Fixed

- A card sometimes stayed highlighted after dragging a finger across it.

## 1.2.0 – 2026-10-02

### New

- **Buttons locked during a match:** While a match is running, the watch buttons do nothing. You can no
  longer leave the match by accident when your wrist presses a button during a shot. Leave via “End” or
  by swiping; the match stays saved and goes on with “Continue”.
- **Heart rate can be turned off:** new option “Heart rate in match”. When set to “Off”, the heart rate
  sensor stays off during the match, which saves battery.
- **History:** The 10 newest matches are shown first, older ones with “Show older”. After deleting a
  match, the list stays where it was.

### Changed

- Points are now given only by tapping a team card. The up and down buttons did not work as intended on
  the Bip 6 and are now locked like all buttons during a match.
- The team cards are slightly shorter; the yellow hint badge now sits exactly between them and no
  longer covers any part you can tap.
- In the history, date, mode and duration share one line.

### Fixed

- A match abandoned during a tiebreak at 6:6 now shows the tiebreak score in the history, e.g. “6:6(4:2)”.
- A team card stayed highlighted when your finger slid off it while tapping.
- If the watch cannot save a match (e.g. storage full), the app no longer crashes: the match goes on
  and a notice appears.

### Other

- The app no longer needs the permission for the old storage. Data from versions before 1.0.0 is no
  longer imported.

## 1.1.0 – 2026-09-28

### New

- **From your point of view:** Your team is now at the bottom and your opponents at the top, both during
  the match and when choosing who serves first. The opponents' mini court is mirrored: when they serve from
  their right side, the left box lights up, just as they face you across the net.
  The buttons match the layout: up = opponents, down = your team.
- **Delete single matches from the history:** Press and hold a card until it turns red, then tap it again.
  Without a second tap the card returns to normal after 3 seconds. Scrolling never triggers it.

### Changed

- **Team colors only last while the app is running.** On the next start they are back to green and blue.
  Team names and all other options stay saved.

### Faster and more efficient

- The clock and the match duration wake the watch only once a minute instead of every 10 seconds.
- After a point, only what actually changed is redrawn.
- Each point is saved once instead of twice.
- Scoring and Undo need less processing time.
- A match left open in version 1.0.0 can simply be continued after the update.

### Fixed

- The app could crash at deuce (40:40) in Advantage mode.

## 1.0.0 – 2026-09-24

First version for the Amazfit Bip 6.

### Scoring

- Three scoring modes: **Advantage** (classic), **Golden Point** (one deciding point at 40:40) and
  **Star Point** (FIP 2026: two advantages, the third deuce is decided by one point).
- **1 or 3 sets**, with the 3rd set played as a normal set or as a **match tiebreak to 10**.
- Tiebreak to 7 at 6:6, serving in the tiebreak follows the 1-2-2 pattern.
- Change-of-ends reminder after every odd game and every 6 points in a tiebreak.

### Match

- Tap a team's card to give it the point, or use the up and down buttons.
- Large point display (0/15/30/40/AD) and four bars for 15, 30, 40 and advantage.
- Games in the current set and results of finished sets right on the team card.
- **Mini court:** shows which team serves and from which side. At a Golden or Star Point both boxes light
  up, and the receivers choose the side.
- Hint badge for deuce (with a counter in Star Point mode), Golden/Star Point, tiebreak, match tiebreak,
  change of ends and the end of the match.
- Heart rate, time and match duration at the top.
- **Undo** takes back the last point, as often as you like.
- **End** finishes the match after a second tap. A match without a winner is saved as “Abandoned”.
- To pause, just leave the app and tap “Continue” later.

### Other screens

- **Start:** “Continue” for an open match, “New match”, “Options”, “History” and info.
- **Serve:** Before each match you choose which team serves first.
- **Options:** scoring mode, sets, 3rd set, team names (up to 8 characters), 8 team colors,
  vibration on change of ends, display during the match and language. Changes are saved immediately.
- **History:** the last 30 matches with date, mode, duration, set scores and winner.
- **Info:** version and developer.

### Watch and controls

- Full screen with its own clock, in 12- or 24-hour format as set on the watch.
- **Display in match:** “Always on” keeps the screen lit, even when you lower your wrist or cover it with
  your hand. “Like the watch” uses the normal setting.
- **Vibration only during the match:** a very light tick per point, two on a change of ends (can be turned
  off). Menus don't vibrate.
- German, English and Spanish, following the watch language or set manually.
