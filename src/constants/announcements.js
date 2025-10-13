/**
 * System Announcements
 *
 * These appear in the notifications modal and create a badge on the app icon.
 * Users can dismiss them individually with the X button.
 *
 * Format:
 * - id: Unique identifier (use date-based format: YYYYMMDD-N)
 * - title: Short title (keep under 30 characters)
 * - body: Message text (keep under 80 characters for mobile readability)
 * - date: ISO date string
 * - type: 'announcement' (reserved for future types like 'feature', 'update', etc.)
 *
 * To add a new announcement:
 * 1. Add new object to ANNOUNCEMENTS array
 * 2. Use next sequential id (YYYYMMDD-N where N increments)
 * 3. Keep title concise and body under 80 characters
 * 4. Set date to when announcement should appear
 */

export const ANNOUNCEMENTS = [
  {
    id: '20251012-2',
    title: 'New!',
    body: 'Share right from your favorite podcast app. Click the share icon, select Audio2, and clip away!',
    date: '2025-10-12T00:00:00Z',
    type: 'announcement',
  },
  // Add new announcements here - they will appear in the notifications modal
  // Example:
  // {
  //   id: '20251013-1',
  //   title: 'New Feature: Video Templates',
  //   body: 'Choose from pre-designed templates to make your clips stand out on social media.',
  //   date: '2025-10-13T00:00:00Z',
  //   type: 'announcement',
  // },
];
