import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { execSync } from 'child_process'

const repoRoot = resolve(new URL('../..', import.meta.url).pathname)
const sandbox = mkdtempSync(join(tmpdir(), 'ocex-pack-smoke-'))

try {
  const packedRaw = execSync('npm pack --json --silent', {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim()

  const packed = JSON.parse(packedRaw)
  const packedName = Array.isArray(packed) ? packed[0]?.filename : null
  if (!packedName) {
    throw new Error('npm pack did not return a tarball filename')
  }

  const tarball = join(repoRoot, packedName)
  const probeDir = join(sandbox, 'probe')
  execSync('mkdir -p probe', { cwd: sandbox })

  writeFileSync(join(probeDir, 'package.json'), JSON.stringify({
    name: 'ocex-pack-smoke-probe',
    private: true,
    type: 'module'
  }, null, 2))

  execSync(`npm install --silent "${tarball}"`, { cwd: probeDir, stdio: 'inherit' })

  execSync(
    `node -e "import('@isupervillain/opencode-container-exec/plugin/index.js').then(async (m) => { const fn = m.ContainerExecPlugin || m.default; if (typeof fn !== 'function') throw new Error('Plugin export missing'); const hooks = await fn({ project: {}, client: {}, $: () => ({ text: () => Promise.resolve('') }), directory: '/tmp', worktree: '/tmp' }); if (!hooks?.tool?.container || !hooks?.tool?.bash) throw new Error('Plugin hooks missing required tools'); console.log('pack-smoke-ok'); }).catch((err) => { console.error(err); process.exit(1); })"`,
    { cwd: probeDir, stdio: 'inherit' }
  )

  // Keep npm pack side-effect clean for working tree checks.
  execSync(`rm -f "${tarball}"`, { stdio: 'inherit' })
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}
