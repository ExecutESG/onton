import { Composer } from 'grammy'
import { isUserAdmin } from '../db/users'
import { MyContext } from '../types/MyContext'

const helpComposer = new Composer<MyContext>();

helpComposer.command('help', async (ctx) => {
  const { isAdmin } = await isUserAdmin(ctx.from?.id.toString() || "");
  if (!isAdmin) return;
  
  // Commands list with description based on provided list
  const commands = [
    { command: '/channel_button', description: 'Edit channel post buttons' },
    { command: '/remove_button', description: 'Remove channel post buttons' },
    { command: '/2id', description: 'Convert usernames to IDs' },
    { command: '/sbtdist', description: 'Distribute SBT rewards' },
    { command: '/invitor', description: 'Manage event Telegram groups' },
    { command: '/collections', description: 'Manage collections' },
    { command: '/affiliate', description: 'Manage affiliate links' },
    { command: '/cancel', description: 'Cancel active operations' },
    { command: '/help', description: 'Display available commands' },
    { command: '/play2winfeatured', description: 'Update featured play2win tournaments' },
    { command: '/broadcast', description: 'Send broadcast messages' },
    { command: '/tournament', description: 'Manage tournaments' },
    { command: '/sendpoll', description: 'Create and send polls' },
  ];

  // Format the help message
  const helpMessage = commands.map(cmd => `${cmd.command} - ${cmd.description}`).join('\n');
  await ctx.reply(`Available commands:\n${helpMessage}`);
});

export default helpComposer;
