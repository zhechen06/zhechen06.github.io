const majorVersion = Number.parseInt(process.versions.node.split('.')[0] || '', 10);

if (!Number.isFinite(majorVersion) || majorVersion < 22 || majorVersion >= 26) {
  console.error(
    `Unsupported Node.js ${process.version}. Use Node.js 22, 23, 24, or 25 for this Next.js build.`
  );
  process.exit(1);
}
