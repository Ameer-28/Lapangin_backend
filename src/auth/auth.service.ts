import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    let rawToken: string | undefined;

    if (user) {
      // Generate 32-byte secure random token
      rawToken = crypto.randomBytes(32).toString('hex');
      // Hash with SHA-256 for secure DB storage
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      // Expire in 1 hour
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: expires,
        },
      });

      // Only log token in development — NEVER in production
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[PASSWORD RESET - DEV ONLY] Email: ${user.email}, Token: ${rawToken}`);
      }
    }

    // Do NOT reveal whether an email exists in the system through the response
    return {
      message: 'Jika email terdaftar di sistem kami, instruksi reset password telah dikirimkan.',
      ...(process.env.NODE_ENV !== 'production' && rawToken ? { resetToken: rawToken } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Token reset password tidak valid atau telah kadaluarsa');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Atomically update password and invalidate token (single-use)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return {
      message: 'Password berhasil diperbarui. Silakan login dengan password baru Anda.',
    };
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
