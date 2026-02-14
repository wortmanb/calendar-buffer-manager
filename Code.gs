/**
 * Automatic Calendar Buffer Creator
 * Detects appointments that need buffers based on:
 *   1. Title starting with [ALL-CAPS] pattern (customer engagements)
 *   2. Contains conferencing links (Meet, Zoom, Teams, WebEx, etc.)
 */

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Buffer durations in minutes
  preBufferMinutes: 15,
  postBufferMinutes: 15,
  
  // Minimum event duration to consider (skip quick syncs)
  minEventMinutes: 5,
  
  // How far ahead to look
  lookAheadDays: 7,       // for regular runs
  lookAheadDaysExtended: 30, // for extended runs
  
  // Buffer event styling
  bufferColor: CalendarApp.EventColor.GRAY,
  preBufferEmoji: '🚦',
  postBufferEmoji: '🚦',
  
  // Patterns to match customer engagements (title-based)
  customerEngagementPattern: /^\[([A-Z0-9]+)\]/,
  
  // Conferencing URL patterns to detect
  // Note: patterns match anywhere in text, so "elastic.zoom.us" matches "zoom.us"
  conferencingPatterns: [
    /meet\.google\.com/i,
    /\.?zoom\.us/i,              // matches zoom.us and *.zoom.us (vanity URLs like elastic.zoom.us)
    /zoomgov\.com/i,             // government Zoom
    /teams\.microsoft\.com/i,
    /teams\.live\.com/i,
    /webex\.com/i,
    /gotomeeting\.com/i,
    /gotomeet\.me/i,
    /bluejeans\.com/i,
    /whereby\.com/i,
    /around\.co/i,
    /discord\.gg/i,
    /chime\.aws/i,
    /duo\.google\.com/i,
    /hangouts\.google\.com/i,
  ],
  
  // Calendar to CREATE buffers on (your primary work calendar)
  targetCalendar: 'bret.wortman@elastic.co',
  
  // BLOCKLIST: Skip events from these calendars (company-wide, optional, etc.)
  // These are calendars whose events you see but don't need buffers for
  excludeCalendarPatterns: [
    /all-hands/i,
    /company.*meeting/i,
    /town.*hall/i,
    /@group\.calendar\.google\.com$/,  // Most shared/group calendars
  ],
  
  // Skip events with more than this many guests (likely all-hands/optional)
  maxGuestsForBuffer: 30,
  
  // Only buffer events you've accepted or tentatively accepted
  // If false, buffers all events regardless of your response
  requireAcceptedStatus: true,
  
  // Event titles to exclude (exact match or regex)
  excludeTitles: [
    /^Focus Time/i,
    /^Lunch/i,
    /^OOO/i,
    /^Out of Office/i,
    /^Block/i,
    /^Hold/i,
  ],
  
  // Skip events you created yourself (only buffer external meetings)
  skipSelfCreated: false,
};

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Main entry point - adds buffers to qualifying events
 */
function addBuffersToQualifyingEvents() {
  const now = new Date();
  const lookAhead = new Date(now.getTime() + (CONFIG.lookAheadDays * 24 * 60 * 60 * 1000));
  
  const calendar = getTargetCalendar();
  const events = calendar.getEvents(now, lookAhead);
  
  console.log(`📅 Processing ${events.length} events from "${calendar.getName()}"`);
  
  let created = 0;
  let skipped = 0;
  
  events.forEach(event => {
    const result = shouldAddBuffers(event);
    if (result.shouldAdd) {
      console.log(`  ✓ Qualifies: "${event.getTitle()}" (${result.reason})`);
      const bufferResult = addBuffersToEvent(calendar, event);
      created += bufferResult.created;
      skipped += bufferResult.skipped;
    }
  });
  
  console.log(`✅ Complete: ${created} buffers created, ${skipped} skipped`);
}

/**
 * Get the target calendar (where we read events and create buffers)
 */
function getTargetCalendar() {
  const calId = CONFIG.targetCalendar;
  
  if (!calId || calId === 'primary') {
    const cal = CalendarApp.getDefaultCalendar();
    console.log(`Using default calendar: "${cal.getName()}"`);
    return cal;
  }
  
  try {
    const cal = CalendarApp.getCalendarById(calId);
    if (cal) {
      console.log(`Using calendar: "${cal.getName()}" (${calId})`);
      return cal;
    }
  } catch (e) {
    console.log(`Error accessing calendar ${calId}: ${e.message}`);
  }
  
  console.log('Falling back to default calendar');
  return CalendarApp.getDefaultCalendar();
}

