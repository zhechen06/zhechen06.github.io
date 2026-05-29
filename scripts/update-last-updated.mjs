import fs from 'node:fs';
import path from 'node:path';

const timezone = 'Asia/Hong_Kong';
const root = process.cwd();

const date = new Date();
const englishDate = new Intl.DateTimeFormat('en-US', {
  timeZone: timezone,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(date);
const chineseDate = new Intl.DateTimeFormat('zh-Hans-CN', {
  timeZone: timezone,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(date);

const updates = [
  ['content/config.toml', englishDate],
  ['content_zh/config.toml', chineseDate],
];

function updateLastUpdated(relativePath, value) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const lastUpdatedPattern = /^last_updated\s*=\s*".*"$/m;
  if (!lastUpdatedPattern.test(original)) {
    throw new Error(`Could not find last_updated in ${relativePath}`);
  }

  const updated = original.replace(
    lastUpdatedPattern,
    `last_updated = "${value}"`
  );

  fs.writeFileSync(filePath, updated);
  return true;
}

for (const [relativePath, value] of updates) {
  if (updateLastUpdated(relativePath, value)) {
    console.log(`Updated ${relativePath} last_updated to ${value}`);
  }
}
