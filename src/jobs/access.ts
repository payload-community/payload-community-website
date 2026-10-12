/** `Authorization: Bearer $CRON_SECRET`, used by schedulers outside the app (spec §9). */
export const isCronRequest = (headers: Headers): boolean => {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && headers.get('authorization') === `Bearer ${secret}`
}
