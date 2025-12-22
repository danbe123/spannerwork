import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodTypeAny } from 'zod';

/**
 * Middleware to validate request data against a Zod schema
 */
export function validate(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return next(error);
    }
  };
}

/**
 * Format validation errors into user-friendly messages
 */
function formatValidationErrors(errors: ZodError['errors']): { field: string; message: string }[] {
  return errors.map((err) => {
    const field = err.path.join('.');
    let message = err.message;
    
    // Make common validation messages more user-friendly
    if (message === 'Required') {
      const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
      message = `${fieldName} is required`;
    }
    
    return { field, message };
  });
}

/**
 * Create a summary message from validation errors
 */
function createSummaryMessage(errors: { field: string; message: string }[]): string {
  if (errors.length === 1) {
    return errors[0].message;
  }
  if (errors.length <= 3) {
    return errors.map(e => e.message).join('. ');
  }
  return `Please fix ${errors.length} validation errors`;
}

/**
 * Validate only request body
 */
export function validateBody(schema: ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = formatValidationErrors(error.errors);
        return res.status(400).json({
          error: 'Validation Error',
          message: createSummaryMessage(details),
          details,
        });
      }
      return next(error);
    }
  };
}

/**
 * Validate only query parameters
 */
export function validateQuery(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return next(error);
    }
  };
}

/**
 * Validate only route parameters (e.g., :id)
 */
export function validateParams(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid route parameters',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return next(error);
    }
  };
}

/**
 * Combine body, query, and params validation
 */
export function validateRequest(options: {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (options.params) {
        req.params = await options.params.parseAsync(req.params);
      }
      if (options.query) {
        req.query = await options.query.parseAsync(req.query);
      }
      if (options.body) {
        req.body = await options.body.parseAsync(req.body);
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return next(error);
    }
  };
}
