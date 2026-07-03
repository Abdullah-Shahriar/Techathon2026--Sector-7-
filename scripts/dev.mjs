import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

const commands = [
  { name: "backend", args: ["run", "dev", "-w", "backend"] },
  { name: "frontend", args: ["run", "dev", "-w", "frontend"] }
];

const children = commands.map(({ name, args }) => {
  const child = spawn(npmCommand, args, {
    stdio: "inherit",
    shell: false,
    env: process.env
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited from signal ${signal}`);
      return;
    }

    if (code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
      stopAll();
    }
  });

  return child;
});

function stopAll() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
