const esc = '\x1b['

function ansi(n: number): (s: string) => string {
  return (s: string) => `${esc}${n}m${s}${esc}0m`
}

function ansiBright(n: number): (s: string) => string {
  return (s: string) => `${esc}${n};1m${s}${esc}0m`
}

export const reset    = (s: string) => s
export const bold     = ansi(1)
export const dim      = ansi(2)
export const red      = ansi(31)
export const green    = ansi(32)
export const yellow   = ansi(33)
export const blue     = ansi(34)
export const magenta  = ansi(35)
export const cyan     = ansi(36)
export const white    = ansi(37)
export const gray     = ansi(90)
