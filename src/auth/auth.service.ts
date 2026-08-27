import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        passwordHash: hashedPassword,
        role: 'user',
      },
    });

    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async adminLogin(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.role !== 'admin') {
      throw new UnauthorizedException('Invalid credentials or insufficient permissions');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async validateGoogleUser(googleUser: { email: string; fullName: string; avatarUrl?: string }) {
    if (!googleUser || !googleUser.email) {
      throw new UnauthorizedException('Invalid Google user data');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    const safeName = (googleUser.fullName || googleUser.email.split('@')[0]).substring(0, 95);
    const safeAvatar = googleUser.avatarUrl ? googleUser.avatarUrl.substring(0, 490) : null;

    if (!user) {
      // Auto-register user from Google if not existing
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          fullName: safeName,
          avatarUrl: safeAvatar,
          passwordHash: '$2b$10$DUMMYPASSWORDFORGOOGLEOAUTHACCXXXXXX', // valid dummy hash
          role: 'user',
        },
      });
    } else {
      // Update fullName and avatar if available from Google
      const updates: any = {};
      if (safeName && (!user.fullName || user.fullName === user.email.split('@')[0])) {
        updates.fullName = safeName;
      }
      if (safeAvatar && !user.avatarUrl) {
        updates.avatarUrl = safeAvatar;
      }
      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    }

    return this.generateToken(user);
  }

  async validateUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    };
  }
}
