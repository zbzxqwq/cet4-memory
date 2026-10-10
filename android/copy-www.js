/* 把上级目录里的网页版复制到 www/，供 Capacitor 打包 */
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..');
const dst = path.resolve(__dirname, 'www');

const files = [
  'index.html', 'app.js', 'words.js', 'manifest.json', 'sw.js',
  'icon-192.png', 'icon-512.png', 'favicon.png'
];

fs.mkdirSync(dst, { recursive: true });
let n = 0;
for (const f of files) {
  const from = path.join(src, f);
  if (!fs.existsSync(from)) { console.warn('  缺少 ' + f + '，跳过'); continue; }
  fs.copyFileSync(from, path.join(dst, f));
  n++;
}
console.log('已复制 ' + n + ' 个文件到 ' + dst);
