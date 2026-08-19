import assert from 'node:assert/strict';

import {
  formatBibTeXPersonName,
  parsePublicationAuthors,
  personNameKey,
  splitBibTeXNames,
} from '../src/lib/bibtexNames.ts';
import {
  PUBLICATION_BIBTEX_EXPORT_EXCLUDED_FIELDS,
  reconstructBibTeX,
} from '../src/lib/bibtexExport.ts';
import { isPublicationHidden, isTruthyBibTeXFlag } from '../src/lib/bibtexVisibility.ts';

assert.deepEqual(splitBibTeXNames('Chen, Zhe and Di Gangi, Alessandra'), [
  'Chen, Zhe',
  'Di Gangi, Alessandra',
]);
assert.equal(formatBibTeXPersonName('Di Gangi, Alessandra'), 'Alessandra Di Gangi');
assert.equal(formatBibTeXPersonName('So, P. M.'), 'P. M. So');
assert.equal(personNameKey('Chen, Zhe'), personNameKey('Zhe Chen'));

const authors = parsePublicationAuthors(
  'Chen, Yongbao and Chen, Zhe and So, P. M.',
  'Chen, Yongbao and Chen, Zhe',
  ['Zhe Chen', 'Chen Zhe'],
);

assert.deepEqual(authors, [
  { name: 'Yongbao Chen', isHighlighted: false, isCorresponding: true },
  { name: 'Zhe Chen', isHighlighted: true, isCorresponding: true },
  { name: 'P. M. So', isHighlighted: false, isCorresponding: false },
]);

const exported = reconstructBibTeX(
  {
    entryType: 'article',
    citationKey: 'chen2026example',
    entryTags: {
      title: 'An {AI} example',
      author: 'Chen, Zhe and Xiao, Fu',
      corresponding: 'Xiao, Fu',
      year: '2026',
      doi: '10.1234/example',
      accepted: '2026-01-01',
      preview: 'example.png',
      sci: 'Q1',
      sciif: '10.0',
      description: 'Site-only summary.',
      selected: 'true',
      hidden: 'true',
    },
  },
  PUBLICATION_BIBTEX_EXPORT_EXCLUDED_FIELDS,
);

assert.match(exported, /author = \{Chen, Zhe and Xiao, Fu\}/);
assert.match(exported, /title = \{An \{AI\} example\}/);
assert.doesNotMatch(exported, /corresponding|accepted|preview|sciif|description|selected|hidden/);

assert.equal(isTruthyBibTeXFlag('YES'), true);
assert.equal(isPublicationHidden({ hidden: 'true' }), true);
assert.equal(isPublicationHidden({ hidden: 'false' }), false);

console.log('BibTeX name parser tests passed.');
