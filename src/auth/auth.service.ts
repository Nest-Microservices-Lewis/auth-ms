import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RpcException } from '@nestjs/microservices';

import { PrismaClient } from '@prisma/client';
import { LoginUserDto, RegisterUserDto } from '@/auth/dto';
import { JwtPayload } from '@/auth/interfaces';
import { JwtService } from '@nestjs/jwt';
import { envs } from '@/config';

@Injectable()
export class AuthService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('AuthService');

  constructor(private readonly jwtService: JwtService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async signJWT(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  async registerUser({ name, email, password }: RegisterUserDto) {
    try {
      const userExists = await this.user.findUnique({
        where: {
          email,
        },
      });

      if (userExists) {
        this.throwsException('User already exists');
      }

      const user = await this.user.create({
        data: {
          name,
          email,
          password: bcrypt.hashSync(password, 10),
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
      return {
        user,
        token: await this.signJWT(user),
      };
    } catch (error) {
      this.throwsException(error.message);
    }
  }

  async loginUser({ email, password }: LoginUserDto) {
    this.logger.log('PAse por el login');
    this.logger.log(email, password);
    try {
      const user = await this.user.findUnique({
        where: {
          email,
        },
      });
      if (!user || !bcrypt.compareSync(password, user.password)) {
        this.throwsException('Invalid credentials');
      }

      delete user.password;

      return {
        user,
        token: await this.signJWT(user),
      };
    } catch (error) {
      this.throwsException(error.message);
    }
  }

  async verifyToken(token: string) {
    try {
      const { id } = (await this.jwtService.verify(token, {
        secret: envs.jwtSecret,
      })) as JwtPayload;

      const user = await this.user.findUnique({
        where: {
          id,
        },
      });

      if (!user) {
        this.throwsException('User not found');
      }

      delete user.password;

      return {
        user,
        token: await this.signJWT(user),
      };
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.UNAUTHORIZED,
        message: error.message,
      });
    }
  }

  throwsException(message: string) {
    throw new RpcException({
      status: HttpStatus.BAD_REQUEST,
      message,
    });
  }
}
