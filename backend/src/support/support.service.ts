import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthUser } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_BODY = 1000;
const MAX_STAFF_BODY = 2000;
const MAX_MESSAGES_PER_TICKET = 300;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\s-]{7,16}$/;

const MSG = {
  rate: 'অনেক বেশি বার্তা পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  body: 'বার্তা লিখুন (সর্বোচ্চ ১০০০ অক্ষর)।',
  name: 'আপনার নাম লিখুন।',
  contact: 'যোগাযোগের জন্য সঠিক মোবাইল নম্বর বা ইমেইল দিন, যাতে আমরা প্রয়োজনে যোগাযোগ করতে পারি।',
  full: 'এই কথোপকথনে বার্তার সীমা শেষ। নতুন সাপোর্ট রিকোয়েস্ট খুলুন।',
};

const clean = (s: unknown, max: number) =>
  // eslint-disable-next-line no-control-regex
  String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

@Injectable()
export class SupportService {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  /** Sliding-window limiter; throws 429 when `max` hits happened in `windowMs`. */
  private limit(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) throw new HttpException({ message: MSG.rate }, 429);
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (!v.some((t) => now - t < 3_600_000)) this.hits.delete(k);
    }
  }

  private sameToken(a: string, b?: string) {
    if (!b) return false;
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }

  /** Owner = the signed-in user who opened it, or whoever holds the guest token. */
  private async owned(id: string, user: AuthUser | null, token?: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    // Same response for "missing" and "not yours" so ids cannot be probed.
    if (!t) throw new NotFoundException();
    const ok = (user && t.userId === user.id) || (!t.userId && this.sameToken(t.accessToken, token));
    if (!ok) throw new NotFoundException();
    return t;
  }

  private view(t: { id: string; status: string; name: string; userUnread: boolean }, messages: { id: string; sender: string; authorName: string | null; body: string; createdAt: Date }[]) {
    return { id: t.id, status: t.status, name: t.name, unread: t.userUnread, messages };
  }

  // ---------- visitor / student side ----------
  async create(user: AuthUser | null, ip: string, b: any) {
    this.limit(`t:${ip}`, 3, 3_600_000);
    this.limit(`td:${ip}`, 10, 86_400_000);
    const body = clean(b?.message, MAX_BODY);
    if (!body) throw new HttpException({ message: MSG.body }, 400);

    let name = clean(b?.name, 80);
    let contact: string | null = clean(b?.contact, 120) || null;
    if (user) {
      const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, phone: true } });
      name = me.name;
      contact = me.phone || me.email;
    } else {
      if (name.length < 2) throw new HttpException({ message: MSG.name }, 400);
      if (!contact || !(EMAIL.test(contact) || PHONE.test(contact))) throw new HttpException({ message: MSG.contact }, 400);
    }

    const token = randomBytes(24).toString('hex');
    const t = await this.prisma.supportTicket.create({
      data: {
        userId: user?.id ?? null,
        name,
        contact,
        accessToken: token,
        messages: { create: { sender: 'USER', authorName: name, body } },
      },
      include: { messages: true },
    });
    // The token is only ever returned here, to the creator (needed for guests).
    return { ...this.view(t, t.messages), token: user ? null : token };
  }

  async get(id: string, user: AuthUser | null, token?: string) {
    const t = await this.owned(id, user, token);
    const messages = await this.prisma.supportMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      take: MAX_MESSAGES_PER_TICKET,
      select: { id: true, sender: true, authorName: true, body: true, createdAt: true },
    });
    if (t.userUnread) await this.prisma.supportTicket.update({ where: { id }, data: { userUnread: false }, select: { id: true } });
    return this.view({ ...t, userUnread: false }, messages);
  }

  /** Cheap poll for the launcher's "new reply" dot. */
  async unread(id: string, user: AuthUser | null, token?: string) {
    const t = await this.owned(id, user, token);
    return { unread: t.userUnread, status: t.status };
  }

  async mine(user: AuthUser) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { userId: user.id },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }], // OPEN before CLOSED
      select: { id: true },
    });
    return { id: t?.id ?? null };
  }

  async post(id: string, user: AuthUser | null, token: string | undefined, ip: string, b: any) {
    this.limit(`m:${ip}`, 30, 3_600_000);
    const t = await this.owned(id, user, token);
    const body = clean(b?.message, MAX_BODY);
    if (!body) throw new HttpException({ message: MSG.body }, 400);
    if ((await this.prisma.supportMessage.count({ where: { ticketId: id } })) >= MAX_MESSAGES_PER_TICKET) {
      throw new HttpException({ message: MSG.full }, 400);
    }
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId: id, sender: 'USER', authorName: t.name, body } }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: 'OPEN', staffUnread: true } }),
    ]);
    return this.get(id, user, token);
  }

  // ---------- admin side ----------
  async adminList(status?: string) {
    const rows = await this.prisma.supportTicket.findMany({
      where: status === 'closed' ? { status: 'CLOSED' } : status === 'open' ? { status: 'OPEN' } : {},
      orderBy: [{ staffUnread: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true, name: true, contact: true, status: true, staffUnread: true, userId: true, updatedAt: true, createdAt: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { sender: true, body: true } },
      },
    });
    return rows.map(({ messages, userId, ...t }) => ({
      ...t,
      isUser: !!userId,
      last: messages[0] ? { sender: messages[0].sender, body: messages[0].body.slice(0, 140) } : null,
    }));
  }

  async adminCount() {
    return { count: await this.prisma.supportTicket.count({ where: { status: 'OPEN', staffUnread: true } }) };
  }

  async adminGet(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: MAX_MESSAGES_PER_TICKET },
        user: { select: { email: true, phone: true, role: true } },
      },
    });
    if (!t) throw new NotFoundException();
    if (t.staffUnread) await this.prisma.supportTicket.update({ where: { id }, data: { staffUnread: false }, select: { id: true } });
    const { accessToken: _omit, ...safe } = t; // never expose the guest's token, not even to admins
    void _omit;
    return { ...safe, staffUnread: false };
  }

  async adminReply(id: string, admin: AuthUser, b: any) {
    const body = clean(b?.message, MAX_STAFF_BODY);
    if (!body) throw new HttpException({ message: MSG.body }, 400);
    if (!(await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException();
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: admin.id }, select: { name: true } });
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId: id, sender: 'STAFF', authorName: me.name, body } }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: 'OPEN', userUnread: true, staffUnread: false } }),
    ]);
    return this.adminGet(id);
  }

  async adminSetStatus(id: string, status: unknown) {
    if (status !== 'OPEN' && status !== 'CLOSED') throw new BadRequestException('status must be OPEN or CLOSED');
    if (!(await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException();
    await this.prisma.supportTicket.update({ where: { id }, data: { status }, select: { id: true } });
    return this.adminGet(id);
  }
}
