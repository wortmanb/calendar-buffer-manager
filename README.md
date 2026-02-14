# Calendar Buffer Manager

Google Apps Script that automatically adds buffer events before and after meetings.

## Features

- **Automatic detection** of meetings that need buffers:
  - Events with conferencing links (Zoom, Google Meet, Teams, WebEx, etc.)
  - Customer engagements (events starting with `[CODE]` pattern)
- **Smart conflict detection** — won't create buffers that overlap with other meetings
- **Calendar filtering** — only processes events from specified calendars
- **Orphan cleanup** — removes buffer events when the original meeting is deleted

## Setup

1. Go to [script.google.com](https://script.google.com)
2. Create a new project
3. Copy the contents of `Code.gs` into the editor
4. Update the `CONFIG` section at the top:
   ```javascript
   calendarIds: ['your.email@company.com'],
   ```
5. Run `setup()` to test and create automatic triggers

## Configuration

Edit the `CONFIG` object at the top of `Code.gs`:

| Setting | Description | Default |
|---------|-------------|---------|
| `calendarIds` | Array of calendar IDs to process | `[]` (default calendar) |
| `preBufferMinutes` | Minutes before meeting | `15` |
| `postBufferMinutes` | Minutes after meeting | `15` |
| `minEventMinutes` | Skip events shorter than this | `5` |
| `lookAheadDays` | How far ahead to look | `7` |
| `excludeTitles` | Patterns to skip (Focus Time, Lunch, etc.) | See code |

## Functions

| Function | Description |
|----------|-------------|
| `setup()` | Initial setup — runs once and creates triggers |
| `addBuffersToQualifyingEvents()` | Main function — adds buffers (runs hourly) |
| `addBuffersExtended()` | Same but looks 30 days ahead |
| `cleanupOrphanedBuffers()` | Remove buffers for deleted meetings (runs daily) |
| `dryRun()` | Preview what would be created (no changes) |
| `debugEvent("title")` | Debug why a specific event isn't detected |

## Supported Conferencing Platforms

- Google Meet (native + URL)
- Zoom (including vanity URLs like `company.zoom.us`)
- Microsoft Teams
- WebEx
- GoToMeeting
- BlueJeans
- Amazon Chime
- And more...

## License

MIT
