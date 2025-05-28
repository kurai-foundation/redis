import {
  ArraySchema,
  BasePrimitive,
  NullableSchema,
  ObjectSchema,
  seal
} from "@sigiljs/seal"
import { InferSchema } from "@sigiljs/seal/types"

type InputShape = BasePrimitive<any>
  | ArraySchema<BasePrimitive<any> | NullableSchema<BasePrimitive<any>>>
  | NullableSchema<BasePrimitive<any>>
  | ObjectSchema<any>

function fromCompressedArray(arr: any[], schema: ObjectSchema<any>): any {
  const result: Record<string, any> = {}
  const shape = (schema as any).__$shape

  const keys = Object.keys(shape)

  keys.forEach((key, idx) => {
    const propSchema = shape[key]
    const raw = arr[idx]

    result[key] = propSchema instanceof ObjectSchema
      ? fromCompressedArray(raw, (propSchema as any).__$shape)
      : raw
  })

  return result
}

export default function sealJsonParser<T extends InputShape>(
  jsonArrayString: string,
  schema: T
): InferSchema<T> | null {
  const parsed = JSON.parse(jsonArrayString)

  if (!Array.isArray(parsed)) throw new Error("Input must be a JSON array string")

  if (!(schema instanceof ObjectSchema)) {
    if (seal.validate(schema, parsed).length) return null
    return parsed as any
  }

  const obj = fromCompressedArray(parsed, schema)
  if (seal.validate(schema, obj).length) return null

  return obj
}