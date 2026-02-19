import { SlashCommandBuilder } from 'discord.js';
import { db } from '../../database.js';
import { buildCalendarEmbed } from '../embeds/calendar.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:Calendar');

// Inline version of getRaidDates (avoids importing Express route module)
async function getRaidDates(weeks = 2) {
  const raidDays = await db.all(
    'SELECT day_of_week, day_name, raid_time FROM raid_days WHERE is_active = 1 ORDER BY day_of_week'
  );

  const dates = [];
  const spainFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const spainDateStr = spainFormatter.format(new Date());
  const [year, month, day] = spainDateStr.split('-').map(Number);
  const today = new Date(year, month - 1, day);
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const jsDay = date.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay;
    const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
    if (raidDay) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      const raidTimeStr = raidDay.raid_time || '21:00';
      const [raidH, raidM] = raidTimeStr.split(':').map(Number);
      const raidStart = new Date(date);
      raidStart.setHours(raidH, raidM, 0, 0);
      const cutoff = new Date(raidStart.getTime() - 8 * 60 * 60 * 1000);
      const nowInSpain = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));

      dates.push({
        date: dateStr,
        dayOfWeek: dbDay,
        dayName: raidDay.day_name,
        raidTime: raidTimeStr,
        isLocked: nowInSpain > cutoff,
      });
    }
  }
  return dates;
}

export const data = new SlashCommandBuilder()
  .setName('calendar')
  .setDescription('View raid schedule for this week');

export async function execute(interaction) {
  try {
    const dates = await getRaidDates(2);
    return interaction.reply({ embeds: [buildCalendarEmbed(dates)] });
  } catch (error) {
    log.error('Calendar command error', error);
    return interaction.reply({ content: 'Failed to get raid schedule.', ephemeral: true });
  }
}
