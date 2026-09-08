const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const weights = { Thin: 100, Light: 300, Text: 400, Medium: 500, SemiBold: 600, Bold: 700 };

const assertValidWoff2 = (font, name) => {
  assert.equal(font.toString("ascii", 0, 4), "wOF2", name);
  assert.equal(font.readUInt32BE(8), font.length, `${name} length`);
  assert.ok(font.readUInt16BE(12) > 0, `${name} has font tables`);
};

test("all six Sukhumvit webfonts are valid, compact WOFF2 assets with matching weights", () => {
  const layout = read("src/app/layout.tsx");
  let bytes = 0;
  for (const [face, weight] of Object.entries(weights)) {
    const name = `SukhumvitSet-${face}.woff2`;
    const font = fs.readFileSync(path.join(root, "public/fonts/sukhumvit", name));
    assertValidWoff2(font, name);
    assert.ok(layout.includes(`${name}\", weight: \"${weight}\"`), `${name} CSS weight`);
    bytes += font.length;
  }
  assert.ok(bytes < 200 * 1024, "total font payload stays under 200 KiB");
});

test("Inter is a licensed compact Latin variable webfont", () => {
  const layout = read("src/app/layout.tsx");
  const name = "Inter-Variable-Latin.woff2";
  const font = fs.readFileSync(path.join(root, "public/fonts/inter", name));
  const license = read("public/fonts/inter/OFL.txt");

  assertValidWoff2(font, name);
  assert.ok(font.length < 200 * 1024, "Inter Latin payload stays under 200 KiB");
  assert.ok(layout.includes(`src: \"../../public/fonts/inter/${name}\"`));
  assert.match(layout, /weight: "100 900"/);
  assert.match(layout, /prop: "unicode-range"/);
  assert.match(layout, /adjustFontFallback: false/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
});

test("Inter is global for Latin while Sukhumvit remains the Thai fallback", () => {
  const layout = read("src/app/layout.tsx");
  const css = read("src/app/globals.css");
  assert.match(layout, /from "next\/font\/local"/);
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /inter\.variable/);
  assert.match(layout, /sukhumvit\.variable/);
  assert.match(layout, /display: "swap"/);
  assert.match(layout, /preload: false/);
  for (const utility of ["sans", "mono", "serif"]) {
    assert.ok(css.includes(`--font-${utility}: var(--font-inter), var(--font-sukhumvit), sans-serif;`));
  }
});

test("login and attachment placeholders do not fall back to an explicit system font", () => {
  assert.doesNotMatch(read("src/app/login/page.tsx"), /fontFamily:/);
  const drawer = read("src/app/employees/components/EmployeeProfileDrawer.tsx");
  assert.ok(drawer.includes("/fonts/inter/Inter-Variable-Latin.woff2"));
  assert.ok(drawer.includes("/fonts/sukhumvit/SukhumvitSet-Text.woff2"));
  assert.ok(drawer.includes("font-family: 'Inter', 'Sukhumvit Set'"));
  assert.equal((drawer.match(/\$\{previewFontStyle\}/g) || []).length, 2);
  assert.doesNotMatch(read("src/components/ui/DigitalSignature.tsx"), /font-\[signature\]/);
});

test("primary navigation uses the bold font weight for every menu item", () => {
  const css = read("src/components/ui/PillNav.css");
  assert.match(css, /\.pill-nav \.nav-item\.pill\s*\{[^}]*font-weight:\s*700\s*;/);
  assert.doesNotMatch(css, /font-weight:\s*(?:[1-6]00|normal|lighter)\s*;/);
});
