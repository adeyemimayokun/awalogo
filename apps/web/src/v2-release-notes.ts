// V2 editorial content is separate from the V1 feeds.
import data from './v2-editorial.json';
import { logos } from './v2-brand-data';
import { flags } from './flags-data';
export const previewUpdates=data.updates.filter(row=>row.status==='published').map(row=>({...row,summary:row.summary.replaceAll('{companyCount}',String(logos.length)).replaceAll('{flagCount}',String(flags.length))}));
export const previewChangelog=data.changelog.filter(row=>row.status==='published');
