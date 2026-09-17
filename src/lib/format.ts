const oneDecimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
export const fmt = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.round(value))
export const decimal = (value: number) => oneDecimal.format(value)
export const pct = (value: number) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value)}%`
export const pctPlain = (value: number) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)}%`
export const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')
