# Neon Arcade — Game Widget Checklist

Universal requirements for every game in the arcade. Items marked with a game
name (e.g. **[Snake]**) apply only to that specific game or game type.

## Multi-Game Arcade

- [x] Homepage with game selection grid showing all available games
- [x] State-based navigation between homepage and individual games
- [x] Each game has a back/home button in the header to return to the homepage
- [x] Homepage uses same retro arcade aesthetic as games
- [x] Game cards show name, icon, description, and play action

## Iframe Focus & Input

- [x] Game does **not** auto-start on load — waits for an explicit user click
- [x] Idle screen shows **"Click to Start"** / **"Tap to Start"** so the user knows to interact
- [x] When the iframe loses focus mid-game, the game **auto-pauses** and shows "Click to Resume"
- [x] Keyboard events are only processed when the container has focus (`tabIndex={0}`, `onKeyDown`)
- [x] Touch / pointer controls work without requiring keyboard focus

## Visual Feedback & Dopamine

- [x] Animated toast messages for exciting moments (zoom-in, hold, fade-out)
- [x] Context-aware toasts for near-miss or exciting gameplay moments
- [x] Milestone toasts at score / point / time thresholds
- [x] Particle burst on key gameplay events (e.g., scoring, clearing, collecting)
- [x] Screen flash (board glow) on positive events
- [x] Screen shake on negative events (game over, mistakes)
- [x] "New High Score!" / "New Best Time!" toast on personal best

## Global Leaderboard

- [x] Leaderboard tab with 10 ranked entries
- [x] Dummy player data with fun usernames pre-populated
- [x] Player's best score/time auto-inserted and ranked among dummy data
- [x] Player entry highlighted in green with "(YOU)" label
- [x] Medal icons for top 3 positions

## Badge / Achievement System

- [x] 16 badges per game covering gameplay milestones, skill challenges, and persistence
- [x] Badge progress persisted in `localStorage`
- [x] Badge unlock triggers a purple toast notification with badge icon
- [x] Badges tab shows all badges in a grid — earned vs locked styling
- [x] Badge tooltips with name and description
- [x] Badges grid uses 3 columns (not 4) to prevent clipping on narrow widths
- [x] Day-1 to day-7 achievable badges (first action, play N games, milestones, etc.)

## Point System

- [x] Points earned per meaningful gameplay action
- [x] Points persist across sessions in `localStorage`
- [x] Points displayed in header with coin icon
- [x] Points earned summary shown on game over / win screen
- [x] Daily streak multiplier applied to end-of-run points (1x → 1.2x → 1.5x → 2x)
- [x] Streak multiplier toast shown when bonus is active

## Daily Play Streak

- [x] Streak tracked via `arcade-streak-last-date` and `arcade-streak-count` in `localStorage`
- [x] Playing any game today continues the streak; missing a day resets it
- [x] Streak multiplier on points: 1x (day 1), 1.2x (day 2), 1.5x (day 3+), 2x (day 7+)
- [x] Streak count and multiplier displayed on the HomePage with flame icon
- [x] `recordStreak()` called once per game end, returns `{ count, multiplier, isNew }`

## Skins & Customizations

- [x] Shop tab **lights up with pulsing glow** the first time a user earns enough points to buy a skin
- [x] Glow is one-time only — persisted via `localStorage` so it never re-triggers
- [x] Toast notification "You can buy a skin!" accompanies the glow
- [x] Clicking the Shop tab dismisses the glow
- [x] 6 skins per game with unique visual themes
- [x] Each skin changes key visual elements and glow colors
- [x] Shop tab with preview swatches for each skin
- [x] Buy button (deducts points) and equip button (free once owned)
- [x] Currently equipped skin highlighted with green border
- [x] Shop card height is consistent regardless of state (BUY / EQUIP / EQUIPPED)
- [x] Unaffordable skins show red price, disabled buy button
- [x] Skin ownership persisted in `localStorage`

## Permanent Upgrades (within Shop tab)

- [x] Shop tab has Skins / Upgrades subtab toggle
- [x] Each game has 2–3 permanent upgrades purchasable with points
- [x] Upgrades persist in `localStorage` (e.g., `snake-upgrades`, `nd-upgrades`)
- [x] Owned upgrades displayed with "OWNED" label in purple
- [x] Unaffordable upgrades show disabled buy button with cost
- [x] Upgrade effects apply to gameplay (e.g., wider paddle, extra jump, shield start)
- [x] Upgrades are permanent once purchased — no per-run cost

## Continue / Second Chance (where applicable)

