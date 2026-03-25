import { describe, it, expect } from 'vitest';
import { AppError, ValidationError, NotFoundError, UnauthorizedError, ConflictError } from '../../src/utils/errors';

describe('errors', () => {
  describe('AppError', () => {
    it('AppError has correct statusCode and code', () => {
      const error = new AppError('TEST_ERROR', 'Test message', 418);
      expect(error.statusCode).toBe(418);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
    });
  });

  describe('ValidationError', () => {
    it('ValidationError statusCode 400, code VALIDATION_ERROR', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('NotFoundError statusCode 404, code NOT_FOUND', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('UnauthorizedError', () => {
    it('UnauthorizedError statusCode 401, code UNAUTHORIZED', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ConflictError', () => {
    it('ConflictError statusCode 409, code CONFLICT', () => {
      const error = new ConflictError('Already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });
});
