const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.goto('http://localhost:8777/render.html');
  await p.waitForFunction('window.ready===true', null, { timeout: 300000 });
  const shots = {
    central: [[60, 30, -150], [0, 60, -400], 70],
    mongkok: [[-180, 10, -235], [100, 14, -235], 65],
    temple: [[-170, 12, 180], [-300, 6, 180], 65],
    estate: [[315, 15, 110], [315, 30, 220], 75],
    harbour: [[0, 25, 470], [0, 60, 980], 60],
    aerea: [[300, 420, 200], [-50, 0, -250], 60],
  };
  for (const [n, [pos, look, fov]] of Object.entries(shots)) {
    await p.evaluate(([a, c, f]) => window.shot(a, c, f), [pos, look, fov]);
    await p.screenshot({ path: `hk_${n}.png` });
  }
  await b.close();
})();
