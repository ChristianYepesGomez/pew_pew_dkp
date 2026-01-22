/**
 * Middleware to authenticate Discord Bot requests
 */
export function authenticateBot(req, res, next) {
  const botSecret = req.headers['x-bot-secret'];
  const expectedSecret = process.env.BOT_API_SECRET || 'change-this-bot-secret-in-production';

  if (!botSecret) {
    return res.status(401).json({ error: 'Bot authentication required' });
  }

  if (botSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid bot credentials' });
  }

  // Mark this request as coming from the bot
  req.bot = true;
  req.user = {
    userId: 0,
    username: 'discord-bot',
    role: 'bot'
  };

  next();
}
