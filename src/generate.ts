import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs';
import {
  capitalize,
  chunkArray,
  convertNumbersToWords,
  readFilesRecursively,
} from './generate.utils';

const chunkSize = 100;

async function getIconList(
  browser: Browser,
  variant?: 'outlined' | 'filled' | 'rounded' | 'sharp' | 'twotone'
): Promise<{ name: string; link: string }[]> {
  const page = await browser.newPage();

  await page.goto(
    variant
      ? `https://fonts.google.com/icons?icon.set=Material+Icons&icon.style=${
          variant == 'twotone' ? 'Two+tone' : capitalize(variant)
        }`
      : 'https://fonts.google.com/icons?icon.set=Material+Icons'
  );

  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1000);

  const iconList = await page.evaluate(() => {
    const spans = Array.from(
      document.querySelectorAll('span.icon-name.mat-caption')
    );

    return spans.map((span) => {
      const name = span.textContent?.trim() ?? '';

      span.parentElement?.click();

      const link =
        document
          .querySelector('a.side-nav-links__button--svg')
          ?.getAttribute('href') ?? '';

      return { name, link };
    });
  });

  return iconList.filter((icon) => !!icon.link && icon.name !== 'Addchart');
}

async function getIconsSVG(
  browser: Browser,
  iconNames: { name: string; link: string }[],
  variant: 'outlined' | 'filled' | 'rounded' | 'sharp' | 'twotone'
): Promise<{ name: string; content: string }[]> {
  const iconListChunks = chunkArray(iconNames, chunkSize);
  let svgData: { name: string; content: string }[] = [];
  let count = 1;

  for (const chunk of iconListChunks) {
    console.log(
      `Extracting ${variant} SVG ${
        count * chunkSize > iconNames.length
          ? iconNames.length
          : count * chunkSize
      } out of ${iconNames.length}`
    );
    const data = await Promise.all(
      chunk.map(async (icon) => {
        const newPage = await browser.newPage();
        await newPage.goto(encodeURI(icon.link), {
          waitUntil: 'domcontentloaded',
        });

        const svgElement = await newPage.waitForSelector('svg');

        const outerHTML = await newPage.evaluate(
          (element) => element?.outerHTML ?? 'No SVG',
          svgElement
        );

        newPage.close();

        return {
          name: convertNumbersToWords(icon.name),
          content: outerHTML ?? 'No SVG',
        };
      })
    );

    svgData = svgData.concat(data);
    count++;
  }

  return svgData.filter((data) => data.content !== 'No SVG');
}

async function svgToComponent(name: string, svg: string, folder: string) {
  const componentName = name.replace(/\s+/g, '');

  return fs.writeFileSync(
    `./icons/${folder}/${componentName}.tsx`,
    `
      import React, { SVGProps } from "react";

      const ${componentName}: React.FC<SVGProps<SVGSVGElement>> = (props) => {
        return ${svg
          .replace(
            /<svg[\s\S]*?>/g,
            '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" fill="currentColor" {...props} >'
          )
          .replace('fill-opacity', 'fillOpacity')
          .replace('enable-background', 'enableBackground')
          .replace('clip-path', 'clipPath')
          .replace('class', 'className')
          .replace(/xlink:href=".*?"/g, '')
          .replace(
            /style="([\w.-]+):\s*([^\s;]*)"/g,
            (x, y, z) =>
              `style={{${y.replace(/-(.)/g, (m, n) =>
                n.toUpperCase()
              )}: "${z}"}}`
          )}
      };

      export default ${componentName};
    `
  );
}

async function generateIconVariant(
  variant: 'outlined' | 'filled' | 'rounded' | 'sharp' | 'twotone',
  iconList?: { name: string; link: string }[]
) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

  try {
    if (!iconList) {
      iconList = await getIconList(browser, variant);
    }

    const iconSVGs = await getIconsSVG(browser, iconList, variant);

    let count = 1;

    for (const svg of iconSVGs) {
      console.log(`Saving ${variant} SVG ${count} out of ${iconSVGs.length}`);

      await svgToComponent(`${svg.name}`, svg.content, `${variant}`);

      count++;
    }
  } catch (error) {
    console.error(`Failed to generate ${variant} variants`, error);
  } finally {
    await browser.close();
  }
}

async function generateIndexFile(
  files: { name: string; path: string }[],
  destinationPath: string
) {
  return fs.promises.writeFile(
    destinationPath,
    `${files
      .map((file) => `import ${file.name} from '${file.path}';\n`)
      .join('')}\nexport {\n${files.map((file) => `${file.name},\n`).join('')}}
    `
  );
}

async function main() {
  // CREATE icons FOLDER
  [
    './icons',
    './icons/outlined',
    './icons/rounded',
    './icons/sharp',
    './icons/filled',
    './icons/twotone',
  ].forEach((folder) => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }
  });

  // GENERATE ICON COMPONENTS
  await generateIconVariant('outlined');
  await generateIconVariant('rounded');
  await generateIconVariant('sharp');
  await generateIconVariant('filled');
  await generateIconVariant('twotone');

  // GENERATE index.ts
  const variants = ['rounded', 'sharp', 'outlined', 'filled', 'twotone'];

  for (const variant of variants) {
    const files = readFilesRecursively(`./icons/${variant}`, '.tsx');
    await generateIndexFile(
      files.map((path) => {
        return {
          path: `./${path.split('/').at(-1)?.split('.')[0] ?? ''}`,
          name: path.split('/').at(-1)?.split('.')[0] ?? '',
        };
      }),
      `./icons/${variant}/index.ts`
    );
  }
}

main();
