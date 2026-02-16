import { SlashCommandBuilder } from 'discord.js';
import { db } from '../../database.js';
import { resolveUser } from '../utils/permissions.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:Signup');

export const data = new SlashCommandBuilder()
  .setName('signup')
  .setDescription('Sign up for a raid date')
  .addStringOption(opt =>
    opt.setName('date').setDescription('Raid date (YYYY-MM-DD)').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('status').setDescription('Your status')
      .setRequired(true)
      .addChoices(
        { name: 'Confirmed', value: 'confirmed' },
        { name: 'Declined', value: 'declined' },
        { name: 'Tentative', value: 'tentative' },
      )
  );

export async function execute(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller) {
    return interaction.reply({ content: 'Your Discord account is not linked. Use `/link` to connect it.', ephemeral: true });
  }

  const date = interaction.options.getString('date');
  const status = interaction.options.getString('status');

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return interaction.reply({ content: 'Invalid date format. Use YYYY-MM-DD.', ephemeral: true });
  }

  // Check it's a raid day
  const dateObj = new Date(date + 'T12:00:00');
  const jsDay = dateObj.getDay();
  const dbDay = jsDay === 0 ? 7 : jsDay;
  const raidDay = await db.get('SELECT * FROM raid_days WHERE day_of_week = ? AND is_active = 1', dbDay);
  if (!raidDay) {
    return interaction.reply({ content: `${date} is not a raid day.`, ephemeral: true });
  }

  // Check cutoff
  const raidTimeStr = raidDay.raid_time || '21:00';
  const [raidH, raidM] = raidTimeStr.split(':').map(Number);
  const raidStart = new Date(dateObj);
  raidStart.setHours(raidH, raidM, 0, 0);
  const cutoff = new Date(raidStart.getTime() - 8 * 60 * 60 * 1000);

  if (new Date() > cutoff) {
    return interaction.reply({ content: 'Signup deadline has passed (8 hours before raid start).', ephemeral: true });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx.get(
        'SELECT id, dkp_awarded FROM member_availability WHERE user_id = ? AND raid_date = ?',
        caller.id, date
      );

      if (existing) {
        await tx.run(
          'UPDATE member_availability SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND raid_date = ?',
          status, caller.id, date
        );
        return { isNew: false, dkpAwarded: 0 };
      }

      // First signup — award calendar DKP
      const dkpConfig = await tx.get("SELECT config_value FROM dkp_config WHERE config_key = 'calendar_dkp_per_day'");
      const capConfig = await tx.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
      const dkpPerDay = parseInt(dkpConfig?.config_value || '1', 10);
      const dkpCap = parseInt(capConfig?.config_value || '250', 10);

      const currentMember = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', caller.id);
      const currentDkp = currentMember?.current_dkp || 0;
      let dkpAwarded = Math.min(dkpPerDay, dkpCap - currentDkp);
      dkpAwarded = Math.max(0, dkpAwarded);

      await tx.run(
        'INSERT INTO member_availability (user_id, raid_date, status, dkp_awarded) VALUES (?, ?, ?, ?)',
        caller.id, date, status, dkpAwarded
      );

      if (dkpAwarded > 0) {
        await tx.run(
          'UPDATE member_dkp SET current_dkp = current_dkp + ?, lifetime_gained = lifetime_gained + ? WHERE user_id = ?',
          dkpAwarded, dkpAwarded, caller.id
        );
        await tx.run(
          'INSERT INTO dkp_transactions (user_id, amount, reason, performed_by) VALUES (?, ?, ?, ?)',
          caller.id, dkpAwarded, `Calendario: registro para ${date}`, caller.id
        );
      }

      return { isNew: true, dkpAwarded };
    });

    const statusEmoji = { confirmed: '\u2705', declined: '\u274c', tentative: '\u2753' };
    let msg = `${statusEmoji[status]} Signed up as **${status}** for **${date}**`;
    if (result.isNew && result.dkpAwarded > 0) {
      msg += ` (+${result.dkpAwarded} DKP)`;
    }

    return interaction.reply({ content: msg });
  } catch (error) {
    log.error('Signup command error', error);
    return interaction.reply({ content: 'Failed to sign up.', ephemeral: true });
  }
}
