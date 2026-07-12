if (process.env.UNITBENCH_RELEASE_PARITY !== '1') {
  throw new Error('UNITBENCH_RELEASE_PARITY=1 is required; ordinary CI must remain hermetic.')
}
for (const name of ['WHETSTONE_RELEASE_PARITY_DESCRIPTOR', 'ANALYSIS_DATABASE_URL', 'DATABASE_URL']) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for the release parity consumer.`)
}