/**
 * Extended version - looks further ahead
 */
function addBuffersExtended() {
  const now = new Date();
  const lookAhead = new Date(now.getTime() + (CONFIG.lookAheadDaysExtended * 24 * 60 * 60 * 1000));
  
  const calendar = getTargetCalendar();
  const events = calendar.getEvents(now, lookAhead);
  
  console.log(`📅 Processing ${events.length} events from "${calendar.getName()}" (extended: ${CONFIG.lookAheadDaysExtended} days)`);
  
  let created = 0;
  let skipped = 0;
  
  events.forEach(event => {
    const result = shouldAddBuffers(event);
    if (result.shouldAdd) {
      console.log(`  ✓ Qualifies: "${event.getTitle()}" (${result.reason})`);
      const bufferResult = addBuffersToEvent(calendar, event);
      created += bufferResult.created;
      skipped += bufferResult.skipped;
    }
  });
  
  console.log(`✅ Extended complete: ${created} buffers created, ${skipped} skipped`);
}

// ============================================================
// DETECTION LOGIC
// ============================================================

/**
 * Determines if an event should have buffers added
 * Returns { shouldAdd: boolean, reason: string }
 */
function shouldAddBuffers(event) {
  const title = event.getTitle();
  const startTime = event.getStartTime();
  const endTime = event.getEndTime();
  const durationMinutes = (endTime - startTime) / (60 * 1000);
  
  // === BASIC FILTERS ===
  
  // Skip if too short
  if (durationMinutes < CONFIG.minEventMinutes) {
    return { shouldAdd: false, reason: 'too short' };
  }
  
  // Skip if it's an all-day event
  if (event.isAllDayEvent()) {
    return { shouldAdd: false, reason: 'all-day event' };
  }
  
  // Skip if it's already a buffer event
  if (title.includes(CONFIG.preBufferEmoji) || title.includes(CONFIG.postBufferEmoji)) {
    return { shouldAdd: false, reason: 'is a buffer' };
  }
  
  // Skip excluded titles (Focus Time, Lunch, etc.)
  for (const pattern of CONFIG.excludeTitles) {
    if (pattern instanceof RegExp && pattern.test(title)) {
      return { shouldAdd: false, reason: `excluded title: ${pattern}` };
    }
    if (typeof pattern === 'string' && title === pattern) {
      return { shouldAdd: false, reason: `excluded title: ${pattern}` };
    }
  }
  
  // === BLOCKLIST FILTERS (new) ===
  
  // Skip events from blocklisted calendars
  const eventCalId = getEventSourceCalendar(event);
  for (const pattern of CONFIG.excludeCalendarPatterns || []) {
    if (pattern instanceof RegExp && pattern.test(eventCalId)) {
      return { shouldAdd: false, reason: `excluded calendar: ${eventCalId}` };
    }
  }
  
  // Skip events with too many guests (likely all-hands)
  if (CONFIG.maxGuestsForBuffer) {
    const guestCount = getGuestCount(event);
    if (guestCount > CONFIG.maxGuestsForBuffer) {
      return { shouldAdd: false, reason: `too many guests: ${guestCount}` };
    }
  }
  
  // Skip events you haven't accepted (if configured)
  if (CONFIG.requireAcceptedStatus) {
    const myStatus = getMyAttendanceStatus(event);
    if (myStatus !== 'YES' && myStatus !== 'MAYBE' && myStatus !== 'OWNER') {
      return { shouldAdd: false, reason: `not accepted: ${myStatus}` };
    }
  }
  
  // === POSITIVE MATCHES ===
  
  // Check if it's a customer engagement (title pattern)
  if (isCustomerEngagement(title)) {
    return { shouldAdd: true, reason: 'customer engagement [CODE]' };
  }
  
  // Check if it has a conferencing link
  const confResult = hasConferencingLink(event);
  if (confResult.hasLink) {
    return { shouldAdd: true, reason: `conferencing: ${confResult.type}` };
  }
  
  return { shouldAdd: false, reason: 'no conferencing detected' };
}

/**
 * Get the source calendar ID for an event (where it was created)
 */
function getEventSourceCalendar(event) {
  try {
    const origCalId = event.getOriginalCalendarId();
    if (origCalId) return origCalId;
  } catch (e) {}
  
  try {
    const creators = event.getCreators();
    if (creators && creators.length > 0) return creators[0];
  } catch (e) {}
  
  return 'unknown';
}

