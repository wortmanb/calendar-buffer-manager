# Calendar Buffer Manager

Google Apps Script that automatically adds buffer events before and after meetings.

## Features

- **Automatic detection** of meetings that need buffers:
  - Events with conferencing links (Zoom, Google Meet, Teams, WebEx, etc.)
  - Customer engagements (events starting with `[CODE]` pattern)
- **Smart filtering** — only buffers meetings you've accepted, skips large all-hands
- **Conflict-aware** — won't create buffers that overlap with your real meetings
- **Orphan cleanup** — removes buffer events when the original meeting is deleted

## Quick Start

1. Go to [script.google.com](https://script.google.com)
2. Create a new project
3. Copy the contents of `Code.gs` into the editor
4. **Set your calendar** at the top of the file:
   ```javascript
   targetCalendar: 'you@company.com',
   ```
5. Run `dryRun()` to preview what would be created
6. Run `setup()` to create buffers and enable automatic triggers

## Configuration

The `CONFIG` object at the top of `Code.gs` is organized into sections:

### 👇 Main Settings (Change These)

```javascript
targetCalendar: 'primary',  // Change to 'you@company.com'
preBufferMinutes: 15,       // Minutes before meeting
postBufferMinutes: 15,      // Minutes after meeting
```

### Filter Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `maxGuestsForBuffer` | Skip events with more guests than this (all-hands) | `30` |
| `requireAcceptedStatus` | Only buffer events you've accepted | `true` |
| `excludeCalendarPatterns` | Regex patterns for calendars to ignore | Group calendars |

### Other Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `minEventMinutes` | Skip events shorter than this | `5` |
| `lookAheadDays` | How far ahead to look | `7` |
| `bufferColor` | Calendar color for buffers | Gray |
| `preBufferEmoji` / `postBufferEmoji` | Emoji prefix for buffer titles | 🚦 |

### Advanced Settings

| Setting | Description |
|---------|-------------|
| `customerEngagementPattern` | Regex for title-based detection (e.g., `[ACME]`) |
| `conferencingPatterns` | Array of regexes for video conference URLs |
| `excludeTitles` | Title patterns to skip (Focus Time, Lunch, etc.) |

## Functions

| Function | Description |
|----------|-------------|
| `setup()` | Initial setup — runs once and creates hourly triggers |
| `dryRun()` | **Start here!** Preview what would be created (no changes) |
| `addBuffersToQualifyingEvents()` | Main function — adds buffers (runs hourly via trigger) |
| `addBuffersExtended()` | Same but looks 30 days ahead |
| `cleanupOrphanedBuffers()` | Remove buffers for deleted meetings (runs daily via trigger) |
| `debugEvent("title")` | Debug why a specific event isn't being detected |

## How It Decides What to Buffer

An event gets buffers if **ALL** of these are true:

1. ✅ Has a conferencing link (Zoom, Meet, Teams, etc.) OR matches `[CODE]` pattern
2. ✅ You've accepted or tentatively accepted (or you're the organizer)
3. ✅ Fewer than 30 guests (configurable)
4. ✅ Not from a blocklisted calendar (group calendars, all-hands, etc.)
5. ✅ Not an excluded title (Focus Time, Lunch, OOO, etc.)
6. ✅ Duration is at least 5 minutes
7. ✅ Not an all-day event

## Supported Conferencing Platforms

- Google Meet (native button + URLs)
- Zoom (including vanity URLs like `company.zoom.us`)
- Microsoft Teams
- WebEx
- GoToMeeting
- BlueJeans
- Amazon Chime
- Google Duo / Hangouts
- Whereby, Around, Discord

## Troubleshooting

**Buffers not being created for a meeting?**

Run `debugEvent("meeting title")` to see:
- Guest count and your attendance status
- Source calendar
- Whether conferencing was detected
- The specific reason it was skipped

**Buffers being created for meetings you don't want?**

Add patterns to `excludeCalendarPatterns` or `excludeTitles` in the config.

**Conflicts blocking buffers incorrectly?**

The conflict checker uses the same filters as buffer creation — events you haven't accepted or from blocklisted calendars won't count as conflicts.

## License

MIT
