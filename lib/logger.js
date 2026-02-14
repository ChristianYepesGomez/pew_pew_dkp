const isProduction = process.env.NODE_ENV === 'production';

function serialize(level, module, message, data) {
  if (isProduction) {
    const entry = { level, module, msg: message, t: new Date().toISOString() };
    if (data instanceof Error) entry.error = { message: data.message, stack: data.stack };
    else if (data !== undefined) entry.data = data;
    return JSON.stringify(entry);
  }
  const prefix = `[${module}]`;
  if (data instanceof Error) return `${prefix} ${message}: ${data.message}\n${data.stack}`;
  if (data !== undefined) return `${prefix} ${message} ${typeof data === 'string' ? data : JSON.stringify(data)}`;
  return `${prefix} ${message}`;
}

export function createLogger(module) {
  return {
    info: (msg, data) => console.log(serialize('info', module, msg, data)),
    warn: (msg, data) => console.warn(serialize('warn', module, msg, data)),
    error: (msg, data) => console.error(serialize('error', module, msg, data)),
    debug: (msg, data) => { if (!isProduction) console.debug(serialize('debug', module, msg, data)); },
  };
}
