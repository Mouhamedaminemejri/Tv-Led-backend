import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Module({
    providers: [
        {
            provide: 'PRISMA',
            useValue: new PrismaClient(),
        },
    ],
    exports: ['PRISMA'],
})
export class PrismaModule { }
