import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit', env: process.env }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:client'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];
for (const child of children) child.on('exit', code => {
  if (code && !children.some(other => other.exitCode === null)) process.exitCode = code;
});
function stop() { for (const child of children) child.kill(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
