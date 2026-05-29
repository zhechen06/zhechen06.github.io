import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const directoriesToClean = ['public', 'out'];

function removeDsStoreFiles(directory) {
  const absoluteDirectory = path.join(root, directory);

  if (!fs.existsSync(absoluteDirectory)) {
    return;
  }

  const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(absoluteDirectory, entry.name);

    if (entry.isDirectory()) {
      removeDsStoreFiles(path.join(directory, entry.name));
    } else if (entry.name === '.DS_Store') {
      fs.rmSync(entryPath);
      console.log(`Removed ${path.relative(root, entryPath)}`);
    }
  }
}

directoriesToClean.forEach(removeDsStoreFiles);