- [x] On game over, offer "Continue?" overlay before final game-over screen
- [x] Continue costs 50 points from the player's point pool
- [x] Limited to 1 continue per run
- [x] Continue preserves current score/speed/level
- [x] Disabled when player has fewer than 50 points
- [x] "No thanks" button proceeds to normal game over
- [x] Currently implemented in: Neon Dash (with 3s invincibility) and Brick Breaker (restore 1 life)

## Skill Feedback (Post-Run Stats)

- [x] Game over / win screen shows mini stats comparison vs personal best
- [x] Each stat shows "NEW BEST!" in green when it's a new record
- [x] Non-best stats show percentage of best (e.g., "73% of best")
- [x] Personal best stats persisted in `localStorage` per game
- [x] Stats are compact (fontSize 10, lineHeight 2) to fit within the overlay

## Retro Arcade Aesthetic

- [x] Pixel font ("Press Start 2P") loaded via Google Fonts for all UI chrome
- [x] Neon glow text shadows on headers, labels, scores, and active tab elements
- [x] Pixel-art borders (2px solid, sharp corners) on game board, stats, tabs, shop cards, badges
- [x] Retro color palette: neon green, electric blue, hot pink, gold, purple on dark navy
- [x] Chunky uppercase lettering with wide letter-spacing throughout
- [x] Retro-styled scrollbar (thin, purple thumb on dark track)
- [x] Game board has indigo border with ambient glow
- [x] Overlays (idle, paused, game over) use pixel font with arcade-style messaging
- [x] Tab bar uses per-tab accent colors with glow on active state

## Gameplay UX

- [x] Game state transitions are clear: idle → playing → paused → gameover/win
- [x] Key stats visible at all times during play
- [x] High score / best time persists across sessions via `localStorage`
- [x] Game over / win screen shows results and offers "Play Again"
- [x] Tab bar (Leaderboard / Badges / Shop) below game board
- [x] Tab bar uses stacked layout: icon on top, label text below
- [x] Tab glows when its content changes: badge tab pulses on new badge earned, shop tab pulses when a new skin becomes affordable, rank tab pulses when the player's leaderboard position changes (first score, new best)
- [x] Tab glow clears when the user clicks into that tab
- [x] Difficulty picker (Easy / Medium / Hard) with visual dropdown
- [x] Idle screen shows "How to Play" instructions before the game starts
- [x] Instructions cover core mechanics, win condition, and controls (desktop vs mobile)
- [x] Idle screen content (instructions + start button) fits entirely within the game board — no overflow or clipping
- [x] "Click to Start" / "Tap to Start" button is always fully visible without scrolling

## Widget / MCP Integration

- [x] Widget HTML is fully self-contained (inlined JS bundle, no external fetches required)
- [x] `structuredContent` passes config so the widget can hydrate from tool args
- [x] `openai:set_globals` late-hydration listener re-renders with new config
- [x] `text/html+skybridge` MIME type used for resources
- [x] `_meta` includes `openai.com/widget` resource embedding for reliable hydration

## Performance

- [x] No heavy computation on load — game loop only starts after user interacts
- [x] Timers / intervals cleaned up on unmount and pause
- [x] Board rendering uses refs for hot-path state to avoid stale closures
- [x] Particles animated via `requestAnimationFrame` and auto-removed when life expires
- [x] Toasts auto-cleaned after 1.6s

## Device Detection (Apps SDK pattern for all games)

