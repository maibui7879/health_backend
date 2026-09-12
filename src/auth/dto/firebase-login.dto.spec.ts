import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FirebaseLoginDto } from './firebase-login.dto';

describe('FirebaseLoginDto', () => {
  it('should fail validation when idToken is empty', async () => {
    const dto = plainToInstance(FirebaseLoginDto, { idToken: '' });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