/**
 * Get the number of guests on an event
 */
function getGuestCount(event) {
  try {
    const guests = event.getGuestList(true); // include self
    return guests ? guests.length : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Get current user's attendance status for this event
 * Returns: 'YES', 'NO', 'MAYBE', 'INVITED' (not responded), 'OWNER', or 'UNKNOWN'
 */
function getMyAttendanceStatus(event) {
  try {
    const myEmail = Session.getActiveUser().getEmail().toLowerCase();
    
    // Check if I'm the creator/owner
    const creators = event.getCreators();
    if (creators && creators.some(c => c.toLowerCase() === myEmail)) {
      return 'OWNER';
    }
    
    // Check guest list for my status
    const guests = event.getGuestList(true);
    if (guests) {
      for (const guest of guests) {
        if (guest.getEmail().toLowerCase() === myEmail) {
          const status = guest.getGuestStatus();
          if (status === CalendarApp.GuestStatus.YES) return 'YES';
          if (status === CalendarApp.GuestStatus.NO) return 'NO';
          if (status === CalendarApp.GuestStatus.MAYBE) return 'MAYBE';
          if (status === CalendarApp.GuestStatus.INVITED) return 'INVITED';
          return status.toString();
        }
      }
    }
    
    // If we're seeing this event but not in guest list, we probably own it
    return 'OWNER';
  } catch (e) {
    return 'UNKNOWN';
  }
}

/**
 * Check if title matches customer engagement pattern
 */
function isCustomerEngagement(title) {
  return CONFIG.customerEngagementPattern.test(title);
}

/**
 * Check if event has a conferencing link in location, description, or conference data
 * Returns { hasLink: boolean, type: string }
 */
function hasConferencingLink(event) {
  // Method 1: Check for native Google Meet via getHangoutLink() 
  // (works for Meet added via "Add Google Meet" button)
  try {
    const hangoutLink = event.getHangoutLink();
    if (hangoutLink && hangoutLink.length > 0) {
      return { hasLink: true, type: 'Google Meet (native)' };
    }
  } catch (e) {
    // Method may not exist in older API versions
  }
  
  // Method 2: Check location field for conferencing URLs
  const location = event.getLocation() || '';
  const locationMatch = matchesConferencingPattern(location);
  if (locationMatch) {
    return { hasLink: true, type: `${locationMatch} (in location)` };
  }
  
  // Method 3: Check description for conferencing URLs
  const description = event.getDescription() || '';
  const descMatch = matchesConferencingPattern(description);
  if (descMatch) {
    return { hasLink: true, type: `${descMatch} (in description)` };
  }
  
  // Method 4: Use Calendar Advanced Service if available
  // This can access conferenceData which has more reliable info
  try {
    const eventId = event.getId().split('@')[0];
    const calendarId = event.getOriginalCalendarId();
    if (typeof Calendar !== 'undefined' && Calendar.Events) {
      const advancedEvent = Calendar.Events.get(calendarId, eventId);
      if (advancedEvent.conferenceData && advancedEvent.conferenceData.entryPoints) {
        const entryPoints = advancedEvent.conferenceData.entryPoints;
        const videoEntry = entryPoints.find(ep => ep.entryPointType === 'video');
        if (videoEntry) {
          return { hasLink: true, type: `${advancedEvent.conferenceData.conferenceSolution?.name || 'Video conf'} (conferenceData)` };
        }
      }
    }
  } catch (e) {
    // Advanced Calendar service not available or error accessing it
    // This is fine - we'll rely on other methods
  }
  
  return { hasLink: false, type: '' };
}

/**
 * Check if text matches any conferencing URL pattern
 * Returns the matched platform name or false
 */
function matchesConferencingPattern(text) {
  const patterns = [
    { pattern: /meet\.google\.com/i, name: 'Google Meet' },
    { pattern: /\.?zoom\.us/i, name: 'Zoom' },
    { pattern: /zoomgov\.com/i, name: 'Zoom Gov' },
    { pattern: /teams\.microsoft\.com/i, name: 'MS Teams' },
    { pattern: /teams\.live\.com/i, name: 'MS Teams' },
    { pattern: /webex\.com/i, name: 'WebEx' },
    { pattern: /gotomeeting\.com/i, name: 'GoToMeeting' },
    { pattern: /gotomeet\.me/i, name: 'GoToMeeting' },
    { pattern: /bluejeans\.com/i, name: 'BlueJeans' },
    { pattern: /whereby\.com/i, name: 'Whereby' },
    { pattern: /around\.co/i, name: 'Around' },
    { pattern: /discord\.gg/i, name: 'Discord' },
    { pattern: /chime\.aws/i, name: 'Amazon Chime' },
    { pattern: /duo\.google\.com/i, name: 'Google Duo' },
    { pattern: /hangouts\.google\.com/i, name: 'Google Hangouts' },
  ];
  
  for (const { pattern, name } of patterns) {
    if (pattern.test(text)) {
      return name;
    }
  }
  return false;
}

/**
 * Check if event was created by the calendar owner
 */
function isCreatedBySelf(event) {
  try {
    const creators = event.getCreators();
    const myEmail = Session.getActiveUser().getEmail();
    return creators.some(creator => creator === myEmail);
  } catch (e) {
    return false;
  }
}

/**
 * Extract a short label for the buffer event
 */
function getEventLabel(event) {
  const title = event.getTitle();
  
  // If it's a customer engagement, use the code
  const match = title.match(CONFIG.customerEngagementPattern);
  if (match) {
    return match[1];
  }
  
  // For conferencing events, try to get a short meaningful label
  // Truncate long titles
  if (title.length > 25) {
    return title.substring(0, 22) + '...';
  }
  
  return title;
}

// ============================================================
// BUFFER CREATION
// ============================================================

/**
 * Add pre and post buffers to an event
 */
function addBuffersToEvent(calendar, event) {
  const startTime = event.getStartTime();
  const endTime = event.getEndTime();
  const label = getEventLabel(event);
  const title = event.getTitle();
  
  let created = 0;
  let skipped = 0;
  
  // Pre-buffer
  const preResult = createBufferIfNeeded(
    calendar,
    new Date(startTime.getTime() - (CONFIG.preBufferMinutes * 60 * 1000)),
    startTime,
    `${CONFIG.preBufferEmoji} Pre-buffer (${label})`,
    `Preparation time for: ${title}`
  );
  if (preResult === 'created') created++;
  else skipped++;
  
  // Post-buffer
  const postResult = createBufferIfNeeded(
    calendar,
    endTime,
    new Date(endTime.getTime() + (CONFIG.postBufferMinutes * 60 * 1000)),
    `${CONFIG.postBufferEmoji} Post-buffer (${label})`,
    `Follow-up time for: ${title}`
  );
  if (postResult === 'created') created++;
  else skipped++;
  
  return { created, skipped };
}

/**
 * Create a buffer event if it doesn't exist and doesn't conflict
 */
function createBufferIfNeeded(calendar, bufferStart, bufferEnd, bufferTitle, bufferDesc) {
  // Get events in a slightly wider window to catch boundary cases
  // We expand by 1 minute on each side to ensure we catch all potentially overlapping events
  const searchStart = new Date(bufferStart.getTime() - 60000);
  const searchEnd = new Date(bufferEnd.getTime() + 60000);
  const existingEvents = calendar.getEvents(searchStart, searchEnd);
  
  // Check if this exact buffer already exists
  const bufferExists = existingEvents.some(e => e.getTitle() === bufferTitle);
  if (bufferExists) {
    console.log(`    ⏭️ Already exists: ${bufferTitle}`);
    return 'exists';
  }
  
  // Check for TRUE conflicts (actual overlap, not just touching boundaries)
  // Only consider events that ACTUALLY block your time:
  //   - Events you've accepted or own
  //   - Not from blocklisted calendars
  //   - Not all-day events
  const conflicts = existingEvents.filter(e => {
    const eventTitle = e.getTitle();
    
    // Skip other buffer events
    if (eventTitle.includes(CONFIG.preBufferEmoji) || eventTitle.includes(CONFIG.postBufferEmoji)) {
      return false;
    }
    
    // Skip all-day events (they shouldn't block buffers)
    if (e.isAllDayEvent()) {
      return false;
    }
    
    // Skip events from blocklisted calendars
    const eventCalId = getEventSourceCalendar(e);
    for (const pattern of CONFIG.excludeCalendarPatterns || []) {
      if (pattern instanceof RegExp && pattern.test(eventCalId)) {
        return false; // Not a real conflict
      }
    }
    
    // Skip events you haven't accepted (they don't block your time)
    if (CONFIG.requireAcceptedStatus) {
      const myStatus = getMyAttendanceStatus(e);
      if (myStatus !== 'YES' && myStatus !== 'MAYBE' && myStatus !== 'OWNER') {
        return false; // Not a real conflict
      }
    }
    
    // Skip events with too many guests (optional large meetings)
    if (CONFIG.maxGuestsForBuffer) {
      const guestCount = getGuestCount(e);
      if (guestCount > CONFIG.maxGuestsForBuffer) {
        return false; // Not a real conflict
      }
    }
    
    const eventStart = e.getStartTime().getTime();
    const eventEnd = e.getEndTime().getTime();
    const bStart = bufferStart.getTime();
    const bEnd = bufferEnd.getTime();
    
    // True overlap: event starts before buffer ends AND event ends after buffer starts
    // Events that just touch (eventEnd === bufferStart or eventStart === bufferEnd) are OK
    const overlaps = eventStart < bEnd && eventEnd > bStart;
    
    if (overlaps) {
      console.log(`    ⚠️ Conflict with "${eventTitle}" (${new Date(eventStart).toLocaleTimeString()} - ${new Date(eventEnd).toLocaleTimeString()})`);
    }
    
    return overlaps;
  });
  
  if (conflicts.length > 0) {
    console.log(`    ⚠️ Skipping due to ${conflicts.length} conflict(s): ${bufferTitle}`);
    return 'conflict';
  }
  
  // Create the buffer
  try {
    const buffer = calendar.createEvent(bufferTitle, bufferStart, bufferEnd, {
      description: bufferDesc,
    });
    buffer.setColor(CONFIG.bufferColor);
    console.log(`    ✅ Created: ${bufferTitle}`);
    return 'created';
  } catch (error) {
    console.log(`    ❌ Failed: ${bufferTitle} - ${error.message}`);
    return 'error';
  }
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Remove orphaned buffer events (where the original meeting was deleted/moved)
 */
function cleanupOrphanedBuffers() {
  const calendar = getTargetCalendar();
  const now = new Date();
  const lookAhead = new Date(now.getTime() + (CONFIG.lookAheadDays * 24 * 60 * 60 * 1000));
  
  const events = calendar.getEvents(now, lookAhead);
  let deleted = 0;
  
  events.forEach(event => {
    const title = event.getTitle();
    
    // Only process buffer events
    if (!title.includes(CONFIG.preBufferEmoji) && !title.includes(CONFIG.postBufferEmoji)) {
      return;
    }
    
    const isPreBuffer = title.includes('Pre-buffer');
    const bufferStart = event.getStartTime();
    const bufferEnd = event.getEndTime();
    
    // Find the expected meeting time
    let meetingStart, meetingEnd;
    if (isPreBuffer) {
      meetingStart = bufferEnd;
      meetingEnd = new Date(bufferEnd.getTime() + (60 * 60 * 1000)); // Look 1 hour ahead
    } else {
      meetingEnd = bufferStart;
      meetingStart = new Date(bufferStart.getTime() - (60 * 60 * 1000)); // Look 1 hour back
    }
    
    // Check if there's a qualifying event adjacent to this buffer
    const adjacentEvents = calendar.getEvents(meetingStart, meetingEnd);
    const hasQualifyingEvent = adjacentEvents.some(e => shouldAddBuffers(e).shouldAdd);
    
    if (!hasQualifyingEvent) {
      console.log(`🗑️ Orphaned buffer, deleting: ${title}`);
      event.deleteEvent();
      deleted++;
    }
  });
  
  console.log(`✅ Cleanup complete: ${deleted} orphaned buffers removed`);
}

// ============================================================
// TRIGGER SETUP
// ============================================================

/**
 * Set up automatic triggers
 */
function setupTriggers() {
  // Delete existing triggers for these functions
  const functionsToTrigger = ['addBuffersToQualifyingEvents', 'cleanupOrphanedBuffers'];
  
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (functionsToTrigger.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Run buffer check every hour
  ScriptApp.newTrigger('addBuffersToQualifyingEvents')
    .timeBased()
    .everyHours(1)
    .create();
  
  // Run cleanup daily at 6 AM
  ScriptApp.newTrigger('cleanupOrphanedBuffers')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();
    
  console.log('✅ Triggers configured: buffer check hourly, cleanup daily at 6 AM');
}

/**
 * One-time setup function - run this first!
 */
function setup() {
  console.log('🚀 Setting up automatic calendar buffers...');
  
  // Run once immediately
  addBuffersToQualifyingEvents();
  
  // Set up automatic triggers
  setupTriggers();
  
  console.log('✅ Setup complete! Buffers will be added automatically.');
}

// ============================================================
// DEBUG / DRY RUN
// ============================================================

/**
 * Dry run - shows what would be created without actually creating anything
 * Useful for debugging detection issues
 */
function dryRun() {
  const now = new Date();
  const lookAhead = new Date(now.getTime() + (CONFIG.lookAheadDays * 24 * 60 * 60 * 1000));
  
  console.log('🔍 DRY RUN - No events will be created\n');
  console.log(`Looking from ${now.toLocaleString()} to ${lookAhead.toLocaleString()}`);
  console.log(`Target calendar: ${CONFIG.targetCalendar}`);
  console.log(`Max guests: ${CONFIG.maxGuestsForBuffer}`);
  console.log(`Require accepted: ${CONFIG.requireAcceptedStatus}\n`);
  
  const calendar = getTargetCalendar();
  const events = calendar.getEvents(now, lookAhead);
  
  console.log(`\n📅 ${events.length} events found\n`);
  
  events.forEach(event => {
    const title = event.getTitle();
    const start = event.getStartTime();
    const end = event.getEndTime();
    const sourceCalendar = getEventSourceCalendar(event);
    const guestCount = getGuestCount(event);
    const myStatus = getMyAttendanceStatus(event);
    
    const result = shouldAddBuffers(event);
    
    if (result.shouldAdd) {
      console.log(`✅ WOULD BUFFER: "${title}"`);
      console.log(`   Time: ${start.toLocaleString()} - ${end.toLocaleString()}`);
      console.log(`   Source: ${sourceCalendar}`);
      console.log(`   Guests: ${guestCount} | My status: ${myStatus}`);
      console.log(`   Reason: ${result.reason}`);
      
      const preStart = new Date(start.getTime() - (CONFIG.preBufferMinutes * 60 * 1000));
      const postEnd = new Date(end.getTime() + (CONFIG.postBufferMinutes * 60 * 1000));
      console.log(`   Pre-buffer: ${preStart.toLocaleTimeString()} - ${start.toLocaleTimeString()}`);
      console.log(`   Post-buffer: ${end.toLocaleTimeString()} - ${postEnd.toLocaleTimeString()}`);
    } else {
      console.log(`⏭️ SKIP: "${title}"`);
      console.log(`   Time: ${start.toLocaleString()} - ${end.toLocaleString()}`);
      console.log(`   Source: ${sourceCalendar}`);
      console.log(`   Guests: ${guestCount} | My status: ${myStatus}`);
      console.log(`   Reason: ${result.reason}`);
    }
    console.log('');
  });
  
  console.log('🔍 DRY RUN COMPLETE');
}

/**
 * Debug a specific event by title (partial match)
 */
function debugEvent(searchTitle) {
  const now = new Date();
  const lookAhead = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
  
  const calendar = getTargetCalendar();
  const events = calendar.getEvents(now, lookAhead);
  
  events.forEach(event => {
    const title = event.getTitle();
    if (title.toLowerCase().includes(searchTitle.toLowerCase())) {
      console.log(`\n🔍 Found: "${title}"`);
      console.log(`   Calendar: ${calendar.getName()}`);
      console.log(`   Time: ${event.getStartTime().toLocaleString()} - ${event.getEndTime().toLocaleString()}`);
      console.log(`   Source: ${getEventSourceCalendar(event)}`);
      console.log(`   Guests: ${getGuestCount(event)} | My status: ${getMyAttendanceStatus(event)}`);
      console.log(`   Location: ${event.getLocation() || '(none)'}`);
      console.log(`   Description: ${(event.getDescription() || '(none)').substring(0, 200)}...`);
      
      try {
        console.log(`   Hangout Link: ${event.getHangoutLink() || '(none)'}`);
      } catch (e) {
        console.log(`   Hangout Link: (error: ${e.message})`);
      }
      
      const confResult = hasConferencingLink(event);
      console.log(`   Conferencing detected: ${confResult.hasLink ? confResult.type : 'No'}`);
      
      const result = shouldAddBuffers(event);
      console.log(`   Should buffer: ${result.shouldAdd} (${result.reason})`);
    }
  });
}

// Quick debug functions - run these to test specific events
function debugBennyMartin() { debugEvent('Benny Martin'); }
function debugTalesFails() { debugEvent('Tales'); }

// ============================================================
// LEGACY COMPATIBILITY
// ============================================================

// Keep old function name working
function addBuffersToCustomerEngagements() {
  addBuffersToQualifyingEvents();
}
