import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getAppInfo() {
    return {
      name: 'Lapang.in API',
      version: '1.0.0',
    };
  }
}
