import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';

export async function addPremiereToCalendar({
  showTitle,
  episodeName,
  episodeNumber,
  seasonNumber,
  airDate,
  hostName,
  premiereId,
}: {
  showTitle: string;
  episodeName: string;
  episodeNumber: string | number;
  seasonNumber: string | number;
  airDate: string;
  airTime?: string | null;
  hostName: string;
  premiereId: string;
}) {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Calendar access needed', 'Please allow Clique to access your calendar in Settings.');
    return;
  }

  // Parse user-selected time or fall back to 8 PM
  let startHour = 20;
  let startMinute = 0;
  if (airTime) {
    const match = airTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      startHour = parseInt(match[1], 10) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
      startMinute = parseInt(match[2], 10);
    }
  }
  const startDate = new Date(`${airDate}T${String(startHour).padStart(2,'0')}:${String(startMinute).padStart(2,'0')}:00`);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const eventTitle = `${showTitle} — S${seasonNumber} E${episodeNumber} Premiere`;
  const notes = `${episodeName}\n\nHosted by ${hostName} on Clique\nJoin: thecliqueapp://premiere/${premiereId}`;

  try {
    // Find the default calendar to write to
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writableCalendar =
      calendars.find((c) => c.allowsModifications && c.source?.name === 'iCloud') ??
      calendars.find((c) => c.allowsModifications) ??
      null;

    if (!writableCalendar) {
      Alert.alert('No calendar found', 'Could not find a writable calendar on this device.');
      return;
    }

    await Calendar.createEventAsync(writableCalendar.id, {
      title: eventTitle,
      startDate,
      endDate,
      notes,
      alarms: [{ relativeOffset: -15 }], // 15 min reminder
      timeZone: Calendar.TimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    Alert.alert('Added to calendar! 📅', `"${eventTitle}" has been added with a 15-minute reminder.`);
  } catch {
    Alert.alert('Something went wrong', 'Could not add the event to your calendar. Please try again.');
  }
}
