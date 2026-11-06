import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
GlobalFonts.registerFromPath('node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-700-normal.woff', 'Be Vietnam Pro');
GlobalFonts.registerFromPath('node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-700-normal.woff', 'Be Vietnam Pro');
const cv = createCanvas(10, 10); const ctx = cv.getContext('2d');
for (const s of ['Mèo', 'Kỹ Năng', 'Cường Hóa', 'Bộ Sưu Tập', 'Cài Đặt', 'Cats', 'Skills', 'Upgrades', 'Collection', 'Settings']) {
  for (const size of [9, 9.5, 10]) {
    ctx.font = `700 ${size}px "Be Vietnam Pro"`;
    console.log(s.padEnd(12), size, Math.ceil(ctx.measureText(s).width));
  }
}
