import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const role = request.query.role || 'INDIVIDUAL';
    const name = request.query.name || '';
    const state = Buffer.from(JSON.stringify({ role, name })).toString('base64');
    return {
      state,
      scope: ['email', 'profile'],
    };
  }
}
