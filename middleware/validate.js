import { error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

export function validateParams(schema) {
  return (req, res, next) => {
    for (const [param, type] of Object.entries(schema)) {
      if (type === 'integer') {
        const value = parseInt(req.params[param], 10);
        if (isNaN(value)) {
          return error(res, `Invalid ${param}`, 400, ErrorCodes.VALIDATION_ERROR);
        }
      }
    }
    next();
  };
}
