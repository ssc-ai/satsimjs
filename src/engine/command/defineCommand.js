function defaultResolve() {
  return undefined
}

function defaultNormalize(command) {
  return { ...command }
}

function defaultValidate() {}

export default function defineCommand({
  type,
  aliases = [],
  schema,
  normalize = defaultNormalize,
  resolve = defaultResolve,
  validate = defaultValidate,
  execute
}) {
  return {
    type,
    aliases,
    schema,
    normalize,
    resolve,
    validate,
    execute
  }
}
