import { assertField, assertOperator, assertValue } from './assertions.ts'
import { cloneValue } from './clone.ts'
import type { Connector, FilterNode, Operator } from './types.ts'

export function isBlankCondition(operatorOrValue: unknown, maybeValue: unknown, argumentCount: number): boolean {
    const value = argumentCount >= 3 ? maybeValue : operatorOrValue
    return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

export function conditionNode(
    boolean: Connector,
    field: string,
    operatorOrValue: unknown,
    maybeValue: unknown,
    argumentCount: number,
): FilterNode {
    const hasOperator = argumentCount >= 3
    const operator = hasOperator ? operatorOrValue : '='
    const value = hasOperator ? maybeValue : operatorOrValue
    assertField(field)
    assertOperator(operator)
    assertValue(operator, value)
    return {
        kind: 'condition',
        boolean,
        field,
        operator: operator as Operator,
        value: cloneValue(value),
    }
}
