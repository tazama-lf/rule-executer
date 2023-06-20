import { Context, Next } from 'koa';

export const healthCheck = async (
  ctx: Context,
  next: Next,
): Promise<void | Context> => {
  ctx.body = 'online';
  ctx.status = 200;
  await next();
};
