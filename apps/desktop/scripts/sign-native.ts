const id = process.env.ELECTROBUN_DEVELOPER_ID
if (!id) {
	console.error('ELECTROBUN_DEVELOPER_ID not set')
	process.exit(1)
}
const r = Bun.spawnSync(
	['codesign', '--force', '--options', 'runtime', '--timestamp', '--sign', id, 'src/bun/native/biometric-helper'],
	{ stdout: 'inherit', stderr: 'inherit' },
)
process.exit(r.exitCode ?? 1)