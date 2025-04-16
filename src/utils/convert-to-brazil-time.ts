import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * Convert UTC date to Brazilian timezone (America/Sao_Paulo)
 * @param date - UTC date from database or any source
 * @returns dayjs.Dayjs instance in Brazilian timezone
 */

export function convertToBrazilTime(date: Date | string) {
  return dayjs(date).tz('America/Sao_Paulo')
}
