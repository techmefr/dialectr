export interface LikePattern {
    literal: string
    leading: boolean
    trailing: boolean
    inner: boolean
}

export function escapeLike(text: string): string {
    return text.replace(/[\\%_]/g, character => `\\${character}`)
}

export function parseLike(pattern: string): LikePattern {
    const tokens: Array<{ character: string; wildcard: boolean }> = []
    for (let index = 0; index < pattern.length; index++) {
        const character = pattern[index]
        if (character === '\\' && index + 1 < pattern.length) {
            tokens.push({ character: pattern[index + 1], wildcard: false })
            index++
        } else {
            tokens.push({ character, wildcard: character === '%' || character === '_' })
        }
    }
    const last = tokens.length - 1
    let leading = false
    let trailing = false
    let inner = false
    tokens.forEach((token, index) => {
        if (!token.wildcard) return
        if (token.character === '%' && index === 0) {
            leading = true
            if (last === 0) trailing = true
        } else if (token.character === '%' && index === last) trailing = true
        else inner = true
    })
    const literal = tokens
        .filter(token => !token.wildcard)
        .map(token => token.character)
        .join('')
    return { literal, leading, trailing, inner }
}

export function containsPattern(pattern: string): string {
    const parsed = parseLike(pattern)
    return parsed.leading || parsed.trailing || parsed.inner ? pattern : `%${pattern}%`
}