Per the [Apps SDK Reference](https://developers.openai.com/apps-sdk/reference), ChatGPT
provides `window.openai.userAgent` as a context signal for the host user's device.
Use this as the **primary** detection method inside ChatGPT widgets; fall back to
browser APIs for standalone / non-ChatGPT contexts.

- [x] **Primary**: read `window.openai.userAgent` (official Apps SDK API) and parse for mobile indicators
- [x] **Fallback**: use `pointer: coarse` media query + `ontouchstart` / `maxTouchPoints` for standalone contexts
- [x] Re-detect on `openai:set_globals` event since `userAgent` may arrive after initial mount
- [x] Detection extracted into reusable `detectTouchDevice()` helper
- [x] Controls, UI hints, and event listeners are gated by device type — no overlap

## Controls — Desktop / PC

- [x] Game-appropriate keyboard controls (arrow keys, WASD, mouse clicks, etc.)
- [x] Keyboard events only processed when container is focused
- [x] Pause / resume support via keyboard shortcut where applicable

## Controls — Mobile / Touch

- [x] On-screen controls visible during gameplay where needed (hidden on desktop)
- [x] Touch targets large enough for comfortable use (minimum 54×54)
- [x] `touch-action: none` on interactive areas to prevent scroll interference

## Accessibility

- [x] Container has `tabIndex={0}` (desktop only) and `outline: none` for clean focus ring

---

## Game-Specific Requirements

### Snake only

- [x] Arrow keys / WASD to steer the snake
- [x] Space bar to toggle pause / resume
- [x] D-pad visible during gameplay on mobile
- [x] Swipe gestures on the game board (min 20px drag)
- [x] Opposite direction input ignored
- [x] Combo tracking with time window (2.5s between eats)
- [x] Combo counter badge visible during active combos
- [x] Level-up based on score thresholds (speed increases)
- [x] Countdown (3-2-1) before game starts
- [x] "That Was Close!" toast when eating food within 1 cell of a wall

### Minesweeper only

- [x] Left-click to reveal, right-click to flag (desktop)
- [x] Tap to reveal, long-press to flag (mobile); toggle flag-mode button available
- [x] First click is always safe (mines placed after first reveal)
- [x] Flood fill on zero-adjacent-mine cells
- [x] Timer counts up from first click
- [x] Remaining mine count displayed (total mines minus flags placed)
- [x] All mines revealed on loss
- [x] Leaderboard ranked by fastest clear time (lower is better)

### Brick Breaker only

- [x] Paddle at bottom controlled by arrow keys / A,D (desktop)
- [x] Paddle follows touch/drag position (mobile)
- [x] Ball bounces off walls, paddle, and bricks
- [x] Ball angle changes based on paddle hit position
- [x] Multi-hit bricks in later levels (visual indicator)
- [x] 5 levels of increasing speed and brick layout
- [x] 3 lives — lose one when ball falls past paddle
- [x] Combo counter tracks bricks hit without paddle bounce
- [x] Leaderboard ranked by highest score (higher is better)

### Maze Runner only

- [x] Procedurally generated maze with extra wall removals to create branching loops (not a single-path maze)
- [x] Player starts at top-left, exit at bottom-right (🏁 marker)
- [x] 5 levels with increasing maze size (9x9 → 17x17)
- [x] Fog of war — only cells near the player are visible (radius shrinks per level)
- [x] Collectible ⭐ stars scattered through the maze for bonus points
- [x] 💀 trap cells that teleport the player to a random location
- [x] Timer tracks time per level
- [x] Move counter tracks steps taken
- [x] Scoring: time bonus + move efficiency bonus + size bonus + star bonus
- [x] Visited cells highlighted with skin-colored trail
- [x] Wall bump feedback (screen shake, no movement)
- [x] Shortest-path calculation for efficiency badge
- [x] Leaderboard ranked by highest score (higher is better)

### Neon Dash (Endless Runner) only

- [x] Side-scrolling endless runner with DOM-based rendering (no canvas)
- [x] Player runs automatically; obstacles scroll from right to left
- [x] Jump mechanic (↑ / W / Space) with gravity physics
- [x] Double jump supported (second jump weaker, resets on landing)
- [x] Duck mechanic (↓ / S hold) to slide under high obstacles; player crouches to ground
- [x] Three obstacle types: low (jump), high (duck), double (narrow gap)
- [x] High obstacles visually positioned clearly above ducking height (not flush with ground)
- [x] Speed increases continuously over time (capped at max)
- [x] Speed level displayed as HUD indicator during play
- [x] Touch controls: top half = jump, bottom half = duck
- [x] Scrolling ground lines for parallax movement feel
- [x] Collectible coins spawn at various heights (ground, jump, double-jump, duck)
- [x] Coins appear in groups of 1-3, Mario-style
- [x] Collecting a coin awards +5 score and spawns gold particles
- [x] Coins counter shown in stats bar and game-over screen
- [x] Score based on distance survived (frames) + coin bonuses
- [x] Dodge counter tracks obstacles cleared
- [x] In-run power-ups spawn as rare collectible items (Shield, Magnet, Slow-Mo)
- [x] Shield absorbs one hit; Magnet auto-collects nearby coins for 5s; Slow-Mo halves speed for 3s
- [x] Active power-ups shown as HUD indicators with countdown timers
- [x] Power-up items have distinct colors and pulsing animation
- [x] Leaderboard ranked by highest score (higher is better)

### Grid-based games (Snake, Minesweeper)

- [x] DOM grid of `<div>` cells for the playfield
- [x] SVG grid overlay lines (faint, ~0.06 opacity)
- [x] Board scales to fit container via calculated cell size
